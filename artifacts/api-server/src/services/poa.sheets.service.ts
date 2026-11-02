import { google, type sheets_v4 } from "googleapis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { getGoogleContext, GoogleSheetsError, classifyGoogleError } from "./googleSheets.service";

/**
 * Google Sheets service for Power of Attorney (Wakala) records.
 * Uses a dedicated sheet tab named "Attorney" in the spreadsheet.
 * Strictly enforces office-level multi-tenant isolation via the "معرف المكتب" column.
 */

const POA_SHEET_NAME = "Attorney";

export const POA_SHEET_COLUMNS = [
  "اسم العميل",        // Col 0 (A)
  "رقم الوكالة",        // Col 1 (B)
  "تاريخ الإصدار هجري", // Col 2 (C)
  "تاريخ الانتهاء هجري", // Col 3 (D)
  "الأيام المتبقية",    // Col 4 (E)
  "ملاحظات",           // Col 5 (F)
  "تاريخ الإنشاء",      // Col 6 (G)
  "معرف المكتب",       // Col 7 (H) - Office ID
] as const;

export const POA_COLS = POA_SHEET_COLUMNS.length; // 8
const COL_LAST = String.fromCharCode("A".charCodeAt(0) + POA_COLS - 1); // "H"
export const POA_OFFICE_COL_INDEX = 7;

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

let poaSheetIdCache: number | null = null;
let isPoaSheetReadyCache = false;

// In-memory POA data cache (raw rows)
let poaDataCache: { id: number; values: PoaRow }[] | null = null;
let lastPoaCacheTime = 0;
const POA_CACHE_TTL_MS = 15000; // 15 seconds

export function invalidatePoaCache(): void {
  poaDataCache = null;
  lastPoaCacheTime = 0;
}

async function getPoaSheetId(officeId?: string): Promise<number> {
  const ctx = await getGoogleContext(officeId, POA_SHEET_NAME);
  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === POA_SHEET_NAME,
    );
    if (!sheet?.properties || sheet.properties.sheetId == null) {
      throw new Error(`Sheet tab "${POA_SHEET_NAME}" not found.`);
    }
    return sheet.properties.sheetId;
  } catch (err: any) {
    throw classifyGoogleError(err, "getPoaSheetId", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: POA_SHEET_NAME,
      userId: officeId,
    });
  }
}

/** Ensures the "Attorney" sheet tab exists with the correct header row. */
export async function ensurePoaSheetReady(officeId?: string): Promise<void> {
  const ctx = await getGoogleContext(officeId, POA_SHEET_NAME);
  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const existing = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === POA_SHEET_NAME,
    );

    if (!existing) {
      await ctx.sheets.spreadsheets.batchUpdate({
        spreadsheetId: ctx.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: POA_SHEET_NAME } } }],
        },
      });
      logger.info(`Created sheet tab "${POA_SHEET_NAME}"`);
    }

    // Always ensure the header is up to date (A1:H1)
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${POA_SHEET_NAME}!A1:${COL_LAST}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...POA_SHEET_COLUMNS]] },
    });
  } catch (err: any) {
    throw classifyGoogleError(err, "ensurePoaSheetReady", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: POA_SHEET_NAME,
      userId: officeId,
    });
  }
}

export type PoaRow = string[];

/** Internal helper to fetch all rows from sheet */
async function fetchAllRawPoaRows(officeId?: string, forceRefresh = false): Promise<{ id: number; values: PoaRow }[]> {
  const now = Date.now();
  if (!forceRefresh && poaDataCache !== null && now - lastPoaCacheTime < POA_CACHE_TTL_MS) {
    return poaDataCache;
  }

  await ensurePoaSheetReady(officeId);
  const ctx = await getGoogleContext(officeId, POA_SHEET_NAME);

  try {
    const response = await ctx.sheets.spreadsheets.values.get({
      spreadsheetId: ctx.spreadsheetId,
      range: `${POA_SHEET_NAME}!A2:${COL_LAST}`,
    });
    const rows = response.data.values ?? [];
    const result = rows
      .map((row, index) => ({ id: index + 2, values: row as PoaRow }))
      .filter((row) => row.values.some((cell) => cell !== undefined && cell !== ""));

    poaDataCache = result;
    lastPoaCacheTime = now;
    return result;
  } catch (err: any) {
    throw classifyGoogleError(err, "fetchAllRawPoaRows", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: POA_SHEET_NAME,
      userId: officeId,
    });
  }
}

/**
 * Returns all POA records for the specified office.
 * Unmigrated rows without an office are strictly ignored.
 */
