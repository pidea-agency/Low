import app from "./app";
import { env, isSupabaseConfigured, isFrontendUrlConfigured } from "./config/env";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./scheduler/reminderScheduler";

// Startup check: Fail loudly if FRONTEND_URL and APP_URL are missing
if (!isFrontendUrlConfigured()) {
  logger.fatal("FATAL: FRONTEND_URL is not set — all outgoing links will be broken");
  if (process.env.NODE_ENV !== "test") {
    throw new Error("FRONTEND_URL is not set — all outgoing links will be broken");
  }
}

// Startup check: Fail loudly if Supabase credentials are missing
if (!isSupabaseConfigured()) {
  logger.fatal("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) are not configured. The server cannot boot in degraded in-memory mode.");
  if (process.env.NODE_ENV !== "test") {
    throw new Error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database connectivity.");
  }
}

// Startup check: Fail loudly if SETTINGS_ENCRYPTION_KEY and SESSION_SECRET are both missing
const activeEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim();
if (activeEncryptionKey && !process.env.SETTINGS_ENCRYPTION_KEY?.trim()) {
  process.env.SETTINGS_ENCRYPTION_KEY = activeEncryptionKey;
}
if (!activeEncryptionKey) {
  logger.fatal("FATAL: Neither SETTINGS_ENCRYPTION_KEY nor SESSION_SECRET is configured. The server cannot start without a valid encryption key.");
  if (process.env.NODE_ENV !== "test") {
    throw new Error("FATAL: SETTINGS_ENCRYPTION_KEY or SESSION_SECRET environment variable is required.");
  }
}

// Validate required secrets on startup in production
if (env.isProduction && !process.env.VERCEL) {
  void env.sessionSecret;
}

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env.VERCEL) {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startReminderScheduler();
  });
}

export default app;
