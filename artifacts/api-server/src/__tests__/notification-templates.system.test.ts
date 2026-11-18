import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  listOfficeNotificationTemplates,
  getOfficeNotificationTemplate,
  updateOfficeNotificationTemplate,
  dispatchEventNotification,
  resetNotificationTemplateStoreForTesting,
  type NotificationEventType,
} from "../services/notification-template.service";
import * as postgresService from "../services/postgres.service";
import * as supabaseService from "../services/supabase.service";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";
import { runSubscriptionExpirySweep } from "../services/reminder/subscription-expiry.service";

describe("Notification Templates & Centralized Event System", () => {
  const testOfficeId = "office-test-uuid";
  const testAdminId = "admin-user-uuid";
  const testLawyerId = "lawyer-user-uuid";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetNotificationTemplateStoreForTesting();
  });

  it("1. All platform event types are registered with correct defaults and metadata", async () => {
    const templates = await listOfficeNotificationTemplates(testOfficeId);
    expect(templates).toHaveLength(13);

    const eventTypes: NotificationEventType[] = [
      "case_assigned",
      "reminder_failed",
      "poa_assigned",
      "poa_expiring",
      "staff_license_expiring",
      "member_activation_invite",
      "member_account_suspended",
      "member_account_reactivated",
      "session_upcoming_reminder",
      "subscription_expiring_soon",
      "subscription_suspended",
      "payment_recorded",
      "new_document_uploaded",
    ];

    for (const evt of eventTypes) {
      const t = templates.find((row) => row.event_type === evt);
      expect(t).toBeDefined();
      expect(t?.name).toBeTruthy();
      expect(t?.category).toBeTruthy();
      expect(t?.channels).toBeDefined();
      expect(typeof t?.channels.in_app).toBe("boolean");
      expect(typeof t?.channels.whatsapp).toBe("boolean");
      expect(t?.default_recipient_role).toBeTruthy();
    }
  });

  it("2. dispatchEventNotification respects enabled/disabled channels", async () => {
    const createNotifSpy = vi
      .spyOn(postgresService, "createNotification")
      .mockResolvedValue({
        id: "notif-1",
        officeId: testOfficeId,
        userId: testLawyerId,
        type: "case_assigned",
        title: "Test",
        body: "Test body",
        isRead: false,
        createdAt: new Date().toISOString(),
      });

    const sendRawSpy = vi
      .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
      .mockResolvedValue({ success: true, isConfigured: true });

    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: testLawyerId,
      username: "lawyer1",
      phone: "+966500000000",
      role: "staff",
      status: "active",
      created_at: new Date().toISOString(),
    });

    // Default case_assigned has both in_app: true and whatsapp: true
    const res = await dispatchEventNotification({
      officeId: testOfficeId,
      eventType: "case_assigned",
      recipientUserId: testLawyerId,
      placeholderData: {
        recordTypeArabic: "جلسة قضائية",
        recordDescription: "جلسة 101",
        directLink: "/sessions/101",
      },
    });

    expect(res.success).toBe(true);
    expect(res.inAppCreated).toBe(true);
    expect(res.whatsappSent).toBe(true);
    expect(createNotifSpy).toHaveBeenCalledTimes(1);
    expect(sendRawSpy).toHaveBeenCalledTimes(1);
  });

  it("3. Disabling WhatsApp for member_account_suspended still creates the in-app notification", async () => {
    const createNotifSpy = vi
      .spyOn(postgresService, "createNotification")
      .mockResolvedValue({
        id: "notif-2",
        officeId: testOfficeId,
        userId: testLawyerId,
        type: "member_account_suspended",
        title: "إيقاف الحساب",
        body: "تم إيقاف حسابك",
        isRead: false,
        createdAt: new Date().toISOString(),
      });

    const sendRawSpy = vi
      .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
      .mockResolvedValue({ success: true, isConfigured: true });

    // Ensure member_account_suspended has whatsapp disabled (the default)
    const t = await getOfficeNotificationTemplate(testOfficeId, "member_account_suspended");
    expect(t.channels.whatsapp).toBe(false);
    expect(t.channels.in_app).toBe(true);

    const res = await dispatchEventNotification({
      officeId: testOfficeId,
      eventType: "member_account_suspended",
      recipientUserId: testLawyerId,
      placeholderData: {
        officeName: "مكتب العدل",
        memberName: "أحمد",
      },
      relatedRecordType: "user",
      relatedRecordId: testLawyerId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppCreated).toBe(true);
    expect(res.whatsappSent).toBe(false);
    expect(createNotifSpy).toHaveBeenCalledTimes(1);
    expect(sendRawSpy).not.toHaveBeenCalled();
  });

  it("4. Updating template channels and custom body text persists and applies properly", async () => {
    await updateOfficeNotificationTemplate(testOfficeId, "poa_assigned", {
      channels: { in_app: true, whatsapp: false },
      body_template: "وكالة مخصصة للمحامي: {{poaNumber}} للموكل {{clientName}}",
    });

    const updated = await getOfficeNotificationTemplate(testOfficeId, "poa_assigned");
    expect(updated.channels.whatsapp).toBe(false);
    expect(updated.channels.in_app).toBe(true);
    expect(updated.body_template).toContain("وكالة مخصصة للمحامي");

    const createNotifSpy = vi
      .spyOn(postgresService, "createNotification")
      .mockResolvedValue({
        id: "notif-3",
        officeId: testOfficeId,
        userId: testLawyerId,
        type: "poa_assigned",
        title: "تكليف",
        body: "...",
        isRead: false,
        createdAt: new Date().toISOString(),
      });

    const sendRawSpy = vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw");

    const res = await dispatchEventNotification({
      officeId: testOfficeId,
      eventType: "poa_assigned",
      recipientUserId: testLawyerId,
      placeholderData: {
        poaNumber: "POA-9988",
        clientName: "شركة البناء",
      },
    });

    expect(res.renderedBody).toBe("وكالة مخصصة للمحامي: POA-9988 للموكل شركة البناء");
    expect(res.inAppCreated).toBe(true);
    expect(res.whatsappSent).toBe(false);
    expect(sendRawSpy).not.toHaveBeenCalled();
    expect(createNotifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "وكالة مخصصة للمحامي: POA-9988 للموكل شركة البناء",
      }),
    );
  });

  it("5. subscription_expiring_soon fires once per office per day (deduplication / anti-spam)", async () => {
    const expiresSoonDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(); // 4 days remaining

    const mockAdmin = {
      id: "admin-expiring",
      username: "expiring_admin",
      office_name: "مكتب المحامي خالد",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: expiresSoonDate,
      phone: "+966512345678",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([mockAdmin as any]);
    vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw").mockResolvedValue({ success: true, isConfigured: true });

    // First sweep: notification should be dispatched
    const hasRecentSpy = vi.spyOn(postgresService, "hasRecentNotification").mockResolvedValueOnce(false);
    const createNotifSpy = vi.spyOn(postgresService, "createNotification").mockResolvedValue({} as any);

    const firstSweep = await runSubscriptionExpirySweep("admin-expiring");
    expect(firstSweep.ok).toBe(true);
    expect(firstSweep.expiringFound).toBe(1);
    expect(firstSweep.notificationsCreated).toBe(1);
    expect(firstSweep.skippedDuplicate).toBe(0);
    expect(createNotifSpy).toHaveBeenCalledTimes(1);

    // Second sweep: alreadyNotified returns true -> duplicate is skipped
    hasRecentSpy.mockResolvedValueOnce(true);
    const secondSweep = await runSubscriptionExpirySweep("admin-expiring");
    expect(secondSweep.ok).toBe(true);
    expect(secondSweep.expiringFound).toBe(1);
    expect(secondSweep.notificationsCreated).toBe(0);
    expect(secondSweep.skippedDuplicate).toBe(1);
    expect(createNotifSpy).toHaveBeenCalledTimes(1); // Not called again
  });

  it("6. payment_recorded notification only reaches the designated office's admin", async () => {
    const createNotifSpy = vi.spyOn(postgresService, "createNotification").mockResolvedValue({} as any);

    const targetOfficeA = "office-alpha-uuid";
    const targetOfficeB = "office-beta-uuid";

    await dispatchEventNotification({
      officeId: targetOfficeA,
      eventType: "payment_recorded",
      recipientUserId: targetOfficeA,
      placeholderData: {
        amount: "5000",
        currency: "SAR",
        reference: "PAY-12345",
      },
      relatedRecordType: "payment",
      relatedRecordId: "PAY-12345",
    });

    expect(createNotifSpy).toHaveBeenCalledTimes(1);
    expect(createNotifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: targetOfficeA,
        userId: targetOfficeA,
        type: "payment_recorded",
        title: expect.stringContaining("سند قبض"),
        body: expect.stringContaining("5000 SAR"),
      }),
    );
    expect(createNotifSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: targetOfficeB,
      }),
    );
  });
});
