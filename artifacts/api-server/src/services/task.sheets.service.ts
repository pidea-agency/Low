import { google, type sheets_v4 } from "googleapis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { getGoogleContext, GoogleSheetsError, classifyGoogleError } from "./googleSheets.service";

/**
 * Google Sheets service for Tasks (المهام) records.
 * Uses a dedicated sheet tab named "Tasks" in the spreadsheet.
 * Strictly enforces office-level multi-tenant isolation via the "معرف المكتب" column.
 */

const TASK_SHEET_NAME = "Tasks";

export const TASK_SHEET_COLUMNS = [
  "عنوان المهمة",        // Col 0 (A)
  "المكلف",             // Col 1 (B)
  "الأولوية",           // Col 2 (C)
  "تاريخ التسليم",      // Col 3 (D)
  "عدد الأيام المتبقية", // Col 4 (E)
  "الحالة",             // Col 5 (F)
  "ملاحظات",            // Col 6 (G)
  "تاريخ الإنشاء",      // Col 7 (H)
  "معرف المكتب",         // Col 8 (I) - Office ID
] as const;

export const TASK_COLS = TASK_SHEET_COLUMNS.length; // 9
const COL_LAST = String.fromCharCode("A".charCodeAt(0) + TASK_COLS - 1); // "I"
export const TASK_OFFICE_COL_INDEX = 8;

let sheetsClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (!sheetsClient) {
    const credentials = env.googleServiceAccountJson as {
      client_email?: string;
      private_key?: string;
    };
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email/private_key.",
      );
    }
    const privateKey = credentials.private_key.replace(/\\n/g, "\n");
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

let taskSheetIdCache: number | null = null;
let isTaskSheetReadyCache = false;

// In-memory data cache
let taskDataCache: { id: number; values: TaskRow }[] | null = null;
let lastTaskCacheTime = 0;
const TASK_CACHE_TTL_MS = 15000; // 15 seconds

export function invalidateTaskCache(): void {
  taskDataCache = null;
  lastTaskCacheTime = 0;
}

async function getTaskSheetId(officeId?: string): Promise<number> {
  const ctx = await getGoogleContext(officeId, TASK_SHEET_NAME);
  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === TASK_SHEET_NAME,
    );
    if (!sheet?.properties || sheet.properties.sheetId == null) {
      throw new Error(`Sheet tab "${TASK_SHEET_NAME}" not found.`);
    }
    return sheet.properties.sheetId;
  } catch (err: any) {
    throw classifyGoogleError(err, "getTaskSheetId", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: TASK_SHEET_NAME,
      userId: officeId,
    });
  }
}

/** Ensures the "Tasks" sheet tab exists with the correct header row. */
export async function ensureTaskSheetReady(officeId?: string): Promise<void> {
  const ctx = await getGoogleContext(officeId, TASK_SHEET_NAME);
  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const existing = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === TASK_SHEET_NAME,
    );

    if (!existing) {
      await ctx.sheets.spreadsheets.batchUpdate({
        spreadsheetId: ctx.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: TASK_SHEET_NAME } } }],
        },
      });
      logger.info(`Created sheet tab "${TASK_SHEET_NAME}"`);
    }

    // Always ensure the header is up to date (A1:I1)
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${TASK_SHEET_NAME}!A1:${COL_LAST}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...TASK_SHEET_COLUMNS]] },
    });
  } catch (err: any) {
    throw classifyGoogleError(err, "ensureTaskSheetReady", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: TASK_SHEET_NAME,
      userId: officeId,
    });
  }
}

export type TaskRow = string[];

/** Internal helper to fetch all raw task rows from sheet */
async function fetchAllRawTaskRows(officeId?: string, forceRefresh = false): Promise<{
  headers: string[];
  rows: { id: number; values: TaskRow }[];
}> {
  await ensureTaskSheetReady(officeId);
  const ctx = await getGoogleContext(officeId, TASK_SHEET_NAME);

  const now = Date.now();
  const useCache =
    !forceRefresh &&
    taskDataCache !== null &&
    now - lastTaskCacheTime < TASK_CACHE_TTL_MS;

  try {
    if (useCache) {
      const headerRes = await ctx.sheets.spreadsheets.values.get({
        spreadsheetId: ctx.spreadsheetId,
        range: `${TASK_SHEET_NAME}!A1:${COL_LAST}1`,
      });
      const headers = ((headerRes.data.values?.[0] as string[]) ?? [...TASK_SHEET_COLUMNS]);
      return { headers, rows: taskDataCache! };
    }

    const response = await ctx.sheets.spreadsheets.values.get({
      spreadsheetId: ctx.spreadsheetId,
      range: `${TASK_SHEET_NAME}!A1:${COL_LAST}`,
    });
    const data = response.data.values ?? [];
    const headers = (data[0] as string[]) ?? [...TASK_SHEET_COLUMNS];
    const dataRows = data.slice(1);
    const rows = dataRows
      .map((row, index) => ({ id: index + 2, values: row as TaskRow }))
      .filter((row) => row.values.some((cell) => cell !== undefined && cell !== ""));

    taskDataCache = rows;
    lastTaskCacheTime = now;
    return { headers, rows };
  } catch (err: any) {
    throw classifyGoogleError(err, "fetchAllRawTaskRows", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: TASK_SHEET_NAME,
      userId: officeId,
    });
  }
}

/**
 * Returns all Task records for the specified office.
 * Unmigrated rows without an office are strictly ignored.
 */
