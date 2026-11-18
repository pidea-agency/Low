import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";
import { resetTestSendRateLimitForTesting } from "../services/notification-template.service";

describe("Notification Templates Test-Send Endpoint & Rate Limiting", () => {
  let lawyerCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // 1. Authenticate lawyer (staff role)
    const lawyerLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "12345", password: "ValidPass123!" })
      .catch(() => null);

    if (lawyerLogin && lawyerLogin.status === 200) {
      const setCookie = lawyerLogin.headers["set-cookie"];
      lawyerCookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    } else {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "12345", password: "12345" });
      const setCookie = res.headers["set-cookie"];
      lawyerCookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    }

    // 2. Authenticate office admin (admin role)
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin1", password: "admin123" });
    const setAdminCookie = adminLogin.headers["set-cookie"];
    adminCookie = Array.isArray(setAdminCookie) ? setAdminCookie.join("; ") : setAdminCookie;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    resetTestSendRateLimitForTesting();
  });

  describe("1. Role Guarding (Admin Only)", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const res = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .send({ phone: "966500000000", eventType: "case_assigned" });

      expect(res.status).toBe(401);
    });

    it("returns 403 when request is made by a staff/lawyer", async () => {
      const res = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .set("Cookie", lawyerCookie)
        .send({ phone: "966500000000", eventType: "case_assigned" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|Admin/);
    });
  });

  describe("2. Real WhatsApp Path & Placeholder Substitution", () => {
    it("uses the verified-real WhatsApp channel path (WhatsappReminderChannel.prototype.sendRaw)", async () => {
      const sendRawSpy = vi
        .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
        .mockResolvedValue({
          success: true,
          isConfigured: true,
          idMessage: "GREENAPI-TEST-MSG-12345",
        });

      const res = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .set("Cookie", adminCookie)
        .send({
          phone: "966501234567",
          eventType: "case_assigned",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.idMessage).toBe("GREENAPI-TEST-MSG-12345");
      expect(sendRawSpy).toHaveBeenCalledTimes(1);

      // Verify recipient phone was passed to sendRaw
      const [calledMessage, calledPhone, calledOptions] = sendRawSpy.mock.calls[0];
      expect(calledPhone).toBe("966501234567");
      expect(calledOptions?.throwIfNotConfigured).toBe(true);

      // Verify clearly-marked dummy values were substituted
      expect(calledMessage).toContain("رسالة تجريبية");
      expect(calledMessage).toMatch(/أ\. فهد المنصوري|0000\/9999|جلسة قضائية/);
    });

    it("substitutes custom placeholders and custom message override cleanly", async () => {
      const sendRawSpy = vi
        .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
        .mockResolvedValue({
          success: true,
          isConfigured: true,
          idMessage: "GREENAPI-CUSTOM-999",
        });

      const res = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .set("Cookie", adminCookie)
        .send({
          phone: "966509998877",
          customMessage: "عزيزي المحامي {lawyer_name} لديك قضية رقم {case_number}",
        });

      expect(res.status).toBe(200);
      expect(sendRawSpy).toHaveBeenCalledTimes(1);

      const [calledMessage] = sendRawSpy.mock.calls[0];
      expect(calledMessage).toContain("أ. فهد المنصوري (محام تجريبي)");
      expect(calledMessage).toContain("0000/9999");
      expect(calledMessage).not.toContain("{lawyer_name}");
      expect(calledMessage).not.toContain("{case_number}");
    });

    it("returns real Green API failure message when sendRaw fails", async () => {
      vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw").mockResolvedValue({
        success: false,
        isConfigured: true,
        error: "الـ Instance غير متصل بالواتساب — افتح console.greenapi.com واسحب QR Code بهاتفك.",
      });

      const res = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .set("Cookie", adminCookie)
        .send({
          phone: "966501234567",
          eventType: "session_upcoming_reminder",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("الـ Instance غير متصل بالواتساب");
    });

    it("gracefully falls back to system defaults when notification_templates table is missing in Supabase (PGRST205)", async () => {
      const sendRawSpy = vi
        .spyOn(WhatsappReminderChannel.prototype, "sendRaw")
        .mockResolvedValue({
          success: true,
          isConfigured: true,
          idMessage: "MOCK-RECOVERY-ID",
        });

      // Emulate Supabase missing table error
      const supabaseService = await import("../services/supabase.service");
      const client = supabaseService.getSupabaseClient();
      if (client) {
        vi.spyOn(client, "from").mockReturnValue({
          select: () => ({
            eq: async () => ({
              data: null,
              error: {
                code: "PGRST205",
                message: "Could not find the table 'public.notification_templates' in the schema cache",
              },
            }),
          }),
        } as any);
      }

      const res = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .set("Cookie", adminCookie)
        .send({
          phone: "966501234567",
          eventType: "case_assigned",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sendRawSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Rate Limiting Enforcement (Max 10 per hour per admin)", () => {
    it("allows up to 10 test sends and rejects the 11th with HTTP 429", async () => {
      vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw").mockResolvedValue({
        success: true,
        isConfigured: true,
        idMessage: "MOCK-ID",
      });

      // Send 10 times successfully
      for (let i = 1; i <= 10; i++) {
        const res = await request(app)
          .post("/api/settings/notification-templates/test-send")
          .set("Cookie", adminCookie)
          .send({
            phone: `96650000000${i % 10}`,
            customMessage: `Test send #${i}`,
          });

        expect(res.status).toBe(200);
        expect(res.body.remaining).toBe(10 - i);
      }

      // The 11th request MUST be blocked with 429 Too Many Requests
      const blockedRes = await request(app)
        .post("/api/settings/notification-templates/test-send")
        .set("Cookie", adminCookie)
        .send({
          phone: "966500000099",
          customMessage: "Test send #11 (should be blocked)",
        });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toMatch(/تجاوزت الحد الأقصى لإرسال الرسائل التجريبية/);
      expect(blockedRes.body.remaining).toBe(0);
    });

    it("quota endpoint returns accurate remaining count", async () => {
      const quotaRes = await request(app)
        .get("/api/settings/notification-templates/test-send/quota")
        .set("Cookie", adminCookie);

      expect(quotaRes.status).toBe(200);
      expect(quotaRes.body.max).toBe(10);
      expect(quotaRes.body.remaining).toBe(10);
    });
  });
});
