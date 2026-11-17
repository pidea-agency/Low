/**
 * notification-template.service.ts
 *
 * Centralized notification templates & dispatch system.
 * Governs all 12 platform event types:
 * - case_assigned
 * - reminder_failed
 * - poa_assigned
 * - poa_expiring
 * - member_activation_invite
 * - member_account_suspended
 * - member_account_reactivated
 * - session_upcoming_reminder
 * - subscription_expiring_soon
 * - subscription_suspended
 * - payment_recorded
 * - new_document_uploaded
 *
 * Each event type has:
 * - Default channels: { in_app: boolean, whatsapp: boolean }
 * - Default recipient role (informational)
 * - Dynamic placeholder templating {{var}}
 * - Unified dispatch via dispatchEventNotification()
 */

import { logger } from "../lib/logger";
import { getSupabaseClient } from "./supabase.service";
import { findUserByIdOrUsername } from "./supabase.service";
import { createNotification, isInMemoryFallbackAllowed, DatabaseUnavailableError } from "./postgres.service";
import { WhatsappReminderChannel } from "./reminder/channels/whatsappChannel";

export type NotificationEventType =
  | "case_assigned"
  | "reminder_failed"
  | "poa_assigned"
  | "poa_expiring"
  | "staff_license_expiring"
  | "member_activation_invite"
  | "member_account_suspended"
  | "member_account_reactivated"
  | "session_upcoming_reminder"
  | "subscription_expiring_soon"
  | "subscription_suspended"
  | "payment_recorded"
  | "new_document_uploaded";

export type NotificationCategory =
  | "cases_poa"
  | "accounts"
  | "subscription_payments"
  | "reminders";

export type DefaultRecipientRole =
  | "assigned_lawyer"
  | "admin"
  | "member"
  | "assigned_lawyer_and_admin";

export interface NotificationChannels {
  in_app: boolean;
  whatsapp: boolean;
}

export interface NotificationTemplateDefinition {
  eventType: NotificationEventType;
  name: string;
  category: NotificationCategory;
  categoryArabic: string;
  defaultRecipientRole: DefaultRecipientRole;
  defaultRecipientArabic: string;
  titleTemplate: string;
  bodyTemplate: string;
  defaultChannels: NotificationChannels;
  availablePlaceholders: string[];
}

export interface NotificationTemplateRecord {
  id?: string;
  office_id: string;
  event_type: NotificationEventType;
  name: string;
  category: NotificationCategory;
  category_arabic?: string;
  title_template: string;
  body_template: string;
  channels: NotificationChannels;
  default_recipient_role: DefaultRecipientRole;
  default_recipient_arabic?: string;
  available_placeholders?: string[];
  created_at?: string;
  updated_at?: string;
}

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  cases_poa: "أحداث القضايا والوكالات",
  accounts: "أحداث الحسابات",
  subscription_payments: "أحداث الاشتراك والمدفوعات",
  reminders: "التذكيرات",
};

export const RECIPIENT_ROLE_LABELS: Record<DefaultRecipientRole, string> = {
  assigned_lawyer: "المحامي المكلف",
  admin: "مدير المكتب",
  member: "العضو المعني",
  assigned_lawyer_and_admin: "المحامي المكلف ومدير المكتب",
};

/**
 * Registry of all 12 Platform Event Types with Sensible Arabic Defaults
 */
export const NOTIFICATION_EVENT_DEFINITIONS: Record<
  NotificationEventType,
  NotificationTemplateDefinition
