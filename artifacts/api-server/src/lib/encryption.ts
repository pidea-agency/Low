import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // Standard 128-bit auth tag

function getEncryptionKey(): Buffer {
  // Read SETTINGS_ENCRYPTION_KEY or fall back to SHA-256 of sessionSecret
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || env.sessionSecret || "court_system_secure_fallback_key";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<auth_tag_hex>:<cipher_hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * If the input is not in encrypted format (e.g. legacy plain JSON), returns input as-is.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:v1:")) {
    // Legacy unencrypted string
    return cipherText;
  }

  const parts = cipherText.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted format");
  }

  const iv = Buffer.from(parts[2], "hex");
  const authTag = Buffer.from(parts[3], "hex");
  const encrypted = parts[4];

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}

/**
 * Checks whether a string is currently encrypted with enc:v1 format.
 */
export function isEncrypted(text: string): boolean {
  return typeof text === "string" && text.startsWith("enc:v1:");
}

