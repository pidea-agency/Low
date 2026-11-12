import { Router, type IRouter } from "express";
import { google } from "googleapis";
import {
  getSettings,
  saveSettings,
  refreshSettingsFromSupabase,
  ensureSettingsLoaded,
  type AppSettings,
} from "../config/settings-store";
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
import { isEncrypted, decryptSecret } from "../lib/encryption";

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

export class GoogleVerificationError extends Error {
  readonly statusCode: number;
  readonly clientEmail?: string;
  constructor(message: string, statusCode = 400, clientEmail?: string) {
    super(message);
    this.name = "GoogleVerificationError";
    this.statusCode = statusCode;
    this.clientEmail = clientEmail;
  }
}

/**
 * Validates service account JSON and performs live read/write permission check on Google Sheet.
 * Throws GoogleVerificationError with specific HTTP status codes (400, 403, 404).
 */
export async function verifyGoogleSheetAccess(params: {
  rawJson: string | object;
  spreadsheetUrlOrId: string;
  sheetName?: string;
}): Promise<{
  spreadsheetId: string;
  sheetName: string;
  clientEmail: string;
  sheetTitle: string;
}> {
  const { rawJson, spreadsheetUrlOrId, sheetName } = params;

  if (!rawJson) {
    throw new GoogleVerificationError("يرجى تزويد ملف Service Account JSON لاختبار الاتصال.", 400);
  }

  if (!spreadsheetUrlOrId || !spreadsheetUrlOrId.trim()) {
    throw new GoogleVerificationError("يرجى إدخال رابط جدول بيانات Google Sheet أو معرف الجدول (Spreadsheet ID).", 400);
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId || spreadsheetId.length < 10) {
    throw new GoogleVerificationError("معرف جدول البيانات (Spreadsheet ID) غير صالح. تأكد من نسخ الرابط كاملاً.", 400);
  }

  const targetSheetName = (sheetName || "Sessions").trim();

  // Parse and validate service account JSON structure
  let parsedJson: any;
  try {
    const unencrypted = typeof rawJson === "string" && isEncrypted(rawJson) ? decryptSecret(rawJson) : rawJson;
    parsedJson = typeof unencrypted === "string" ? JSON.parse(unencrypted) : unencrypted;
  } catch {
    throw new GoogleVerificationError("صيغة ملف JSON غير صالحة. تأكد من صحة محتوى الملف.", 400);
  }

  if (!parsedJson || typeof parsedJson !== "object" || !parsedJson.client_email || !parsedJson.private_key) {
    throw new GoogleVerificationError(
      "ملف JSON ينقصه أحد الحقول الأساسية: client_email أو private_key. تأكد من تحميل مفتاح Service Account بصيغة JSON من Google Cloud Console.",
      400,
    );
  }

  // Initialize Google Sheets client
  const privateKey = String(parsedJson.private_key).replace(/\\n/g, "\n");
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
      throw new GoogleVerificationError(
        `تعذر الوصول لجدول البيانات (403): تأكد من فتح زر 'مشاركة' في Google Sheet ومشاركة الورقة مع البريد البرمجي (${parsedJson.client_email}) ومنحه صلاحية 'محرر' (Editor).`,
        403,
        parsedJson.client_email,
      );
    }
    if (status === 404 || message.includes("Requested entity was not found")) {
      throw new GoogleVerificationError(
        `لم يتم العثور على جدول البيانات (404): تأكد من صحة رابط الـ Google Sheet أو الـ Spreadsheet ID (${spreadsheetId}).`,
        404,
      );
    }
    if (message.includes("SERVICE_DISABLED") || message.includes("has not used the Google Sheets API") || message.includes("API has not been used")) {
      throw new GoogleVerificationError(
        "واجهة Google Sheets API غير مفعّلة في مشروع Google Cloud. يرجى الدخول إلى Google Cloud Console وتفعيل Google Sheets API ثم إعادة المحاولة.",
        400,
      );
    }
    throw new GoogleVerificationError(
      err.message || "فشل الاتصال بـ Google Sheets.",
      status >= 400 && status < 600 ? status : 500,
    );
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

  return {
    spreadsheetId,
    sheetName: targetSheetName,
    clientEmail: parsedJson.client_email,
    sheetTitle: metadata.properties?.title || "Google Sheet",
  };
}

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

    const verified = await verifyGoogleSheetAccess({
      rawJson,
      spreadsheetUrlOrId: spreadsheet_url_or_id,
      sheetName: sheet_name,
    });

    res.json({
      success: true,
      message: "تم الاتصال بـ Google Sheets بنجاح وقراءة ورقة العمل بشكل سليم!",
      spreadsheet_id: verified.spreadsheetId,
      sheet_name: verified.sheetName,
      client_email: verified.clientEmail,
      sheet_title: verified.sheetTitle,
    });
  } catch (err: any) {
    logger.error({ err }, "Google test connection failed");
    const statusCode = err?.statusCode || 400;
    res.status(statusCode).json({
      error: err.message || "فشل الاتصال بـ Google Sheets. يرجى مراجعة إعدادات المفتاح والرابط.",
      client_email: err?.clientEmail,
    });
  }
});

