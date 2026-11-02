import { google, type sheets_v4 } from "googleapis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { getUserGoogleCredentials } from "./supabase.service";

/**
 * Thin wrapper around the Google Sheets API that treats one spreadsheet tab
 * as the database of record for hearing sessions. Row 1 is a fixed header;
 * every subsequent row is one session, and its 1-based sheet row index
 * doubles as the record's `id` (there is no separate primary key column).
 */

export const SHEET_COLUMNS = [
  "رقم القضية",
  "المدعي",
  "المدعى عليه",
  "المحكمة",
  "الدائرة القضائية",
  "موضوع القضية",
  "نوع الجلسة",
  "تاريخ الجلسة هجري",
  "يوم الجلسة",
  "وقت الجلسة",
  "الأيام المتبقية",
  "ملاحظات",
  "حالة الجلسة",
  "تذكير 24 ساعة",
  "تذكير 6 ساعات",
  "تاريخ الإنشاء",
  "التقرير",
] as const;

export type SheetRow = string[];

// ============================================================================
// Typed Error Hierarchy for Google Sheets Integration
// ============================================================================

export class GoogleSheetsError extends Error {
  public readonly refId: string;
  public readonly statusCode: number;
  public readonly userMessage: string;

  constructor(message: string, statusCode: number, userMessage: string, refId?: string) {
    super(message);
    this.name = "GoogleSheetsError";
    this.refId =
      refId ||
      `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.statusCode = statusCode;
    this.userMessage = userMessage;
  }
}

export class GoogleSheetsConfigError extends GoogleSheetsError {
  constructor(message: string, refId?: string) {
    super(
      message,
      503,
      "إعدادات Google Sheets غير مكتملة. يرجى تزويد ملف Service Account ومعرف جدول البيانات.",
      refId,
    );
    this.name = "GoogleSheetsConfigError";
  }
}

export class GoogleBindingMissingError extends GoogleSheetsError {
  constructor(message = "ربط المكتب غير مكتمل. تواصل مع المشرف", refId?: string) {
    super(
      message,
      409,
      "ربط المكتب غير مكتمل. تواصل مع المشرف",
      refId,
    );
    this.name = "GoogleBindingMissingError";
  }
}

export class GoogleSettingsStoreError extends GoogleSheetsError {
  constructor(message = "تعذر الوصول إلى مخزن إعدادات المكتب. يرجى المحاولة لاحقاً.", refId?: string) {
    super(
      message,
      503,
      "تعذر الوصول إلى مخزن إعدادات المكتب. يرجى المحاولة لاحقاً.",
      refId,
    );
    this.name = "GoogleSettingsStoreError";
  }
}

export class GoogleSheetsAuthError extends GoogleSheetsError {
  constructor(message: string, refId?: string) {
    super(
      message,
      503,
      "فشل التحقق من هوية حساب الخدمة لدى Google (Authentication Failed).",
      refId,
    );
    this.name = "GoogleSheetsAuthError";
  }
}

export class GoogleSheetsPermissionError extends GoogleSheetsError {
  constructor(message: string, refId?: string) {
    super(
      message,
      503,
      "تعذر الوصول إلى جدول البيانات: يرجى مشاركة الجدول مع البريد الإلكتروني لحساب الخدمة ومنحه صلاحية محرر (Editor).",
      refId,
    );
    this.name = "GoogleSheetsPermissionError";
  }
}

export class GoogleSheetsNotFoundError extends GoogleSheetsError {
  constructor(message: string, refId?: string) {
    super(
      message,
      502,
      "جدول البيانات غير موجود أو تم حذفه (Spreadsheet Not Found).",
      refId,
    );
    this.name = "GoogleSheetsNotFoundError";
  }
}

export class GoogleSheetsRangeError extends GoogleSheetsError {
  constructor(message: string, refId?: string) {
    super(
      message,
      502,
      "تعذر قراءة ورقة العمل أو النطاق المحدد (Worksheet Range Error).",
      refId,
    );
    this.name = "GoogleSheetsRangeError";
  }
}

export class GoogleSheetsNetworkError extends GoogleSheetsError {
  constructor(message: string, refId?: string) {
    super(
      message,
      504,
      "تعذر الاتصال بخوادم Google بسبب انقطاع الشبكة أو انتهاء المهلة (Network Timeout).",
      refId,
    );
    this.name = "GoogleSheetsNetworkError";
  }
}

export function maskIdentifier(val?: string | null): string {
  if (!val) return "(none)";
  if (val.length <= 4) return "****";
  return `****${val.slice(-4)}`;
}

export function classifyGoogleError(
  err: any,
  operation: string,
  meta?: { spreadsheetId?: string; sheetName?: string; userId?: string },
): GoogleSheetsError {
  if (err instanceof GoogleSheetsError) {
    return err;
  }

  const rawMsg = String(err?.message || err || "");
  const status = Number(err?.status || err?.code || err?.response?.status || 0);
  const errorCode = String(err?.code || err?.errno || err?.cause?.code || "");
  const maskedId = meta?.spreadsheetId ? maskIdentifier(meta.spreadsheetId) : undefined;

  let classified: GoogleSheetsError;

  if (
    status === 401 ||
    rawMsg.includes("invalid_grant") ||
    rawMsg.includes("Unauthorized") ||
    rawMsg.includes("unauthorized_client") ||
    rawMsg.includes("Authentication with Google failed")
  ) {
    classified = new GoogleSheetsAuthError(`Google Auth Failure in ${operation}: ${rawMsg}`);
  } else if (
    status === 403 ||
    rawMsg.includes("The caller does not have permission") ||
    rawMsg.includes("PERMISSION_DENIED") ||
    rawMsg.includes("does not have permission")
  ) {
    classified = new GoogleSheetsPermissionError(`Google Permission Denied in ${operation}: ${rawMsg}`);
  } else if (
    status === 404 ||
    rawMsg.includes("Requested entity was not found") ||
    rawMsg.includes("NOT_FOUND") ||
    rawMsg.includes("Spreadsheet not found")
  ) {
    classified = new GoogleSheetsNotFoundError(`Google Spreadsheet Not Found in ${operation}: ${rawMsg}`);
  } else if (
    status === 400 ||
    rawMsg.includes("Unable to parse range") ||
    rawMsg.includes("badRequest") ||
    rawMsg.includes("Sheet tab")
  ) {
    classified = new GoogleSheetsRangeError(`Google Sheets Range Error in ${operation}: ${rawMsg}`);
  } else if (
    errorCode.includes("ETIMEDOUT") ||
    errorCode.includes("ECONNRESET") ||
    errorCode.includes("ECONNREFUSED") ||
    errorCode.includes("ENOTFOUND") ||
    rawMsg.includes("ETIMEDOUT") ||
    rawMsg.includes("ECONNRESET") ||
    rawMsg.includes("ECONNREFUSED") ||
    rawMsg.includes("ENOTFOUND") ||
    rawMsg.includes("network timeout") ||
    rawMsg.includes("timed out") ||
    rawMsg.includes("Client network socket disconnected") ||
    status === 504
  ) {
    classified = new GoogleSheetsNetworkError(`Google Network Timeout in ${operation}: ${rawMsg}`);
  } else {
    classified = new GoogleSheetsError(
      `Google API Error in ${operation}: ${rawMsg}`,
      502,
      "تعذر معالجة طلب بيانات الجلسات مع خادم Google.",
    );
  }

  logger.error(
    {
      operation,
      refId: classified.refId,
      status: classified.statusCode,
      googleStatus: status,
      errorName: classified.name,
      maskedSpreadsheetId: maskedId,
      sheetName: meta?.sheetName,
      userId: meta?.userId,
      googleMessage: rawMsg.slice(0, 300),
    },
    `[GoogleSheets Diagnostic] ${operation} failed with ${classified.name} (refId: ${classified.refId})`,
  );

  return classified;
}

let defaultSheetsClient: sheets_v4.Sheets | null = null;
const userClientsMap = new Map<string, sheets_v4.Sheets>();

function getDefaultClient(): sheets_v4.Sheets {
  if (!defaultSheetsClient) {
    const credentials = env.googleServiceAccountJson as {
      client_email?: string;
      private_key?: string;
    } | null;
    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new GoogleSheetsConfigError(
        "ملف Google Service Account JSON غير محدد في النظام. يرجى إضافته في بيانات المستخدم أو في متغيرات البيئة.",
      );
    }
    try {
      const privateKey = credentials.private_key.replace(/\\n/g, "\n");
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      defaultSheetsClient = google.sheets({ version: "v4", auth });
    } catch (err) {
      throw classifyGoogleError(err, "getDefaultClient");
    }
  }
  return defaultSheetsClient;
}

export interface GoogleContext {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}

export async function getGoogleContext(
  userId?: string,
  defaultSheetName = "Sessions",
): Promise<GoogleContext> {
  const cleanUserId = userId?.trim();

  // 1. Check if user is explicitly allowed to use the global sheet
  const isAllowListed = cleanUserId
    ? env.globalSheetAllowedUserIds.includes(cleanUserId)
    : false;

  if (isAllowListed) {
    const globalSpreadsheetId = env.googleSpreadsheetId;
    if (!globalSpreadsheetId) {
      throw new GoogleSheetsConfigError(
        "إعدادات Google Sheets العامة غير مكتملة في الخادم.",
      );
    }
    logger.info(
      { userId: cleanUserId, defaultSheetName },
      "[GoogleSheets] Intentional global sheet usage: user is on GLOBAL_SHEET_ALLOWED_USER_IDS allow-list",
    );
    return {
      sheets: getDefaultClient(),
      spreadsheetId: globalSpreadsheetId,
      sheetName: defaultSheetName || env.googleSheetName || "Sessions",
    };
  }

  // 2. If not allow-listed and no userId provided, fail closed
  if (!cleanUserId) {
    throw new GoogleBindingMissingError("معرف المستخدم/المكتب غير محدد للوصول إلى Google Sheets.");
  }

  // 3. Look up user's own Google binding from the settings store
  let userCreds: import("./supabase.service").UserGoogleCredentials | null = null;
  try {
    userCreds = await getUserGoogleCredentials(cleanUserId);
  } catch (err: any) {
    logger.error({ err, userId: cleanUserId }, "Failed to load user Google settings from store");
    throw new GoogleSettingsStoreError(
      `تعذر الوصول إلى مخزن إعدادات المكتب للمستخدم ${cleanUserId}: ${err?.message || err}`,
    );
  }

  // 4. Verify binding exists and is complete
  if (!userCreds) {
    throw new GoogleBindingMissingError("ربط المكتب غير مكتمل. تواصل مع المشرف");
  }

  const spreadsheetId = userCreds.spreadsheetId?.trim();
  if (!spreadsheetId) {
    throw new GoogleBindingMissingError("ربط المكتب غير مكتمل. تواصل مع المشرف");
  }

  const credentials = userCreds.serviceAccountJson as {
    client_email?: string;
    private_key?: string;
  } | undefined;

  if (
    !credentials ||
    typeof credentials !== "object" ||
    !credentials.client_email?.trim() ||
    !credentials.private_key?.trim()
  ) {
    throw new GoogleBindingMissingError("ربط المكتب غير مكتمل. تواصل مع المشرف");
  }

  // 5. Build or reuse client for this office
  let client = userClientsMap.get(cleanUserId);
  if (!client) {
    try {
      const privateKey = credentials.private_key.replace(/\\n/g, "\n");
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      client = google.sheets({ version: "v4", auth });
      userClientsMap.set(cleanUserId, client);
    } catch (err) {
      throw classifyGoogleError(err, "getGoogleContext.createClient", { userId: cleanUserId });
    }
  }

  const sheetName = userCreds.sheetName?.trim() || defaultSheetName;
  return { sheets: client, spreadsheetId, sheetName };
}

/** Resolves the numeric sheet (tab) id needed for row delete operations. */
async function getSheetId(ctx: GoogleContext): Promise<number> {
  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === ctx.sheetName,
    );
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
      throw new GoogleSheetsRangeError(
        `Sheet tab "${ctx.sheetName}" was not found in the configured spreadsheet.`,
      );
    }
    return sheet.properties.sheetId;
  } catch (err) {
    throw classifyGoogleError(err, "getSheetId", { spreadsheetId: ctx.spreadsheetId, sheetName: ctx.sheetName });
  }
}

/** Ensures the target sheet tab exists with the expected header row. Safe to call repeatedly. */
export async function ensureSheetReady(userId?: string): Promise<void> {
  let ctx: GoogleContext;
  try {
    ctx = await getGoogleContext(userId);
  } catch (err) {
    throw classifyGoogleError(err, "ensureSheetReady.getContext", { userId });
  }

  try {
    const spreadsheet = await ctx.sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const existing = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === ctx.sheetName,
    );

    if (!existing) {
      await ctx.sheets.spreadsheets.batchUpdate({
        spreadsheetId: ctx.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: ctx.sheetName } } }],
        },
      });
    }

    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `'${ctx.sheetName}'!A1:Q1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...SHEET_COLUMNS]] },
    });
  } catch (err) {
    logger.warn({ err, userId, refId: (err as any)?.refId }, "ensureSheetReady non-fatal warning");
  }
}

