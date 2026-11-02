/**
 * settings-store.ts
 *
 * A lightweight, file-backed store for user-configurable runtime settings.
 * Values here take precedence over environment variables so that staff can
 * update API keys and spreadsheet IDs through the /settings UI without
 * restarting the server.
 *
 * The file is stored at <cwd>/settings.json (next to the process working dir).
 * On first boot it is created as an empty object; missing keys fall through to
 * process.env as a fallback.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger";

const currentDirname = typeof __dirname !== "undefined" ? __dirname : fileURLToPath(new URL(".", import.meta.url));

export interface AppSettings {
  /** AI Provider API key (e.g. OpenRouter, OpenAI, Groq) */
  aiApiKey?: string;
  /** AI Provider Base URL */
  aiBaseUrl?: string;
  /** AI Model identifier */
  aiModel?: string;
  /** Google Spreadsheet ID (from the Sheet URL) */
  googleSpreadsheetId?: string;
  /** Tab/sheet name inside the spreadsheet (defaults to "Sessions") */
  googleSheetName?: string;
  /** Hugging Face API Token */
  hfApiToken?: string;
  /** Hugging Face Model */
  hfModel?: string;
  /** WhatsApp Phone Number to receive reminders */
  whatsappNumber?: string;
  /** Optional WhatsApp API Gateway URL (base URL) */
  whatsappApiUrl?: string;
  /** Optional WhatsApp API Token/Key */
  whatsappToken?: string;
  /** Green API Instance ID (e.g. 7107XXXXXXXXX) */
  whatsappInstanceId?: string;
  /** Supabase Project URL */
  supabaseUrl?: string;
  /** Supabase Service Role Key or Anon Key */
  supabaseKey?: string;
  /** Supabase Table Name for Users (defaults to "app_users") */
  supabaseTableName?: string;
}

/**
 * On Vercel, the filesystem is read-only except for /tmp.
 * Priority order: in-memory _cache > /tmp/settings.json > process.env
 */
const TMP_SETTINGS_PATH = resolve("/tmp", "settings.json");
const LOCAL_SETTINGS_PATH = resolve(process.cwd(), "settings.json");
const ALT_SETTINGS_PATH = resolve(process.cwd(), "artifacts", "api-server", "settings.json");

function loadFromDisk(): AppSettings {
  const pathsToTry = [
    LOCAL_SETTINGS_PATH,
    ALT_SETTINGS_PATH,
    resolve(currentDirname, "..", "..", "settings.json"),
    resolve(currentDirname, "..", "..", "..", "settings.json"),
    TMP_SETTINGS_PATH,
  ];
  let result: AppSettings = {};
  for (const p of pathsToTry) {
    try {
      if (existsSync(p)) {
        const raw = readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw) as AppSettings;
        if (parsed && typeof parsed === "object") {
          // Merge so any non-empty setting from any path is preserved
          result = { ...parsed, ...result };
        }
      }
    } catch {
      // ignore & try next path
    }
  }
  return result;
}

function saveToDisk(settings: AppSettings): void {
  const content = JSON.stringify(settings, null, 2);
  // Try /tmp first (always writable on Vercel)
  try {
    writeFileSync(TMP_SETTINGS_PATH, content, "utf-8");
    return;
  } catch {
    // /tmp failed, try local path
  }
  try {
    writeFileSync(LOCAL_SETTINGS_PATH, content, "utf-8");
  } catch (err) {
    logger.warn({ err }, "Failed to persist settings.json to any path");
  }
}

// In-memory cache — loaded once at module init, updated on every save.
let _cache: AppSettings = loadFromDisk();

/**
 * Return the current settings.
 * Priority: in-memory _cache > /tmp disk > process.env
 */
export function getSettings(): AppSettings {
  // Re-read disk every time to pick up saves from other requests in the same
  // Vercel invocation that may have written to /tmp.
  const disk = loadFromDisk();
  const merged = { ...disk, ..._cache };

  return {
    hfApiToken:          merged.hfApiToken          || process.env.HF_API_TOKEN          || process.env.HF_TOKEN             || undefined,
    hfModel:             merged.hfModel              || process.env.HF_MODEL               || undefined,
    whatsappNumber:      merged.whatsappNumber       || process.env.WHATSAPP_NUMBER        || undefined,
    whatsappApiUrl:      merged.whatsappApiUrl       || process.env.WHATSAPP_API_URL       || undefined,
    whatsappToken:       merged.whatsappToken        || process.env.WHATSAPP_TOKEN         || undefined,
    whatsappInstanceId:  merged.whatsappInstanceId   || process.env.WHATSAPP_INSTANCE_ID   || undefined,
    aiApiKey:            merged.aiApiKey             || process.env.AI_API_KEY             || process.env.OPENAI_API_KEY      || undefined,
    aiBaseUrl:           merged.aiBaseUrl            || process.env.AI_BASE_URL            || undefined,
    aiModel:             merged.aiModel              || process.env.AI_MODEL               || undefined,
    googleSpreadsheetId: merged.googleSpreadsheetId  || process.env.GOOGLE_SPREADSHEET_ID  || undefined,
    googleSheetName:     merged.googleSheetName      || process.env.GOOGLE_SHEET_NAME      || undefined,
    supabaseUrl:         merged.supabaseUrl          || process.env.SUPABASE_URL           || undefined,
    supabaseKey:         merged.supabaseKey          || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || undefined,
    supabaseTableName:   merged.supabaseTableName    || process.env.SUPABASE_TABLE_NAME    || "app_users",
  };
}

/**
 * Merge `patch` into the current settings, persist to disk, and update
 * the in-memory cache.
 */
export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  // Strip empty strings so they don't shadow env var fallbacks
  const cleaned: Partial<AppSettings> = {};
  for (const [k, v] of Object.entries(patch) as [keyof AppSettings, string | undefined][]) {
    if (v !== undefined && v !== "") {
      (cleaned as Record<string, string>)[k] = v as string;
    }
  }

  _cache = { ..._cache, ...cleaned };

  // If the user explicitly set a value to "" we should delete that key
  if (patch.aiApiKey === "") delete _cache.aiApiKey;
  if (patch.aiBaseUrl === "") delete _cache.aiBaseUrl;
  if (patch.aiModel === "") delete _cache.aiModel;
  if (patch.googleSpreadsheetId === "") delete _cache.googleSpreadsheetId;
  if (patch.googleSheetName === "") delete _cache.googleSheetName;
  if (patch.hfApiToken === "") delete _cache.hfApiToken;
  if (patch.hfModel === "") delete _cache.hfModel;
  if (patch.whatsappNumber === "") delete _cache.whatsappNumber;
  if (patch.whatsappApiUrl === "") delete _cache.whatsappApiUrl;
  if (patch.whatsappToken === "") delete _cache.whatsappToken;
  if (patch.whatsappInstanceId === "") delete _cache.whatsappInstanceId;
  if (patch.supabaseUrl === "") delete _cache.supabaseUrl;
  if (patch.supabaseKey === "") delete _cache.supabaseKey;
  if (patch.supabaseTableName === "") delete _cache.supabaseTableName;

  saveToDisk(_cache);
  return getSettings();
}