> = {
  case_assigned: {
    eventType: "case_assigned",
    name: "تكليف بقضية أو جلسة",
    category: "cases_poa",
    categoryArabic: CATEGORY_LABELS.cases_poa,
    defaultRecipientRole: "assigned_lawyer",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.assigned_lawyer,
    titleTemplate: "تكليف جديد: {{recordTypeArabic}}",
    bodyTemplate:
      "تم تكليفك بـ{{recordTypeArabic}} جديد: {{recordDescription}}. لمتابعتها: {{directLink}}",
    defaultChannels: { in_app: true, whatsapp: true },
    availablePlaceholders: [
      "recordTypeArabic",
      "recordDescription",
      "directLink",
      "recordId",
    ],
  },

  poa_assigned: {
    eventType: "poa_assigned",
    name: "تكليف بوكالة قانونية",
    category: "cases_poa",
    categoryArabic: CATEGORY_LABELS.cases_poa,
    defaultRecipientRole: "assigned_lawyer",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.assigned_lawyer,
    titleTemplate: "تكليف جديد: وكالة قانونية",
    bodyTemplate:
      "تم تكليفك بوكالة قانونية جديدة رقم {{poaNumber}} الخاصة بالموكل {{clientName}}.",
    defaultChannels: { in_app: true, whatsapp: true },
    availablePlaceholders: ["poaNumber", "clientName", "directLink", "poaId"],
  },

  poa_expiring: {
    eventType: "poa_expiring",
    name: "قرب انتهاء سريان وكالة",
    category: "cases_poa",
    categoryArabic: CATEGORY_LABELS.cases_poa,
    defaultRecipientRole: "assigned_lawyer_and_admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.assigned_lawyer_and_admin,
    titleTemplate: "تنبيه: اقتراب انتهاء وكالة ({{clientName}})",
    bodyTemplate:
      "تنتهي الوكالة رقم {{poaNumber}} للموكل \"{{clientName}}\" خلال {{daysRemaining}} أيام (تاريخ الانتهاء: {{expiryDate}}).",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: [
      "poaNumber",
      "clientName",
      "daysRemaining",
      "expiryDate",
      "lawyerName",
    ],
  },

  staff_license_expiring: {
    eventType: "staff_license_expiring",
    name: "قرب انتهاء رخصة محاماة عضو",
    category: "accounts",
    categoryArabic: CATEGORY_LABELS.accounts,
    defaultRecipientRole: "admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.admin,
    titleTemplate: "تنبيه: اقتراب انتهاء رخصة محاماة ({{memberName}})",
    bodyTemplate:
      "تنتهي رخصة المحاماة الخاصة بالعضو \"{{memberName}}\" (رقم الترخيص: {{licenseNumber}}) خلال {{daysRemaining}} يوماً (تاريخ الانتهاء: {{expiryDate}}).",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: [
      "memberName",
      "licenseNumber",
      "daysRemaining",
      "expiryDate",
    ],
  },

  new_document_uploaded: {
    eventType: "new_document_uploaded",
    name: "رفع مستند أو مرفق جديد",
    category: "cases_poa",
    categoryArabic: CATEGORY_LABELS.cases_poa,
    defaultRecipientRole: "assigned_lawyer",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.assigned_lawyer,
    titleTemplate: "مستند جديد: {{documentName}}",
    bodyTemplate:
      "قام {{uploaderName}} برفع مستند جديد ({{documentName}}) على {{recordTypeArabic}} رقم {{recordNumber}}.",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: [
      "documentName",
      "uploaderName",
      "recordTypeArabic",
      "recordNumber",
      "directLink",
    ],
  },

  member_activation_invite: {
    eventType: "member_activation_invite",
    name: "دعوة تفعيل حساب عضو",
    category: "accounts",
    categoryArabic: CATEGORY_LABELS.accounts,
    defaultRecipientRole: "member",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.member,
    titleTemplate: "دعوة للانضمام إلى منصة {{platformName}}",
    bodyTemplate:
      "مرحباً بك أستاذ {{memberName}}، تمت دعوتك للانضمام إلى {{officeName}} على منصة {{platformName}}. يرجى تفعيل حسابك عبر الرابط: {{activationLink}}",
    defaultChannels: { in_app: false, whatsapp: true },
    availablePlaceholders: [
      "memberName",
      "officeName",
      "platformName",
      "activationLink",
    ],
  },

  member_account_suspended: {
    eventType: "member_account_suspended",
    name: "إيقاف حساب عضو",
    category: "accounts",
    categoryArabic: CATEGORY_LABELS.accounts,
    defaultRecipientRole: "member",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.member,
    titleTemplate: "إيقاف الحساب مؤقتاً",
    bodyTemplate:
      "تم إيقاف حسابك في مكتب {{officeName}}. يرجى مراجعة إدارة المكتب لمزيد من التفاصيل.",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: ["officeName", "memberName", "reason"],
  },

  member_account_reactivated: {
    eventType: "member_account_reactivated",
    name: "إعادة تفعيل حساب عضو",
    category: "accounts",
    categoryArabic: CATEGORY_LABELS.accounts,
    defaultRecipientRole: "member",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.member,
    titleTemplate: "إعادة تفعيل الحساب",
    bodyTemplate:
      "تمت إعادة تفعيل حسابك بنجاح في مكتب {{officeName}}. يمكنك الآن تسجيل الدخول واستئناف العمل.",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: ["officeName", "memberName"],
  },

  subscription_expiring_soon: {
    eventType: "subscription_expiring_soon",
    name: "قرب انتهاء اشتراك المكتب",
    category: "subscription_payments",
    categoryArabic: CATEGORY_LABELS.subscription_payments,
    defaultRecipientRole: "admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.admin,
    titleTemplate: "تنبيه: اقتراب انتهاء اشتراك المكتب",
    bodyTemplate:
      "اشتراك مكتبك في باقة {{planName}} ينتهي خلال {{daysRemaining}} أيام (بتاريخ {{endDate}}). يرجى التجديد لضمان استمرار الخدمات دون انقطاع.",
    defaultChannels: { in_app: true, whatsapp: true },
    availablePlaceholders: ["planName", "daysRemaining", "endDate", "officeName"],
  },

  subscription_suspended: {
    eventType: "subscription_suspended",
    name: "إيقاف أو تعليق اشتراك المكتب",
    category: "subscription_payments",
    categoryArabic: CATEGORY_LABELS.subscription_payments,
    defaultRecipientRole: "admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.admin,
    titleTemplate: "إشعار: تم إيقاف اشتراك المكتب",
    bodyTemplate:
      "تم إيقاف اشتراك مكتبك في منصة {{platformName}}. يرجى التواصل مع إدارة المنصة لتسوية الحساب وإعادة التفعيل.",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: ["platformName", "officeName", "reason"],
  },

  payment_recorded: {
    eventType: "payment_recorded",
    name: "تسجيل دفعة مالية جديدة",
    category: "subscription_payments",
    categoryArabic: CATEGORY_LABELS.subscription_payments,
    defaultRecipientRole: "admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.admin,
    titleTemplate: "سند قبض: تسجيل دفعة مالية",
    bodyTemplate:
      "تم تسجيل دفعة مالية جديدة لمكتبك بقيمة {{amount}} {{currency}} برقم سند {{reference}}.",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: [
      "amount",
      "currency",
      "reference",
      "paymentDate",
      "method",
    ],
  },

  session_upcoming_reminder: {
    eventType: "session_upcoming_reminder",
    name: "تذكير بموعد جلسة مقبلة",
    category: "reminders",
    categoryArabic: CATEGORY_LABELS.reminders,
    defaultRecipientRole: "assigned_lawyer_and_admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.assigned_lawyer_and_admin,
    titleTemplate: "تذكير بموعد جلسة: قضية {{caseNumber}}",
    bodyTemplate:
      "تذكير بموعد جلسة القضية رقم {{caseNumber}} بتاريخ {{sessionDate}} الساعة {{sessionTime}} لدى {{court}} ({{remainingText}}).",
    defaultChannels: { in_app: true, whatsapp: true },
    availablePlaceholders: [
      "caseNumber",
      "sessionDate",
      "sessionTime",
      "court",
      "remainingText",
      "kind",
    ],
  },

  reminder_failed: {
    eventType: "reminder_failed",
    name: "فشل إرسال تذكير الجلسة",
    category: "reminders",
    categoryArabic: CATEGORY_LABELS.reminders,
    defaultRecipientRole: "admin",
    defaultRecipientArabic: RECIPIENT_ROLE_LABELS.admin,
    titleTemplate: "فشل إرسال تذكير الجلسة عبر الواتساب",
    bodyTemplate:
      "تعذر إرسال تذكير الجلسة القضائية رقم {{caseNumber}}: {{error}}",
    defaultChannels: { in_app: true, whatsapp: false },
    availablePlaceholders: ["caseNumber", "sessionId", "error"],
  },
};

