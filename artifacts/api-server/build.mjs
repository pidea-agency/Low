import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
  // ── Vercel Serverless Function handler ─────────────────────────────────
  // Produces a self-contained CJS bundle at <root>/api/index.js that Vercel
  // discovers automatically as the /api/* serverless function.
  const rootDir = path.resolve(artifactDir, "..", "..");
  const vercelHandlerSrc = path.resolve(artifactDir, "src", "vercelHandler.ts");
  const vercelOutDir = path.resolve(rootDir, "api");

  await esbuild({
    entryPoints: [vercelHandlerSrc],
    platform: "node",
    bundle: true,
    format: "cjs",          // Vercel Node runtime requires CJS
    outfile: path.resolve(vercelOutDir, "index.js"),
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
      "import.meta.url": "__bannerImportMetaUrl",
    },
    external: [
      "*.node",
      "@google-cloud/*",
      "@google/*",
      "firebase-admin",
    ],
    sourcemap: false,
    plugins: [],
    banner: {
      js: `
"use strict";
const { createRequire: __bannerCrReq } = require('node:module');
const __bannerPath = require('node:path');
const __bannerUrl = require('node:url');
const __bannerImportMetaUrl = __bannerUrl.pathToFileURL(__filename).href;
globalThis.require = __bannerCrReq(__filename);
globalThis.__filename = __filename;
globalThis.__dirname = __bannerPath.dirname(__filename);
      `,
    },
  });
  console.log("[build] Vercel handler written to api/index.js");

  // Also write api/[...path].js for Vercel catch-all serverless function routing
  const fsPromises = require("node:fs/promises");
  await fsPromises.copyFile(
    path.resolve(vercelOutDir, "index.js"),
    path.resolve(vercelOutDir, "[...path].js"),
  );
  console.log("[build] Vercel catch-all handler written to api/[...path].js");
}
buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