/** Returns every data row (excluding the header) as `{ id, values }`, where `id` is the 1-based sheet row number. */
export async function listRows(userId?: string): Promise<{ id: number; values: SheetRow }[]> {
  const ctx = await getGoogleContext(userId);
  try {
    const response = await ctx.sheets.spreadsheets.values.get({
      spreadsheetId: ctx.spreadsheetId,
      range: `'${ctx.sheetName}'!A2:Q`,
    });
    const rows = response.data.values ?? [];
    return rows
      .map((row, index) => ({ id: index + 2, values: row as SheetRow }))
      .filter((row) => row.values.some((cell) => cell !== undefined && cell !== ""));
  } catch (err) {
    throw classifyGoogleError(err, "listRows", { spreadsheetId: ctx.spreadsheetId, sheetName: ctx.sheetName, userId });
  }
}

/** Appends a new row (filling the first empty row if available) and returns its 1-based sheet row id. */
export async function appendRow(values: SheetRow, userId?: string): Promise<number> {
  const ctx = await getGoogleContext(userId);

  // Check if there are any existing empty rows in the sheet range to reuse
  try {
    const existing = await ctx.sheets.spreadsheets.values.get({
      spreadsheetId: ctx.spreadsheetId,
      range: `'${ctx.sheetName}'!A2:Q`,
    });
    const rawRows = existing.data.values ?? [];

    let emptyRowId: number | null = null;
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const isEmpty =
        !r ||
        r.length === 0 ||
        r.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
      if (isEmpty) {
        emptyRowId = i + 2; // 1-based sheet row number (Header is row 1)
        break;
      }
    }

    if (emptyRowId !== null) {
      await updateRow(emptyRowId, values, userId);
      return emptyRowId;
    }
  } catch (err) {
    logger.warn({ err, userId }, "Failed to check empty rows before append, falling back to append API");
  }

  try {
    const response = await ctx.sheets.spreadsheets.values.append({
      spreadsheetId: ctx.spreadsheetId,
      range: `'${ctx.sheetName}'!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    const updatedRange = response.data.updates?.updatedRange;
    const match = updatedRange?.match(/![A-Z]+(\d+):/);
    if (match) {
      return Number(match[1]);
    }
    logger.warn({ updatedRange, userId }, "Could not parse appended row id from Sheets response");
    const rows = await listRows(userId);
    const last = rows[rows.length - 1];
    if (!last) {
      throw new GoogleSheetsError("Failed to determine id of newly created session row.", 502, "تعذر تحديد معرّف السطر المضاف.");
    }
    return last.id;
  } catch (err) {
    throw classifyGoogleError(err, "appendRow", { spreadsheetId: ctx.spreadsheetId, sheetName: ctx.sheetName, userId });
  }
}

/** Overwrites a single existing row (1-based sheet row id) with new values. */
export async function updateRow(id: number, values: SheetRow, userId?: string): Promise<void> {
  const ctx = await getGoogleContext(userId);
  try {
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `'${ctx.sheetName}'!A${id}:Q${id}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  } catch (err) {
    throw classifyGoogleError(err, "updateRow", { spreadsheetId: ctx.spreadsheetId, sheetName: ctx.sheetName, userId });
  }
}

/** Overwrites specific columns (0-based indexes into SHEET_COLUMNS) on a row, leaving others untouched. */
export async function updateRowCells(
  id: number,
  updates: Record<number, string>,
  userId?: string,
): Promise<void> {
  const ctx = await getGoogleContext(userId);
  const data = Object.entries(updates).map(([colIndex, value]) => {
    const column = String.fromCharCode("A".charCodeAt(0) + Number(colIndex));
    return {
      range: `'${ctx.sheetName}'!${column}${id}:${column}${id}`,
      values: [[value]],
    };
  });
  if (data.length === 0) {
    return;
  }
  try {
    await ctx.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ctx.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  } catch (err) {
    throw classifyGoogleError(err, "updateRowCells", { spreadsheetId: ctx.spreadsheetId, sheetName: ctx.sheetName, userId });
  }
}

/** Deletes a row (1-based sheet row id). */
export async function deleteRow(id: number, userId?: string): Promise<void> {
  const ctx = await getGoogleContext(userId);
  const sheetId = await getSheetId(ctx);
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
  } catch (err) {
    throw classifyGoogleError(err, "deleteRow", { spreadsheetId: ctx.spreadsheetId, sheetName: ctx.sheetName, userId });
  }
}
