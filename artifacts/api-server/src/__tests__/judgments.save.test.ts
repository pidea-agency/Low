import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as postgresService from "../services/postgres.service";

describe("Judgment Save Path & Error Handling (/api/judgments)", () => {
  const testOfficeId = "local-office-admin";
  const authCookie = createSignedSessionCookie({
    username: "12345",
    userId: "local-lawyer-default",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    postgresService.resetInMemoryStore();
  });

  describe("Validation & Required Fields", () => {
    it("rejects judgment creation with missing caseNumber or judgmentNumber with 400", async () => {
      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "",
          judgmentNumber: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("رقم القضية ورقم الصك مطلوبان.");
    });
  });

  describe("Happy Path Save & Office Isolation", () => {
    it("creates judgment with valid payload, stamps office, and returns 201", async () => {
      const payload = {
        caseNumber: "1446/قضية/5501",
        court: "المحكمة التجارية بالرياض",
        plaintiff: "شركة التقنية المتقدمة",
        defendant: "مؤسسة البناء الحديث",
        assignedLawyer: "المحامي خالد",
        judgmentNumber: "451009988",
        judgmentDate: "1446/02/15",
        summary: "حكم لصالح المدعي بإلزام المدعى عليه بسداد المبلغ",
        isFavorable: "نهائي",
      };

      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.caseNumber).toBe(payload.caseNumber);
      expect(res.body.judgmentNumber).toBe(payload.judgmentNumber);
      expect(res.body.officeId).toBe(testOfficeId);

      // Verify retrieval
      const getRes = await request(app)
        .get(`/api/judgments/${res.body.id}`)
        .set("Cookie", authCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.caseNumber).toBe(payload.caseNumber);
    });

    it("updates existing judgment and returns updated fields", async () => {
      const createRes = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "1446/ق/1",
          judgmentNumber: "111",
        });

      const judgmentId = createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/judgments/${judgmentId}`)
        .set("Cookie", authCookie)
        .send({
          court: "محكمة الاستئناف",
          summary: "تم تأييد الحكم",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.court).toBe("محكمة الاستئناف");
      expect(updateRes.body.summary).toBe("تم تأييد الحكم");
    });

    it("deletes existing judgment with 204", async () => {
      const createRes = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "1446/ق/DELETE",
          judgmentNumber: "999",
        });

      const judgmentId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/judgments/${judgmentId}`)
        .set("Cookie", authCookie);

      expect(deleteRes.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/judgments/${judgmentId}`)
        .set("Cookie", authCookie);

      expect(getRes.status).toBe(404);
    });
  });
});