// In-memory cache for office templates to ensure persistence across sessions/tests
const memoryTemplateStore = new Map<string, Map<NotificationEventType, NotificationTemplateRecord>>();

/**
 * Resets the in-memory template store (useful for clean unit tests).
 */
export function resetNotificationTemplateStoreForTesting(): void {
  memoryTemplateStore.clear();
}

/**
 * Replaces placeholders of type {{key}} in a template string.
 */
export function renderTemplate(
  template: string,
  placeholders: Record<string, any> = {},
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const val = placeholders[key];
    if (val === undefined || val === null) {
      return "";
    }
    return String(val);
  });
}

/**
 * Builds a default NotificationTemplateRecord from an event definition.
 */
function createDefaultRecord(
  officeId: string,
  eventType: NotificationEventType,
): NotificationTemplateRecord {
  const def = NOTIFICATION_EVENT_DEFINITIONS[eventType];
  return {
    office_id: officeId,
    event_type: eventType,
    name: def.name,
    category: def.category,
    category_arabic: def.categoryArabic,
    title_template: def.titleTemplate,
    body_template: def.bodyTemplate,
    channels: { ...def.defaultChannels },
    default_recipient_role: def.defaultRecipientRole,
    default_recipient_arabic: def.defaultRecipientArabic,
    available_placeholders: [...def.availablePlaceholders],
  };
}

