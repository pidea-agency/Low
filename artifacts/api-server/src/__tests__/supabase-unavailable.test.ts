import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as postgresService from "../services/postgres.service";
import * as supabaseService from "../services/supabase.service";

describe("Supabase Unavailability & Fallback Removal", () => {
  const authCookie = createSignedSessionCookie({
    username: "12345",
    userId: "local-lawyer-default",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    postgresService.resetInMemoryStore();
  });

  afterEach(() => {
    postgresService.setForceDisableMemoryStoreForTesting(false);
    postgresService.resetInMemoryStore();
    vi.restoreAllMocks();
  });

  describe("Gating of In-Memory Stores", () => {
    it("isInMemoryFallbackAllowed() returns false when forced disabled", () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      expect(postgresService.isInMemoryFallbackAllowed()).toBe(false);
      postgresService.setForceDisableMemoryStoreForTesting(false);
      expect(postgresService.isInMemoryFallbackAllowed()).toBe(true);
    });

    it("isInMemoryFallbackAllowed() returns false if NODE_ENV is production", () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        expect(postgresService.isInMemoryFallbackAllowed()).toBe(false);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe("Direct Service Calls Fail Loudly When Supabase Unreachable", () => {
    it("createClient throws DatabaseUnavailableError when memory fallback is disabled", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      await expect(
        postgresService.createClient({ name: "عميل تجريبي" }, "test-office")
      ).rejects.toThrow(postgresService.DatabaseUnavailableError);
    });

    it("createSession throws DatabaseUnavailableError when memory fallback is disabled", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      await expect(
        postgresService.createSession({ caseNumber: "123" } as any, "test-office")
      ).rejects.toThrow(postgresService.DatabaseUnavailableError);
    });

    it("createTask throws DatabaseUnavailableError when memory fallback is disabled", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      await expect(
        postgresService.createTask({ title: "مهمة عاجلة" }, "test-office")
      ).rejects.toThrow(postgresService.DatabaseUnavailableError);
    });

    it("createPoa throws DatabaseUnavailableError when memory fallback is disabled", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      await expect(
        postgresService.createPoa({ clientName: "زيد", poaNumber: "999" }, "test-office")
      ).rejects.toThrow(postgresService.DatabaseUnavailableError);
    });

    it("createJudgment throws DatabaseUnavailableError when memory fallback is disabled", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      await expect(
        postgresService.createJudgment({ judgmentNumber: "J1" }, "test-office")
      ).rejects.toThrow(postgresService.DatabaseUnavailableError);
    });

    it("createCase throws DatabaseUnavailableError when memory fallback is disabled", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      await expect(
        postgresService.createCase({ clientId: "c1", caseNumber: "CASE-1" }, "test-office")
      ).rejects.toThrow(postgresService.DatabaseUnavailableError);
    });
  });

  describe("API Endpoints Return HTTP 503 Without Silent In-Memory Fallback", () => {
    beforeEach(() => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
        id: "local-lawyer-default",
        username: "12345",
        role: "admin",
        status: "active",
        subscription_end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      } as any);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);
    });

    it("POST /api/clients returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .post("/api/clients")
        .set("Cookie", authCookie)
        .send({ name: "محمد أحمد", phone: "0500000000" });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });

    it("GET /api/clients returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .get("/api/clients")
        .set("Cookie", authCookie);

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });

    it("POST /api/sessions returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .post("/api/sessions")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "2026/101",
          court: "المحكمة التجارية بالرياض",
          sessionDateHijri: "1448/05/10",
          sessionTime: "10:00 ص",
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });

    it("POST /api/tasks returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "إعداد لائحة دعوى",
          priority: "عاجلة",
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });

    it("POST /api/poa returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: "client-abc",
          clientName: "شركة اليمامة",
          poaNumber: "POA-9988",
          issueDateHijri: "1448/01/01",
          expiryDateHijri: "1449/01/01",
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });

    it("POST /api/judgments returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "2026/999",
          judgmentNumber: "JUDG-445",
          court: "المحكمة العامة بالرياض",
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });

    it("POST /api/cases returns HTTP 503 with DATABASE_UNAVAILABLE", async () => {
      const res = await request(app)
        .post("/api/cases")
        .set("Cookie", authCookie)
        .send({
          clientId: "client-abc",
          caseNumber: "CASE-2026/01",
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("DATABASE_UNAVAILABLE");
      expect(res.body.error).toContain("قاعدة البيانات غير متصلة حالياً");
    });
  });

  describe("In-Memory Store Remains Clean on DB Failures", () => {
    it("ensures in-memory Maps are not silently written when DB operation fails", async () => {
      postgresService.setForceDisableMemoryStoreForTesting(true);
      vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
        id: "local-lawyer-default",
        username: "12345",
        role: "admin",
        status: "active",
        subscription_end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      } as any);
      vi.spyOn(supabaseService, "getSupabaseClient").mockReturnValue(null);

      // Attempt write via API
      await request(app)
        .post("/api/clients")
        .set("Cookie", authCookie)
        .send({ name: "بيانات ضائعة" });

      // Re-enable memory store to inspect its content
      postgresService.setForceDisableMemoryStoreForTesting(false);
      const memClients = await postgresService.listClients("local-office-admin");
      expect(memClients.length).toBe(0);
    });
  });
});
