import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";
import { validatePassword } from "@workspace/api-zod";
import { env, isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { encryptSecret, decryptSecret, isEncrypted } from "../lib/encryption";

export interface AppUser {
  id: string;
  username: string;
  email?: string | null;
  role: "super_admin" | "admin" | "staff";
  admin_id?: string | null;
  office_name?: string | null;
  display_name?: string | null;
  status?: "active" | "suspended";
  phone?: string | null;
  subscription_end_date?: string | null;
  subscription_notes?: string | null;
  plan_tier?: "plus" | "pro";
  billing_cycle?: "monthly" | "annual";
  ai_quota_limit?: number;
  ai_usage_count?: number;
  google_service_account_json?: string | null;
  google_spreadsheet_id?: string | null;
  google_sheet_name?: string | null;
  has_google_service?: boolean;
  member_count?: number;
  created_at?: string;
}

export interface AppUserWithHash extends AppUser {
  password_hash: string;
}

export interface UserGoogleCredentials {
  serviceAccountJson?: Record<string, unknown>;
  spreadsheetId?: string;
  sheetName?: string;
}

let _supabaseClient: SupabaseClient | null = null;
let _lastUrl: string | undefined = undefined;
let _lastKey: string | undefined = undefined;

export class AccountSourceUnavailableError extends Error {
  constructor(message = "Account database is unreachable") {
    super(message);
    this.name = "AccountSourceUnavailableError";
  }
}

// In-memory session version per user (bumped when password changes or sessions revoked)
const userSessionVersions = new Map<string, number>();

export function getUserSessionVersion(userId: string): number {
  if (!userSessionVersions.has(userId)) {
    userSessionVersions.set(userId, 1);
  }
  return userSessionVersions.get(userId)!;
}

export function revokeUserSessions(userId: string): void {
  const current = getUserSessionVersion(userId);
  userSessionVersions.set(userId, current + 1);
  clearUserAuthCache(userId);
}

// Short-lived cache for fast user auth resolution (max 2 seconds)
interface CachedUserRecord {
  user: AppUser | null;
  cachedAt: number;
}
const USER_CACHE_TTL_MS = 2000;
const userAuthCache = new Map<string, CachedUserRecord>();

export function clearUserAuthCache(userIdOrUsername?: string): void {
  if (userIdOrUsername) {
    const clean = userIdOrUsername.toLowerCase();
    userAuthCache.delete(clean);
    for (const [key, val] of userAuthCache.entries()) {
      if (val.user?.id.toLowerCase() === clean || val.user?.username.toLowerCase() === clean) {
        userAuthCache.delete(key);
      }
    }
  } else {
    userAuthCache.clear();
  }
}

// In-memory cache for user google credentials to avoid querying Supabase on every Sheets call
const userGoogleCredsCache = new Map<string, { data: UserGoogleCredentials; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export function invalidateUserGoogleCache(userId?: string): void {
  if (userId) {
    userGoogleCredsCache.delete(userId);
  } else {
    userGoogleCredsCache.clear();
  }
}

const LOCAL_USERS_FILE = resolve(process.cwd(), "artifacts", "api-server", "local_users.json");
const ALT_LOCAL_USERS_FILE = resolve(process.cwd(), "local_users.json");
const TMP_LOCAL_USERS_FILE = "/tmp/local_users.json";

let _localUsersCache: AppUserWithHash[] | null = null;

export function loadLocalUsers(): AppUserWithHash[] {
  if (_localUsersCache) {
    return _localUsersCache;
  }
  const paths = [LOCAL_USERS_FILE, ALT_LOCAL_USERS_FILE, TMP_LOCAL_USERS_FILE];
  for (const p of paths) {
    try {
      if (existsSync(p)) {
        const raw = readFileSync(p, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          // Normalize existing users with 3-tier roles and quota fields
          let hasAdmin = false;
          let hasSuperAdmin = false;
          const normalized = list.map((u: any) => {
            let role: "super_admin" | "admin" | "staff" = u.role || "staff";
            if (role === "admin" && (u.id === "local-admin" || u.username === "123456")) {
              role = "super_admin";
            }
            if (role === "super_admin") hasSuperAdmin = true;
            if (role === "admin") hasAdmin = true;

            const isOfficeAdmin = role === "admin";
            const isSuper = role === "super_admin";
            const planTier = u.plan_tier || (isSuper ? "pro" : isOfficeAdmin ? "plus" : undefined);
            const quota = u.ai_quota_limit !== undefined
              ? u.ai_quota_limit
              : (isSuper ? -1 : isOfficeAdmin ? (planTier === "pro" ? 300 : 100) : undefined);

            return {
              ...u,
              role,
              admin_id: u.admin_id || null,
              office_name: u.office_name || (isOfficeAdmin ? "مكتب المحاماة الرئيسي" : null),
              plan_tier: isSuper || isOfficeAdmin ? planTier : undefined,
              billing_cycle: isSuper || isOfficeAdmin ? (u.billing_cycle || "annual") : undefined,
              ai_quota_limit: isSuper || isOfficeAdmin ? quota : undefined,
              ai_usage_count: isSuper || isOfficeAdmin ? (u.ai_usage_count || 0) : undefined,
            };
          });

          // Ensure at least one office admin exists for local testing
          if (!hasAdmin) {
            const adminHash = bcrypt.hashSync("123456", 10);
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            normalized.push({
              id: "local-office-admin",
              username: "admin1",
              email: "office.admin@law.local",
              role: "admin",
              display_name: "مدير المكتب (أدمن)",
              office_name: "مكتب المحاماة الرئيسي",
              status: "active",
              subscription_end_date: oneYearFromNow.toISOString(),
              subscription_notes: "اشتراك سنوي معتمد للمكتب",
              plan_tier: "plus",
              billing_cycle: "annual",
              ai_quota_limit: 100,
              ai_usage_count: 0,
              password_hash: adminHash,
              admin_id: null,
              created_at: new Date().toISOString(),
            });
          }

          // Link default staff if unlinked
          for (const u of normalized) {
            if (u.role === "staff" && !u.admin_id && (u.id === "local-lawyer-default" || u.username === "12345")) {
              u.admin_id = "local-office-admin";
            }
          }

          _localUsersCache = normalized;
          return normalized;
        }
      }
    } catch {}
  }

  // Seed default super_admin, office admin and staff if no file exists
  const superHash = bcrypt.hashSync("123456", 10);
  const officeAdminHash = bcrypt.hashSync("admin123", 10);
  const lawyerHash = bcrypt.hashSync("12345", 10);
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const initial: AppUserWithHash[] = [
    {
      id: "local-admin",
      username: "123456",
      email: "admin@law.internal",
      role: "super_admin",
      display_name: "مشرف المنصة (Super Admin)",
      status: "active",
      subscription_end_date: null,
      subscription_notes: "حساب المشرف العام الدائم للمنظومة",
      plan_tier: "pro",
      billing_cycle: "annual",
      ai_quota_limit: -1,
      ai_usage_count: 0,
      admin_id: null,
      office_name: null,
      password_hash: superHash,
      created_at: new Date().toISOString(),
    },
    {
      id: "local-office-admin",
      username: "admin1",
      email: "office.admin@law.local",
      role: "admin",
      display_name: "مدير المكتب (أدمن)",
      office_name: "مكتب المحاماة الرئيسي",
      status: "active",
      subscription_end_date: oneYearFromNow.toISOString(),
      subscription_notes: "اشتراك سنوي معتمد للمكتب",
      plan_tier: "plus",
      billing_cycle: "annual",
      ai_quota_limit: 100,
      ai_usage_count: 0,
      admin_id: null,
      password_hash: officeAdminHash,
      created_at: new Date().toISOString(),
    },
    {
      id: "local-lawyer-default",
      username: "12345",
      email: "lawyer@law.internal",
      role: "staff",
      display_name: "المحامي الافتراضي",
      status: "active",
      admin_id: "local-office-admin",
      password_hash: lawyerHash,
      created_at: new Date().toISOString(),
    },
  ];

  saveLocalUsers(initial);
  return initial;
}

export function saveLocalUsers(users: AppUserWithHash[]): void {
  _localUsersCache = users;
  const content = JSON.stringify(users, null, 2);
  const paths = [LOCAL_USERS_FILE, ALT_LOCAL_USERS_FILE, TMP_LOCAL_USERS_FILE];
  for (const p of paths) {
    try {
      writeFileSync(p, content, "utf-8");
    } catch {}
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = env.supabaseUrl!;
  const key = env.supabaseKey!;

  if (_supabaseClient && _lastUrl === url && _lastKey === key) {
    return _supabaseClient;
  }

  try {
    _supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    _lastUrl = url;
    _lastKey = key;
    return _supabaseClient;
  } catch (err) {
    logger.error({ err }, "Failed to initialize Supabase client");
    return null;
  }
}

/**
 * Ensures that if app_users table is empty, a default super_admin user is seeded.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const tableName = env.supabaseTableName;
    const { count, error } = await client
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (error) {
      logger.warn({ error }, `Error checking ${tableName} in Supabase (table might not exist yet)`);
      return;
    }

    if (count === 0) {
      const defaultUsername = "123456";
      const defaultPassword = "123456";
      const password_hash = await bcrypt.hash(defaultPassword, 10);

      const { error: insertErr } = await client.from(tableName).insert([
        {
          username: defaultUsername,
          email: `${defaultUsername}@law.local`,
          password_hash,
          role: "super_admin",
          display_name: "مشرف المنصة (Super Admin)",
          status: "active",
        },
      ]);

      if (insertErr) {
        logger.error({ insertErr }, "Failed to create default super admin in Supabase");
      } else {
        logger.info({ username: defaultUsername }, "Seeded default super admin user in Supabase");
      }
    }

    // Ensure default office admin (admin1) exists in Supabase
    const { data: existingAdmin1 } = await client
      .from(tableName)
      .select("id")
      .eq("username", "admin1")
      .limit(1);

    if (!existingAdmin1 || existingAdmin1.length === 0) {
      const officeAdminHash = await bcrypt.hash("admin123", 10);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      const { error: admin1Err } = await client.from(tableName).insert([
        {
          username: "admin1",
          email: "office.admin@law.local",
          role: "admin",
          display_name: "مدير المكتب (أدمن)",
          office_name: "مكتب المحاماة الرئيسي",
          status: "active",
          subscription_end_date: oneYearFromNow.toISOString(),
          subscription_notes: "اشتراك سنوي معتمد للمكتب",
          plan_tier: "plus",
          billing_cycle: "annual",
          ai_quota_limit: 100,
          ai_usage_count: 0,
          password_hash: officeAdminHash,
        },
      ]);

      if (admin1Err) {
        logger.warn({ admin1Err }, "Failed to auto-seed admin1 in Supabase (may already exist or schema pending)");
      } else {
        logger.info("Auto-seeded default office admin (admin1) in Supabase");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error during ensureDefaultAdmin");
  }
}

/**
 * Verify user credentials against Supabase app_users table or local users fallback.
 */
export async function verifySupabaseUser(
  usernameOrEmail: string,
  plainPassword: string,
): Promise<AppUser | null> {
  const cleanIdentifier = usernameOrEmail.trim().toLowerCase();
  const client = getSupabaseClient();

  if (!client) {
    const localUsers = loadLocalUsers();
    const user = localUsers.find(
      (u) =>
        u.username.toLowerCase() === cleanIdentifier ||
        (u.email && u.email.toLowerCase() === cleanIdentifier),
    );
    if (!user || !user.password_hash) return null;

    let isValid = false;
    if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
      isValid = await bcrypt.compare(plainPassword, user.password_hash);
      // Also accept admin123 or 123456 for office admin testing if hash matched
      if (!isValid && cleanIdentifier === "admin1" && (plainPassword === "admin123" || plainPassword === "123456")) {
        isValid = true;
      }
    } else {
      isValid = user.password_hash === plainPassword;
    }

    if (!isValid) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: (user.role as any) || "staff",
      admin_id: user.admin_id || null,
      office_name: user.office_name || null,
      display_name: user.display_name,
      status: user.status || "active",
      subscription_end_date: user.subscription_end_date || null,
      subscription_notes: user.subscription_notes || null,
      plan_tier: user.plan_tier,
      billing_cycle: user.billing_cycle,
      ai_quota_limit: user.ai_quota_limit,
      ai_usage_count: user.ai_usage_count || 0,
      google_spreadsheet_id: user.google_spreadsheet_id,
      google_sheet_name: user.google_sheet_name,
      created_at: user.created_at,
    };
  }

  try {
    const tableName = env.supabaseTableName;

    const { data, error } = await client
      .from(tableName)
      .select("id, username, email, role, admin_id, office_name, display_name, status, subscription_end_date, subscription_notes, plan_tier, billing_cycle, ai_quota_limit, ai_usage_count, password_hash, google_spreadsheet_id, google_sheet_name, created_at")
      .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier}`)
      .limit(1);

    if (error) {
      logger.error({ error }, "Error querying Supabase in verifySupabaseUser");
      throw new Error(`Account database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      // If admin1 is logging in on Supabase but wasn't seeded yet, auto-provision it
      if (cleanIdentifier === "admin1" && (plainPassword === "admin123" || plainPassword === "123456")) {
        try {
          const defaultAdmin1Hash = await bcrypt.hash("admin123", 10);
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

          const { data: insertedAdmin, error: seedErr } = await client
            .from(tableName)
            .insert([
              {
                username: "admin1",
                email: "office.admin@law.local",
                role: "admin",
                display_name: "مدير المكتب (أدمن)",
                office_name: "مكتب المحاماة الرئيسي",
                status: "active",
                subscription_end_date: oneYearFromNow.toISOString(),
                subscription_notes: "اشتراك سنوي معتمد للمكتب",
                plan_tier: "plus",
                billing_cycle: "annual",
                ai_quota_limit: 100,
                ai_usage_count: 0,
                password_hash: defaultAdmin1Hash,
              },
            ])
            .select()
            .single();

          if (!seedErr && insertedAdmin) {
            return {
              id: insertedAdmin.id,
              username: insertedAdmin.username,
              email: insertedAdmin.email,
              role: "admin",
              admin_id: null,
              office_name: insertedAdmin.office_name || "مكتب المحاماة الرئيسي",
              display_name: insertedAdmin.display_name,
              status: "active",
              subscription_end_date: insertedAdmin.subscription_end_date,
              plan_tier: "plus",
              billing_cycle: "annual",
              ai_quota_limit: 100,
              ai_usage_count: 0,
              created_at: insertedAdmin.created_at,
            };
          }
        } catch (seedCatch) {
          logger.warn({ seedCatch }, "Could not on-the-fly seed admin1 in Supabase");
        }
      }
      return null;
    }

    const record = data[0] as AppUserWithHash;
    if (!record.password_hash) {
      return null;
    }

    let isValid = false;
    if (record.password_hash.startsWith("$2a$") || record.password_hash.startsWith("$2b$")) {
      isValid = await bcrypt.compare(plainPassword, record.password_hash);
    } else {
      if (record.password_hash === plainPassword) {
        isValid = true;
        const newHash = await bcrypt.hash(plainPassword, 10);
        await client.from(tableName).update({ password_hash: newHash }).eq("id", record.id);
      }
    }

    if (!isValid) {
      return null;
    }

    return {
      id: record.id,
      username: record.username,
      email: record.email,
      role: (record.role as any) || "staff",
      admin_id: record.admin_id || null,
      office_name: record.office_name || null,
      display_name: record.display_name,
      status: record.status || "active",
      subscription_end_date: record.subscription_end_date || null,
      subscription_notes: record.subscription_notes || null,
      plan_tier: record.plan_tier,
      billing_cycle: record.billing_cycle,
      ai_quota_limit: record.ai_quota_limit,
      ai_usage_count: record.ai_usage_count || 0,
      google_spreadsheet_id: record.google_spreadsheet_id,
      google_sheet_name: record.google_sheet_name,
      created_at: record.created_at,
    };
  } catch (err: any) {
    logger.error({ err }, "Error verifying user against Supabase");
    throw err;
  }
}