/**
 * Loads all templates for an office, merging DB overrides with defaults.
 */
export async function listOfficeNotificationTemplates(
  officeId: string,
): Promise<NotificationTemplateRecord[]> {
  const officeMap = isInMemoryFallbackAllowed()
    ? (memoryTemplateStore.get(officeId) || new Map<NotificationEventType, NotificationTemplateRecord>())
    : new Map<NotificationEventType, NotificationTemplateRecord>();

  // Attempt to load from Supabase
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("notification_templates")
        .select("*")
        .eq("office_id", officeId);

      if (error) {
        logger.error({ error, officeId }, "Failed to query notification_templates from Supabase");
        if (!isInMemoryFallbackAllowed()) {
          throw new Error("فشل تحميل قوالب الإشعارات من قاعدة البيانات: " + error.message);
        }
      } else if (data && Array.isArray(data)) {
        for (const row of data) {
          if (row.event_type && NOTIFICATION_EVENT_DEFINITIONS[row.event_type as NotificationEventType]) {
            const def = NOTIFICATION_EVENT_DEFINITIONS[row.event_type as NotificationEventType];
            officeMap.set(row.event_type as NotificationEventType, {
              id: row.id,
              office_id: officeId,
              event_type: row.event_type,
              name: row.name || def.name,
              category: row.category || def.category,
              category_arabic: def.categoryArabic,
              title_template: row.title_template || def.titleTemplate,
              body_template: row.body_template || def.bodyTemplate,
              channels: row.channels && typeof row.channels === "object"
                ? {
                    in_app: Boolean(row.channels.in_app),
                    whatsapp: Boolean(row.channels.whatsapp),
                  }
                : { ...def.defaultChannels },
              default_recipient_role: def.defaultRecipientRole,
              default_recipient_arabic: def.defaultRecipientArabic,
              available_placeholders: [...def.availablePlaceholders],
              created_at: row.created_at,
              updated_at: row.updated_at,
            });
          }
        }
      }
    } catch (err: any) {
      if (!isInMemoryFallbackAllowed()) {
        throw err;
      }
    }
  } else if (!isInMemoryFallbackAllowed()) {
    throw new DatabaseUnavailableError("قاعدة البيانات غير متصلة حالياً");
  }

  if (isInMemoryFallbackAllowed()) {
    memoryTemplateStore.set(officeId, officeMap);
  }

  // Ensure all 12 events are returned
  const allEvents = Object.keys(NOTIFICATION_EVENT_DEFINITIONS) as NotificationEventType[];
  return allEvents.map((eventType) => {
    const existing = officeMap.get(eventType);
    if (existing) {
      return existing;
    }
    const defRecord = createDefaultRecord(officeId, eventType);
    if (isInMemoryFallbackAllowed()) {
      officeMap.set(eventType, defRecord);
    }
    return defRecord;
  });
}

