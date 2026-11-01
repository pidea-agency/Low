import { google } from "googleapis";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function maskSecret(val?: string | null): string {
  if (!val) return "(none)";
  if (val.length <= 4) return "****";
  return `****${val.slice(-4)}`;
}

interface ResolvedCreds {
  serviceAccountJson: { client_email?: string; private_key?: string } | null;
  spreadsheetId: string | null;
  sheetName: string;
}

function resolveConfig(): ResolvedCreds {
  let serviceAccountJson: any = null;
  let spreadsheetId: string | null = null;
  let sheetName = "Sessions";

  // Check settings.json paths
  const settingsPaths = [
    resolve(process.cwd(), "settings.json"),
    resolve(process.cwd(), "artifacts", "api-server", "settings.json"),
    resolve("/tmp", "settings.json"),
  ];

  for (const p of settingsPaths) {
    try {
      if (existsSync(p)) {
        const raw = readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.googleSpreadsheetId) spreadsheetId = parsed.googleSpreadsheetId.trim();
        if (parsed.googleSheetName) sheetName = parsed.googleSheetName.trim();
      }
    } catch {}
  }

  // Check candidate service-account.json files
  const candidateFiles = [
    resolve(process.cwd(), "service-account.json"),
    resolve(process.cwd(), "..", "service-account.json"),
    resolve(process.cwd(), "artifacts", "api-server", "service-account.json"),
    resolve(process.cwd(), "..", "..", "service-account.json"),
  ];

  for (const p of candidateFiles) {
    try {
      if (existsSync(p)) {
        serviceAccountJson = JSON.parse(readFileSync(p, "utf-8"));
        break;
      }
    } catch {}
  }

  // Check env vars or .env file
  const candidateEnvPaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];
  let envFileVars: Record<string, string> = {};
  for (const envPath of candidateEnvPaths) {
    if (existsSync(envPath)) {
      try {
        const lines = readFileSync(envPath, "utf-8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const idx = trimmed.indexOf("=");
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            envFileVars[key] = val;
          }
        }
      } catch {}
    }
  }

  if (!serviceAccountJson && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || envFileVars.GOOGLE_SERVICE_ACCOUNT_JSON)) {
    try {
      serviceAccountJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || envFileVars.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {}
  }

  if (!spreadsheetId && (process.env.GOOGLE_SPREADSHEET_ID || envFileVars.GOOGLE_SPREADSHEET_ID)) {
    spreadsheetId = (process.env.GOOGLE_SPREADSHEET_ID || envFileVars.GOOGLE_SPREADSHEET_ID).trim();
  }

  if (process.env.GOOGLE_SHEET_NAME || envFileVars.GOOGLE_SHEET_NAME) {
    sheetName = (process.env.GOOGLE_SHEET_NAME || envFileVars.GOOGLE_SHEET_NAME).trim();
  }

  return { serviceAccountJson, spreadsheetId, sheetName };
}

