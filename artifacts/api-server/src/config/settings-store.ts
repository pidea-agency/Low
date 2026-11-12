/**
 * settings-store.ts
 *
 * Persists runtime application settings to Supabase table `platform_settings` (key: 'app_settings'),
 * with sensitive secrets (tokens, API keys, instance IDs) encrypted at rest using AES-256-GCM
 * with the SETTINGS_ENCRYPTION_KEY pattern.
 *
 * Falls back to disk (/tmp/settings.json or <cwd>/settings.json) and process.env when Supabase
 * is offline or not configured.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger";
import { getSupabaseClient } from "../services/supabase.service";
import { encryptSecret, decryptSecret, isEncrypted } from "../lib/encryption";

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
}

const SENSITIVE_KEYS: (keyof AppSettings)[] = [
  "whatsappToken",
  "whatsappInstanceId",
  "whatsappApiUrl",
  "aiApiKey",
  "hfApiToken",
];

/**
 * On Vercel, the filesystem is read-only except for /tmp.
 * Priority order: in-memory _cache > Supabase platform_settings > /tmp/settings.json > process.env
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
        const parsed = JSON.parse(raw) as Record<string, any>;
        if (parsed && typeof parsed === "object") {
          // Decrypt any encrypted fields that might be stored locally
          const decrypted = decryptSettings(parsed);
          result = { ...decrypted, ...result };
        }
      }
    } catch {
      // ignore & try next path
    }
  }
  return result;
}

function saveToDisk(settings: AppSettings): void {
  const encrypted = encryptSettings(settings);
  const content = JSON.stringify(encrypted, null, 2);
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

/**
 * Decrypts any fields stored with enc:v1 format
 */
function decryptSettings(raw: Record<string, any>): Partial<AppSettings> {
  const result: Partial<AppSettings> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v) {
      if (isEncrypted(v)) {
        try {
          (result as any)[k] = decryptSecret(v);
        } catch (err) {
          logger.warn({ key: k, err }, "Failed to decrypt setting value, keeping raw");
          (result as any)[k] = v;
        }
      } else {
        (result as any)[k] = v;
      }
    } else if (v !== undefined) {
      (result as any)[k] = v;
    }
  }
  return result;
}

/**
 * Encrypts sensitive fields with AES-256-GCM using SETTINGS_ENCRYPTION_KEY
 */
function encryptSettings(settings: AppSettings): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(settings) as [keyof AppSettings, string | undefined][]) {
    if (v !== undefined && v !== "") {
      if (SENSITIVE_KEYS.includes(k)) {
        payload[k] = encryptSecret(v);
      } else {
        payload[k] = v;
      }
    }
  }
  return payload;
}

// In-memory cache — loaded once at module init, updated on every save/refresh.
let _cache: AppSettings = loadFromDisk();
let _loadedFromSupabase = false;

const SYSTEM_SETTINGS_USER_ID = "00000000-0000-0000-0000-000000000001";
const SYSTEM_SETTINGS_USERNAME = "__platform_settings__";

/**
 * Ensures settings are loaded from Supabase at least once before reading.
 * Guarantees that cold starts or fresh deployments will not read empty cache.
 */
export async function ensureSettingsLoaded(): Promise<AppSettings> {
  if (!_loadedFromSupabase) {
    await refreshSettingsFromSupabase();
  }
  return getSettings();
}

/**
 * Asynchronously refreshes in-memory settings from Supabase (authoritative permanent store).
 */
