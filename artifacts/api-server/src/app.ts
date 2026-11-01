import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { env } from "./config/env";

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
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
});

export default app;
