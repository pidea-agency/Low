import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as googleSheetsService from "../services/googleSheets.service";
import { invalidatePoaCache, POA_SHEET_COLUMNS } from "../services/poa.sheets.service";
import { invalidateTaskCache, TASK_SHEET_COLUMNS } from "../services/task.sheets.service";
import { invalidateJudgmentCache, JUDGMENT_SHEET_COLUMNS } from "../services/judgment.sheets.service";

function createMockGoogleSheetsClient() {
  const tabs: Record<string, { sheetId: number; data: string[][] }> = {
    Attorney: {
      sheetId: 101,
      data: [
        [...POA_SHEET_COLUMNS],
        // row 2: legacy unmigrated record (no office)
        ["موكل قديم", "1445/POA/LEGACY", "1445/01/01", "1446/01/01", "0", "ملاحظة", "2026-01-01T00:00:00Z", ""],
      ],
    },
    Tasks: {
      sheetId: 102,
      data: [
        [...TASK_SHEET_COLUMNS],
        // row 2: legacy unmigrated record (no office)
        ["مهمة قديمة", "محامي قديم", "عادية", "2026-01-01", "0", "مكتملة", "ملاحظة", "2026-01-01T00:00:00Z", ""],
      ],
    },
    Judgment: {
      sheetId: 103,
      data: [
        [...JUDGMENT_SHEET_COLUMNS],
        // row 2: legacy unmigrated record (no office)
        ["1445/قضية/01", "المحكمة", "مدعي", "مدعى عليه", "محامي", "1445/حكم/01", "1445/01/01", "ملخص قديم", "نهائي", "2026-01-01T00:00:00Z", ""],
      ],
    },
  };

  return {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: Object.entries(tabs).map(([title, val]) => ({
            properties: { title, sheetId: val.sheetId },
          })),
        },
      }),
      batchUpdate: async ({ requestBody }: any) => {
        const req = requestBody?.requests?.[0];
        if (req?.deleteDimension) {
          const { sheetId, startIndex } = req.deleteDimension.range;
          const tab = Object.values(tabs).find((t) => t.sheetId === sheetId);
          if (tab && startIndex < tab.data.length) {
            tab.data.splice(startIndex, 1);
          }
        }
        return { data: {} };
      },
      values: {
        get: async ({ range }: any) => {
          const tabName = range.split("!")[0].replace(/'/g, "");
          const tab = tabs[tabName];
          if (!tab) return { data: { values: [] } };
          if (range.includes("A2:")) {
            return { data: { values: tab.data.slice(1).map((r) => [...r]) } };
          }
          return { data: { values: tab.data.map((r) => [...r]) } };
        },
        append: async ({ range, requestBody }: any) => {
          const tabName = range.split("!")[0].replace(/'/g, "");
          const tab = tabs[tabName];
          const newRow = requestBody?.values?.[0] ?? [];
          tab.data.push([...newRow]);
          const rowNum = tab.data.length;
          return {
            data: {
              updates: {
                updatedRange: `${tabName}!A${rowNum}:Z${rowNum}`,
              },
            },
          };
        },
        update: async ({ range, requestBody }: any) => {
          const tabName = range.split("!")[0].replace(/'/g, "");
          const tab = tabs[tabName];
          const match = range.match(/![A-Z]+(\d+):/);
          if (match && tab) {
            const rowIndex = Number(match[1]) - 1;
            const updatedValues = requestBody?.values?.[0];
            if (updatedValues && tab.data[rowIndex]) {
              tab.data[rowIndex] = [...updatedValues];
            }
          }
          return { data: {} };
        },
      },
    },
  };
}

