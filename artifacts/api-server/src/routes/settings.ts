import { Router, type IRouter } from "express";
import { getSettings, saveSettings, type AppSettings } from "../config/settings-store";
import { attachAuthUser, requireAdmin } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";

const router: IRouter = Router();

type SettingsPatch = Partial<
  Pick<
    AppSettings,
    | "aiApiKey"
    | "aiModel"
    | "aiBaseUrl"
    | "googleSpreadsheetId"
    | "googleSheetName"
    | "hfApiToken"
    | "hfModel"
    | "whatsappNumber"
    | "whatsappApiUrl"
    | "whatsappToken"
    | "whatsappInstanceId"
    | "supabaseUrl"
    | "supabaseKey"
    | "supabaseTableName"
  >
>;

function parseBody(body: unknown): { ok: true; data: SettingsPatch } | { ok: false } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false };
  const b = body as Record<string, unknown>;
  const allowed = [
    "aiApiKey",
    "aiModel",
    "aiBaseUrl",
    "googleSpreadsheetId",
    "googleSheetName",
    "hfApiToken",
    "hfModel",
    "whatsappNumber",
    "whatsappApiUrl",
    "whatsappToken",
    "whatsappInstanceId",
    "supabaseUrl",
    "supabaseKey",
    "supabaseTableName",
  ] as const;
  const data: SettingsPatch = {};
  for (const key of allowed) {
    const val = b[key];
    if (val !== undefined) {
      if (typeof val !== "string") return { ok: false };
      (data as Record<string, string>)[key] = val;
    }
  }
  return { ok: true, data };
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

/**
 * GET /api/settings
 * Returns the current persisted settings (Admin only).
 */
router.get("/settings", attachAuthUser, requireAdmin, (_req, res) => {
  const s = getSettings();
  res.json(buildSettingsResponse(s));
});

/**
 * PUT /api/settings
 * Accepts a partial settings object and merges it with the persisted values (Admin only).
 */
router.put("/settings", attachAuthUser, requireAdmin, (req, res) => {
  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "Invalid settings payload." });
    return;
  }

  try {
    const updated = saveSettings(parsed.data);
    logger.info("Settings saved via API");
    res.json(buildSettingsResponse(updated));
  } catch (err) {
    logger.error({ err }, "Failed to save settings");
    res.status(500).json({ error: "فشل حفظ الإعدادات." });
  }
});

/**
 * POST /api/settings/test-whatsapp
 * Dispatches a test WhatsApp session reminder to verify configuration (Admin only).
 */
router.post("/settings/test-whatsapp", attachAuthUser, requireAdmin, async (_req, res) => {
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

/** Show first 6 chars + *** to prove it's set without leaking the value. */
function maskToken(token: string): string {
  if (token.length <= 6) return "***";
  return token.slice(0, 6) + "***";
}

export default router;
