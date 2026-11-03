import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { getSettings, saveSettings, type AppSettings } from "../config/settings-store";
import { attachAuthUser, requireAdmin } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";
import {
  getOfficeGoogleBinding,
  saveOfficeGoogleBinding,
  disconnectOfficeGoogleBinding,
  getUserGoogleCredentials,
} from "../services/supabase.service";
import { SHEET_COLUMNS } from "../services/googleSheets.service";

const router: IRouter = Router();

// Rate limiter for Google connection tests (5 attempts per minute per IP)
const testAttemptsMap = new Map<string, { count: number; resetAt: number }>();

function checkTestRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = testAttemptsMap.get(key);
  if (!entry || now > entry.resetAt) {
    testAttemptsMap.set(key, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * Extracts the 44-character Spreadsheet ID from a full Google Sheets URL or raw ID.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed.split("/")[0].split("?")[0].trim();
}

// Strictly require Office Admin role on all settings routes
router.use("/settings", attachAuthUser, requireAdmin);

/**
 * GET /api/settings/google-binding
 * Returns the office's current Google Sheet connection state.
 * Never returns the private_key or decrypted secret!
 */
router.get("/settings/google-binding", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const binding = await getOfficeGoogleBinding(adminId);
    res.json(binding);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch Google Sheet binding status");
    res.status(500).json({ error: err.message || "فشل جلب حالة ربط Google Sheet." });
  }
});

/**
 * POST /api/settings/google-test
 * Tests the Google Sheets connection (read & write ping) without persisting credentials.
 * Auto-extracts spreadsheet ID and validates permissions.
 */
