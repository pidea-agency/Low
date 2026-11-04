import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as postgresService from "../services/postgres.service";

describe("Task Save Path & Error Handling (/api/tasks)", () => {
  const testOfficeId = "local-office-admin";
  const authCookie = createSignedSessionCookie({
    username: "12345",
    userId: "local-lawyer-default",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    postgresService.resetInMemoryStore();
  });

  describe("Validation & Empty Title", () => {
    it("rejects task creation with empty title with 400 and clear Arabic message", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "   ",
          assignee: "محامي",
          priority: "عادية",
          dueDate: "2026-11-20",
          status: "قيد التنفيذ",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("عنوان المهمة مطلوب.");
    });
  });

  describe("Happy Path Save & Office Isolation", () => {
    it("creates task with exact payload, stamps office, and returns 201", async () => {
      const uiPayload = {
        title: "مهمة إعداد مذكرة دفاع QA",
        assignee: "المحامي أحمد",
        priority: "عاجلة",
        dueDate: "2026-11-25",
        status: "قيد التنفيذ",
        notes: "ملاحظة هامة",
      };

      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send(uiPayload);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe(uiPayload.title);
      expect(res.body.assignee).toBe(uiPayload.assignee);
      expect(res.body.priority).toBe(uiPayload.priority);
      expect(res.body.dueDate).toBe(uiPayload.dueDate);
      expect(res.body.status).toBe(uiPayload.status);
      expect(res.body.officeId).toBe(testOfficeId);

      // Verify retrieval
      const getRes = await request(app)
        .get(`/api/tasks/${res.body.id}`)
        .set("Cookie", authCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(res.body.id);
      expect(getRes.body.title).toBe(uiPayload.title);
    });

    it("updates existing task and returns updated fields", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "مهمة للتحديث",
          priority: "عادية",
          status: "قيد التنفيذ",
        });

      const taskId = createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", authCookie)
        .send({
          title: "مهمة محدثة بنجاح",
          status: "مكتملة",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.title).toBe("مهمة محدثة بنجاح");
      expect(updateRes.body.status).toBe("مكتملة");
    });

    it("deletes existing task with 204", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "مهمة للحذف",
          status: "معلقة",
        });

      const taskId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Cookie", authCookie);

      expect(deleteRes.status).toBe(204);

      // Verify 404 after deletion
      const getRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set("Cookie", authCookie);

      expect(getRes.status).toBe(404);
    });
  });
});
