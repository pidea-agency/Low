import { Router, type IRouter } from "express";
import formidable from "formidable";
import fs from "fs/promises";
import path from "path";
import {
  attachAuthUser,
  requireAuth,
  requireActiveSubscription,
  blockSuperAdminFromOfficeData,
} from "../middlewares/auth.middleware";
import * as postgresService from "../services/postgres.service";
import * as storageService from "../services/storage.service";
import { verifyRecordAccess } from "../utils/record-access";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Office data guard & active subscription
router.use(
  "/attachments",
  attachAuthUser,
  requireAuth,
  blockSuperAdminFromOfficeData,
  requireActiveSubscription,
);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".docx",
  ".doc",
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".php",
  ".js",
  ".vbs",
  ".py",
  ".msi",
  ".dll",
  ".com",
  ".scr",
  ".ps1",
]);

/**
 * POST /api/attachments
 * Multipart upload for an attachment linked to client, poa, judgment, session, or task.
 */
router.post("/attachments", async (req, res) => {
  const officeId = getOfficeId(req);
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    multiples: false,
  });

  let fields: formidable.Fields;
  let files: formidable.Files;

  try {
    [fields, files] = await form.parse(req);
  } catch (err: any) {
    if (
      err.code === 1016 ||
      err.message?.includes("maxFileSize") ||
      err.message?.includes("bigger than maxFileSize")
    ) {
      res.status(400).json({
        error: "حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت).",
      });
      return;
    }
    logger.error({ err }, "Formidable upload parse error");
    res.status(400).json({ error: "فشل استلام الملف المرفوع." });
    return;
  }

  // Extract file
  const rawFile = (files.file || files.attachment || Object.values(files)[0]) as
    | formidable.File
    | formidable.File[]
    | undefined;

  const uploadedFile = Array.isArray(rawFile) ? rawFile[0] : rawFile;

  if (!uploadedFile) {
    res.status(400).json({ error: "يرجى اختيار ملف لرفعه." });
    return;
  }

  const originalFilename = uploadedFile.originalFilename || "document";
  const ext = path.extname(originalFilename).toLowerCase();
  const mimeType = uploadedFile.mimetype || "application/octet-stream";
  const fileSize = uploadedFile.size;

  // File size double-check
  if (fileSize > MAX_FILE_SIZE) {
    try {
      await fs.unlink(uploadedFile.filepath);
    } catch {}
    res.status(400).json({
      error: "حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت).",
    });
    return;
  }

  // Type validation: reject dangerous scripts/executables & enforce allowed formats
  if (DANGEROUS_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
    try {
      await fs.unlink(uploadedFile.filepath);
    } catch {}
    res.status(400).json({
      error:
        "نوع الملف غير مدعوم أو غير مسموح به. الأنواع المسموحة هي: PDF، صور (JPG, PNG)، ومستندات Word (DOCX).",
    });
    return;
  }

  // Extract related record params
  const rawRecordType = Array.isArray(fields.relatedRecordType)
    ? fields.relatedRecordType[0]
    : fields.relatedRecordType || (fields as any).related_record_type;

  const rawRecordId = Array.isArray(fields.relatedRecordId)
    ? fields.relatedRecordId[0]
    : fields.relatedRecordId || (fields as any).related_record_id;

  const relatedRecordType = String(
    Array.isArray(rawRecordType) ? rawRecordType[0] : rawRecordType || "",
  ).trim();
  const relatedRecordId = String(
    Array.isArray(rawRecordId) ? rawRecordId[0] : rawRecordId || "",
  ).trim();

  if (!relatedRecordType || !relatedRecordId) {
    try {
      await fs.unlink(uploadedFile.filepath);
    } catch {}
    res.status(400).json({
      error:
        "يجب تحديد نوع السجل المرتبط ومعرفه (relatedRecordType و relatedRecordId).",
    });
    return;
  }

  const validTypes = ["client", "poa", "judgment", "session", "task", "case"];
  if (!validTypes.includes(relatedRecordType)) {
    try {
      await fs.unlink(uploadedFile.filepath);
    } catch {}
    res.status(400).json({
      error: `نوع السجل غير صالح. الأنواع المتاحة: ${validTypes.join(", ")}`,
    });
    return;
  }

  // Access check on the related record (staff must own/be assigned, admin can attach to anything in office)
  const accessCheck = await verifyRecordAccess(
    officeId,
    relatedRecordType,
    relatedRecordId,
    req.authUser!,
  );

  if (!accessCheck.allowed) {
    try {
      await fs.unlink(uploadedFile.filepath);
    } catch {}
    res.status(accessCheck.status || 403).json({ error: accessCheck.error });
    return;
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(uploadedFile.filepath);
  } finally {
    try {
      await fs.unlink(uploadedFile.filepath);
    } catch {}
  }

  try {
    // 1. Upload to Supabase Storage private bucket
    const { filePath } = await storageService.uploadFile(
      officeId,
      relatedRecordType,
      relatedRecordId,
      originalFilename,
      fileBuffer,
      mimeType,
    );

    // 2. Insert attachments row
    const attachment = await postgresService.createAttachment({
      officeId,
      uploadedBy: req.authUser!.userId!,
      fileName: originalFilename,
      filePath,
      fileSize,
      mimeType,
      relatedRecordType: relatedRecordType as any,
      relatedRecordId,
      uploaderName:
        (req.authUser as any)?.displayName || req.authUser!.username,
    });

    res.status(201).json(attachment);
  } catch (err: any) {
    logger.error({ err }, "Failed to save attachment");
    if (
      err?.statusCode === 503 ||
      err?.code === "DATABASE_UNAVAILABLE" ||
      err?.name === "DatabaseUnavailableError" ||
      String(err?.message || "").includes("قاعدة البيانات غير متصلة")
    ) {
      res.status(503).json({ error: "قاعدة البيانات غير متصلة حالياً", code: "DATABASE_UNAVAILABLE" });
      return;
    }
    res.status(500).json({ error: "فشل حفظ المرفق وتخزينه." });
  }
});