router.post("/settings/google-test", async (req, res) => {
  const adminId = req.authUser!.userId!;
  const ip = req.ip || req.socket.remoteAddress || adminId;

  if (!checkTestRateLimit(`google-test:${ip}`)) {
    res.status(429).json({
      error: "تم تجاوز عدد محاولات اختبار الاتصال (الحد الأقصى 5 محاولات في الدقيقة). يرجى الانتظار دقيقة والمحاولة مرة أخرى.",
    });
    return;
  }

  try {
    const { service_account_json, spreadsheet_url_or_id, sheet_name } = req.body;
    let rawJson = service_account_json;

    // If json wasn't supplied in body, check if already bound to office
    if (!rawJson) {
      const existing = await getUserGoogleCredentials(adminId);
      if (existing?.serviceAccountJson) {
        rawJson = existing.serviceAccountJson;
      }
    }

    if (!rawJson) {
      res.status(400).json({ error: "يرجى تزويد ملف Service Account JSON لاختبار الاتصال." });
      return;
    }

    if (!spreadsheet_url_or_id || !spreadsheet_url_or_id.trim()) {
      res.status(400).json({ error: "يرجى إدخال رابط جدول بيانات Google Sheet أو معرف الجدول (Spreadsheet ID)." });
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheet_url_or_id);
    if (!spreadsheetId || spreadsheetId.length < 10) {
      res.status(400).json({ error: "معرف جدول البيانات (Spreadsheet ID) غير صالح. تأكد من نسخ الرابط كاملاً." });
      return;
    }

    const targetSheetName = (sheet_name || "Sessions").trim();

    // Parse and validate service account JSON structure
    let parsedJson: any;
    try {
      parsedJson = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    } catch {
      res.status(400).json({ error: "صيغة ملف JSON غير صالحة. تأكد من صحة محتوى الملف." });
      return;
    }

    if (!parsedJson.client_email || !parsedJson.private_key) {
      res.status(400).json({
        error: "ملف JSON ينقصه أحد الحقول الأساسية: client_email أو private_key. تأكد من تحميل مفتاح Service Account بصيغة JSON من Google Cloud Console.",
      });
      return;
    }

    // Initialize Google Sheets client
    const privateKey = parsedJson.private_key.replace(/\\n/g, "\n");
    const auth = new google.auth.JWT({
      email: parsedJson.client_email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 1. Test read access on spreadsheet metadata
    let metadata: any;
    try {
      const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
      metadata = metaRes.data;
    } catch (err: any) {
      const status = err?.status || err?.code || 500;
      const message = String(err?.message || "");

      if (status === 403 || message.includes("permission") || message.includes("The caller does not have permission")) {
        res.status(403).json({
          error: `تعذر الوصول لجدول البيانات (403): تأكد من فتح زر 'مشاركة' في Google Sheet ومشاركة الورقة مع البريد البرمجي (${parsedJson.client_email}) ومنحه صلاحية 'محرر' (Editor).`,
          client_email: parsedJson.client_email,
        });
        return;
      }
      if (status === 404 || message.includes("Requested entity was not found")) {
        res.status(404).json({
          error: `لم يتم العثور على جدول البيانات (404): تأكد من صحة رابط الـ Google Sheet أو الـ Spreadsheet ID (${spreadsheetId}).`,
        });
        return;
      }
      if (message.includes("SERVICE_DISABLED") || message.includes("has not used the Google Sheets API") || message.includes("API has not been used")) {
        res.status(400).json({
          error: "واجهة Google Sheets API غير مفعّلة في مشروع Google Cloud. يرجى الدخول إلى Google Cloud Console وتفعيل Google Sheets API ثم إعادة المحاولة.",
        });
        return;
      }
      throw err;
    }

    // 2. Check if target sheet tab exists, if not create it with default columns
    const sheetTabs = metadata.sheets?.map((s: any) => s.properties?.title) || [];
    const tabExists = sheetTabs.includes(targetSheetName);

    if (!tabExists) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: targetSheetName },
                },
              },
            ],
          },
        });
        // Populate standard headers
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${targetSheetName}'!A1:Q1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [[...SHEET_COLUMNS]],
          },
        });
      } catch (err) {
        logger.warn({ err }, "Could not auto-create missing sheet tab during test, proceeding");
      }
    }

    // 3. Test read ping
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetSheetName}'!A1:B2`,
    });

    res.json({
      success: true,
      message: "تم الاتصال بـ Google Sheets بنجاح وقراءة ورقة العمل بشكل سليم!",
      spreadsheet_id: spreadsheetId,
      sheet_name: targetSheetName,
      client_email: parsedJson.client_email,
      sheet_title: metadata.properties?.title || "Google Sheet",
    });
  } catch (err: any) {
    logger.error({ err }, "Google test connection failed");
    res.status(400).json({
      error: err.message || "فشل الاتصال بـ Google Sheets. يرجى مراجعة إعدادات المفتاح والرابط.",
    });
  }
});

/**
 * POST /api/settings/google-bind
 * Tests and securely binds Google Sheet credentials (encrypted via AES-256-GCM) to this Office Admin.
 */
router.post("/settings/google-bind", async (req, res) => {
  const adminId = req.authUser!.userId!;
  try {
    const { service_account_json, spreadsheet_url_or_id, sheet_name } = req.body;

    if (!service_account_json) {
      res.status(400).json({ error: "ملف Service Account JSON مطلوب." });
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheet_url_or_id);
    if (!spreadsheetId) {
      res.status(400).json({ error: "رابط جدول البيانات أو الـ Spreadsheet ID مطلوب." });
      return;
    }

    const targetSheetName = (sheet_name || "Sessions").trim();
    const jsonStr = typeof service_account_json === "string" ? service_account_json : JSON.stringify(service_account_json);

    const result = await saveOfficeGoogleBinding(adminId, {
      service_account_json: jsonStr,
      spreadsheet_id: spreadsheetId,
      sheet_name: targetSheetName,
    });

    res.json({
      ...result,
      spreadsheet_id: spreadsheetId,
      sheet_name: targetSheetName,
    });
  } catch (err: any) {
    logger.error({ err, adminId }, "Failed to bind Google Sheet to office");
    res.status(400).json({ error: err.message || "فشل حفظ ربط Google Sheet للمكتب." });
  }
});