export async function listPoaRows(
  officeId: string,
  forceRefresh = false,
): Promise<{ id: number; values: PoaRow }[]> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to list POA records.");
  }
  const cleanOfficeId = officeId.trim();
  const allRows = await fetchAllRawPoaRows(cleanOfficeId, forceRefresh);

  // Strictly filter by officeId
  return allRows.filter((r) => (r.values[POA_OFFICE_COL_INDEX] || "").trim() === cleanOfficeId);
}

/**
 * Gets a single POA record row by id, strictly verifying office ownership.
 * Returns null if record doesn't exist or belongs to another office.
 */
export async function getPoaRowById(
  officeId: string,
  id: number,
): Promise<{ id: number; values: PoaRow } | null> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to get a POA record.");
  }
  const cleanOfficeId = officeId.trim();
  const allRows = await fetchAllRawPoaRows(cleanOfficeId);
  const match = allRows.find((r) => r.id === id);
  if (!match) return null;

  const rowOffice = (match.values[POA_OFFICE_COL_INDEX] || "").trim();
  if (rowOffice !== cleanOfficeId) {
    return null; // Do not reveal existence of records from other offices
  }
  return match;
}

/**
 * Appends a new POA record row, forcefully stamping the caller's office.
 */
export async function appendPoaRow(officeId: string, values: PoaRow): Promise<number> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to create a POA record.");
  }
  invalidatePoaCache();
  await ensurePoaSheetReady(officeId);
  const ctx = await getGoogleContext(officeId, POA_SHEET_NAME);

  const padded: string[] = Array.from({ length: POA_COLS }, (_, i) => values[i] ?? "");
  // Force stamp caller's office
  padded[POA_OFFICE_COL_INDEX] = officeId.trim();

  try {
    const response = await ctx.sheets.spreadsheets.values.append({
      spreadsheetId: ctx.spreadsheetId,
      range: `${POA_SHEET_NAME}!A:${COL_LAST}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [padded] },
    });
    const updatedRange = response.data.updates?.updatedRange;
    const match = updatedRange?.match(/![A-Z]+(\d+):/);
    if (match) return Number(match[1]);

    const rows = await fetchAllRawPoaRows(officeId, true);
    const last = rows[rows.length - 1];
    if (!last) throw new Error("Failed to determine id of newly created POA row.");
    return last.id;
  } catch (err: any) {
    throw classifyGoogleError(err, "appendPoaRow", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: POA_SHEET_NAME,
      userId: officeId,
    });
  }
}

/**
 * Updates an existing POA row by its 1-based row id.
 * Verifies that the row belongs to the caller's office before updating.
 * Throws an error if record does not belong to the office.
 */
export async function updatePoaRow(officeId: string, id: number, values: PoaRow): Promise<void> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to update a POA record.");
  }
  const existing = await getPoaRowById(officeId, id);
  if (!existing) {
    throw new Error("POA record not found for this office.");
  }

  const ctx = await getGoogleContext(officeId, POA_SHEET_NAME);
  invalidatePoaCache();
  const padded: string[] = Array.from({ length: POA_COLS }, (_, i) => values[i] ?? "");
  padded[POA_OFFICE_COL_INDEX] = officeId.trim();

  try {
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${POA_SHEET_NAME}!A${id}:${COL_LAST}${id}`,
      valueInputOption: "RAW",
      requestBody: { values: [padded] },
    });
  } catch (err: any) {
    throw classifyGoogleError(err, "updatePoaRow", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: POA_SHEET_NAME,
      userId: officeId,
    });
  }
}

/**
 * Deletes a POA row by its 1-based row id.
 * Verifies that the row belongs to the caller's office before deleting.
 */
export async function deletePoaRow(officeId: string, id: number): Promise<void> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to delete a POA record.");
  }
  const existing = await getPoaRowById(officeId, id);
  if (!existing) {
    throw new Error("POA record not found for this office.");
  }

  const ctx = await getGoogleContext(officeId, POA_SHEET_NAME);
  invalidatePoaCache();
  const sheetId = await getPoaSheetId(officeId);
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
    throw classifyGoogleError(err, "deletePoaRow", {
      spreadsheetId: ctx.spreadsheetId,
      sheetName: POA_SHEET_NAME,
      userId: officeId,
    });
  }
}

/** Assign office to a legacy/unassigned row (for migration) */
export async function assignOfficeToLegacyRow(id: number, targetOfficeId: string): Promise<void> {
  const cleanOfficeId = targetOfficeId.trim();
  if (!cleanOfficeId) throw new Error("targetOfficeId is required.");
  invalidatePoaCache();
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSpreadsheetId,
    range: `${POA_SHEET_NAME}!${COL_LAST}${id}`,
    valueInputOption: "RAW",
    requestBody: { values: [[cleanOfficeId]] },
  });
}

/** Expose raw fetch for the migration script */
export { fetchAllRawPoaRows };
