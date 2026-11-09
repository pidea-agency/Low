import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Image as ImageIcon,
  File,
  UploadCloud,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Eye,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface AttachmentItem {
  id: string;
  officeId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  relatedRecordType: 'client' | 'poa' | 'judgment' | 'session' | 'task';
  relatedRecordId: string;
  createdAt: string;
  uploaderName?: string;
}

export interface AttachmentsPanelProps {
  relatedRecordType: 'client' | 'poa' | 'judgment' | 'session' | 'task';
  relatedRecordId: string | number;
  title?: string;
  className?: string;
  readOnly?: boolean;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 بايت';
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function AttachmentsPanel({
  relatedRecordType,
  relatedRecordId,
  title = 'المرفقات والوثائق',
  className = '',
  readOnly = false,
}: AttachmentsPanelProps) {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lightbox & Delete states
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttachmentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const currentUserId = currentUser?.id;

  // Load attachments
  const loadAttachments = useCallback(async () => {
    if (!relatedRecordId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/attachments?related_record_type=${relatedRecordType}&related_record_id=${encodeURIComponent(
          String(relatedRecordId),
        )}`,
        { credentials: 'include' },
      );

      if (res.ok) {
        const data = await res.json();
        setAttachments(Array.isArray(data) ? data : []);
      } else if (res.status === 403) {
        setErrorMsg('ليس لديك صلاحية لعرض مرفقات هذا السجل.');
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'تعذر جلب المرفقات.');
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم لجلب المرفقات.');
    } finally {
      setIsLoading(false);
    }
  }, [relatedRecordType, relatedRecordId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  // Handle file upload
  const handleUpload = async (file: File) => {
    setErrorMsg(null);

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`حجم الملف "${file.name}" يتجاوز الحد الأقصى (15 ميجابايت).`);
      toast({
        title: 'الملف كبير جداً',
        description: 'الحد الأقصى لحجم الملف المرفوع هو 15 ميجابايت.',
        variant: 'destructive',
      });
      return;
    }

    // Type validation
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const dangerous = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.vbs', '.py', '.msi'];
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.doc'];

    if (dangerous.includes(ext) || !allowed.includes(ext)) {
      setErrorMsg('نوع الملف غير مسموح به. الأنواع المدعومة: PDF، صور (JPG, PNG)، ومستندات Word (DOCX).');
      toast({
        title: 'نوع الملف غير مدعوم',
        description: 'يرجى اختيار ملف PDF أو صورة أو مستند Word.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('relatedRecordType', relatedRecordType);
    formData.append('relatedRecordId', String(relatedRecordId));

    try {
      setUploadProgress(50);
      const res = await fetch('/api/attachments', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      setUploadProgress(90);

      if (res.ok) {
        const savedAttachment = await res.json();
        setUploadProgress(100);
        toast({
          title: 'تم رفع المرفق بنجاح ✅',
          description: `تم حفظ الملف "${savedAttachment.fileName}" وتخزينه بأمان.`,
        });
        loadAttachments();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل رفع الملف.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء رفع الملف.');
      toast({
        title: 'خطأ في الرفع',
        description: err.message || 'تعذر حفظ المرفق.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (readOnly) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  // Download signed URL
  const handleDownload = async (attachment: AttachmentItem) => {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}/download?json=true`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل التحميل',
          description: err.error || 'تعذر توليد رابط التحميل.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'تعذر الاتصال بالخادم لتحميل المرفق.',
        variant: 'destructive',
      });
    }
  };