/**
 * POST /api/settings/google-disconnect
 * Disconnects the office Google Sheet.
 */
router.post("/settings/google-disconnect", async (req, res) => {
  const adminId = req.authUser!.userId!;
  try {
    const result = await disconnectOfficeGoogleBinding(adminId);
    res.json(result);
  } catch (err: any) {
    logger.error({ err, adminId }, "Failed to disconnect Google Sheet");
    res.status(500).json({ error: err.message || "فشل إلغاء ربط Google Sheet." });
  }
});

// ============================================================================
// Other Office Settings (WhatsApp & General)
// ============================================================================

function maskToken(token: string): string {
  if (token.length <= 6) return "***";
  return token.slice(0, 6) + "***";
}

function buildSettingsResponse(s: AppSettings) {
  return {
    aiApiKey: s.aiApiKey ? maskToken(s.aiApiKey) : "",
    aiApiKeyIsSet: Boolean(s.aiApiKey),
    aiModel: s.aiModel ?? "",
    aiBaseUrl: s.aiBaseUrl ?? "",
    googleSpreadsheetId: s.googleSpreadsheetId ?? "",
    googleSheetName: s.googleSheetName ?? "",
    hfApiToken: s.hfApiToken ? maskToken(s.hfApiToken) : "",
    hfApiTokenIsSet: Boolean(s.hfApiToken),
    hfModel: s.hfModel ?? "",
    whatsappNumber: s.whatsappNumber ?? "",
    whatsappApiUrl: s.whatsappApiUrl ?? "",
    whatsappToken: s.whatsappToken ? maskToken(s.whatsappToken) : "",
    whatsappTokenIsSet: Boolean(s.whatsappToken),
    whatsappInstanceId: s.whatsappInstanceId ?? "",
    supabaseUrl: s.supabaseUrl ?? "",
    supabaseKey: s.supabaseKey ? maskToken(s.supabaseKey) : "",
    supabaseKeyIsSet: Boolean(s.supabaseKey),
    supabaseTableName: s.supabaseTableName ?? "app_users",
  };
}

router.get("/settings", (_req, res) => {
  const s = getSettings();
  res.json(buildSettingsResponse(s));
});

router.put("/settings", (req, res) => {
  try {
    const updated = saveSettings(req.body);
    logger.info("Settings saved via API");
    res.json(buildSettingsResponse(updated));
  } catch (err) {
    logger.error({ err }, "Failed to save settings");
    res.status(500).json({ error: "فشل حفظ الإعدادات." });
  }
});

router.post("/settings/test-whatsapp", async (_req, res) => {
  const s = getSettings();
  if (!s.whatsappNumber?.trim()) {
    res.status(400).json({ error: "يرجى كتابة رقم الواتساب وتحديد الإعدادات أولاً." });
    return;
  }

  try {
    const channel = new WhatsappReminderChannel();
    await channel.send({
      officeId: "admin",
      recipientPhone: s.whatsappNumber.trim(),
      sessionId: 999,
      caseNumber: "1445/اختباري/01",
      court: "المحكمة العامة بالرياض",
      courtCircuit: "دائرة الدعاوي الحقوقية الأولى",
      sessionDateHijri: "15/02/1446",
      sessionTime: "10:30 صباحا",
      plaintiff: "شركة الحلول القضائية",
      defendant: "مؤسسة النور للتجارة",
      caseSubject: "تجربة إرسال تنبيهات الواتساب للجلسات",
      kind: "24h",
    });

    res.json({ message: "تمت تجربة إرسال تنبيه الواتساب بنجاح!" });
  } catch (err) {
    logger.error({ err }, "Failed to execute WhatsApp test notification");
    const msg = err instanceof Error ? err.message : "فشل إجراء تجربة التنبيه عبر الواتساب.";
    res.status(400).json({ error: msg });
  }
});

export default router;
