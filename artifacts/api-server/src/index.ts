import app from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./scheduler/reminderScheduler";

// Validate required secrets on startup in production
if (env.isProduction) {
  void env.sessionSecret;
}

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startReminderScheduler();
});