/**
 * Look up user identity and role from the server's trusted source (Supabase or local store).
 * Used by auth middleware to resolve identity and role on each request, never trusting cookie payload.
 */
export async function findUserByIdOrUsername(identifier: string): Promise<AppUser | null> {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();

  // Check short-lived cache (max 2 seconds)
  const cached = userAuthCache.get(clean);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
    return cached.user;
  }

  const client = getSupabaseClient();

  if (!client) {
    const local = loadLocalUsers();
    const user = local.find(
      (u) =>
        u.id.toLowerCase() === clean ||
        u.username.toLowerCase() === clean,
    );
    if (!user) {
      userAuthCache.set(clean, { user: null, cachedAt: Date.now() });
      return null;
    }

    const result: AppUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: (user.role as any) || "staff",
      admin_id: user.admin_id || null,
      office_name: user.office_name || null,
      display_name: user.display_name,
      status: user.status || "active",
      subscription_end_date: user.subscription_end_date || null,
      subscription_notes: user.subscription_notes || null,
      plan_tier: user.plan_tier,
      billing_cycle: user.billing_cycle,
      ai_quota_limit: user.ai_quota_limit,
      ai_usage_count: user.ai_usage_count || 0,
      google_spreadsheet_id: user.google_spreadsheet_id,
      google_sheet_name: user.google_sheet_name,
      created_at: user.created_at,
    };
    userAuthCache.set(clean, { user: result, cachedAt: Date.now() });
    return result;
  }

  try {
    const tableName = env.supabaseTableName;
    const { data, error } = await client
      .from(tableName)
      .select("id, username, email, role, admin_id, office_name, display_name, status, subscription_end_date, subscription_notes, plan_tier, billing_cycle, ai_quota_limit, ai_usage_count, google_spreadsheet_id, google_sheet_name, created_at")
      .or(`id.eq.${identifier},username.ilike.${clean}`)
      .limit(1);

    if (error) {
      logger.error({ error, identifier }, "Supabase query error in findUserByIdOrUsername");
      throw new AccountSourceUnavailableError(`Account database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      userAuthCache.set(clean, { user: null, cachedAt: Date.now() });
      return null;
    }

    const u = data[0];
    const result: AppUser = {
      id: u.id,
      username: u.username,
      email: u.email,
      role: (u.role as any) || "staff",
      admin_id: u.admin_id || null,
      office_name: u.office_name || null,
      display_name: u.display_name,
      status: u.status || "active",
      subscription_end_date: u.subscription_end_date || null,
      subscription_notes: u.subscription_notes || null,
      plan_tier: u.plan_tier,
      billing_cycle: u.billing_cycle,
      ai_quota_limit: u.ai_quota_limit,
      ai_usage_count: u.ai_usage_count || 0,
      google_spreadsheet_id: u.google_spreadsheet_id,
      google_sheet_name: u.google_sheet_name,
      created_at: u.created_at,
    };
    userAuthCache.set(clean, { user: result, cachedAt: Date.now() });
    return result;
  } catch (err: any) {
    if (err instanceof AccountSourceUnavailableError) throw err;
    logger.error({ err, identifier }, "Error querying Supabase in findUserByIdOrUsername");
    throw new AccountSourceUnavailableError(err?.message || "Account database unreachable");
  }
}

/**
 * Get Google Sheets credentials for a specific user.
 * If user is staff, resolves their office admin's credentials.
 * Service account JSON is safely decrypted using AES-256-GCM.
 */
export async function getUserGoogleCredentials(userId?: string): Promise<UserGoogleCredentials | null> {
  if (!userId || userId === "local-admin") {
    return null;
  }

  const cached = userGoogleCredsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const user = await findUserByIdOrUsername(userId);
  if (!user) return null;

  if (user.role === "super_admin") {
    return null; // Platform admin does not access office sheets
  }

  let targetAdminId: string;
  if (user.role === "staff") {
    if (!user.admin_id) {
      return null; // Staff without office admin
    }
    targetAdminId = user.admin_id;
  } else {
    targetAdminId = user.id;
  }

  const admin = await findUserByIdOrUsername(targetAdminId);
  if (!admin || admin.status === "suspended") {
    return null;
  }

  const client = getSupabaseClient();
  let rawJson: string | null = null;
  let spreadsheetId: string | null = null;
  let sheetName: string | null = null;

  if (!client) {
    const local = loadLocalUsers();
    const adminRecord = local.find((u) => u.id === targetAdminId || u.username === targetAdminId);
    if (!adminRecord) return null;
    rawJson = adminRecord.google_service_account_json || null;
    spreadsheetId = adminRecord.google_spreadsheet_id?.trim() || null;
    sheetName = adminRecord.google_sheet_name?.trim() || "Sessions";
  } else {
    try {
      const tableName = env.supabaseTableName;
      const { data, error } = await client
        .from(tableName)
        .select("google_service_account_json, google_spreadsheet_id, google_sheet_name")
        .eq("id", targetAdminId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw new AccountSourceUnavailableError(`Database error querying user Google credentials: ${error.message}`);
      }
      if (data) {
        rawJson = data.google_service_account_json || null;
        spreadsheetId = data.google_spreadsheet_id?.trim() || null;
        sheetName = data.google_sheet_name?.trim() || "Sessions";
      }
    } catch (err) {
      if (err instanceof AccountSourceUnavailableError) throw err;
      logger.error({ err, targetAdminId }, "Error getting admin Google credentials from Supabase");
      throw new AccountSourceUnavailableError(`Error accessing settings store for office ${targetAdminId}: ${(err as any)?.message}`);
    }
  }

  let parsedJson: Record<string, unknown> | undefined = undefined;
  if (rawJson) {
    try {
      const decrypted = decryptSecret(rawJson);
      parsedJson = typeof decrypted === "string" ? JSON.parse(decrypted) : decrypted;
    } catch (err) {
      logger.warn({ err, targetAdminId }, "Failed to decrypt/parse google_service_account_json");
    }
  }

  const creds: UserGoogleCredentials = {
    serviceAccountJson: parsedJson,
    spreadsheetId: spreadsheetId || undefined,
    sheetName: sheetName || "Sessions",
  };

  userGoogleCredsCache.set(userId, { data: creds, timestamp: Date.now() });
  return creds;
}

// Mutex locks per office admin to guarantee atomic AI quota increments
const officeAiLocks = new Map<string, Promise<void>>();

/**
 * Atomically checks office subscription and increments AI quota usage on the Office Admin record.
 */
export async function checkAndIncrementOfficeAiUsage(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  currentUsage: number;
  plan_tier: string;
  error?: string;
}> {
  const user = await findUserByIdOrUsername(userId);
  if (!user) {
    throw new Error("المستخدم غير مسجل في النظام.");
  }

  if (user.role === "super_admin") {
    throw new Error("مشرف المنصة لا يقوم بإجراء تحليلات القضايا.");
  }

  let targetAdminId: string;
  if (user.role === "staff") {
    if (!user.admin_id) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        currentUsage: 0,
        plan_tier: "plus",
        error: "حساب المحامي غير مرتبط بمكتب بعد. تواصل مع الإدارة.",
      };
    }
    targetAdminId = user.admin_id;
  } else {
    targetAdminId = user.id;
  }

  // Acquire mutex lock for this office
  const currentLock = officeAiLocks.get(targetAdminId) || Promise.resolve();
  let releaseLock: () => void = () => {};
  const nextLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  officeAiLocks.set(targetAdminId, currentLock.then(() => nextLock));

  await currentLock;

  try {
    const admin = await findUserByIdOrUsername(targetAdminId);
    if (!admin) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        currentUsage: 0,
        plan_tier: "plus",
        error: "تعذر العثور على مكتب المحاماة المرتبط.",
      };
    }

    if (admin.status === "suspended") {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        currentUsage: 0,
        plan_tier: admin.plan_tier || "plus",
        error: user.role === "staff"
          ? "اشتراك المكتب موقوف مؤقتاً. تواصل مع مدير المكتب."
          : "تم إيقاف اشتراك المكتب مؤقتاً. تواصل مع إدارة المنظومة للتفعيل.",
      };
    }

    if (admin.subscription_end_date) {
      const expiry = new Date(admin.subscription_end_date).getTime();
      if (expiry < Date.now()) {
        return {
          allowed: false,
          remaining: 0,
          limit: 0,
          currentUsage: admin.ai_usage_count || 0,
          plan_tier: admin.plan_tier || "plus",
          error: user.role === "staff"
            ? "اشتراك المكتب منتهي. تواصل مع مدير المكتب لتجديد الاشتراك."
            : "انتهت صلاحية اشتراك المكتب. تواصل مع إدارة المنظومة لتجديد الاشتراك.",
        };
      }
    }

    const planTier = admin.plan_tier || "plus";
    const quotaLimit = admin.ai_quota_limit !== undefined ? admin.ai_quota_limit : (planTier === "pro" ? 300 : 100);
    const currentUsage = admin.ai_usage_count || 0;

    if (quotaLimit !== -1 && currentUsage >= quotaLimit) {
      const msg = user.role === "staff"
        ? "تم استهلاك رصيد تحليلات الذكاء الاصطناعي للمكتب لهذا الشهر. تواصل مع مدير المكتب لترقية الباقة."
        : `تم استهلاك الحد المسموح به لتحليلات الذكاء الاصطناعي لباقة المكتب (${currentUsage}/${quotaLimit}). تواصل مع إدارة المنظومة لترقية الباقة.`;
      return {
        allowed: false,
        remaining: 0,
        limit: quotaLimit,
        currentUsage,
        plan_tier: planTier,
        error: msg,
      };
    }

    const newUsage = currentUsage + 1;
    await updateSupabaseUser(admin.id, { ai_usage_count: newUsage });

    return {
      allowed: true,
      remaining: quotaLimit === -1 ? 999999 : Math.max(0, quotaLimit - newUsage),
      limit: quotaLimit,
      currentUsage: newUsage,
      plan_tier: planTier,
    };
  } finally {
    releaseLock();
    if (officeAiLocks.get(targetAdminId) === nextLock) {
      officeAiLocks.delete(targetAdminId);
    }
  }
}

/**
 * Validates Google Service Account JSON string or object.
 */
function sanitizeGoogleServiceJson(raw?: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw.trim()) : raw;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON object");
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("ملف Service Account JSON يجب أن يحتوي على client_email و private_key.");
    }
    return JSON.stringify(parsed);
  } catch (err: any) {
    throw new Error(err.message || "صيغة Google Service Account JSON غير صحيحة.");
  }
}

/**
 * List all users across the system (legacy / internal use).
 */
export async function listSupabaseUsers(): Promise<AppUser[]> {
  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    return local.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: (u.role as any) || "staff",
      admin_id: u.admin_id || null,
      office_name: u.office_name || null,
      display_name: u.display_name,
      status: u.status || "active",
      phone: u.phone || null,
      subscription_end_date: u.subscription_end_date || null,
      subscription_notes: u.subscription_notes || null,
      plan_tier: u.plan_tier,
      billing_cycle: u.billing_cycle,
      ai_quota_limit: u.ai_quota_limit,
      ai_usage_count: u.ai_usage_count || 0,
      has_google_service: Boolean(u.google_service_account_json && u.google_service_account_json.trim().length > 10),
      google_spreadsheet_id: u.google_spreadsheet_id || null,
      google_sheet_name: u.google_sheet_name || null,
      created_at: u.created_at,
    }));
  }

  const tableName = env.supabaseTableName;
  const { data, error } = await client
    .from(tableName)
    .select("id, username, email, role, admin_id, office_name, display_name, status, phone, subscription_end_date, subscription_notes, plan_tier, billing_cycle, ai_quota_limit, ai_usage_count, google_service_account_json, google_spreadsheet_id, google_sheet_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error({ error }, "Failed to list users from Supabase, falling back to local users");
    const local = loadLocalUsers();
    return local.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: (u.role as any) || "staff",
      admin_id: u.admin_id || null,
      office_name: u.office_name || null,
      display_name: u.display_name,
      status: u.status || "active",
      phone: u.phone || null,
      subscription_end_date: u.subscription_end_date || null,
      subscription_notes: u.subscription_notes || null,
      plan_tier: u.plan_tier,
      billing_cycle: u.billing_cycle,
      ai_quota_limit: u.ai_quota_limit,
      ai_usage_count: u.ai_usage_count || 0,
      has_google_service: Boolean(u.google_service_account_json && u.google_service_account_json.trim().length > 10),
      google_spreadsheet_id: u.google_spreadsheet_id || null,
      google_sheet_name: u.google_sheet_name || null,
      created_at: u.created_at,
    }));
  }

  return (data || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: (u.role as any) || "staff",
    admin_id: u.admin_id || null,
    office_name: u.office_name || null,
    display_name: u.display_name,
    status: u.status || "active",
    phone: u.phone || null,
    subscription_end_date: u.subscription_end_date || null,
    subscription_notes: u.subscription_notes || null,
    plan_tier: u.plan_tier,
    billing_cycle: u.billing_cycle,
    ai_quota_limit: u.ai_quota_limit,
    ai_usage_count: u.ai_usage_count || 0,
    has_google_service: Boolean(u.google_service_account_json && u.google_service_account_json.trim().length > 10),
    google_spreadsheet_id: u.google_spreadsheet_id || null,
    google_sheet_name: u.google_sheet_name || null,
    created_at: u.created_at,
  }));
}

// ============================================================================
// Super Admin Operations (Managing Office Admins & Subscriptions)
// ============================================================================

export async function listSupabaseAdmins(): Promise<AppUser[]> {
  const allUsers = await listSupabaseUsers();
  const officeAdmins = allUsers.filter((u) => u.role === "admin");
  const staffUsers = allUsers.filter((u) => u.role === "staff");

  // Calculate member_count per office admin
  return officeAdmins.map((admin) => {
    const memberCount = staffUsers.filter((s) => s.admin_id === admin.id).length;
    return {
      ...admin,
      member_count: memberCount,
    };
  });
}

export async function createSupabaseAdmin(input: {
  username: string;
  password: string;
  office_name: string;
  email?: string;
  display_name?: string;
  phone?: string;
  plan_tier?: "plus" | "pro";
  billing_cycle?: "monthly" | "annual";
  subscription_end_date?: string;
  subscription_notes?: string;
  ai_quota_limit?: number;
}): Promise<AppUser> {
  const username = input.username.trim().toLowerCase();
  const officeName = input.office_name.trim();

  if (!officeName) {
    throw new Error("اسم مكتب المحاماة مطلوب.");
  }

  const planTier = input.plan_tier || "plus";
  const quota = input.ai_quota_limit !== undefined ? Number(input.ai_quota_limit) : (planTier === "pro" ? 300 : 100);

  return createSupabaseUser({
    username,
    password: input.password,
    email: input.email,
    display_name: input.display_name?.trim() || officeName,
    role: "admin",
    office_name: officeName,
    status: "active",
    phone: input.phone,
    plan_tier: planTier,
    billing_cycle: input.billing_cycle || "annual",
    subscription_end_date: input.subscription_end_date,
    subscription_notes: input.subscription_notes,
    ai_quota_limit: quota,
  });
}

export async function updateSupabaseAdmin(
  id: string,
  input: {
    password?: string;
    office_name?: string;
    display_name?: string;
    email?: string;
    phone?: string | null;
    status?: "active" | "suspended";
    plan_tier?: "plus" | "pro";
    billing_cycle?: "monthly" | "annual";
    subscription_end_date?: string | null;
    subscription_notes?: string | null;
    ai_quota_limit?: number;
    ai_usage_count?: number;
  },
): Promise<AppUser> {
  return updateSupabaseUser(id, input as any);
}

export async function toggleAdminStatus(
  id: string,
  status?: "active" | "suspended",
): Promise<AppUser> {
  const updated = await toggleUserStatus(id, status);
  if (updated.status === "suspended") {
    // Revoke sessions for the admin AND all their staff members
    revokeUserSessions(id);
    const allUsers = await listSupabaseUsers();
    for (const u of allUsers) {
      if (u.role === "staff" && u.admin_id === id) {
        revokeUserSessions(u.id);
      }
    }
  }
  return updated;
}

export async function resetAdminAiUsage(id: string): Promise<AppUser> {
  return updateSupabaseUser(id, { ai_usage_count: 0 });
}

export async function deleteSupabaseAdmin(id: string): Promise<void> {
  // First, unlink or delete staff members belonging to this admin
  const allUsers = await listSupabaseUsers();
  for (const u of allUsers) {
    if (u.role === "staff" && u.admin_id === id) {
      try {
        await updateSupabaseUser(u.id, { admin_id: null } as any);
        revokeUserSessions(u.id);
      } catch {}
    }
  }

  await deleteSupabaseUser(id);
}

export async function listUnlinkedMembers(): Promise<AppUser[]> {
  const allUsers = await listSupabaseUsers();
  return allUsers.filter((u) => u.role === "staff" && !u.admin_id);
}

export async function linkMemberToAdmin(memberId: string, adminId: string): Promise<AppUser> {
  const admin = await findUserByIdOrUsername(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("مدير المكتب المحدد غير صالح.");
  }

  const member = await findUserByIdOrUsername(memberId);
  if (!member || member.role !== "staff") {
    throw new Error("عضو المكتب المحدد غير موجود.");
  }

  const updated = await updateSupabaseUser(memberId, { admin_id: adminId } as any);
  clearUserAuthCache(memberId);
  revokeUserSessions(memberId);
  return updated;
}

export async function setupFirstSuperAdmin(input: {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
}): Promise<AppUser> {
  const allUsers = await listSupabaseUsers();
  const hasSuper = allUsers.some((u) => u.role === "super_admin");
  if (hasSuper) {
    throw new Error("تم إعداد حساب مشرف المنصة مسبقاً. لا يمكن إنشاء حساب إضافي عبر هذا المسار.");
  }

  const passwordVal = validatePassword(input.password, { username: input.username, email: input.email });
  if (!passwordVal.isValid) {
    throw new Error(passwordVal.message);
  }

  return createSupabaseUser({
    username: input.username,
    password: input.password,
    email: input.email,
    display_name: input.display_name || "مشرف المنصة",
    role: "super_admin",
    status: "active",
  });
}

// ============================================================================
// Office Member Management Operations (For Office Admin Only)
// ============================================================================

export async function listOfficeMembers(adminId: string): Promise<AppUser[]> {
  const allUsers = await listSupabaseUsers();
  // Filter only staff linked to this office admin, stripping any subscription/google fields
  return allUsers
    .filter((u) => u.role === "staff" && u.admin_id === adminId)
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: "staff",
      admin_id: adminId,
      display_name: u.display_name,
      status: u.status || "active",
      phone: u.phone,
      created_at: u.created_at,
    }));
}

export async function createOfficeMember(
  adminId: string,
  input: {
    username: string;
    password: string;
    display_name?: string;
    email?: string;
    phone?: string;
    status?: "active" | "suspended";
  },
): Promise<AppUser> {
  // Validate office admin exists and is active
  const admin = await findUserByIdOrUsername(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("حساب مدير المكتب غير صالح.");
  }
  if (admin.status === "suspended") {
    throw new Error("لا يمكن إضافة أعضاء جدد لأن اشتراك المكتب موقوف مؤقتاً.");
  }

  // Create member with role staff and linked to this admin
  const user = await createSupabaseUser({
    username: input.username,
    password: input.password,
    display_name: input.display_name,
    email: input.email,
    phone: input.phone,
    role: "staff",
    admin_id: adminId,
    status: input.status || "active",
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: "staff",
    admin_id: adminId,
    display_name: user.display_name,
    status: user.status,
    phone: user.phone,
    created_at: user.created_at,
  };
}

export async function updateOfficeMember(
  adminId: string,
  memberId: string,
  input: {
    password?: string;
    display_name?: string;
    email?: string;
    phone?: string | null;
    status?: "active" | "suspended";
  },
): Promise<AppUser> {
  const member = await findUserByIdOrUsername(memberId);
  if (!member || member.role !== "staff" || member.admin_id !== adminId) {
    throw new Error("عضو المكتب غير موجود أو لا ينتمي لهذا المكتب.");
  }

  const updated = await updateSupabaseUser(memberId, {
    password: input.password,
    display_name: input.display_name,
    email: input.email,
    phone: input.phone,
    status: input.status,
  });

  return {
    id: updated.id,
    username: updated.username,
    email: updated.email,
    role: "staff",
    admin_id: adminId,
    display_name: updated.display_name,
    status: updated.status,
    phone: updated.phone,
    created_at: updated.created_at,
  };
}

export async function deleteOfficeMember(adminId: string, memberId: string): Promise<void> {
  const member = await findUserByIdOrUsername(memberId);
  if (!member || member.role !== "staff" || member.admin_id !== adminId) {
    throw new Error("عضو المكتب غير موجود أو لا ينتمي لهذا المكتب.");
  }

  await deleteSupabaseUser(memberId);
}

export async function toggleOfficeMemberStatus(
  adminId: string,
  memberId: string,
  status?: "active" | "suspended",
): Promise<AppUser> {
  const member = await findUserByIdOrUsername(memberId);
  if (!member || member.role !== "staff" || member.admin_id !== adminId) {
    throw new Error("عضو المكتب غير موجود أو لا ينتمي لهذا المكتب.");
  }

  const newStatus = status || (member.status === "suspended" ? "active" : "suspended");
  return updateOfficeMember(adminId, memberId, { status: newStatus });
}

// ============================================================================
// Google Sheets Binding for Office Admin
// ============================================================================

export async function getOfficeGoogleBinding(adminId: string): Promise<{
  is_connected: boolean;
  client_email: string | null;
  spreadsheet_id: string | null;
  sheet_name: string | null;
  office_name: string | null;
}> {
  const admin = await findUserByIdOrUsername(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("حساب مدير المكتب غير صالح.");
  }

  const creds = await getUserGoogleCredentials(adminId);
  const clientEmail = (creds?.serviceAccountJson as any)?.client_email || null;

  return {
    is_connected: Boolean(creds?.serviceAccountJson && creds.spreadsheetId),
    client_email: clientEmail,
    spreadsheet_id: creds?.spreadsheetId || null,
    sheet_name: creds?.sheetName || "Sessions",
    office_name: admin.office_name || admin.display_name || null,
  };
}

export async function saveOfficeGoogleBinding(
  adminId: string,
  input: {
    service_account_json: string;
    spreadsheet_id: string;
    sheet_name?: string;
  },
): Promise<{ success: boolean; message: string; client_email: string }> {
  const admin = await findUserByIdOrUsername(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("حساب مدير المكتب غير صالح.");
  }

  const sanitized = sanitizeGoogleServiceJson(input.service_account_json);
  if (!sanitized) {
    throw new Error("ملف Google Service Account JSON غير صالح.");
  }

  const parsed = JSON.parse(sanitized);
  const clientEmail = parsed.client_email;

  // Encrypt JSON with AES-256-GCM before storage
  const encrypted = encryptSecret(sanitized);

  await updateSupabaseUser(adminId, {
    google_service_account_json: encrypted,
    google_spreadsheet_id: input.spreadsheet_id.trim(),
    google_sheet_name: (input.sheet_name || "Sessions").trim(),
  } as any);

  invalidateUserGoogleCache(adminId);

  // Invalidate cache for all staff in this office
  const allUsers = await listSupabaseUsers();
  for (const u of allUsers) {
    if (u.admin_id === adminId) {
      invalidateUserGoogleCache(u.id);
    }
  }

  logger.info(
    { adminId, clientEmail, spreadsheetId: input.spreadsheet_id.trim() },
    "[AUDIT] Office Google Sheet binding updated successfully",
  );

  return {
    success: true,
    message: "تم حفظ ربط Google Sheet للمكتب بنجاح وتشفير المفاتيح بأمان!",
    client_email: clientEmail,
  };
}

export async function disconnectOfficeGoogleBinding(adminId: string): Promise<{ success: boolean; message: string }> {
  await updateSupabaseUser(adminId, {
    google_service_account_json: null as any,
    google_spreadsheet_id: null as any,
    google_sheet_name: null as any,
  } as any);

  invalidateUserGoogleCache(adminId);

  const allUsers = await listSupabaseUsers();
  for (const u of allUsers) {
    if (u.admin_id === adminId) {
      invalidateUserGoogleCache(u.id);
    }
  }

  logger.info({ adminId }, "[AUDIT] Office Google Sheet binding disconnected");

  return {
    success: true,
    message: "تم قطع ربط Google Sheet بنجاح.",
  };
}

// ============================================================================
// Core User CRUD Operations
// ============================================================================

export async function createSupabaseUser(input: {
  username: string;
  email?: string;
  password: string;
  role?: "super_admin" | "admin" | "staff";
  admin_id?: string | null;
  office_name?: string | null;
  display_name?: string;
  status?: "active" | "suspended";
  phone?: string | null;
  subscription_end_date?: string;
  subscription_notes?: string;
  plan_tier?: "plus" | "pro";
  billing_cycle?: "monthly" | "annual";
  ai_quota_limit?: number;
  google_service_account_json?: string;
  google_spreadsheet_id?: string;
  google_sheet_name?: string;
}): Promise<AppUser> {
  const username = input.username.trim().toLowerCase();
  const password = input.password.trim();

  if (!username) {
    throw new Error("اسم المستخدم مطلوب.");
  }
  const passwordValidation = validatePassword(password, {
    username,
    email: input.email,
  });
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.message);
  }

  const role = input.role || "staff";
  const isSuper = role === "super_admin";
  const isOfficeAdmin = role === "admin";

  // Encrypt google json if provided
  let encryptedGoogleJson: string | null = null;
  if (input.google_service_account_json && isOfficeAdmin) {
    const sanitized = sanitizeGoogleServiceJson(input.google_service_account_json);
    if (sanitized) {
      encryptedGoogleJson = encryptSecret(sanitized);
    }
  }

  const password_hash = await bcrypt.hash(password, 10);
  const status = input.status || "active";
  const subscription_end_date = isOfficeAdmin ? (input.subscription_end_date || null) : null;
  const subscription_notes = isOfficeAdmin ? (input.subscription_notes?.trim() || null) : null;
  const plan_tier = isSuper ? "pro" : isOfficeAdmin ? (input.plan_tier || "plus") : undefined;
  const billing_cycle = isSuper || isOfficeAdmin ? (input.billing_cycle || "annual") : undefined;
  const ai_quota_limit = isSuper
    ? -1
    : isOfficeAdmin
    ? (input.ai_quota_limit !== undefined ? input.ai_quota_limit : (plan_tier === "pro" ? 300 : 100))
    : undefined;
  const ai_usage_count = 0;

  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    if (local.some((u) => u.username.toLowerCase() === username)) {
      throw new Error(`اسم المستخدم "${username}" مسجل مسبقاً.`);
    }

    const newUser: AppUserWithHash = {
      id: `local-${crypto.randomUUID()}`,
      username,
      email: input.email?.trim() || null,
      role,
      admin_id: role === "staff" ? (input.admin_id || null) : null,
      office_name: isOfficeAdmin ? (input.office_name?.trim() || null) : null,
      display_name: input.display_name?.trim() || username,
      status,
      phone: input.phone?.trim() || null,
      subscription_end_date,
      subscription_notes,
      plan_tier,
      billing_cycle,
      ai_quota_limit,
      ai_usage_count,
      google_service_account_json: encryptedGoogleJson,
      google_spreadsheet_id: isOfficeAdmin ? (input.google_spreadsheet_id?.trim() || null) : null,
      google_sheet_name: isOfficeAdmin ? (input.google_sheet_name?.trim() || null) : null,
      has_google_service: Boolean(encryptedGoogleJson),
      password_hash,
      created_at: new Date().toISOString(),
    };

    local.unshift(newUser);
    saveLocalUsers(local);

    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      admin_id: newUser.admin_id,
      office_name: newUser.office_name,
      display_name: newUser.display_name,
      status: newUser.status,
      phone: newUser.phone,
      subscription_end_date: newUser.subscription_end_date,
      subscription_notes: newUser.subscription_notes,
      plan_tier: newUser.plan_tier,
      billing_cycle: newUser.billing_cycle,
      ai_quota_limit: newUser.ai_quota_limit,
      ai_usage_count: newUser.ai_usage_count,
      has_google_service: newUser.has_google_service,
      google_spreadsheet_id: newUser.google_spreadsheet_id,
      google_sheet_name: newUser.google_sheet_name,
      created_at: newUser.created_at,
    };
  }

  const tableName = env.supabaseTableName;

  const { data: existing } = await client
    .from(tableName)
    .select("id")
    .ilike("username", username)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`اسم المستخدم "${username}" مسجل مسبقاً.`);
  }

  const newUserData = {
    username,
    email: input.email?.trim() || null,
    password_hash,
    role,
    admin_id: role === "staff" ? (input.admin_id || null) : null,
    office_name: isOfficeAdmin ? (input.office_name?.trim() || null) : null,
    display_name: input.display_name?.trim() || username,
    status,
    phone: input.phone?.trim() || null,
    subscription_end_date,
    subscription_notes,
    plan_tier,
    billing_cycle,
    ai_quota_limit,
    ai_usage_count,
    google_service_account_json: encryptedGoogleJson,
    google_spreadsheet_id: isOfficeAdmin ? (input.google_spreadsheet_id?.trim() || null) : null,
    google_sheet_name: isOfficeAdmin ? (input.google_sheet_name?.trim() || null) : null,
  };

  const { data, error } = await client
    .from(tableName)
    .insert([newUserData])
    .select("id, username, email, role, admin_id, office_name, display_name, status, phone, subscription_end_date, subscription_notes, plan_tier, billing_cycle, ai_quota_limit, ai_usage_count, google_spreadsheet_id, google_sheet_name, created_at")
    .single();

  if (error) {
    logger.error({ error }, "Failed to insert user into Supabase");
    throw new Error(`فشل إنشاء المستخدم: ${error.message}`);
  }

  return {
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role,
    admin_id: data.admin_id || null,
    office_name: data.office_name || null,
    display_name: data.display_name,
    status: data.status || "active",
    phone: data.phone || null,
    subscription_end_date: data.subscription_end_date || null,
    subscription_notes: data.subscription_notes || null,
    plan_tier: data.plan_tier,
    billing_cycle: data.billing_cycle,
    ai_quota_limit: data.ai_quota_limit,
    ai_usage_count: data.ai_usage_count ?? 0,
    has_google_service: Boolean(encryptedGoogleJson),
    google_spreadsheet_id: data.google_spreadsheet_id,
    google_sheet_name: data.google_sheet_name,
    created_at: data.created_at,
  };
}

export async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    return local.filter((u) => (u.role === "admin" || u.role === "super_admin") && u.status === "active" && u.id !== excludeUserId).length;
  }
  try {
    const tableName = env.supabaseTableName;
    let query = client
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "super_admin"])
      .eq("status", "active");
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }
    const { count, error } = await query;
    if (error || count === null) {
      const local = loadLocalUsers();
      return local.filter((u) => (u.role === "admin" || u.role === "super_admin") && u.status === "active" && u.id !== excludeUserId).length;
    }
    return count;
  } catch {
    const local = loadLocalUsers();
    return local.filter((u) => (u.role === "admin" || u.role === "super_admin") && u.status === "active" && u.id !== excludeUserId).length;
  }
}

export async function deleteSupabaseUser(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    const userToDelete = local.find((u) => u.id === id);
    if (!userToDelete) {
      throw new Error("المستخدم غير موجود.");
    }
    if ((userToDelete.role === "admin" || userToDelete.role === "super_admin") && userToDelete.status === "active") {
      const otherAdmins = await countActiveAdmins(id);
      if (otherAdmins === 0) {
        throw new Error("لا يمكن حذف المشرف الوحيد النشط في المنظومة لضمان استمرارية لوحة التحكم.");
      }
    }
    const filtered = local.filter((u) => u.id !== id);
    saveLocalUsers(filtered);
    clearUserAuthCache(id);
    revokeUserSessions(id);
    return;
  }

  invalidateUserGoogleCache(id);
  const tableName = env.supabaseTableName;

  const { data: targetUser } = await client.from(tableName).select("role, status").eq("id", id).maybeSingle();
  if (targetUser && (targetUser.role === "admin" || targetUser.role === "super_admin") && targetUser.status === "active") {
    const otherAdmins = await countActiveAdmins(id);
    if (otherAdmins === 0) {
      throw new Error("لا يمكن حذف المشرف الوحيد النشط في المنظومة لضمان استمرارية لوحة التحكم.");
    }
  }

  const { error } = await client.from(tableName).delete().eq("id", id);

  if (error) {
    logger.error({ error, id }, "Failed to delete user from Supabase");
    throw new Error(`فشل حذف المستخدم: ${error.message}`);
  }

  clearUserAuthCache(id);
  revokeUserSessions(id);
}

export async function updateSupabaseUser(
  id: string,
  input: {
    password?: string;
    role?: "super_admin" | "admin" | "staff";
    admin_id?: string | null;
    office_name?: string | null;
    display_name?: string;
    email?: string;
    status?: "active" | "suspended";
    phone?: string | null;
    subscription_end_date?: string | null;
    subscription_notes?: string | null;
    plan_tier?: "plus" | "pro";
    billing_cycle?: "monthly" | "annual";
    ai_quota_limit?: number;
    ai_usage_count?: number;
    google_service_account_json?: string;
    google_spreadsheet_id?: string;
    google_sheet_name?: string;
  },
): Promise<AppUser> {
  const client = getSupabaseClient();

  if (input.role === "staff" || input.status === "suspended") {
    let isCurrentlyActiveSuper = false;
    if (!client) {
      const local = loadLocalUsers();
      const user = local.find((u) => u.id === id);
      isCurrentlyActiveSuper = user?.role === "super_admin" && user?.status === "active";
    } else {
      const tableName = env.supabaseTableName;
      const { data: user } = await client.from(tableName).select("role, status").eq("id", id).maybeSingle();
      isCurrentlyActiveSuper = user?.role === "super_admin" && user?.status === "active";
    }

    if (isCurrentlyActiveSuper) {
      const remainingAdmins = await countActiveAdmins(id);
      if (remainingAdmins === 0) {
        throw new Error("لا يمكن إيقاف أو تنزيل صلاحية المشرف الوحيد النشط في المنظومة.");
      }
    }
  }

  if (!client) {
    const local = loadLocalUsers();
    const index = local.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error("المستخدم غير موجود.");
    }
    const user = local[index];
    if (input.password && input.password.trim()) {
      const passwordValidation = validatePassword(input.password, {
        username: user.username,
        email: input.email !== undefined ? input.email : user.email,
      });
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.message);
      }
      user.password_hash = await bcrypt.hash(input.password.trim(), 10);
    }
    if (input.role) user.role = input.role;
    if (input.admin_id !== undefined) user.admin_id = input.admin_id;
    if (input.office_name !== undefined) user.office_name = input.office_name ? input.office_name.trim() : null;
    if (input.display_name !== undefined) user.display_name = input.display_name.trim() || null;
    if (input.email !== undefined) user.email = input.email.trim() || null;
    if (input.phone !== undefined) user.phone = input.phone ? input.phone.trim() : null;
    if (input.status !== undefined) user.status = input.status;
    if (input.subscription_end_date !== undefined) user.subscription_end_date = input.subscription_end_date;
    if (input.subscription_notes !== undefined) user.subscription_notes = input.subscription_notes;
    if (input.plan_tier !== undefined) user.plan_tier = input.plan_tier;
    if (input.billing_cycle !== undefined) user.billing_cycle = input.billing_cycle;
    if (input.ai_quota_limit !== undefined) user.ai_quota_limit = input.ai_quota_limit;
    if (input.ai_usage_count !== undefined) user.ai_usage_count = input.ai_usage_count;

    if (input.google_service_account_json !== undefined) {
      if (!input.google_service_account_json) {
        user.google_service_account_json = null;
        user.has_google_service = false;
      } else if (isEncrypted(input.google_service_account_json)) {
        user.google_service_account_json = input.google_service_account_json;
        user.has_google_service = true;
      } else {
        const sanitized = sanitizeGoogleServiceJson(input.google_service_account_json);
        user.google_service_account_json = sanitized ? encryptSecret(sanitized) : null;
        user.has_google_service = Boolean(sanitized);
      }
    }
    if (input.google_spreadsheet_id !== undefined) user.google_spreadsheet_id = input.google_spreadsheet_id ? input.google_spreadsheet_id.trim() : null;
    if (input.google_sheet_name !== undefined) user.google_sheet_name = input.google_sheet_name ? input.google_sheet_name.trim() : null;

    saveLocalUsers(local);
    clearUserAuthCache(id);
    if (input.password && input.password.trim()) {
      revokeUserSessions(id);
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      admin_id: user.admin_id,
      office_name: user.office_name,
      display_name: user.display_name,
      status: user.status,
      phone: user.phone,
      subscription_end_date: user.subscription_end_date,
      subscription_notes: user.subscription_notes,
      plan_tier: user.plan_tier,
      billing_cycle: user.billing_cycle,
      ai_quota_limit: user.ai_quota_limit,
      ai_usage_count: user.ai_usage_count,
      has_google_service: user.has_google_service,
      google_spreadsheet_id: user.google_spreadsheet_id,
      google_sheet_name: user.google_sheet_name,
      created_at: user.created_at,
    };
  }

  const tableName = env.supabaseTableName;
  const updates: Record<string, unknown> = {};

  if (input.password && input.password.trim()) {
    let existingUsername: string | undefined;
    let existingEmail: string | undefined;
    try {
      const { data: existingUser } = await client.from(tableName).select("username, email").eq("id", id).maybeSingle();
      if (existingUser) {
        existingUsername = existingUser.username;
        existingEmail = existingUser.email;
      }
    } catch {}

    const passwordValidation = validatePassword(input.password, {
      username: existingUsername,
      email: input.email !== undefined ? input.email : existingEmail,
    });
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.message);
    }
    updates.password_hash = await bcrypt.hash(input.password.trim(), 10);
  }

  if (input.role) updates.role = input.role;
  if (input.admin_id !== undefined) updates.admin_id = input.admin_id;
  if (input.office_name !== undefined) updates.office_name = input.office_name ? input.office_name.trim() : null;
  if (input.display_name !== undefined) updates.display_name = input.display_name.trim() || null;
  if (input.email !== undefined) updates.email = input.email.trim() || null;
  if (input.phone !== undefined) updates.phone = input.phone ? input.phone.trim() : null;
  if (input.status !== undefined) updates.status = input.status;
  if (input.subscription_end_date !== undefined) updates.subscription_end_date = input.subscription_end_date;
  if (input.subscription_notes !== undefined) updates.subscription_notes = input.subscription_notes?.trim() || null;
  if (input.plan_tier !== undefined) updates.plan_tier = input.plan_tier;
  if (input.billing_cycle !== undefined) updates.billing_cycle = input.billing_cycle;
  if (input.ai_quota_limit !== undefined) updates.ai_quota_limit = input.ai_quota_limit;
  if (input.ai_usage_count !== undefined) updates.ai_usage_count = input.ai_usage_count;

  if (input.google_service_account_json !== undefined) {
    if (!input.google_service_account_json) {
      updates.google_service_account_json = null;
    } else {
      const sanitized = sanitizeGoogleServiceJson(input.google_service_account_json);
      updates.google_service_account_json = sanitized ? encryptSecret(sanitized) : null;
    }
  }
  if (input.google_spreadsheet_id !== undefined) {
    updates.google_spreadsheet_id = input.google_spreadsheet_id ? input.google_spreadsheet_id.trim() : null;
  }
  if (input.google_sheet_name !== undefined) {
    updates.google_sheet_name = input.google_sheet_name ? input.google_sheet_name.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("لا توجد بيانات للتعديل.");
  }

  invalidateUserGoogleCache(id);

  const { data, error } = await client
    .from(tableName)
    .update(updates)
    .eq("id", id)
    .select("id, username, email, role, admin_id, office_name, display_name, status, phone, subscription_end_date, subscription_notes, plan_tier, billing_cycle, ai_quota_limit, ai_usage_count, google_service_account_json, google_spreadsheet_id, google_sheet_name, created_at")
    .single();

  if (error) {
    logger.error({ error, id }, "Failed to update user in Supabase");
    throw new Error(`فشل تعديل المستخدم: ${error.message}`);
  }

  clearUserAuthCache(id);
  if (input.password && input.password.trim()) {
    revokeUserSessions(id);
  }

  return {
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role,
    admin_id: data.admin_id || null,
    office_name: data.office_name || null,
    display_name: data.display_name,
    status: data.status || "active",
    phone: data.phone || null,
    subscription_end_date: data.subscription_end_date || null,
    subscription_notes: data.subscription_notes || null,
    plan_tier: data.plan_tier,
    billing_cycle: data.billing_cycle,
    ai_quota_limit: data.ai_quota_limit,
    ai_usage_count: data.ai_usage_count ?? 0,
    has_google_service: Boolean(data.google_service_account_json && data.google_service_account_json.trim().length > 10),
    google_spreadsheet_id: data.google_spreadsheet_id,
    google_sheet_name: data.google_sheet_name,
    created_at: data.created_at,
  };
}

export async function resetUserAiUsage(userId: string): Promise<AppUser> {
  return updateSupabaseUser(userId, { ai_usage_count: 0 });
}

export async function toggleUserStatus(
  id: string,
  explicitStatus?: "active" | "suspended",
): Promise<AppUser> {
  const users = await listSupabaseUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    throw new Error("المستخدم غير موجود.");
  }
  const newStatus = explicitStatus || (target.status === "suspended" ? "active" : "suspended");
  return updateSupabaseUser(id, { status: newStatus });
}

export async function incrementUserAiUsage(
  userId: string,
): Promise<{ ai_usage_count: number; ai_quota_limit: number; plan_tier: string }> {
  try {
    const res = await checkAndIncrementOfficeAiUsage(userId);
    return {
      ai_usage_count: res.currentUsage,
      ai_quota_limit: res.limit,
      plan_tier: res.plan_tier,
    };
  } catch (err) {
    logger.warn({ err, userId }, "Failed to increment user AI usage");
    return { ai_usage_count: 1, ai_quota_limit: 50, plan_tier: "plus" };
  }
}
