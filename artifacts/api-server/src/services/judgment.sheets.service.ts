import { type sheets_v4 } from "googleapis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { getGoogleContext, GoogleSheetsError } from "./googleSheets.service";

/**
 * Google Sheets service for Judgment (الأحكام) records.
 * Uses a dedicated sheet tab named "Judgment" in the spreadsheet.
 * Strictly enforces office-level multi-tenant isolation via the "معرف المكتب" column.
 */

const JUDGMENT_SHEET_NAME = "Judgment";

export const JUDGMENT_SHEET_COLUMNS = [
  "رقم القضية",      // Col 0 (A)
  "المحكمة المختصة", // Col 1 (B)
  "المدعي",          // Col 2 (C)
  "المدعى عليه",     // Col 3 (D)
  "المحامي المكلف",  // Col 4 (E)
  "رقم الصك",        // Col 5 (F)
  "تاريخ الحكم",     // Col 6 (G)
  "ملخص الحكم",      // Col 7 (H)
  "الحكم",           // Col 8 (I)
  "تاريخ الإنشاء",   // Col 9 (J)
  "معرف المكتب",      // Col 10 (K) - Office ID
] as const;

export const JUDGMENT_COLS = JUDGMENT_SHEET_COLUMNS.length; // 11
const COL_LAST = String.fromCharCode("A".charCodeAt(0) + JUDGMENT_COLS - 1); // "K"
export const JUDGMENT_OFFICE_COL_INDEX = 10;

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

let judgmentSheetIdCache: number | null = null;
let isJudgmentSheetReadyCache = false;

// In-memory data cache
let judgmentDataCache: { id: number; values: JudgmentRow }[] | null = null;
let lastJudgmentCacheTime = 0;
const JUDGMENT_CACHE_TTL_MS = 15000; // 15 seconds

export function invalidateJudgmentCache(): void {
  judgmentDataCache = null;
  lastJudgmentCacheTime = 0;
}

async function getJudgmentSheetId(officeId?: string): Promise<number> {
  const ctx = await getGoogleContext(officeId, JUDGMENT_SHEET_NAME);
  const spreadsheet = await ctx.sheets.spreadsheets.get({
    spreadsheetId: ctx.spreadsheetId,
  });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === JUDGMENT_SHEET_NAME,
  );
  if (!sheet?.properties && sheet?.properties?.sheetId === undefined) {
    throw new Error(`Sheet tab "${JUDGMENT_SHEET_NAME}" not found.`);
  }
  return sheet!.properties!.sheetId!;
}

/** Ensures the "Judgment" sheet tab exists with the correct header row. */
export async function ensureJudgmentSheetReady(officeId?: string): Promise<void> {
  const ctx = await getGoogleContext(officeId, JUDGMENT_SHEET_NAME);
  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const existing = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === JUDGMENT_SHEET_NAME,
    );

    if (!existing) {
      await ctx.sheets.spreadsheets.batchUpdate({
        spreadsheetId: ctx.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: JUDGMENT_SHEET_NAME } } }],
        },
      });
      logger.info(`Created sheet tab "${JUDGMENT_SHEET_NAME}"`);
    }

    // Always ensure the header is up to date (A1:K1)
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${JUDGMENT_SHEET_NAME}!A1:${COL_LAST}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...JUDGMENT_SHEET_COLUMNS]] },
    });
  } catch (err: any) {
    if (err instanceof GoogleSheetsError) throw err;
    logger.warn({ err }, "ensureJudgmentSheetReady warning");
  }
}

export type JudgmentRow = string[];

/** Internal helper to fetch all raw judgment rows from sheet */
async function fetchAllRawJudgmentRows(officeId?: string, forceRefresh = false): Promise<{
  headers: string[];
  rows: { id: number; values: JudgmentRow }[];
}> {
  await ensureJudgmentSheetReady(officeId);
  const ctx = await getGoogleContext(officeId, JUDGMENT_SHEET_NAME);

  const now = Date.now();
  const useCache =
    !forceRefresh &&
    judgmentDataCache !== null &&
    now - lastJudgmentCacheTime < JUDGMENT_CACHE_TTL_MS;

  if (useCache) {
    const headerRes = await ctx.sheets.spreadsheets.values.get({
      spreadsheetId: ctx.spreadsheetId,
      range: `${JUDGMENT_SHEET_NAME}!A1:${COL_LAST}1`,
    });
    const headers = ((headerRes.data.values?.[0] as string[]) ?? [...JUDGMENT_SHEET_COLUMNS]);
    return { headers, rows: judgmentDataCache! };
  }

  const response = await ctx.sheets.spreadsheets.values.get({
    spreadsheetId: ctx.spreadsheetId,
    range: `${JUDGMENT_SHEET_NAME}!A1:${COL_LAST}`,
  });
  const data = response.data.values ?? [];
  const headers = (data[0] as string[]) ?? [...JUDGMENT_SHEET_COLUMNS];
  const dataRows = data.slice(1);
  const rows = dataRows
    .map((row, index) => ({ id: index + 2, values: row as JudgmentRow }))
    .filter((row) => row.values.some((cell) => cell !== undefined && cell !== ""));

  judgmentDataCache = rows;
  lastJudgmentCacheTime = now;
  return { headers, rows };
}

/**
 * Returns all Judgment records for the specified office.
 * Unmigrated rows without an office are strictly ignored.
 */
