import { env } from "../config/env";
import { logger } from "../lib/logger";

export interface SendActivationEmailParams {
  to: string;
  memberName: string;
  officeName?: string | null;
  token: string;
  expiryHours?: number;
}

export interface EmailSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

// In-memory record for testing and diagnostics
export interface SentEmailRecord {
  to: string;
  subject: string;
  token: string;
  activationUrl: string;
  timestamp: string;
}

const sentEmailsHistory: SentEmailRecord[] = [];

export function getSentEmailsHistory(): SentEmailRecord[] {
  return [...sentEmailsHistory];
}

export function clearSentEmailsHistory(): void {
  sentEmailsHistory.length = 0;
}

export function isEmailConfigured(): boolean {
  return Boolean(env.resendApiKey && env.resendApiKey.trim().length > 0);
}

/**
 * Sends an account activation email using the Resend HTTP API.
 * Fails gracefully without throwing, returning { success: false, error: message }.
 */
export async function sendActivationEmail(
  params: SendActivationEmailParams,
): Promise<EmailSendResult> {
  const { to, memberName, officeName, token } = params;
  const activationUrl = `${env.frontendUrl}/activate?token=${encodeURIComponent(token)}`;
  const displayOffice = officeName ? officeName.trim() : "مكتب المحاماة";

  // Record for debugging / testing
  sentEmailsHistory.push({
    to,
    subject: `دعوة تفعيل حسابك - ${displayOffice}`,
    token,
    activationUrl,
    timestamp: new Date().toISOString(),
  });

  const apiKey = env.resendApiKey;
  if (!apiKey || apiKey.trim() === "") {
    logger.warn(
      { to, memberName, activationUrl },
      "[EmailService] RESEND_API_KEY is not configured. Email not sent. Activation URL logged for development.",
    );
    return {
      success: false,
      error: "لم يتم ضبط مفتاح RESEND_API_KEY في إعدادات النظام. يرجى تزويد المحامي برابط التفعيل يدوياً.",
    };
  }

  const subject = `دعوة تفعيل حسابك - ${displayOffice}`;
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; direction: rtl; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .title { color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; }
    .subtitle { color: #64748b; font-size: 14px; margin: 0; }
    .content { color: #334155; font-size: 15px; line-height: 1.7; margin-bottom: 28px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 14px 32px; border-radius: 10px; font-weight: 600; text-decoration: none; font-size: 15px; }
    .link-box { background: #f1f5f9; border-radius: 8px; padding: 14px; font-size: 13px; color: #475569; word-break: break-all; text-align: left; direction: ltr; margin-top: 16px; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">دعوة للانضمام وتفعيل الحساب</h1>
      <p class="subtitle">${displayOffice}</p>
    </div>
    <div class="content">
      <p>مرحباً <strong>${memberName}</strong>،</p>
      <p>تمت دعوتك من قِبل إدارة <strong>${displayOffice}</strong> للانضمام إلى منظومة إدارة الجلسات والقضايا. لتفعيل حسابك وتعيين كلمة المرور الخاصة بك، يرجى الضغط على الزر أدناه:</p>
      <div class="btn-container">
        <a href="${activationUrl}" class="btn" target="_blank">تفعيل الحساب وتعيين كلمة المرور</a>
      </div>
      <p><strong>ملاحظة هامة:</strong> هذا الرابط صالح للاستخدام مرة واحدة ولمدة ${params.expiryHours || 48} ساعة فقط.</p>
      <p>إذا لم يعمل الزر معك، يمكنك نسخ الرابط التالي ولصقه في متصفحك مباشرة:</p>
      <div class="link-box">${activationUrl}</div>
    </div>
    <div class="footer">
      <p>إذا لم تكن معنياً بهذه الرسالة أو وصلتك عن طريق الخطأ، يمكنك تجاهلها بأمان.</p>
    </div>
  </div>
</body>
</html>
`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [to.trim()],
        subject,
        html,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as any;

    if (!res.ok) {
      const errorMsg = data?.message || data?.error?.message || `HTTP ${res.status}`;
      logger.error(
        { to, status: res.status, errorData: data },
        "[EmailService] Resend API error while sending activation email",
      );
      return {
        success: false,
        error: `فشل إرسال البريد الإلكتروني: ${errorMsg}`,
      };
    }

    logger.info({ to, messageId: data?.id }, "[EmailService] Activation email sent successfully");
    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err: any) {
    logger.error({ err, to }, "[EmailService] Unexpected network error sending activation email");
    return {
      success: false,
      error: err?.message || "فشل الاتصال بخدمة البريد الإلكتروني.",
    };
  }
}