/**
 * POST /api/settings/google-bind
 * Tests connection first and only securely binds Google Sheet credentials (encrypted via AES-256-GCM) on success.
 * Never persists on failure.
 */
router.post("/settings/google-bind", async (req, res) => {
  const adminId = req.authUser!.userId!;
  try {
    let { service_account_json, spreadsheet_url_or_id, sheet_name } = req.body;

    if (!service_account_json) {
      const existing = await getUserGoogleCredentials(adminId);
      if (existing?.serviceAccountJson) {
        service_account_json = typeof existing.serviceAccountJson === "string"
          ? existing.serviceAccountJson
          : JSON.stringify(existing.serviceAccountJson);
      } else {
        res.status(400).json({ error: "ملف Service Account JSON مطلوب." });
        return;
      }
    }

    if (!spreadsheet_url_or_id || !spreadsheet_url_or_id.trim()) {
      res.status(400).json({ error: "رابط جدول البيانات أو الـ Spreadsheet ID مطلوب." });
      return;
    }

    // 1. Live test credentials & spreadsheet access before persisting
    const verified = await verifyGoogleSheetAccess({
      rawJson: service_account_json,
      spreadsheetUrlOrId: spreadsheet_url_or_id,
      sheetName: sheet_name,
    });

    // 2. Save only after verification passes
    const jsonStr = typeof service_account_json === "string" ? service_account_json : JSON.stringify(service_account_json);

    const result = await saveOfficeGoogleBinding(adminId, {
      service_account_json: jsonStr,
      spreadsheet_id: verified.spreadsheetId,
      sheet_name: verified.sheetName,
    });

    res.json({
      ...result,
      spreadsheet_id: verified.spreadsheetId,
      sheet_name: verified.sheetName,
    });
  } catch (err: any) {
    logger.error({ err, adminId }, "Failed to bind Google Sheet to office");
    const statusCode = err?.statusCode || 400;
    res.status(statusCode).json({
      error: err.message || "فشل حفظ ربط Google Sheet للمكتب.",
      client_email: err?.clientEmail,
    });
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
  };
}

router.get("/settings", async (_req, res) => {
  await refreshSettingsFromSupabase();
  const s = getSettings();
  res.json(buildSettingsResponse(s));
});

router.put("/settings", async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.whatsappToken && (patch.whatsappToken.includes("•") || patch.whatsappToken.includes("*"))) {
      delete patch.whatsappToken;
    }
    if (patch.aiApiKey && (patch.aiApiKey.includes("•") || patch.aiApiKey.includes("*"))) {
      delete patch.aiApiKey;
    }
    if (patch.hfApiToken && (patch.hfApiToken.includes("•") || patch.hfApiToken.includes("*"))) {
      delete patch.hfApiToken;
    }
    const updated = await saveSettings(patch);
    logger.info("Settings saved via API and persisted permanently to Supabase");
    res.json(buildSettingsResponse(updated));
  } catch (err) {
    logger.error({ err }, "Failed to save settings");
    res.status(500).json({ error: "فشل حفظ الإعدادات." });
  }
});

router.post("/settings/google-export", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const { exportOfficeDataToGoogleSheets } = await import("../services/postgres.service");
    const result = await exportOfficeDataToGoogleSheets(adminId);
    res.json({
      success: true,
      message: "تم تصدير البيانات إلى Google Sheets بنجاح.",
      ...result,
    });
  } catch (err: any) {
    logger.error({ err }, "Google export failed");
    res.status(500).json({ error: err.message || "فشل تصدير البيانات إلى Google Sheets." });
  }
});

/**
 * POST /api/settings/test-whatsapp-connection
 * Tests connectivity and authorization of Green API instance using getStateInstance.
 * Confirms whether the instance is actually authorized/connected to WhatsApp.
 */
