import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Finished & Cancelled Session WhatsApp Guard", { timeout: 30000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let admin: any;
  let cookieAdmin: string;
  let clientRecord: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    const username = `session_guard_${Date.now()}`;
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
      .send({ name: "موكل فحص الجلسات", phone: "0501112233" });
    expect([200, 201]).toContain(cRes.status);
    clientRecord = cRes.body;
  });

  it("rejects sending WhatsApp reminder for a Finished session with 400", async () => {
    // 1. Create a Finished session
    const sRes = await request(app)
      .post("/api/sessions")
      .set("Cookie", cookieAdmin)
      .send({
        caseNumber: "CASE-FIN-01",
        court: "المحكمة العامة بالرياض",
        sessionDateHijri: "1446-01-01",
        sessionTime: "09:00 ص",
        clientId: clientRecord.id,
        status: "Finished",
      });
    expect([200, 201]).toContain(sRes.status);
    const sessionId = sRes.body.id;

    // 2. Try sending WhatsApp
    const sendRes = await request(app)
      .post(`/api/sessions/${sessionId}/send-whatsapp`)
      .set("Cookie", cookieAdmin)
      .send({});
    expect(sendRes.status).toBe(400);
    expect(sendRes.body.error).toContain("لا يمكن إرسال تذكير لجلسة منتهية أو ملغية");
  });

  it("rejects sending WhatsApp reminder for a Cancelled session with 400", async () => {
    // 1. Create a Cancelled session
    const sRes = await request(app)
      .post("/api/sessions")
      .set("Cookie", cookieAdmin)
      .send({
        caseNumber: "CASE-CANC-01",
        court: "المحكمة التجارية بالرياض",
        sessionDateHijri: "1447-01-01",
        sessionTime: "11:00 ص",
        clientId: clientRecord.id,
        status: "Cancelled",
      });
    expect([200, 201]).toContain(sRes.status);
    const sessionId = sRes.body.id;

    // 2. Try sending WhatsApp
    const sendRes = await request(app)
      .post(`/api/sessions/${sessionId}/send-whatsapp`)
      .set("Cookie", cookieAdmin)
      .send({});
    expect(sendRes.status).toBe(400);
    expect(sendRes.body.error).toContain("لا يمكن إرسال تذكير لجلسة منتهية أو ملغية");
  });
});