/**
 * Gets a specific notification template for an office.
 */
export async function getOfficeNotificationTemplate(
  officeId: string,
  eventType: NotificationEventType,
): Promise<NotificationTemplateRecord> {
  if (isInMemoryFallbackAllowed()) {
    const officeMap = memoryTemplateStore.get(officeId);
    if (officeMap && officeMap.has(eventType)) {
      return officeMap.get(eventType)!;
    }
  }

  const all = await listOfficeNotificationTemplates(officeId);
  const found = all.find((t) => t.event_type === eventType);
  if (found) {
    return found;
  }

  return createDefaultRecord(officeId, eventType);
}

/**
 * Updates or overrides an office's notification template.
 */
export async function updateOfficeNotificationTemplate(
  officeId: string,
  eventType: NotificationEventType,
  patch: {
    channels?: Partial<NotificationChannels>;
    body_template?: string;
    title_template?: string;
  },
): Promise<NotificationTemplateRecord> {
  const current = await getOfficeNotificationTemplate(officeId, eventType);
  const updatedChannels: NotificationChannels = {
    in_app:
      patch.channels?.in_app !== undefined
        ? Boolean(patch.channels.in_app)
        : current.channels.in_app,
    whatsapp:
      patch.channels?.whatsapp !== undefined
        ? Boolean(patch.channels.whatsapp)
        : current.channels.whatsapp,
  };

  const updatedRecord: NotificationTemplateRecord = {
    ...current,
    title_template: patch.title_template !== undefined ? patch.title_template : current.title_template,
    body_template: patch.body_template !== undefined ? patch.body_template : current.body_template,
    channels: updatedChannels,
    updated_at: new Date().toISOString(),
  };

  const client = getSupabaseClient();
  if (client) {
    const payload = {
      office_id: officeId,
      event_type: eventType,
      name: updatedRecord.name,
      category: updatedRecord.category,
      title_template: updatedRecord.title_template,
      body_template: updatedRecord.body_template,
      channels: updatedRecord.channels,
      default_recipient_role: updatedRecord.default_recipient_role,
      updated_at: updatedRecord.updated_at,
    };

    const { data, error } = await client
      .from("notification_templates")
      .upsert(payload, { onConflict: "office_id,event_type" })
      .select()
      .single();

    if (error) {
      logger.error({ error, officeId, eventType }, "Failed to upsert notification template to Supabase");
      if (!isInMemoryFallbackAllowed()) {
        throw new Error("فشل حفظ وتحديث قالب الإشعار في قاعدة البيانات: " + (error.message || "خطأ غير معروف"));
      }
    } else if (data) {
      updatedRecord.id = data.id;
    }
  } else if (!isInMemoryFallbackAllowed()) {
    throw new DatabaseUnavailableError("قاعدة البيانات غير متصلة حالياً");
  }

  // Update in-memory cache ONLY in test environment
  if (isInMemoryFallbackAllowed()) {
    let officeMap = memoryTemplateStore.get(officeId);
    if (!officeMap) {
      officeMap = new Map();
      memoryTemplateStore.set(officeId, officeMap);
    }
    officeMap.set(eventType, updatedRecord);
  }

  return updatedRecord;
}

