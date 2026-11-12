import { env } from "../config/env";
import { logger } from "../lib/logger";
import { sendActivationEmail } from "./email.service";
import { WhatsappReminderChannel, maskPhone } from "./reminder/channels/whatsappChannel";
import {
  getOfficeNotificationTemplate,
  renderTemplate,
} from "./notification-template.service";

export interface ActivationDeliveryParams {
  officeId?: string;
  memberId: string;
  memberName: string;
  email: string;
  phone?: string | null;
  officeName?: string | null;
  platformName?: string | null;
  token: string;
  expiryHours: number;
}

export interface ActivationDeliveryResult {
  channel: "whatsapp" | "email" | "none";
  whatsappSent: boolean;
  whatsappError?: string;
  emailSent: boolean;
  emailError?: string;
}

export interface SentWhatsappActivationRecord {
  memberId: string;
  phone: string;
  memberName: string;
  officeName?: string | null;
  message: string;
  activationUrl: string;
  timestamp: string;
}

const sentWhatsappHistory: SentWhatsappActivationRecord[] = [];

export function getSentWhatsappHistory(): SentWhatsappActivationRecord[] {
  return [...sentWhatsappHistory];
}

export function clearSentWhatsappHistory(): void {
  sentWhatsappHistory.length = 0;
}

/**
 * Formats the activation message for WhatsApp according to the required template:
 * "مرحباً [الاسم]، تمت إضافتك إلى [اسم المكتب] على [اسم المنصة].
 * لإكمال تفعيل حسابك، افتح الرابط التالي خلال [X] ساعة:
 * [رابط التفعيل]
 * إذا لم تطلب هذا، تجاهل الرسالة."
 */
export function formatActivationWhatsappMessage(params: {
  memberName: string;
  officeName?: string | null;
  platformName?: string | null;
  expiryHours: number;
  activationUrl: string;
}): string {
  const name = params.memberName.trim();
  const office = params.officeName?.trim() || "مكتب المحاماة";
  const platform = params.platformName?.trim() || "منصة رَسَند";
  const hours = params.expiryHours;
  const link = params.activationUrl;

  return [
    `مرحباً ${name}، تمت إضافتك إلى ${office} على ${platform}.`,
    `لإكمال تفعيل حسابك، افتح الرابط التالي خلال ${hours} ساعة:`,
    link,
    "إذا لم تطلب هذا، تجاهل الرسالة.",
  ].join("\n");
}

/**
 * Dispatches account activation instructions following WhatsApp-primary with automatic email fallback:
 * 1. If the member has a phone number on file, attempts WhatsApp delivery first.
 * 2. If WhatsApp send succeeds, email is NOT sent (no duplicate).
 * 3. If member has no phone, or WhatsApp send fails/throws, automatically falls back to email.
 * 4. Logs which channel was actually used, without exposing raw tokens in logs.
 */
export async function sendActivationInvitation(
  params: ActivationDeliveryParams,
): Promise<ActivationDeliveryResult> {
  const { memberId, memberName, email, phone, officeName, platformName, token, expiryHours } = params;
  const activationUrl = `${env.frontendUrl}/activate?token=${encodeURIComponent(token)}`;
  const cleanPhone = phone ? phone.trim() : "";

  let whatsappSent = false;
  let whatsappError: string | undefined;

  // 1. WhatsApp Primary attempt (if phone number is on file)
  if (cleanPhone) {
    try {
      let message: string;
      if (params.officeId) {
        try {
          const template = await getOfficeNotificationTemplate(
            params.officeId,
            "member_activation_invite",
          );
          message = renderTemplate(template.body_template, {
            memberName,
            officeName: officeName || "مكتب المحاماة",
            platformName: platformName || "منصة رَسَند",
            activationLink: activationUrl,
            expiryHours: String(expiryHours),
          });
        } catch {
          message = formatActivationWhatsappMessage({
            memberName,
            officeName,
            platformName,
            expiryHours,
            activationUrl,
          });
        }
      } else {
        message = formatActivationWhatsappMessage({
          memberName,
          officeName,
          platformName,
          expiryHours,
          activationUrl,
        });
      }

      const channel = new WhatsappReminderChannel();
      const rawRes = await channel.sendRaw(message, cleanPhone, { throwIfNotConfigured: true });
      if (rawRes && !rawRes.success) {
        throw new Error(rawRes.error || "فشل إرسال رابط التفعيل عبر واتساب.");
      }

      whatsappSent = true;
      sentWhatsappHistory.push({
        memberId,
        phone: cleanPhone,
        memberName,
        officeName,
        message,
        activationUrl,
        timestamp: new Date().toISOString(),
      });

      // Log success with channel used — DO NOT log rawToken
      logger.info(
        {
          memberId,
          channel: "whatsapp",
          phone: maskPhone(cleanPhone),
          expiryHours,
        },
        "Member activation link dispatched successfully via WhatsApp (primary channel)",
      );

      return {
        channel: "whatsapp",
        whatsappSent: true,
        emailSent: false,
      };
    } catch (err: any) {
      whatsappSent = false;
      whatsappError = err?.message || "فشل إرسال رابط التفعيل عبر واتساب.";
      logger.warn(
        {
          memberId,
          channel: "whatsapp",
          phone: maskPhone(cleanPhone),
          error: whatsappError,
        },
        "WhatsApp activation delivery failed or not configured; falling back to email",
      );
    }
  }

  // 2. Email Fallback (or primary when no phone number)
  let emailSent = false;
  let emailError: string | undefined;

  try {
    const emailRes = await sendActivationEmail({
      to: email.trim(),
      memberName,
      officeName,
      token,
      expiryHours,
    });

    emailSent = emailRes.success;
    emailError = emailRes.error;

    if (emailSent) {
      // Log success with channel used — DO NOT log rawToken
      logger.info(
        {
          memberId,
          channel: "email",
          email: email.trim(),
          expiryHours,
          reason: cleanPhone ? "whatsapp_fallback" : "no_phone",
        },
        "Member activation link dispatched successfully via email",
      );

      return {
        channel: "email",
        whatsappSent: false,
        whatsappError,
        emailSent: true,
      };
    } else {
      logger.warn(
        {
          memberId,
          channel: "email",
          email: email.trim(),
          error: emailError,
        },
        "Email activation fallback delivery failed",
      );
      return {
        channel: "email",
        whatsappSent: false,
        whatsappError,
        emailSent: false,
        emailError,
      };
    }
  } catch (err: any) {
    emailSent = false;
    emailError = err?.message || "فشل إرسال بريد التفعيل.";
    logger.error(
      {
        memberId,
        channel: "email",
        error: emailError,
      },
      "Exception during email activation delivery",
    );
    return {
      channel: "email",
      whatsappSent: false,
      whatsappError,
      emailSent: false,
      emailError,
    };
  }

  return {
    channel: "none",
    whatsappSent: false,
    whatsappError,
    emailSent: false,
    emailError: "لا توجد وسيلة تواصل متاحة لإرسال رابط التفعيل.",
  };
}