export async function listTaskRowsWithHeaders(
  officeId: string,
  forceRefresh = false,
): Promise<{
  headers: string[];
  rows: { id: number; values: TaskRow }[];
}> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to list Task records.");
  }
  const cleanOfficeId = officeId.trim();
  const { headers, rows } = await fetchAllRawTaskRows(cleanOfficeId, forceRefresh);

  const officeColIdx = headers.findIndex((h) => h.trim() === "معرف المكتب");
  const actualColIdx = officeColIdx !== -1 ? officeColIdx : TASK_OFFICE_COL_INDEX;

  const filtered = rows.filter((r) => (r.values[actualColIdx] || "").trim() === cleanOfficeId);
  return { headers, rows: filtered };
}

/**
 * Gets a single Task record row by id, strictly verifying office ownership.
 * Returns null if record doesn't exist or belongs to another office.
 */
export async function getTaskRowById(
  officeId: string,
  id: number,
): Promise<{ id: number; values: TaskRow; headers: string[] } | null> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to get a Task record.");
  }
  const cleanOfficeId = officeId.trim();
  const { headers, rows } = await fetchAllRawTaskRows(cleanOfficeId);

  const match = rows.find((r) => r.id === id);
  if (!match) return null;

  const officeColIdx = headers.findIndex((h) => h.trim() === "معرف المكتب");
  const actualColIdx = officeColIdx !== -1 ? officeColIdx : TASK_OFFICE_COL_INDEX;

  if ((match.values[actualColIdx] || "").trim() !== cleanOfficeId) {
    return null; // Do not reveal existence of records from other offices
  }
  return { id: match.id, values: match.values, headers };
}

/**
 * Appends a new Task record row, forcefully stamping the caller's office.
 */
export async function appendTaskRow(officeId: string, values: TaskRow): Promise<number> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to create a Task record.");
  }
  invalidateTaskCache();
  await ensureTaskSheetReady(officeId);
  const ctx = await getGoogleContext(officeId, TASK_SHEET_NAME);

  const paddedValues: string[] = Array.from({ length: TASK_COLS }, (_, i) => values[i] ?? "");
  paddedValues[TASK_OFFICE_COL_INDEX] = officeId.trim();

  try {
    const response = await ctx.sheets.spreadsheets.values.append({
      spreadsheetId: ctx.spreadsheetId,
      range: `${TASK_SHEET_NAME}!A:${COL_LAST}`,
      valueInputOption: "RAW",
      insertDataOption: "OVERWRITE",
      requestBody: { values: [paddedValues] },
    });
    const updatedRange = response.data.updates?.updatedRange;
    const match = updatedRange?.match(/![A-Z]+(\d+):/);
    if (match) return Number(match[1]);

    const { rows } = await fetchAllRawTaskRows(officeId, true);
    const last = rows[rows.length - 1];
    if (!last) throw new Error("Failed to determine id of newly created Task row.");
    return last.id;
  } catch (err: any) {
    throw classifyGoogleError(err, "appendTaskRow", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: TASK_SHEET_NAME,
      userId: officeId,
    });
  }
}

/**
 * Updates an existing Task row by its 1-based row id.
 * Verifies that the row belongs to the caller's office before updating.
 */
export async function updateTaskRow(officeId: string, id: number, values: TaskRow): Promise<void> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to update a Task record.");
  }
  const existing = await getTaskRowById(officeId, id);
  if (!existing) {
    throw new Error("Task record not found for this office.");
  }

  const ctx = await getGoogleContext(officeId, TASK_SHEET_NAME);
  invalidateTaskCache();
  const paddedValues: string[] = Array.from({ length: TASK_COLS }, (_, i) => values[i] ?? "");
  paddedValues[TASK_OFFICE_COL_INDEX] = officeId.trim();

  try {
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${TASK_SHEET_NAME}!A${id}:${COL_LAST}${id}`,
      valueInputOption: "RAW",
      requestBody: { values: [paddedValues] },
    });
  } catch (err: any) {
    throw classifyGoogleError(err, "updateTaskRow", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: TASK_SHEET_NAME,
      userId: officeId,
    });
  }
}

/**
 * Deletes a Task row by its 1-based row id.
 * Verifies that the row belongs to the caller's office before deleting.
 */
export async function deleteTaskRow(officeId: string, id: number): Promise<void> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to delete a Task record.");
  }
  const existing = await getTaskRowById(officeId, id);
  if (!existing) {
    throw new Error("Task record not found for this office.");
  }

  const ctx = await getGoogleContext(officeId, TASK_SHEET_NAME);
  invalidateTaskCache();
  const sheetId = await getTaskSheetId(officeId);
  try {
    await ctx.sheets.spreadsheets.batchUpdate({
      spreadsheetId: ctx.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: id - 1,
                endIndex: id,
              },
            },
          },
        ],
      },
    });
  } catch (err: any) {
    throw classifyGoogleError(err, "deleteTaskRow", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: TASK_SHEET_NAME,
      userId: officeId,
    });
  }
}

/** Assign office to a legacy/unassigned row (for migration) */
export async function assignOfficeToLegacyRow(id: number, targetOfficeId: string): Promise<void> {
  const cleanOfficeId = targetOfficeId.trim();
  if (!cleanOfficeId) throw new Error("targetOfficeId is required.");
  invalidateTaskCache();
  if (!env.googleSpreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not configured for legacy migration.");
  }
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSpreadsheetId,
    range: `${TASK_SHEET_NAME}!${COL_LAST}${id}`,
    valueInputOption: "RAW",
    requestBody: { values: [[cleanOfficeId]] },
  });
}

/** Expose raw fetch for the migration script */
export { fetchAllRawTaskRows };