export interface EventNotificationParams {
  officeId: string;
  eventType: NotificationEventType;
  recipientUserId: string;
  recipientPhone?: string | null;
  placeholderData?: Record<string, string | number | null | undefined>;
  relatedRecordType?: string | null;
  relatedRecordId?: string | number | null;
}

export interface EventNotificationResult {
  success: boolean;
  inAppCreated: boolean;
  whatsappSent: boolean;
  renderedTitle: string;
  renderedBody: string;
  error?: string;
}

/**
 * Standardized Central Dispatcher:
 * Evaluates template (enabled channels & body text) and dispatches via in-app and/or WhatsApp.
 */
export async function dispatchEventNotification(
  params: EventNotificationParams,
): Promise<EventNotificationResult> {
  const {
    officeId,
    eventType,
    recipientUserId,
    recipientPhone,
    placeholderData = {},
    relatedRecordType,
    relatedRecordId,
  } = params;

  try {
    const template = await getOfficeNotificationTemplate(officeId, eventType);

    const renderedTitle = renderTemplate(template.title_template, placeholderData);
    const renderedBody = renderTemplate(template.body_template, placeholderData);

    let inAppCreated = false;
    let whatsappSent = false;

    // 1. In-App Notification Dispatch
    if (template.channels.in_app) {
      try {
        await createNotification({
          officeId,
          userId: recipientUserId,
          type: eventType,
          title: renderedTitle,
          body: renderedBody,
          relatedRecordType: relatedRecordType ?? null,
          relatedRecordId: relatedRecordId !== undefined && relatedRecordId !== null ? String(relatedRecordId) : null,
        });
        inAppCreated = true;
      } catch (err: any) {
        logger.error(
          { err, officeId, eventType, recipientUserId },
          "dispatchEventNotification: failed to create in-app notification",
        );
      }
    }

    // 2. WhatsApp Notification Dispatch
    if (template.channels.whatsapp) {
      let targetPhone = recipientPhone?.trim() || null;

      // If no explicit phone passed, lookup recipient's registered phone
      if (!targetPhone && recipientUserId) {
        try {
          const recipient = await findUserByIdOrUsername(recipientUserId);
          targetPhone = recipient?.phone?.trim() || null;
        } catch {}
      }

      // If still no phone, and the event is admin-level or office-level, lookup office phone
      if (!targetPhone) {
        try {
          const officeAdmin = await findUserByIdOrUsername(officeId);
          targetPhone = officeAdmin?.phone?.trim() || null;
        } catch {}
      }

      if (targetPhone) {
        try {
          const channel = new WhatsappReminderChannel();
          const waResult = await channel.sendRaw(renderedBody, targetPhone, {
            throwIfNotConfigured: false,
          });
          whatsappSent = waResult.success;
          if (waResult.success) {
            logger.info(
              { officeId, eventType, recipientUserId, phone: targetPhone },
              "dispatchEventNotification: WhatsApp message sent successfully",
            );
          } else {
            logger.warn(
              { officeId, eventType, recipientUserId, phone: targetPhone, error: waResult.error },
              "dispatchEventNotification: WhatsApp message dispatch failed (non-blocking)",
            );
          }
        } catch (waErr: any) {
          logger.warn(
            { waErr, officeId, eventType, recipientUserId },
            "dispatchEventNotification: WhatsApp channel threw error (non-blocking)",
          );
        }
      }
    }

    return {
      success: true,
      inAppCreated,
      whatsappSent,
      renderedTitle,
      renderedBody,
    };
  } catch (err: any) {
    logger.error(
      { err, officeId, eventType, recipientUserId },
      "dispatchEventNotification: unhandled dispatch error",
    );
    return {
      success: false,
      inAppCreated: false,
      whatsappSent: false,
      renderedTitle: "",
      renderedBody: "",
      error: err?.message || String(err),
    };
  }
}
