import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendActivationInvitation,
  formatActivationWhatsappMessage,
  getSentWhatsappHistory,
  clearSentWhatsappHistory,
} from "../services/activation-delivery.service";
import * as emailService from "../services/email.service";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";

describe("Part C — Member Activation Delivery (WhatsApp-primary with email fallback)", () => {
  beforeEach(() => {
    clearSentWhatsappHistory();
    emailService.clearSentEmailsHistory();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. WhatsApp send success does NOT send email (no duplicate)", async () => {
    // Spy on WhatsappReminderChannel.prototype.sendRaw to simulate successful WhatsApp delivery
    const sendRawSpy = vi
      .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
      .mockResolvedValue({ success: true, isConfigured: true });

    const sendEmailSpy = vi.spyOn(emailService, "sendActivationEmail").mockResolvedValue({
      success: true,
      messageId: "msg-test-123",
    });

    const result = await sendActivationInvitation({
      memberId: "mem-101",
      memberName: "طارق المحامي",
      email: "lawyer@example.com",
      phone: "+970599123456",
      officeName: "مكتب النور للمحاماة",
      platformName: "منصة رَسَند",
      token: "secret_activation_token_12345",
      expiryHours: 48,
    });

    expect(result.channel).toBe("whatsapp");
    expect(result.whatsappSent).toBe(true);
    expect(result.emailSent).toBe(false);

    // Verify WhatsApp was called with recipient phone
    expect(sendRawSpy).toHaveBeenCalledTimes(1);
    const [sentMsg, sentPhone] = sendRawSpy.mock.calls[0];
    expect(sentPhone).toBe("+970599123456");

    // Verify message matches required template
    expect(sentMsg).toContain("مرحباً طارق المحامي، تمت إضافتك إلى مكتب النور للمحاماة على منصة رَسَند.");
    expect(sentMsg).toContain("لإكمال تفعيل حسابك، افتح الرابط التالي خلال 48 ساعة:");
    expect(sentMsg).toContain("/activate?token=secret_activation_token_12345");
    expect(sentMsg).toContain("إذا لم تطلب هذا، تجاهل الرسالة.");

    // Critical assertion: NO email was sent
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(emailService.getSentEmailsHistory()).toHaveLength(0);

    // Verify WhatsApp tracking history recorded
    const whatsappHistory = getSentWhatsappHistory();
    expect(whatsappHistory).toHaveLength(1);
    expect(whatsappHistory[0].phone).toBe("+970599123456");
  });

  it("2. WhatsApp failure correctly falls back automatically to email", async () => {
    // Simulate WhatsApp failure (e.g. gateway error or disconnected)
    vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw").mockRejectedValue(
      new Error("Green API gateway timed out"),
    );

    // Mock fetch for email service so Resend API call succeeds in test
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg-email-mock-1" }),
    } as any);

    const sendEmailSpy = vi.spyOn(emailService, "sendActivationEmail");

    const result = await sendActivationInvitation({
      memberId: "mem-102",
      memberName: "سارة المستشارة",
      email: "sara@example.com",
      phone: "+970599765432",
      officeName: "مكتب العدل",
      token: "token_abc_xyz",
      expiryHours: 24,
    });

    expect(result.channel).toBe("email");
    expect(result.whatsappSent).toBe(false);
    expect(result.whatsappError).toContain("Green API gateway timed out");
    expect(result.emailSent).toBe(true);

    // Verify fallback to email occurred
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "sara@example.com",
        memberName: "سارة المستشارة",
        officeName: "مكتب العدل",
        token: "token_abc_xyz",
        expiryHours: 24,
      }),
    );

    const emailHistory = emailService.getSentEmailsHistory();
    expect(emailHistory).toHaveLength(1);
    expect(emailHistory[0].to).toBe("sara@example.com");
  });

  it("3. Member with no phone goes straight to email (skips WhatsApp)", async () => {
    const sendRawSpy = vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw");

    // Mock fetch for email service so Resend API call succeeds in test
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg-email-mock-2" }),
    } as any);

    const sendEmailSpy = vi.spyOn(emailService, "sendActivationEmail");

    const result = await sendActivationInvitation({
      memberId: "mem-103",
      memberName: "محمد الكاتب",
      email: "mohamed.clerk@example.com",
      phone: null, // No phone on file
      officeName: "مكتب الوفاق",
      token: "token_no_phone_999",
      expiryHours: 48,
    });

    expect(result.channel).toBe("email");
    expect(result.whatsappSent).toBe(false);
    expect(result.emailSent).toBe(true);

    // WhatsApp must NOT be called when phone is absent
    expect(sendRawSpy).not.toHaveBeenCalled();
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(emailService.getSentEmailsHistory()).toHaveLength(1);
  });

  it("4. Professional WhatsApp template formatting respects dynamic parameters", () => {
    const message = formatActivationWhatsappMessage({
      memberName: "خالد المحامي",
      officeName: "شركة الرواد للمحاماة",
      platformName: "منصة رَسَند",
      expiryHours: 72,
      activationUrl: "https://court.app/activate?token=test_token_123",
    });

    const expected = [
      "مرحباً خالد المحامي، تمت إضافتك إلى شركة الرواد للمحاماة على منصة رَسَند.",
      "لإكمال تفعيل حسابك، افتح الرابط التالي خلال 72 ساعة:",
      "https://court.app/activate?token=test_token_123",
      "إذا لم تطلب هذا، تجاهل الرسالة.",
    ].join("\n");

    expect(message).toBe(expected);
  });

  it("5. createOfficeMember dispatches via WhatsApp when phone is present and send succeeds", async () => {
    const { createOfficeMember, createSupabaseUser, deleteSupabaseUser } = await import(
      "../services/supabase.service"
    );

    const sendRawSpy = vi
      .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
      .mockResolvedValue({ success: true, isConfigured: true });
    const sendEmailSpy = vi.spyOn(emailService, "sendActivationEmail");

    // Create a temporary admin
    const adminUname = `act_admin_${Date.now()}`;
    const admin = await createSupabaseUser({
      username: adminUname,
      password: "Password123!",
      role: "admin",
      office_name: "مكتب المحامي يوسف",
      status: "active",
      plan_tier: "plus",
      billing_cycle: "annual",
    });

    try {
      const memberUname = `staff_wa_${Date.now()}`;
      const res = await createOfficeMember(admin.id, {
        username: memberUname,
        email: "staff.wa@example.com",
        display_name: "أحمد المحامي",
        phone: "+972599001122",
      });

      expect(res.member.status).toBe("pending_activation");
      expect(res.deliveryChannel).toBe("whatsapp");
      expect(res.whatsappSent).toBe(true);
      expect(res.emailSent).toBe(false);
      expect(sendRawSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).not.toHaveBeenCalled();

      // Clean up member
      await deleteSupabaseUser(res.member.id).catch(() => {});
    } finally {
      await deleteSupabaseUser(admin.id).catch(() => {});
    }
  }, 30000);

  it("6. resendOfficeMemberActivation follows WhatsApp-first logic and invalidates old token", async () => {
    const {
      createOfficeMember,
      resendOfficeMemberActivation,
      createSupabaseUser,
      deleteSupabaseUser,
      findUserByActivationToken,
    } = await import("../services/supabase.service");

    const sendRawSpy = vi
      .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
      .mockResolvedValue({ success: true, isConfigured: true });

    const admin = await createSupabaseUser({
      username: `admin_resend_${Date.now()}`,
      password: "Password123!",
      role: "admin",
      office_name: "مكتب المحامي عادل",
      status: "active",
      plan_tier: "plus",
      billing_cycle: "annual",
    });

    try {
      const member = await createOfficeMember(admin.id, {
        username: `staff_resend_${Date.now()}`,
        email: "staff.resend@example.com",
        display_name: "عادل المحامي",
        phone: "+972599334455",
      });

      const oldToken = member.rawToken!;
      expect(oldToken).toBeDefined();

      // Old token must be initially valid
      const checkOldBefore = await findUserByActivationToken(oldToken);
      expect(checkOldBefore.valid).toBe(true);

      // Resend activation
      const resendRes = await resendOfficeMemberActivation(admin.id, member.member.id);
      expect(resendRes.success).toBe(true);
      expect(resendRes.deliveryChannel).toBe("whatsapp");
      expect(resendRes.whatsappSent).toBe(true);
      expect(resendRes.emailSent).toBe(false);

      const newToken = resendRes.rawToken!;
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);

      // Old token must now be invalid
      const checkOldAfter = await findUserByActivationToken(oldToken);
      expect(checkOldAfter.valid).toBe(false);

      // New token must be valid
      const checkNew = await findUserByActivationToken(newToken);
      expect(checkNew.valid).toBe(true);

      await deleteSupabaseUser(member.member.id).catch(() => {});
    } finally {
      await deleteSupabaseUser(admin.id).catch(() => {});
    }
  }, 30000);
});