describe("Cross-Office Isolation for POA, Tasks, and Judgments", { timeout: 30000 }, () => {
  let officeACookie: string;
  let officeBCookie: string;
  let userA: any;
  let userB: any;

  beforeAll(async () => {
    // 1. Create two separate office admins
    const usernameA = `office_a_${Date.now()}`;
    const usernameB = `office_b_${Date.now()}`;
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    userA = await supabaseService.createSupabaseUser({
      username: usernameA,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });

    userB = await supabaseService.createSupabaseUser({
      username: usernameB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });

    const mockSheetsClient = createMockGoogleSheetsClient();
    vi.spyOn(googleSheetsService, "getGoogleContext").mockImplementation(async (userId, defaultSheetName) => {
      return {
        sheets: mockSheetsClient as any,
        spreadsheetId: "mock-spreadsheet-id-12345",
        sheetName: defaultSheetName || "Sessions",
      };
    });

    // Invalidate caches before starting
    invalidatePoaCache();
    invalidateTaskCache();
    invalidateJudgmentCache();

    // Login Office A
    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ username: usernameA, password: "OfficePass123!" });
    expect(loginA.status).toBe(200);
    const cookieA = loginA.headers["set-cookie"];
    officeACookie = Array.isArray(cookieA) ? cookieA.join("; ") : cookieA;

    // Login Office B
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ username: usernameB, password: "OfficePass123!" });
    expect(loginB.status).toBe(200);
    const cookieB = loginB.headers["set-cookie"];
    officeBCookie = Array.isArray(cookieB) ? cookieB.join("; ") : cookieB;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (userA?.id) await supabaseService.deleteSupabaseUser(userA.id).catch(() => {});
    if (userB?.id) await supabaseService.deleteSupabaseUser(userB.id).catch(() => {});
  });

  describe("Unauthenticated requests", () => {
    it("rejects unauthenticated requests to /api/poa with 401", async () => {
      const res = await request(app).get("/api/poa");
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to /api/tasks with 401", async () => {
      const res = await request(app).get("/api/tasks");
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to /api/judgments with 401", async () => {
      const res = await request(app).get("/api/judgments");
      expect(res.status).toBe(401);
    });
  });

  describe("Power of Attorney (POA) Cross-Office Isolation", () => {
    let officeARowId: number;

    it("Office A creates a POA record; Office B cannot see it", async () => {
      // Office A creates POA
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", officeACookie)
        .send({
          clientName: "موكل مكتب أ",
          poaNumber: "1446/POA/A1",
          issueDateHijri: "1446/01/01",
          expiryDateHijri: "1447/01/01",
          notes: "سري للغاية لمكتب أ",
          officeId: "forged_office_b", // Forged office value in body must be ignored
        });

      expect(createRes.status).toBe(201);

      // Office A lists and sees it
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      expect(listARes.status).toBe(200);
      const aRecord = listARes.body.find((r: any) => r.poaNumber === "1446/POA/A1");
      expect(aRecord).toBeDefined();
      officeARowId = aRecord.sheetRowId;

      // Office B lists and MUST NOT see it
      const listBRes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeBCookie);
      expect(listBRes.status).toBe(200);
      const bFound = listBRes.body.find((r: any) => r.poaNumber === "1446/POA/A1");
      expect(bFound).toBeUndefined();
    });

    it("Office B attempts to update Office A's POA record -> 404 and record is unchanged", async () => {
      const updateRes = await request(app)
        .put(`/api/poa/${officeARowId}`)
        .set("Cookie", officeBCookie)
        .send({ clientName: "مخترق من مكتب ب" });

      // Must be 404 (not 403, so existence is not revealed)
      expect(updateRes.status).toBe(404);

      // Verify Office A's record is completely unchanged
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      const aRecord = listARes.body.find((r: any) => r.sheetRowId === officeARowId);
      expect(aRecord.clientName).toBe("موكل مكتب أ");
    });

    it("Office B attempts to delete Office A's POA record -> 404 and record still exists", async () => {
      const deleteRes = await request(app)
        .delete(`/api/poa/${officeARowId}`)
        .set("Cookie", officeBCookie);

      expect(deleteRes.status).toBe(404);

      // Verify Office A's record still exists
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      const aRecord = listARes.body.find((r: any) => r.sheetRowId === officeARowId);
      expect(aRecord).toBeDefined();
    });

    it("Office A can update and delete its own POA record normally", async () => {
      // Update by owner
      const updateRes = await request(app)
        .put(`/api/poa/${officeARowId}`)
        .set("Cookie", officeACookie)
        .send({ clientName: "موكل مكتب أ - معدل" });
      expect(updateRes.status).toBe(200);

      // Delete by owner
      const deleteRes = await request(app)
        .delete(`/api/poa/${officeARowId}`)
        .set("Cookie", officeACookie);
      expect(deleteRes.status).toBe(204);

      // Verify it's gone for Office A
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      const aRecord = listARes.body.find((r: any) => r.sheetRowId === officeARowId);
      expect(aRecord).toBeUndefined();
    });
  });

  describe("Tasks Cross-Office Isolation", () => {
    let officeATaskId: number;

    it("Office A creates a Task; Office B cannot see or get it", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", officeACookie)
        .send({
          title: "مهمة إعداد مذكرة لمكتب أ",
          assignee: "محامي مكتب أ",
          priority: "عاجلة",
          dueDate: "2026-12-01",
          status: "قيد التنفيذ",
          officeId: "forged_b",
        });
      expect(createRes.status).toBe(201);
      officeATaskId = createRes.body.id;

      // Office B lists and does NOT see it
      const listBRes = await request(app)
        .get("/api/tasks")
        .set("Cookie", officeBCookie);
      expect(listBRes.status).toBe(200);
      const bFound = listBRes.body.find((t: any) => t.id === officeATaskId);
      expect(bFound).toBeUndefined();

      // Office B gets by ID -> 404
      const getBRes = await request(app)
        .get(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie);
      expect(getBRes.status).toBe(404);
    });

    it("Office B attempts to update or delete Office A's Task -> 404", async () => {
      // Update attempt
      const updateRes = await request(app)
        .put(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie)
        .send({ title: "تعديل غير مصرح به" });
      expect(updateRes.status).toBe(404);

      // Delete attempt
      const deleteRes = await request(app)
        .delete(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);

      // Office A still sees it intact
      const getARes = await request(app)
        .get(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeACookie);
      expect(getARes.status).toBe(200);
      expect(getARes.body.title).toBe("مهمة إعداد مذكرة لمكتب أ");
    });
  });

  describe("Judgments Cross-Office Isolation", () => {
    let officeAJudgmentId: number;

    it("Office A creates a Judgment; Office B cannot see or get it", async () => {
      const createRes = await request(app)
        .post("/api/judgments")
        .set("Cookie", officeACookie)
        .send({
          caseNumber: "1446/قضية/A1",
          court: "المحكمة العامة",
          plaintiff: "المدعي أ",
          defendant: "المدعى عليه أ",
          assignedLawyer: "محامي أ",
          judgmentNumber: "1446/حكم/01",
          judgmentDate: "1446/02/01",
          summary: "حكم خاص بمكتب أ",
          isFavorable: "نهائي",
          officeId: "forged_b",
        });
      expect(createRes.status).toBe(201);
      officeAJudgmentId = createRes.body.id;

      // Office B lists -> does NOT see it
      const listBRes = await request(app)
        .get("/api/judgments")
        .set("Cookie", officeBCookie);
      expect(listBRes.status).toBe(200);
      const bFound = listBRes.body.find((j: any) => j.id === officeAJudgmentId);
      expect(bFound).toBeUndefined();

      // Office B gets by ID -> 404
      const getBRes = await request(app)
        .get(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie);
      expect(getBRes.status).toBe(404);
    });

    it("Office B attempts to update or delete Office A's Judgment -> 404", async () => {
      // Update attempt
      const updateRes = await request(app)
        .put(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie)
        .send({ summary: "تعديل محظور" });
      expect(updateRes.status).toBe(404);

      // Delete attempt
      const deleteRes = await request(app)
        .delete(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);

      // Office A still sees it
      const getARes = await request(app)
        .get(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeACookie);
      expect(getARes.status).toBe(200);
      expect(getARes.body.summary).toBe("حكم خاص بمكتب أ");
    });
  });

  describe("Legacy / Unmigrated records visibility", () => {
    it("Unmigrated records without office are invisible to both Office A and Office B in list", async () => {
      const listTasksA = await request(app).get("/api/tasks").set("Cookie", officeACookie);
      const listTasksB = await request(app).get("/api/tasks").set("Cookie", officeBCookie);
      expect(listTasksA.body.find((t: any) => t.id === 2)).toBeUndefined();
      expect(listTasksB.body.find((t: any) => t.id === 2)).toBeUndefined();

      const listJudgmentsA = await request(app).get("/api/judgments").set("Cookie", officeACookie);
      const listJudgmentsB = await request(app).get("/api/judgments").set("Cookie", officeBCookie);
      expect(listJudgmentsA.body.find((j: any) => j.id === 2)).toBeUndefined();
      expect(listJudgmentsB.body.find((j: any) => j.id === 2)).toBeUndefined();
    });

    it("Direct access by ID to unmigrated records returns 404 for any office", async () => {
      const getTaskA = await request(app).get("/api/tasks/2").set("Cookie", officeACookie);
      const getTaskB = await request(app).get("/api/tasks/2").set("Cookie", officeBCookie);
      expect(getTaskA.status).toBe(404);
      expect(getTaskB.status).toBe(404);

      const getJudgmentA = await request(app).get("/api/judgments/2").set("Cookie", officeACookie);
      const getJudgmentB = await request(app).get("/api/judgments/2").set("Cookie", officeBCookie);
      expect(getJudgmentA.status).toBe(404);
      expect(getJudgmentB.status).toBe(404);
    });
  });
});