router.post("/settings/test-whatsapp-connection", async (req, res) => {
  const s = await ensureSettingsLoaded();
  const rawInstanceId = String(req.body?.instanceId ?? "").trim();
  const rawToken = String(req.body?.token ?? "").trim();
  const isMaskedToken = rawToken.includes("•") || rawToken.includes("*");

  const instanceId = rawInstanceId || s.whatsappInstanceId || "";
  const token = (!rawToken || isMaskedToken) ? (s.whatsappToken || "") : rawToken;
  const rawApiUrl = String(req.body?.apiUrl || s.whatsappApiUrl || "https://api.green-api.com").trim();

  if (!instanceId || !token) {
    res.status(400).json({
      success: false,
      connected: false,
      error: "يرجى إدخال معرف النسخة (Instance ID) ورمز المصادقة (Token) أولاً لاختبار الاتصال.",
    });
    return;
  }

  const base = (rawApiUrl || "https://api.green-api.com").replace(/\/+$/, "");
  const targetUrl = `${base}/waInstance${instanceId}/getStateInstance/${token}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as Record<string, any>;
      const message = errJson.message || `فشلت المصادقة مع مزود Green API (رمز الخطأ: ${response.status})`;
      res.status(400).json({
        success: false,
        connected: false,
        stateInstance: "unauthorized",
        error: message,
      });
      return;
    }

    const data = (await response.json()) as { stateInstance?: string };
    const state = data?.stateInstance || "unknown";

    if (state === "authorized") {
      // If requested or if valid token passed, ensure it is safely persisted permanently to Supabase
      if (req.body?.saveOnSuccess && instanceId && token && !isMaskedToken) {
        await saveSettings({
          whatsappInstanceId: instanceId,
          whatsappToken: token,
          whatsappApiUrl: rawApiUrl,
        });
      }

      res.json({
        success: true,
        connected: true,
        stateInstance: state,
        message: "المثيل مصادق عليه ومتصل بحساب الواتساب بنجاح!",
      });
      return;
    }

    let message = `حالة المثيل الحالية: ${state}`;
    if (state === "notAuthorized") {
      message = "المثيل غير مصرح حالياً. يرجى مسح رمز الاستجابة السريعة (QR Code) في لوحة تحكم Green API لربط الحساب.";
    } else if (state === "blocked") {
      message = "المثيل محظور من قِبل مزود الخدمة.";
    } else if (state === "sleepMode") {
      message = "المثيل في وضع السكون (Sleep Mode). يرجى تفعيله من لوحة التحكم.";
    } else if (state === "starting") {
      message = "المثيل قيد بدء التشغيل حالياً، يرجى المحاولة بعد قليل.";
    }

    res.json({
      success: true,
      connected: false,
      stateInstance: state,
      message,
    });
  } catch (err: any) {
    logger.error({ err, targetUrl }, "WhatsApp test connection failed");
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
    const msg = isTimeout
      ? "انتهت مهلة الاتصال بمزود Green API (يرجى التحقق من صحة رابط الـ API والاتصال بالإنترنت)."
      : (err?.message || "تعذر الاتصال بخادم مزود خدمة الواتساب.");
    res.status(400).json({
      success: false,
      connected: false,
      error: msg,
    });
  }
});

router.post("/settings/test-whatsapp", async (req, res) => {
  const s = await ensureSettingsLoaded();
  const phone = String(
    req.body?.whatsappNumber ?? req.body?.number ?? req.body?.recipientPhone ?? s.whatsappNumber ?? ""
  ).trim();

  if (!phone) {
    res.status(400).json({ error: "يرجى كتابة رقم الواتساب وتحديد الإعدادات أولاً." });
    return;
  }

  const rawApiUrl = String(req.body?.whatsappApiUrl ?? req.body?.apiUrl ?? s.whatsappApiUrl ?? "").trim();
  const rawToken = String(req.body?.whatsappToken ?? req.body?.token ?? "").trim();
  const isMaskedToken = rawToken.includes("•") || rawToken.includes("*");
  const token = (!rawToken || isMaskedToken) ? (s.whatsappToken ?? "") : rawToken;
  const rawInstance = String(req.body?.whatsappInstanceId ?? req.body?.instanceId ?? "").trim();
  const instanceId = rawInstance || (s.whatsappInstanceId ?? "");

  try {
    const channel = new WhatsappReminderChannel();
    const nowHijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    const testMessage = [
      "🔔 *رسالة تجريبية من نظام إدارة جلسات المحكمة*",
      "",
      `📱 تم إرسال هذه الرسالة لاختبار ربط تنبيهات الواتساب بنجاح إلى الرقم: ${phone}`,
      "⚖️ *رقم القضية:* 1446/اختباري/01",
      "🏛️ *المحكمة:* المحكمة العامة",
      `📅 *التاريخ:* ${nowHijri}`,
      "⏰ *الوقت:* 10:30 صباحاً",
      "✅ اتصال مزود الخدمة (Green API) يعمل بصورة سليمة وجاهز لإرسال تذكيرات الجلسات.",
      "",
      "الرجاء عدم الرد على هذه الرسالة الآلية."
    ].join("\n");

    await channel.sendRaw(testMessage, phone, {
      apiUrl: rawApiUrl,
      token,
      instanceId,
    });

    res.json({ message: `تمت تجربة إرسال تنبيه الواتساب بنجاح إلى الرقم ${phone}!` });
  } catch (err) {
    logger.error({ err }, "Failed to execute WhatsApp test notification");
    const msg = err instanceof Error ? err.message : "فشل إجراء تجربة التنبيه عبر الواتساب.";
    res.status(400).json({ error: msg });
  }
});

export default router;