/**
 * GET /api/attachments?related_record_type=&related_record_id=
 * List attachments for a specific record after verifying permissions.
 */
router.get("/attachments", async (req, res) => {
  const officeId = getOfficeId(req);
  const relatedRecordType = String(
    req.query.related_record_type || req.query.relatedRecordType || "",
  ).trim();
  const relatedRecordId = String(
    req.query.related_record_id || req.query.relatedRecordId || "",
  ).trim();

  if (!relatedRecordType || !relatedRecordId) {
    res.status(400).json({
      error: "يجب تحديد نوع السجل المرتبط ومعرفه في الرابط.",
    });
    return;
  }

  // Verify access to the record
  const accessCheck = await verifyRecordAccess(
    officeId,
    relatedRecordType,
    relatedRecordId,
    req.authUser!,
  );

  if (!accessCheck.allowed) {
    res.status(accessCheck.status || 403).json({ error: accessCheck.error });
    return;
  }

  const attachments = await postgresService.listAttachments(
    officeId,
    relatedRecordType,
    relatedRecordId,
  );

  res.json(attachments);
});

/**
 * GET /api/attachments/:id/download
 * Generates a short-lived signed URL (60s) after verifying permissions and redirects or returns JSON URL.
 */
router.get("/attachments/:id/download", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = String(req.params.id);

  const attachment = await postgresService.getAttachmentById(id, officeId);
  if (!attachment) {
    res.status(404).json({ error: "المرفق غير موجود." });
    return;
  }

  // Re-check access to the related record
  const accessCheck = await verifyRecordAccess(
    officeId,
    attachment.relatedRecordType,
    attachment.relatedRecordId,
    req.authUser!,
  );

  if (!accessCheck.allowed) {
    res.status(accessCheck.status || 403).json({ error: accessCheck.error });
    return;
  }

  // Generate 60s signed URL
  const signedUrl = await storageService.createSignedUrl(attachment.filePath, 60);

  if (
    req.query.json === "true" ||
    req.headers.accept?.includes("application/json")
  ) {
    res.json({
      url: signedUrl,
      downloadUrl: signedUrl,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      expiresIn: 60,
    });
    return;
  }

  res.redirect(signedUrl);
});

/**
 * DELETE /api/attachments/:id
 * Removes from storage and deletes the database row. Only uploader or admin.
 */
router.delete("/attachments/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = String(req.params.id);

  const attachment = await postgresService.getAttachmentById(id, officeId);
  if (!attachment) {
    res.status(404).json({ error: "المرفق غير موجود." });
    return;
  }

  const isAdmin =
    req.authUser?.role === "admin" || req.authUser?.role === "super_admin";
  const isUploader = req.authUser?.userId === attachment.uploadedBy;

  if (!isAdmin && !isUploader) {
    res.status(403).json({
      error:
        "لا يمكنك حذف هذا المرفق، الحذف مقتصر على من قام برفعه أو مدير المكتب.",
    });
    return;
  }

  // Remove from storage
  await storageService.deleteFile(attachment.filePath);

  // Remove row from DB
  await postgresService.deleteAttachment(id, officeId);

  res.json({ success: true, message: "تم حذف المرفق بنجاح." });
});

export default router;
