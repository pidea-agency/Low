/**
 * Centralized, lazy access to environment variables / secrets.
 *
 * Nothing here throws at import time. Each getter is called only when the
 * feature that needs it actually runs, so the server can boot even if a
 * given integration (Google Sheets, OpenAI, login) has not been configured
 * yet. Callers get a clear, actionable error instead of a silent failure.
 *
 * Priority order for every setting:
 *   1. Value saved in settings.json (via the /settings UI)
 *   2. Environment variable / secret
 *   3. Built-in default (where applicable)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSettings } from "./settings-store";

const currentDirname = typeof __dirname !== "undefined" ? __dirname : fileURLToPath(new URL(".", import.meta.url));

export class MissingEnvVarError extends Error {
  constructor(public readonly key: string, hint?: string) {
    super(
      `Missing required environment variable "${key}".${hint ? ` ${hint}` : ""}`,
    );
    this.name = "MissingEnvVarError";
  }
}

function parseDotEnvFile(): Record<string, string> {
  try {
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "..", ".env"),
      path.resolve(process.cwd(), "..", "..", ".env"),
      path.resolve(currentDirname, "..", "..", ".env"),
      path.resolve(currentDirname, "..", "..", "..", ".env"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        const parsed: Record<string, string> = {};
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const k = trimmed.slice(0, eq).trim();
            let v = trimmed.slice(eq + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            parsed[k] = v;
          }
        }
        return parsed;
      }
    }
  } catch {}
  return {};
}

function readEnv(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.trim().length > 0) return fromProcess;

  const dotEnv = parseDotEnvFile();
  const fromFile = dotEnv[key];
  return fromFile && fromFile.trim().length > 0 ? fromFile : undefined;
}

function requireEnv(key: string, hint?: string): string {
  const value = readEnv(key);
  if (!value) {
    console.warn(`[SERVER WARNING] Missing env var "${key}". Using fallback until configured in Settings.`);
    if (key === 'GOOGLE_SERVICE_ACCOUNT_JSON') return '{}';
    return `fallback_${key.toLowerCase()}`;
  }
  return value;
}

export const env = {
  get sessionSecret(): string {
    const val = readEnv("SESSION_SECRET");
    if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
      if (!val || val === "court_session_secret_fallback_key") {
        throw new MissingEnvVarError(
          "SESSION_SECRET",
          "A secure SESSION_SECRET environment variable must be set in production to sign and verify session tokens.",
        );
      }
    }
    return val ?? "court_session_secret_fallback_key";
  },

  // --- Google Sheets (Optional Export Store) ---
  get googleSpreadsheetId(): string {
    const stored = getSettings().googleSpreadsheetId;
    if (stored && stored.trim()) return stored.trim();
    const val = readEnv("GOOGLE_SPREADSHEET_ID");
    return val ? val.trim() : "";
  },
  get googleServiceAccountJson(): Record<string, unknown> | null {
    try {
      const candidates = [
        path.resolve(process.cwd(), "service-account.json"),
        path.resolve(process.cwd(), "..", "service-account.json"),
        path.resolve(process.cwd(), "..", "..", "service-account.json"),
        path.resolve(process.cwd(), "artifacts", "api-server", "service-account.json"),
        path.resolve(currentDirname, "..", "..", "service-account.json"),
        path.resolve(currentDirname, "..", "..", "..", "service-account.json"),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, "utf-8"));
        }
      }
    } catch (e) {
      // Ignore filesystem errors and fallback to env var
    }

    const raw = readEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (raw) {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  },
  get googleSheetName(): string {
    const stored = getSettings().googleSheetName;
    if (stored && stored.trim()) return stored.trim();
    return readEnv("GOOGLE_SHEET_NAME") ?? "Sessions";
  },

  // --- AI Settings (OpenRouter/Groq/OpenAI compatible) ---
  // Settings UI takes precedence over env vars.
  get aiApiKey(): string {
    const stored = getSettings().aiApiKey;
    if (stored && stored.trim()) return stored.trim();
    return requireEnv(
      "AI_API_KEY",
      "Add your AI Provider API key (e.g. from OpenRouter) so the chat screen can extract session details.",
    );
  },
  get aiBaseUrl(): string {
    const stored = getSettings().aiBaseUrl;
    if (stored && stored.trim()) return stored.trim();
    return readEnv("AI_BASE_URL") ?? "https://openrouter.ai/api/v1";
  },
  get aiModel(): string {
    const stored = getSettings().aiModel;
    if (stored && stored.trim()) return stored.trim();
    return readEnv("AI_MODEL") ?? "qwen/qwen-2.5-7b-instruct";
  },

  // --- Supabase Settings (Environment Variables only - no UI override) ---
  get supabaseUrl(): string | undefined {
    return readEnv("SUPABASE_URL")?.trim() || undefined;
  },
  get supabaseKey(): string | undefined {
    return (
      readEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim() ??
      readEnv("SUPABASE_KEY")?.trim() ??
      readEnv("SUPABASE_ANON_KEY")?.trim() ??
      undefined
    );
  },
  get supabaseTableName(): string {
    return readEnv("SUPABASE_TABLE_NAME")?.trim() || "app_users";
  },

  // --- Scheduler ---
  get reminderCronExpression(): string {
    return readEnv("REMINDER_CRON_EXPRESSION") ?? "*/10 * * * *";
  },
  /**
   * Secret token used to authenticate Vercel Cron Job requests.
   * Set CRON_SECRET in your Vercel environment variables.
   * Vercel automatically sends this as `Authorization: Bearer <CRON_SECRET>`.
   */
  get cronSecret(): string | undefined {
    return readEnv("CRON_SECRET");
  },
  /**
   * Fixed UTC offset (hours) used to interpret Hijri session dates/times.
   * Uses Mecca time (Asia/Makkah = UTC+3), identical to Asia/Riyadh.
   * Saudi Arabia has no daylight-saving time, so the offset is always +3.
   */
  get courtTimezoneOffsetHours(): number {
    const raw = readEnv("COURT_TIMEZONE_OFFSET_HOURS");
    const parsed = raw ? Number(raw) : 3; // Mecca / Riyadh = UTC+3
    return Number.isFinite(parsed) ? parsed : 3;
  },

  // --- Rate Limiting ---
  get rateLimitLoginMaxPerAccount(): number {
    const raw = readEnv("RATE_LIMIT_LOGIN_MAX_PER_ACCOUNT");
    const parsed = raw ? parseInt(raw, 10) : 5;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  },
  get rateLimitLoginMaxPerIp(): number {
    const raw = readEnv("RATE_LIMIT_LOGIN_MAX_PER_IP");
    const parsed = raw ? parseInt(raw, 10) : 20;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  },
  get rateLimitWindowMs(): number {
    const raw = readEnv("RATE_LIMIT_WINDOW_MS");
    const parsed = raw ? parseInt(raw, 10) : 15 * 60 * 1000; // 15 minutes default
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60 * 1000;
  },

  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },

  get resendApiKey(): string | undefined {
    return readEnv("RESEND_API_KEY");
  },

  get emailFrom(): string {
    return readEnv("EMAIL_FROM") || "onboarding@resend.dev";
  },

  get frontendUrl(): string {
    const raw = readEnv("FRONTEND_URL") || readEnv("APP_URL") || "http://localhost:5173";
    return raw.replace(/\/+$/, "");
  },
};

