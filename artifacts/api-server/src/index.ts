import app from "./app";
import { env, isSupabaseConfigured } from "./config/env";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./scheduler/reminderScheduler";

// Startup check: Fail loudly if Supabase credentials are missing
if (!isSupabaseConfigured()) {
  logger.fatal("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) are not configured. The server cannot boot in degraded in-memory mode.");
  if (process.env.NODE_ENV !== "test") {
    throw new Error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database connectivity.");
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
