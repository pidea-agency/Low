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

  // Test environment fallback ONLY
  if (isInMemoryFallbackAllowed()) {
    memoryStorage.set(filePath, { buffer: fileBuffer, mimeType, uploadedAt: Date.now() });
    return { filePath };
  }

  // Production: strictly uploaded to Supabase Storage or throws
  const client = getSupabaseClient();
  if (!client) {
    logger.error({ filePath }, "Supabase storage client is not configured");
    throw new Error("فشل رفع الملف، حاول مرة أخرى");
  }

  try {
    const { data, error } = await client.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error || !data) {
      logger.error({ error, filePath }, "Supabase storage upload failed");
      throw new Error("فشل رفع الملف، حاول مرة أخرى");
    }

    return { filePath: data.path || filePath };
  } catch (err: any) {
    logger.error({ err, filePath }, "Supabase storage upload exception");
    throw new Error(err?.message && err.message.includes("فشل") ? err.message : "فشل رفع الملف، حاول مرة أخرى");
  }
}

export async function createSignedUrl(filePath: string, expiresInSeconds: number = 60): Promise<string> {
  // Test environment fallback ONLY
  if (isInMemoryFallbackAllowed()) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `https://storage.supabase.local/${ATTACHMENTS_BUCKET}/${encodeURIComponent(filePath)}?token=test_signed_token&expires=${expiresAt}`;
  }

  // Production: strictly real signed URL or throws (no mock_signed_token)
  const client = getSupabaseClient();
  if (!client) {
    logger.error({ filePath }, "Supabase storage client is not configured");
    throw new Error("فشل استخراج رابط تحميل الملف");
  }

  try {
    const { data, error } = await client.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      logger.error({ error, filePath }, "Supabase storage createSignedUrl failed");
      throw new Error("فشل استخراج رابط تحميل الملف");
    }

    return data.signedUrl;
  } catch (err: any) {
    logger.error({ err, filePath }, "Supabase storage createSignedUrl exception");
    throw new Error(err?.message && err.message.includes("فشل") ? err.message : "فشل استخراج رابط تحميل الملف");
  }
}

export async function deleteFile(filePath: string): Promise<boolean> {
  // Test environment fallback ONLY
  if (isInMemoryFallbackAllowed()) {
    return memoryStorage.delete(filePath);
  }

  // Production: strictly reflects real cloud deletion result only
  const client = getSupabaseClient();
  if (!client) {
    logger.error({ filePath }, "Supabase storage client is not configured for file deletion");
    return false;
  }

  try {
    const { error } = await client.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([filePath]);

    if (error) {
      logger.error({ error, filePath }, "Supabase storage remove failed");
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, filePath }, "Supabase storage remove exception");
    return false;
  }
}

export function getMemoryFile(filePath: string) {
  if (isInMemoryFallbackAllowed()) {
    return memoryStorage.get(filePath) || null;
  }
  return null;
}

export function clearMemoryStorage(): void {
  if (isInMemoryFallbackAllowed()) {
    memoryStorage.clear();
  }
}