export async function listJudgmentRowsWithHeaders(
  officeId: string,
  forceRefresh = false,
): Promise<{
  headers: string[];
  rows: { id: number; values: JudgmentRow }[];
}> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to list Judgment records.");
  }
  const cleanOfficeId = officeId.trim();
  const { headers, rows } = await fetchAllRawJudgmentRows(cleanOfficeId, forceRefresh);

  const officeColIdx = headers.findIndex((h) => h.trim() === "معرف المكتب");
  const actualColIdx = officeColIdx !== -1 ? officeColIdx : JUDGMENT_OFFICE_COL_INDEX;

  const filtered = rows.filter((r) => (r.values[actualColIdx] || "").trim() === cleanOfficeId);
  return { headers, rows: filtered };
}

/**
 * Gets a single Judgment record row by id, strictly verifying office ownership.
 * Returns null if record doesn't exist or belongs to another office.
 */
export async function getJudgmentRowById(
  officeId: string,
  id: number,
): Promise<{ id: number; values: JudgmentRow; headers: string[] } | null> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to get a Judgment record.");
  }
  const cleanOfficeId = officeId.trim();
  const { headers, rows } = await fetchAllRawJudgmentRows(cleanOfficeId);

  const match = rows.find((r) => r.id === id);
  if (!match) return null;

  const officeColIdx = headers.findIndex((h) => h.trim() === "معرف المكتب");
  const actualColIdx = officeColIdx !== -1 ? officeColIdx : JUDGMENT_OFFICE_COL_INDEX;

  if ((match.values[actualColIdx] || "").trim() !== cleanOfficeId) {
    return null; // Do not reveal existence of records from other offices
  }
  return { id: match.id, values: match.values, headers };
}

/**
 * Appends a new Judgment record row, forcefully stamping the caller's office.
 */
export async function appendJudgmentRow(officeId: string, values: JudgmentRow): Promise<number> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to create a Judgment record.");
  }
  invalidateJudgmentCache();
  await ensureJudgmentSheetReady(officeId);
  const ctx = await getGoogleContext(officeId, JUDGMENT_SHEET_NAME);

  const paddedValues: string[] = Array.from({ length: JUDGMENT_COLS }, (_, i) => values[i] ?? "");
  paddedValues[JUDGMENT_OFFICE_COL_INDEX] = officeId.trim();

  const response = await ctx.sheets.spreadsheets.values.append({
    spreadsheetId: ctx.spreadsheetId,
    range: `${JUDGMENT_SHEET_NAME}!A:${COL_LAST}`,
    valueInputOption: "RAW",
    insertDataOption: "OVERWRITE",
    requestBody: { values: [paddedValues] },
  });
  const updatedRange = response.data.updates?.updatedRange;
  const match = updatedRange?.match(/![A-Z]+(\d+):/);
  if (match) return Number(match[1]);

  const { rows } = await fetchAllRawJudgmentRows(officeId, true);
  const last = rows[rows.length - 1];
  if (!last) throw new Error("Failed to determine id of newly created Judgment row.");
  return last.id;
}

/**
 * Updates an existing Judgment row by its 1-based row id.
 * Verifies that the row belongs to the caller's office before updating.
 */
export async function updateJudgmentRow(officeId: string, id: number, values: JudgmentRow): Promise<void> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to update a Judgment record.");
  }
  const existing = await getJudgmentRowById(officeId, id);
  if (!existing) {
    throw new Error("Judgment record not found for this office.");
  }

  const ctx = await getGoogleContext(officeId, JUDGMENT_SHEET_NAME);
  invalidateJudgmentCache();
  const paddedValues: string[] = Array.from({ length: JUDGMENT_COLS }, (_, i) => values[i] ?? "");
  paddedValues[JUDGMENT_OFFICE_COL_INDEX] = officeId.trim();

  await ctx.sheets.spreadsheets.values.update({
    spreadsheetId: ctx.spreadsheetId,
    range: `${JUDGMENT_SHEET_NAME}!A${id}:${COL_LAST}${id}`,
    valueInputOption: "RAW",
    requestBody: { values: [paddedValues] },
  });
}

/**
 * Deletes a Judgment row by its 1-based row id.
 * Verifies that the row belongs to the caller's office before deleting.
 */
export async function deleteJudgmentRow(officeId: string, id: number): Promise<void> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to delete a Judgment record.");
  }
  const existing = await getJudgmentRowById(officeId, id);
  if (!existing) {
    throw new Error("Judgment record not found for this office.");
  }

  const ctx = await getGoogleContext(officeId, JUDGMENT_SHEET_NAME);
  invalidateJudgmentCache();
  const sheetId = await getJudgmentSheetId(officeId);
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
}

/** Assign office to a legacy/unassigned row (for migration) */
export async function assignOfficeToLegacyRow(id: number, targetOfficeId: string): Promise<void> {
  const cleanOfficeId = targetOfficeId.trim();
  if (!cleanOfficeId) throw new Error("targetOfficeId is required.");
  invalidateJudgmentCache();
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSpreadsheetId,
    range: `${JUDGMENT_SHEET_NAME}!${COL_LAST}${id}`,
    valueInputOption: "RAW",
    requestBody: { values: [[cleanOfficeId]] },
  });
}

/** Expose raw fetch for the migration script */
export { fetchAllRawJudgmentRows };
