import { getSupabaseClient } from "./supabase.service";
import { isInMemoryFallbackAllowed } from "./postgres.service";
import { logger } from "../lib/logger";

export const ATTACHMENTS_BUCKET = "attachments";

// Test-only in-memory storage. Strictly gated by isInMemoryFallbackAllowed().
const memoryStorage = new Map<string, { buffer: Buffer; mimeType: string; uploadedAt: number }>();

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, "_");
}

export async function uploadFile(
  officeId: string,
  relatedRecordType: string,
  relatedRecordId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ filePath: string }> {
  const safeName = sanitizeFileName(fileName);
  const filePath = `${officeId}/${relatedRecordType}/${relatedRecordId}/${Date.now()}_${safeName}`;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error && data) {
        if (isInMemoryFallbackAllowed()) {
          memoryStorage.set(filePath, { buffer: fileBuffer, mimeType, uploadedAt: Date.now() });
        }
        return { filePath: data.path || filePath };
      }

      if (error) {
        logger.error({ error, filePath }, "Supabase storage upload failed");
        if (!isInMemoryFallbackAllowed()) {
          throw new Error("فشل رفع الملف، حاول مرة أخرى");
        }
      }
    } catch (err: any) {
      if (!isInMemoryFallbackAllowed()) {
        logger.error({ err, filePath }, "Supabase storage upload exception");
        throw new Error(err?.message && err.message.includes("فشل") ? err.message : "فشل رفع الملف، حاول مرة أخرى");
      }
      logger.warn({ err, filePath }, "Supabase storage upload error, using test memory fallback");
    }
  } else if (!isInMemoryFallbackAllowed()) {
    logger.error({ filePath }, "Supabase storage client is not configured");
    throw new Error("فشل رفع الملف، حاول مرة أخرى");
  }

  // Fallback storage - test environment ONLY
  if (!isInMemoryFallbackAllowed()) {
    throw new Error("فشل رفع الملف، حاول مرة أخرى");
  }

  memoryStorage.set(filePath, { buffer: fileBuffer, mimeType, uploadedAt: Date.now() });
  return { filePath };
}

export async function createSignedUrl(filePath: string, expiresInSeconds: number = 60): Promise<string> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(filePath, expiresInSeconds);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
      if (error) {
        logger.error({ error, filePath }, "Supabase storage createSignedUrl failed");
        if (!isInMemoryFallbackAllowed()) {
          throw new Error("فشل استخراج رابط تحميل الملف");
        }
      }
    } catch (err: any) {
      if (!isInMemoryFallbackAllowed()) {
        logger.error({ err, filePath }, "Supabase storage createSignedUrl exception");
        throw new Error("فشل استخراج رابط تحميل الملف");
      }
      logger.warn({ err, filePath }, "Supabase storage createSignedUrl error, falling back in test");
    }
  } else if (!isInMemoryFallbackAllowed()) {
    throw new Error("فشل استخراج رابط تحميل الملف");
  }

  // Fallback signed URL - test environment ONLY
  if (!isInMemoryFallbackAllowed()) {
    throw new Error("فشل استخراج رابط تحميل الملف");
  }

  const expiresAt = Date.now() + expiresInSeconds * 1000;
  return `https://storage.supabase.local/${ATTACHMENTS_BUCKET}/${encodeURIComponent(filePath)}?token=test_signed_token&expires=${expiresAt}`;
}

export async function deleteFile(filePath: string): Promise<boolean> {
  let success = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.storage
        .from(ATTACHMENTS_BUCKET)
        .remove([filePath]);

      if (!error) {
        success = true;
      } else {
        logger.error({ error, filePath }, "Supabase storage remove failed");
      }
    } catch (err) {
      logger.error({ err, filePath }, "Supabase storage remove exception");
    }
  }

  if (isInMemoryFallbackAllowed()) {
    const hadInMemory = memoryStorage.delete(filePath);
    return success || hadInMemory;
  }

  // Production: strictly reflects real cloud deletion success
  return success;
}

export function getMemoryFile(filePath: string) {
  if (!isInMemoryFallbackAllowed()) return null;
  return memoryStorage.get(filePath) || null;
}

export function clearMemoryStorage(): void {
  memoryStorage.clear();
}