async function runDiagnostics() {
  console.log("=== Google Sheets End-to-End Diagnostics ===");

  const config = resolveConfig();
  console.log(`Config: Spreadsheet ID: ${maskSecret(config.spreadsheetId)}, Sheet Name: ${config.sheetName}`);

  // Step a: credentials parse OK
  console.log("\n[Step a] Verifying credentials parse...");
  if (!config.serviceAccountJson) {
    console.error("FAIL: [Step a] No Google Service Account JSON found in env, settings.json, or service-account.json files.");
    process.exit(1);
  }

  if (!config.serviceAccountJson.client_email || !config.serviceAccountJson.private_key) {
    console.error("FAIL: [Step a] Credentials JSON is missing client_email or private_key.");
    process.exit(1);
  }
  console.log(`PASS: [Step a] Credentials parsed OK. Client email: ${maskSecret(config.serviceAccountJson.client_email)}`);

  // Step b: auth token obtained
  console.log("\n[Step b] Obtaining auth token...");
  let auth: any;
  let sheetsClient: any;
  try {
    const privateKey = config.serviceAccountJson.private_key.replace(/\\n/g, "\n");
    auth = new google.auth.JWT({
      email: config.serviceAccountJson.client_email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const token = await auth.authorize();
    if (!token?.access_token) {
      throw new Error("Empty access_token returned from Google Auth.");
    }
    sheetsClient = google.sheets({ version: "v4", auth });
    console.log("PASS: [Step b] Auth token obtained successfully.");
  } catch (err: any) {
    console.error(`FAIL: [Step b] Failed to obtain auth token: ${err.message || err}`);
    process.exit(1);
  }

  // Check spreadsheet ID
  if (!config.spreadsheetId) {
    console.error("\nFAIL: [Step c] Spreadsheet ID is not configured (GOOGLE_SPREADSHEET_ID is missing or empty).");
    process.exit(1);
  }

  // Step c: spreadsheet metadata fetched
  console.log(`\n[Step c] Fetching spreadsheet metadata for ID ${maskSecret(config.spreadsheetId)}...`);
  let spreadsheetMetadata: any;
  try {
    spreadsheetMetadata = await sheetsClient.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
    });
    console.log(`PASS: [Step c] Spreadsheet metadata fetched. Title: "${spreadsheetMetadata.data.properties?.title || 'Unknown'}"`);
  } catch (err: any) {
    console.error(`FAIL: [Step c] Failed to fetch spreadsheet metadata: ${err.message || err} (status: ${err.status || err.code})`);
    process.exit(1);
  }

  // Step d: check expected tabs
  console.log("\n[Step d] Checking expected tabs...");
  const existingTabs: string[] = (spreadsheetMetadata.data.sheets || []).map(
    (s: any) => s.properties?.title || ""
  );
  console.log(`Existing tabs in spreadsheet: [${existingTabs.map((t) => `"${t}"`).join(", ")}]`);

  const expectedTabs = [config.sheetName, "Attorney", "Judgment", "Tasks"];
  const missingTabs = expectedTabs.filter((tab) => !existingTabs.includes(tab));

  if (missingTabs.length > 0) {
    console.error(`FAIL: [Step d] Missing tabs: [${missingTabs.map((t) => `"${t}"`).join(", ")}]`);
    console.log("Attempting to auto-create missing tabs for test completeness...");
    try {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: config.spreadsheetId,
        requestBody: {
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
      console.log("PASS: [Step d] Successfully created missing tabs.");
    } catch (createErr: any) {
      console.error(`FAIL: [Step d] Could not create missing tabs: ${createErr.message || createErr}`);
      process.exit(1);
    }
  } else {
    console.log("PASS: [Step d] Every expected tab name exists.");
  }

  // Step e: read header row of each tab
  console.log("\n[Step e] Reading header row of each expected tab...");
  try {
    for (const tab of expectedTabs) {
      const headerRes = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${tab}'!A1:Q1`,
      });
      const headerRow = headerRes.data.values?.[0] || [];
      console.log(`Tab "${tab}" header columns count: ${headerRow.length} - ${JSON.stringify(headerRow.slice(0, 3))}...`);
    }
    console.log("PASS: [Step e] Header row read successfully from all expected tabs.");
  } catch (err: any) {
    console.error(`FAIL: [Step e] Failed to read header row: ${err.message || err}`);
    process.exit(1);
  }

  // Step f: append test row, read it back, delete/clear it
  const testId = `QA-DIAG-${Date.now()}`;
  console.log(`\n[Step f] Appending test row with prefix ${testId}...`);
  let appendedRowIndex: number | null = null;
  const targetTab = config.sheetName;

  try {
    const appendRes = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `'${targetTab}'!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[testId, "Test Plaintiff", "Test Defendant", "Test Court", "", "", "", "", "", "", "", "", "Upcoming", "false", "false", new Date().toISOString(), ""]],
      },
    });

    const updatedRange = appendRes.data.updates?.updatedRange;
    const match = updatedRange?.match(/![A-Z]+(\d+):/);
    if (match) {
      appendedRowIndex = Number(match[1]);
    }
    console.log(`Test row appended at range ${updatedRange} (row ${appendedRowIndex})`);

    // Read it back
    console.log(`Reading back appended row at row ${appendedRowIndex}...`);
    const readBack = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `'${targetTab}'!A${appendedRowIndex}:Q${appendedRowIndex}`,
    });
    const readValues = readBack.data.values?.[0] || [];
    if (readValues[0] !== testId) {
      throw new Error(`Data mismatch on read back: expected ${testId}, got ${readValues[0]}`);
    }
    console.log(`PASS: Test row read back verified successfully.`);
  } catch (err: any) {
    console.error(`FAIL: [Step f] Failed during append/readback: ${err.message || err}`);
    process.exit(1);
  } finally {
    // ALWAYS clean up: delete or clear the test row
    if (appendedRowIndex !== null) {
      console.log(`Cleaning up test row at index ${appendedRowIndex}...`);
      try {
        await sheetsClient.spreadsheets.values.clear({
          spreadsheetId: config.spreadsheetId,
          range: `'${targetTab}'!A${appendedRowIndex}:Q${appendedRowIndex}`,
        });
        console.log(`PASS: Test row cleared from sheet.`);
      } catch (cleanErr: any) {
        console.error(`WARNING: Failed to clear test row: ${cleanErr.message || cleanErr}`);
      }
    }
  }

  console.log("\n==========================================");
  console.log("ALL DIAGNOSTIC STEPS PASSED SUCCESSFULLY!");
  console.log("==========================================");
}

runDiagnostics().catch((err) => {
  console.error("FATAL DIAGNOSTIC ERROR:", err);
  process.exit(1);
});