export async function refreshSettingsFromSupabase(): Promise<AppSettings> {
  const client = getSupabaseClient();
  if (client) {
    try {
      // 1. Primary permanent store: app_users system row
      const { data: userRow, error: userErr } = await client
        .from("app_users")
        .select("google_service_account_json, updated_at")
        .eq("id", SYSTEM_SETTINGS_USER_ID)
        .maybeSingle();

      if (!userErr && userRow?.google_service_account_json) {
        try {
          const parsed = JSON.parse(userRow.google_service_account_json);
          if (parsed && typeof parsed === "object") {
            const decrypted = decryptSettings(parsed);
            _cache = { ..._cache, ...decrypted };
            _loadedFromSupabase = true;
            logger.info("Loaded persistent AppSettings from Supabase app_users permanent storage");
            return getSettings();
          }
        } catch (e) {
          logger.warn({ err: e }, "Failed to parse system settings JSON from app_users");
        }
      }

      // 2. Secondary fallback store: platform_settings table (if provisioned)
      const { data, error } = await client
        .from("platform_settings")
        .select("value, updated_at")
        .eq("key", "app_settings")
        .single();

      if (!error && data?.value && typeof data.value === "object") {
        const decrypted = decryptSettings(data.value);
        _cache = { ..._cache, ...decrypted };
        _loadedFromSupabase = true;
        return getSettings();
      }
    } catch (err) {
      logger.warn({ err }, "Exception fetching settings from Supabase");
    }
  }

  return getSettings();
}

/**
 * Persists settings permanently to Supabase encrypted at rest with AES-256-GCM.
 */
async function saveToSupabase(settings: AppSettings): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  let saved = false;
  const encrypted = encryptSettings(settings);

  try {
    // 1. Primary permanent store: app_users system row
    const { error: userErr } = await client.from("app_users").upsert({
      id: SYSTEM_SETTINGS_USER_ID,
      username: SYSTEM_SETTINGS_USERNAME,
      role: "super_admin",
      status: "active",
      plan_tier: "pro",
      billing_cycle: "annual",
      password_hash: "SYSTEM_INTERNAL_KEY",
      google_service_account_json: JSON.stringify(encrypted),
      updated_at: new Date().toISOString(),
    });

    if (!userErr) {
      logger.info("Encrypted AppSettings safely persisted permanently to Supabase app_users");
      saved = true;
    } else {
      logger.warn({ code: userErr.code, message: userErr.message }, "Failed to upsert settings to app_users");
    }

    // 2. Secondary fallback: platform_settings table if it exists
    try {
      await client.from("platform_settings").upsert({
        key: "app_settings",
        value: encrypted,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  } catch (err) {
    logger.warn({ err }, "Exception persisting app_settings to Supabase");
  }

  return saved;
}

/**
 * Return the current settings.
 * Priority: in-memory _cache (synced with Supabase) > /tmp disk > process.env
 */
export function getSettings(): AppSettings {
  return {
    hfApiToken:          _cache.hfApiToken          || process.env.HF_API_TOKEN          || process.env.HF_TOKEN             || undefined,
    hfModel:             _cache.hfModel              || process.env.HF_MODEL               || undefined,
    whatsappNumber:      _cache.whatsappNumber       || process.env.WHATSAPP_NUMBER        || undefined,
    whatsappApiUrl:      _cache.whatsappApiUrl       || process.env.WHATSAPP_API_URL       || undefined,
    whatsappToken:       _cache.whatsappToken        || process.env.WHATSAPP_TOKEN         || undefined,
    whatsappInstanceId:  _cache.whatsappInstanceId   || process.env.WHATSAPP_INSTANCE_ID   || undefined,
    aiApiKey:            _cache.aiApiKey             || process.env.AI_API_KEY             || process.env.OPENAI_API_KEY      || undefined,
    aiBaseUrl:           _cache.aiBaseUrl            || process.env.AI_BASE_URL            || undefined,
    aiModel:             _cache.aiModel              || process.env.AI_MODEL               || undefined,
    googleSpreadsheetId: _cache.googleSpreadsheetId  || process.env.GOOGLE_SPREADSHEET_ID  || undefined,
    googleSheetName:     _cache.googleSheetName      || process.env.GOOGLE_SHEET_NAME      || undefined,
  };
}

/**
 * Merge `patch` into the current settings, persist encrypted to Supabase (and local disk fallback),
 * and update the in-memory cache.
 */
export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
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

  // 1. Persist encrypted to Supabase platform_settings
  await saveToSupabase(_cache);

  // 2. Persist to disk fallback
  saveToDisk(_cache);

  return getSettings();
}

/**
 * Synchronous variant of saveSettings for non-async callers.
 */
export function saveSettingsSync(patch: Partial<AppSettings>): AppSettings {
  void saveSettings(patch);
  return getSettings();
}
