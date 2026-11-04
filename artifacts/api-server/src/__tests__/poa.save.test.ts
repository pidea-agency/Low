import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as postgresService from "../services/postgres.service";

describe("POA Save Path & Error Handling (/api/poa)", () => {
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
    it("rejects POA creation with missing clientName or poaNumber with 400", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "",
          poaNumber: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("اسم العميل ورقم الوكالة مطلوبان.");
    });
  });

  describe("Happy Path Save & Read-After-Write", () => {
    it("creates POA with valid payload, stamps office, and returns 201", async () => {
      const payload = {
        clientName: "شركة الوفاق للاستثمار",
        poaNumber: "1446/POA/9981",
        issueDateHijri: "1446/01/10",
        expiryDateHijri: "1447/01/10",
        notes: "وكالة خاصة بالمرافعة",
      };

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.clientName).toBe(payload.clientName);
      expect(res.body.poaNumber).toBe(payload.poaNumber);
      expect(res.body.officeId).toBe(testOfficeId);

      // Verify list contains the created POA
      const listRes = await request(app)
        .get("/api/poa")
        .set("Cookie", authCookie);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.some((p: any) => p.poaNumber === payload.poaNumber)).toBe(true);
    });

    it("updates existing POA and returns updated record", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "موكل قبل التعديل",
          poaNumber: "1446/POA/UPDATE",
        });

      const rowId = createRes.body.sheetRowId || createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/poa/${rowId}`)
        .set("Cookie", authCookie)
        .send({
          clientName: "موكل بعد التعديل",
          notes: "تم تحديث الوكالة",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.clientName).toBe("موكل بعد التعديل");
      expect(updateRes.body.notes).toBe("تم تحديث الوكالة");
    });

    it("deletes existing POA with 204", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "موكل للحذف",
          poaNumber: "1446/POA/DELETE",
        });

      const rowId = createRes.body.sheetRowId || createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/poa/${rowId}`)
        .set("Cookie", authCookie);

      expect(deleteRes.status).toBe(204);
    });
  });
});