  // Preview Image
  const handlePreview = async (attachment: AttachmentItem) => {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}/download?json=true`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setPreviewImage({ url: data.url, name: attachment.fileName });
        }
      }
    } catch {
      handleDownload(attachment);
    }
  };

  // Delete attachment
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/attachments/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({
          title: 'تم حذف المرفق 🗑️',
          description: 'تم حذف الملف نهائياً من التخزين السحابي.',
        });
        setDeleteTarget(null);
        loadAttachments();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'خطأ في الحذف',
          description: err.error || 'تعذر حذف المرفق.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'تعذر الاتصال بالخادم لحذف المرفق.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isImage = (mime: string, name: string) => {
    return (
      mime.startsWith('image/') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp')
    );
  };

  const isPdf = (mime: string, name: string) => {
    return mime.includes('pdf') || name.endsWith('.pdf');
  };

  return (
    <div className={`space-y-4 ${className}`} dir="rtl">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0B2A4A]/10 dark:bg-[#C99732]/15 flex items-center justify-center text-[#0B2A4A] dark:text-[#C99732]">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                {attachments.length}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              تخزين سحابي خاص ومحمي — PDF، صور ومستندات Word (حتى 15 ميجابايت)
            </p>
          </div>
        </div>

        {!readOnly && (
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1.5 text-xs bg-[#C99732] hover:bg-[#B28325] text-white shadow-xs border-0 cursor-pointer"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5" />
            )}
            <span>رفع ملف</span>
          </Button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
          }
        }}
      />

      {/* Error alert */}
      {errorMsg && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-primary">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              جارٍ رفع الملف وتأمينه في التخزين السحابي...
            </span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-1.5" />
        </div>
      )}

      {/* Drag & Drop Zone */}
      {!readOnly && attachments.length === 0 && !isUploading && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-[#C9A449] bg-[#C9A449]/10'
              : 'border-border/80 hover:border-primary/50 bg-card/50'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-muted mx-auto mb-2 flex items-center justify-center text-muted-foreground">
            <UploadCloud className="w-6 h-6 text-[#C9A449]" />
          </div>
          <p className="text-xs font-bold text-foreground">
            اسحب الملف وأفلته هنا، أو <span className="text-primary underline">انقر لاختيار ملف</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            الحد الأقصى: 15 ميجابايت (PDF, JPG, PNG, DOCX)
          </p>
        </div>
      )}

      {/* Attachments List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>جارٍ تحميل المرفقات...</span>
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att) => {
            const isImg = isImage(att.mimeType, att.fileName);
            const isDocumentPdf = isPdf(att.mimeType, att.fileName);
            const canDelete = isAdmin || att.uploadedBy === currentUserId;

            return (
              <div
                key={att.id}
                className="group p-3 rounded-xl border border-border bg-card/80 hover:border-primary/40 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* File Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* File Type Icon / Thumbnail */}
                  <div
                    onClick={() => (isImg ? handlePreview(att) : handleDownload(att))}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border ${
                      isImg
                        ? 'border-[#C9A449]/40 bg-[#C9A449]/10 text-[#C9A449]'
                        : isDocumentPdf
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isImg ? (
                      <ImageIcon className="w-5 h-5" />
                    ) : isDocumentPdf ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <File className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      onClick={() => handleDownload(att)}
                      className="text-xs font-bold text-foreground hover:text-primary transition-colors truncate cursor-pointer"
                      title={att.fileName}
                    >
                      {att.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <span className="font-mono">{formatBytes(att.fileSize)}</span>
                      <span>•</span>
                      <span>{formatDate(att.createdAt)}</span>
                      {att.uploaderName && (
                        <>
                          <span>•</span>
                          <span>بواسطة: {att.uploaderName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {isImg && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(att)}
                      className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      title="معاينة الصورة"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">معاينة</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(att)}
                    className="h-8 px-2.5 text-xs gap-1 border-border/70 hover:bg-muted font-medium"
                    title="تحميل المرفق برابط موقّع وآمن"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>تحميل</span>
                  </Button>

                  {!readOnly && canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(att)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="حذف المرفق"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Lightbox Image Preview Dialog */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] bg-card rounded-2xl overflow-hidden border border-border shadow-2xl p-2 flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between p-2 border-b border-border/60">
              <span className="text-xs font-bold text-foreground truncate">{previewImage.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewImage(null)}
                className="h-7 w-7 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh]">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="rounded-lg object-contain max-h-[70vh] mx-auto shadow-sm"
              />
            </div>
            <div className="w-full p-2 border-t border-border/60 flex justify-end">
              <Button
                size="sm"
                onClick={() => window.open(previewImage.url, '_blank')}
                className="gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                تحميل الصورة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl" className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف المرفق نهائياً</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs">
              هل أنت متأكد من رغبتك في حذف الملف «{deleteTarget?.fileName}»؟ سيتم حذفه نهائياً من
              التخزين السحابي وقاعدة البيانات ولا يمكن استرجاعه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الحذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

