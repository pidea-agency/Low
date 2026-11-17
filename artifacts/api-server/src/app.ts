import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { env, isSupabaseConfigured } from "./config/env";
import { refreshSettingsFromSupabase } from "./config/settings-store";

// Startup check: Fail loudly if Supabase credentials are missing (outside tests)
if (!isSupabaseConfigured() && process.env.NODE_ENV !== "test") {
  logger.fatal("FATAL: Database is not configured. Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
  throw new Error("FATAL: Database is not configured. Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
}

// Startup check: Fail loudly if SETTINGS_ENCRYPTION_KEY and SESSION_SECRET are both missing (outside tests)
const activeEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim();
if (activeEncryptionKey && !process.env.SETTINGS_ENCRYPTION_KEY?.trim()) {
  process.env.SETTINGS_ENCRYPTION_KEY = activeEncryptionKey;
}
if (!activeEncryptionKey && process.env.NODE_ENV !== "test") {
  logger.fatal("FATAL: Neither SETTINGS_ENCRYPTION_KEY nor SESSION_SECRET is configured. The server cannot start without a valid encryption key.");
  throw new Error("FATAL: SETTINGS_ENCRYPTION_KEY or SESSION_SECRET environment variable is required.");
}

// Pre-load runtime settings from Supabase platform_settings into memory cache
void refreshSettingsFromSupabase().catch((err) => {
  logger.warn({ err }, "Initial settings sync from Supabase encountered error, falling back to disk/env");
});

// ESM and CJS safe directory resolution
const currentFilename = typeof __filename !== "undefined" ? __filename : (typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : process.cwd());
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

const app: Express = express();

// Trust the first proxy (Render/Vercel edge)
app.set("trust proxy", 1);

const pinoHttpMiddleware: any = (pinoHttp as any).default || pinoHttp;

app.use(
  pinoHttpMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
// Handle Vercel Serverless Function pre-parsed body and pre-populated cookies
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object" && !(req as any)._body) {
    (req as any)._body = true;
  }
  // Ensure req.secret is always set for signed cookies (Vercel edge doesn't set it)
  (req as any).secret = env.sessionSecret;
  if (req.cookies && !req.signedCookies) {
    delete (req as any).cookies;
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.sessionSecret));

// Mount API routes under /api and root (to handle both rewritten and direct paths)
app.use("/api", router);
app.use(router);

// Serve static frontend files in production / standalone server (Render)
const possibleDistPaths = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "artifacts/court-session-management/dist"),
  path.resolve(currentDirname, "../../court-session-management/dist"),
  path.resolve(currentDirname, "../dist"),
  path.resolve(currentDirname, "../../dist"),
];

const distPath = possibleDistPaths.find((p) => {
  try {
    return fs.existsSync(path.join(p, "index.html"));
  } catch {
    return false;
  }
});

if (distPath) {
  logger.info(`[Server] Serving static frontend from: ${distPath}`);
  app.use(express.static(distPath));
  // SPA fallback — return index.html for all non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Global Express error handler — ensures JSON responses instead of default HTML 500
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "Express request error");
  if (
    err?.statusCode === 503 ||
    err?.code === "DATABASE_UNAVAILABLE" ||
    err?.name === "DatabaseUnavailableError" ||
    String(err?.message || "").includes("قاعدة البيانات غير متصلة")
  ) {
    res.status(503).json({
      error: "قاعدة البيانات غير متصلة حالياً",
      code: "DATABASE_UNAVAILABLE",
    });
    return;
  }
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
});

export default app;
