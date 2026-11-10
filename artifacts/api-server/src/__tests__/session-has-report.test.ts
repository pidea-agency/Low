import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Session has_report computed field", { timeout: 30000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let admin: any;
  let cookieAdmin: string;
  let clientRecord: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    const username = `report_test_admin_${Date.now()}`;
    admin = await supabaseService.createSupabaseUser({
      username,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: futureDate,
    });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username, password: "OfficePass123!" });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];
    cookieAdmin = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    const cRes = await request(app)
      .post("/api/clients")
      .set("Cookie", cookieAdmin)
      .send({ name: "موكل الجلسات والتقارير", phone: "0500000001" });
    expect([200, 201]).toContain(cRes.status);
    clientRecord = cRes.body;
  });

  it("computes has_report false when no report exists, and true when report is saved", async () => {
    // 1. Create session
    const sRes = await request(app)
      .post("/api/sessions")
      .set("Cookie", cookieAdmin)
      .send({
        caseNumber: "CASE-REPORT-99",
        court: "محكمة الرياض",
        sessionDateHijri: "1446-08-15",
        sessionTime: "10:00 ص",
        clientId: clientRecord.id,
      });
    expect([200, 201]).toContain(sRes.status);
    const sessionId = sRes.body.id;

    // 2. Fetch sessions list -> has_report should be false
    const listRes1 = await request(app)
      .get("/api/sessions")
      .set("Cookie", cookieAdmin);
    expect(listRes1.status).toBe(200);
    const foundSession1 = listRes1.body.find((s: any) => s.id === sessionId);
    expect(foundSession1).toBeDefined();
    expect(foundSession1.has_report).toBe(false);

    // 3. Save report for this session
    const putReportRes = await request(app)
      .put(`/api/sessions/${sessionId}/report`)
      .set("Cookie", cookieAdmin)
      .send({ summary: "تقرير مكتمل عن تفاصيل الجلسة", decision: "تأجيل لتقديم بينة" });
    expect(putReportRes.status).toBe(200);

    // 4. Fetch sessions list again -> has_report should now be true
    const listRes2 = await request(app)
      .get("/api/sessions")
      .set("Cookie", cookieAdmin);
    expect(listRes2.status).toBe(200);
    const foundSession2 = listRes2.body.find((s: any) => s.id === sessionId);
    expect(foundSession2).toBeDefined();
    expect(foundSession2.has_report).toBe(true);

    // 5. Fetch single session -> has_report should also be true
    const singleRes = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set("Cookie", cookieAdmin);
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.has_report).toBe(true);
  });
});
