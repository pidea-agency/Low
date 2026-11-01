import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env, isSupabaseConfigured } from "../config/env";
import { getSupabaseClient } from "../services/supabase.service";
import { logger } from "../lib/logger";

export interface RateLimitRecord {
  count: number;
  resetTime: number; // Unix timestamp in milliseconds
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  increment(key: string, windowMs: number): Promise<RateLimitRecord>;
  reset(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory store implementation for local dev, test environments,
 * or as a fallback.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitRecord>();

  async get(key: string): Promise<RateLimitRecord | null> {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.resetTime) {
      this.store.delete(key);
      return null;
    }
    return { ...record };
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || now > existing.resetTime) {
      const record: RateLimitRecord = { count: 1, resetTime: now + windowMs };
      this.store.set(key, record);
      return { ...record };
    }
    existing.count += 1;
    return { ...existing };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Supabase-backed persistent store implementation.
 * Stores counters in the `rate_limits` table across all serverless and container instances.
 */
export class SupabaseRateLimitStore implements RateLimitStore {
  async get(key: string): Promise<RateLimitRecord | null> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase client is not available");
    }

    const { data, error } = await client
      .from("rate_limits")
      .select("count, reset_time")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query rate_limits from Supabase: ${error.message}`);
    }
    if (!data) return null;

    const resetTime = Number(data.reset_time);
    const count = Number(data.count);
    if (Date.now() > resetTime) {
      return null;
    }
    return { count, resetTime };
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase client is not available");
    }

    const now = Date.now();
    const existing = await this.get(key);

    if (!existing) {
      const resetTime = now + windowMs;
      const { error } = await client.from("rate_limits").upsert({
        key,
        count: 1,
        reset_time: resetTime,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        throw new Error(`Failed to upsert rate limit in Supabase: ${error.message}`);
      }
      return { count: 1, resetTime };
    } else {
      const nextCount = existing.count + 1;
      const { error } = await client
        .from("rate_limits")
        .update({
          count: nextCount,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);
      if (error) {
        throw new Error(`Failed to update rate limit in Supabase: ${error.message}`);
      }
      return { count: nextCount, resetTime: existing.resetTime };
    }
  }

  async reset(key: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      await client.from("rate_limits").delete().eq("key", key);
    } catch (err) {
      logger.error({ err, key }, "Failed to delete rate limit key in Supabase");
    }
  }

  async clear(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      await client.from("rate_limits").delete().neq("key", "");
    } catch (err) {
      logger.error({ err }, "Failed to clear rate limits in Supabase");
    }
  }
}

// Global active store singleton
let _customStore: RateLimitStore | null = null;
const _defaultMemoryStore = new MemoryRateLimitStore();

export function setGlobalRateLimitStore(store: RateLimitStore | null): void {
  _customStore = store;
}

export function getGlobalRateLimitStore(): RateLimitStore {
  if (_customStore) {
    return _customStore;
  }
  if (isSupabaseConfigured()) {
    return new SupabaseRateLimitStore();
  }
  return _defaultMemoryStore;
}

/**
 * Safely extracts client IP.
 * Uses Express req.ip (which respects trust proxy configuration) or connection remoteAddress.
 * Never directly trusts unverified client-supplied headers.
 */
export function getClientIp(req: Request): string {
  if (req.ip) {
    return req.ip;
  }
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return socketIp;
  }
  return "127.0.0.1";
}

export interface SharedRateLimiterOptions {
  windowMs?: number;
  maxPerAccount?: number;
  maxPerIp?: number;
  store?: RateLimitStore;
  message?: string;
}

/**
 * Creates a rate limiter middleware backed by a shared store.
 * Tracks failed login attempts per IP and per account, with fail-closed protection.
 */
export function createSharedRateLimiter(options: SharedRateLimiterOptions = {}) {
  return async function sharedRateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const windowMs = options.windowMs ?? env.rateLimitWindowMs;
    const maxPerAccount = options.maxPerAccount ?? env.rateLimitLoginMaxPerAccount;
    const maxPerIp = options.maxPerIp ?? env.rateLimitLoginMaxPerIp;
    const store = options.store ?? getGlobalRateLimitStore();

    const safeIp = getClientIp(req);
    const rawUsername = req.body?.username;
    const cleanUsername = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    const ipKey = `login:ip:${safeIp}`;
    const accountKey = cleanUsername ? `login:account:${cleanUsername}` : null;
    const now = Date.now();

    // 1. Pre-check: Check if IP or Account has exceeded allowed failed attempts
    try {
      const [ipRecord, accountRecord] = await Promise.all([
        store.get(ipKey),
        accountKey ? store.get(accountKey) : Promise.resolve(null),
      ]);

      let lockedRecord: RateLimitRecord | null = null;
      let lockReason = "";

      if (accountRecord && accountRecord.count >= maxPerAccount && now < accountRecord.resetTime) {
        lockedRecord = accountRecord;
        lockReason = "account";
      } else if (ipRecord && ipRecord.count >= maxPerIp && now < ipRecord.resetTime) {
        lockedRecord = ipRecord;
        lockReason = "ip";
      }

      if (lockedRecord) {
        const retryAfterSeconds = Math.max(1, Math.ceil((lockedRecord.resetTime - now) / 1000));
        const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
        const defaultMessage = `تم تجاوز عدد المحاولات. حاول بعد ${minutes} دقيقة.`;
        const message = options.message
          ? options.message.includes("${minutes}")
            ? options.message.replace("${minutes}", String(minutes))
            : options.message
          : defaultMessage;

        // Safe logging: never log passwords!
        const usernameHash = cleanUsername
          ? crypto.createHash("sha256").update(cleanUsername).digest("hex").slice(0, 10)
          : "none";
        logger.warn(
          {
            ip: safeIp,
            accountHash: usernameHash,
            route: req.originalUrl || req.url,
            lockReason,
            retryAfterSeconds,
          },
          "Rate limit exceeded on login attempt"
        );

        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json({
          error: message,
          retryAfterSeconds,
        });
        return;
      }
    } catch (err: any) {
      // Fail closed: if shared store is unreachable, do not allow unlimited attempts
      logger.error(
        {
          err,
          ip: safeIp,
          route: req.originalUrl || req.url,
        },
        "Rate limiter store unreachable - failing closed (503)"
      );
      res.status(503).json({
        error: "تعذر التحقق من قيود محاولات الدخول بسبب عطل مؤقت في الخدمة. يرجى المحاولة لاحقاً.",
      });
      return;
    }

    // 2. Intercept response to track failed attempts and clear on success
    let recorded = false;
    const recordOutcome = async () => {
      if (recorded) return;
      recorded = true;

      try {
        if (res.statusCode === 401 || res.statusCode === 403) {
          const incPromises: Promise<any>[] = [store.increment(ipKey, windowMs)];
          if (accountKey) {
            incPromises.push(store.increment(accountKey, windowMs));
          }
          await Promise.all(incPromises);

          const usernameHash = cleanUsername
            ? crypto.createHash("sha256").update(cleanUsername).digest("hex").slice(0, 10)
            : "none";
          logger.info(
            {
              ip: safeIp,
              accountHash: usernameHash,
              route: req.originalUrl || req.url,
              statusCode: res.statusCode,
            },
            "Failed login attempt recorded"
          );
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          if (accountKey) {
            await store.reset(accountKey);
          }
        }
      } catch (err) {
        logger.error({ err, ip: safeIp }, "Failed to update rate limit store after response");
      }
    };

    // Hook into res.json / res.send so store update initiates immediately
    const origJson = res.json.bind(res);
    res.json = function (body: any) {
      recordOutcome();
      return origJson(body);
    };

    res.on("finish", recordOutcome);
    res.on("close", recordOutcome);

    next();
  };
}

/**
 * Clear rate limits helper (useful for manual unblocking and tests).
 */
export async function clearRateLimits(options: { ip?: string; username?: string } = {}): Promise<void> {
  const store = getGlobalRateLimitStore();
  if (options.ip) {
    await store.reset(`login:ip:${options.ip}`);
  }
  if (options.username) {
    const clean = options.username.trim().toLowerCase();
    await store.reset(`login:account:${clean}`);
  }
  if (!options.ip && !options.username) {
    await store.clear();
  }
}

/** Legacy backwards-compatible factory */
export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
}) {
  return createSharedRateLimiter({
    windowMs: options.windowMs,
    maxPerAccount: options.max,
    maxPerIp: options.max,
    message: options.message,
  });
}

/** Default rate limiter for lawyer login */
export const loginRateLimiter = createSharedRateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxPerAccount: env.rateLimitLoginMaxPerAccount,
  maxPerIp: env.rateLimitLoginMaxPerIp,
  message: "تم تجاوز عدد المحاولات. حاول بعد ${minutes} دقيقة.",
});

/** Default rate limiter for admin login */
export const adminLoginRateLimiter = createSharedRateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxPerAccount: env.rateLimitLoginMaxPerAccount,
  maxPerIp: env.rateLimitLoginMaxPerIp,
  message: "تم تجاوز عدد المحاولات. حاول بعد ${minutes} دقيقة.",
});
