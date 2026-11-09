import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Document & Attachment Uploads & Permissions", { timeout: 45000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let adminA: any;
  let cookieAdminA: string;

  let staffA1: any;
  let cookieStaffA1: string;

  let staffA2: any;
  let cookieStaffA2: string;

  let adminB: any;
  let cookieAdminB: string;

  let clientA: any;
  let taskAssignedToStaffA1: any;
  let taskAssignedToStaffA2: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `att_admin_a_${Date.now()}`;
    adminA = await supabaseService.createSupabaseUser({
      username: unameAdminA,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: futureDate,
    });
    const loginAdminA = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminA, password: "OfficePass123!" });
    expect(loginAdminA.status).toBe(200);
    const cAdminA = loginAdminA.headers["set-cookie"];
    cookieAdminA = Array.isArray(cAdminA) ? cAdminA.join("; ") : cAdminA;

    // 2. Staff A1 under Admin A
    const unameStaffA1 = `att_staff_a1_${Date.now()}`;
    staffA1 = await supabaseService.createSupabaseUser({
      username: unameStaffA1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي زيد",
      subscription_end_date: futureDate,
    });
    const loginStaffA1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA1, password: "OfficePass123!" });
    expect(loginStaffA1.status).toBe(200);
    const cStaffA1 = loginStaffA1.headers["set-cookie"];
    cookieStaffA1 = Array.isArray(cStaffA1) ? cStaffA1.join("; ") : cStaffA1;

    // 3. Staff A2 under Admin A
    const unameStaffA2 = `att_staff_a2_${Date.now()}`;
    staffA2 = await supabaseService.createSupabaseUser({
      username: unameStaffA2,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي عمرو",
      subscription_end_date: futureDate,
    });
    const loginStaffA2 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA2, password: "OfficePass123!" });
    expect(loginStaffA2.status).toBe(200);
    const cStaffA2 = loginStaffA2.headers["set-cookie"];
    cookieStaffA2 = Array.isArray(cStaffA2) ? cStaffA2.join("; ") : cStaffA2;

    // 4. Office B Admin
    const unameAdminB = `att_admin_b_${Date.now()}`;
    adminB = await supabaseService.createSupabaseUser({
      username: unameAdminB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: futureDate,
    });
    const loginAdminB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminB, password: "OfficePass123!" });
    expect(loginAdminB.status).toBe(200);
    const cAdminB = loginAdminB.headers["set-cookie"];
    cookieAdminB = Array.isArray(cAdminB) ? cAdminB.join("; ") : cAdminB;

    // Create a Client in Office A
    clientA = await postgresService.createClient(
      {
        name: "شركة الأفق للاستشارات",
        phone: "0501234567",
      },
      adminA.id
    );

    // Create tasks in Office A
    taskAssignedToStaffA1 = await postgresService.createTask(
      {
        title: "إعداد مذكرة دفاع",
        dueDate: "1447/09/15",
        priority: "عاجلة",
        status: "قيد التنفيذ",
        assignedLawyerId: staffA1.id,
        assignee: "المحامي زيد",
        clientId: clientA.id,
      },
      adminA.id
    );

    taskAssignedToStaffA2 = await postgresService.createTask(
      {
        title: "حضور جلسة استماع",
        dueDate: "1447/09/20",
        priority: "عادية",
        status: "قيد التنفيذ",
        assignedLawyerId: staffA2.id,
        assignee: "المحامي عمرو",
      },
      adminA.id
    );
  }, 45000);

  describe("Upload Validation (file types and sizes)", () => {
    it("rejects forbidden file extensions like .exe or .sh", async () => {
      const res = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieAdminA)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", Buffer.from("echo hacked"), "malicious.sh");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("غير مسموح به");
    });

    it("rejects executable .exe files", async () => {
      const res = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieAdminA)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", Buffer.from("MZ dummy executable"), "malicious.exe");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("غير مسموح به");
    });

    it("accepts allowed file types (PDF, PNG, JPG, DOCX)", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 sample pdf content");
      const res = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieAdminA)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", pdfBuffer, "contract.pdf");

      expect(res.status).toBe(201);
      expect(res.body.fileName).toBe("contract.pdf");
      expect(res.body.relatedRecordType).toBe("task");
      expect(res.body.relatedRecordId).toBe(String(taskAssignedToStaffA1.id));
    });
  });

  describe("Access Scoping by Lawyer Assignment", () => {
    let staff1Attachment: any;

    it("allows assigned staff to upload and view attachments on their assigned task", async () => {
      const imgBuffer = Buffer.from("fake image bytes");
      const uploadRes = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieStaffA1)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", imgBuffer, "evidence.png");

      expect(uploadRes.status).toBe(201);
      staff1Attachment = uploadRes.body;
      expect(staff1Attachment.uploadedBy).toBe(staffA1.id);

      // List attachments as staffA1
      const listRes = await request(app)
        .get(`/api/attachments?relatedRecordType=task&relatedRecordId=${taskAssignedToStaffA1.id}`)
        .set("Cookie", cookieStaffA1);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);
      const found = listRes.body.some((a: any) => a.id === staff1Attachment.id);
      expect(found).toBe(true);
    });

    it("forbids unassigned staff from uploading to a task they are not assigned to", async () => {
      const docBuffer = Buffer.from("fake docx");
      const res = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieStaffA2)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", docBuffer, "unauthorized.docx");

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("صلاحية");
    });

    it("forbids unassigned staff from listing attachments on a record they cannot access", async () => {
      const res = await request(app)
        .get(`/api/attachments?relatedRecordType=task&relatedRecordId=${taskAssignedToStaffA1.id}`)
        .set("Cookie", cookieStaffA2);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("صلاحية");
    });

    it("forbids unassigned staff from downloading an attachment on an unassigned record", async () => {
      const res = await request(app)
        .get(`/api/attachments/${staff1Attachment.id}/download?json=true`)
        .set("Cookie", cookieStaffA2);

      expect(res.status).toBe(403);
    });

    it("allows office admin to view and download all attachments in the office", async () => {
      const listRes = await request(app)
        .get(`/api/attachments?relatedRecordType=task&relatedRecordId=${taskAssignedToStaffA1.id}`)
        .set("Cookie", cookieAdminA);

      expect(listRes.status).toBe(200);
      expect(listRes.body.some((a: any) => a.id === staff1Attachment.id)).toBe(true);

      const downloadRes = await request(app)
        .get(`/api/attachments/${staff1Attachment.id}/download?json=true`)
        .set("Cookie", cookieAdminA);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.downloadUrl).toBeDefined();
      expect(downloadRes.body.downloadUrl).toContain("token=");
    });

    it("generates signed URL with short expiration for authorized user", async () => {
      const res = await request(app)
        .get(`/api/attachments/${staff1Attachment.id}/download?json=true`)
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBeDefined();
      expect(res.body.fileName).toBe("evidence.png");
      expect(res.body.expiresIn).toBe(60);
    });
  });

  describe("Deletion Permissions", () => {
    let attachmentToDelete: any;

    beforeAll(async () => {
      const buffer = Buffer.from("to be deleted");
      const res = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieStaffA1)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", buffer, "delete_me.pdf");
      expect(res.status).toBe(201);
      attachmentToDelete = res.body;
    }, 20000);

    it("forbids other staff from deleting an attachment they did not upload", async () => {
      // Even if staffA1 is uploader, staffA2 cannot delete it
      const res = await request(app)
        .delete(`/api/attachments/${attachmentToDelete.id}`)
        .set("Cookie", cookieStaffA2);

      expect(res.status).toBe(403);
    });

    it("allows the original uploader (staffA1) to delete their own attachment", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${attachmentToDelete.id}`)
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const verifyRes = await request(app)
        .get(`/api/attachments/${attachmentToDelete.id}/download?json=true`)
        .set("Cookie", cookieStaffA1);

      expect(verifyRes.status).toBe(404);
    });

    it("allows office admin to delete any attachment created by staff", async () => {
      // Create another attachment uploaded by staffA1
      const buffer = Buffer.from("admin will delete this");
      const uploadRes = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieStaffA1)
        .field("relatedRecordType", "task")
        .field("relatedRecordId", String(taskAssignedToStaffA1.id))
        .attach("file", buffer, "staff_doc.pdf");
      expect(uploadRes.status).toBe(201);
      const doc = uploadRes.body;

      // Admin A deletes it
      const delRes = await request(app)
        .delete(`/api/attachments/${doc.id}`)
        .set("Cookie", cookieAdminA);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe("Cross-Office Isolation", () => {
    let officeAAttachment: any;

    beforeAll(async () => {
      const buffer = Buffer.from("office A secret data");
      const res = await request(app)
        .post("/api/attachments")
        .set("Cookie", cookieAdminA)
        .field("relatedRecordType", "client")
        .field("relatedRecordId", clientA.id)
        .attach("file", buffer, "confidential.pdf");
      expect(res.status).toBe(201);
      officeAAttachment = res.body;
    }, 20000);

    it("blocks Admin B from listing Office A attachments", async () => {
      const res = await request(app)
        .get(`/api/attachments?relatedRecordType=client&relatedRecordId=${clientA.id}`)
        .set("Cookie", cookieAdminB);

      // Record doesn't belong to Office B
      expect(res.status).toBe(404);
    });

    it("blocks Admin B from downloading Office A attachment", async () => {
      const res = await request(app)
        .get(`/api/attachments/${officeAAttachment.id}/download?json=true`)
        .set("Cookie", cookieAdminB);

      expect(res.status).toBe(404);
    });

    it("blocks Admin B from deleting Office A attachment", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${officeAAttachment.id}`)
        .set("Cookie", cookieAdminB);

      expect(res.status).toBe(404);
    });
  });
});