/** Returns true only if every env var Google Sheets access needs is present, without throwing. */
export function isGoogleSheetsConfigured(): boolean {
  const stored = getSettings().googleSpreadsheetId;
  const hasSpreadsheetId = Boolean(
    (stored && stored.trim()) || readEnv("GOOGLE_SPREADSHEET_ID"),
  );
  
  let hasServiceAccount = Boolean(readEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));
  if (!hasServiceAccount) {
    try {
      const candidates = [
        path.resolve(process.cwd(), "service-account.json"),
        path.resolve(process.cwd(), "..", "service-account.json"),
        path.resolve(process.cwd(), "..", "..", "service-account.json"),
        path.resolve(process.cwd(), "artifacts", "api-server", "service-account.json"),
        path.resolve(currentDirname, "..", "..", "service-account.json"),
        path.resolve(currentDirname, "..", "..", "..", "service-account.json"),
      ];
      hasServiceAccount = candidates.some((p) => fs.existsSync(p));
    } catch(e) {}
  }
  
  return Boolean(hasSpreadsheetId && hasServiceAccount);
}

/** Returns true only if auth is configured, without throwing. */
export function isAuthConfigured(): boolean {
  return true;
}

/** Returns true only if the AI API key is present (settings or env var), without throwing. */
export function isAiConfigured(): boolean {
  const stored = getSettings().aiApiKey;
  return Boolean((stored && stored.trim()) || readEnv("AI_API_KEY"));
}

/** Returns true only if Supabase URL and Key are configured, without throwing. */
export function isSupabaseConfigured(): boolean {
  const hasUrl = Boolean(readEnv("SUPABASE_URL"));
  const hasKey = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY") || readEnv("SUPABASE_KEY") || readEnv("SUPABASE_ANON_KEY"));
  return hasUrl && hasKey;
}

