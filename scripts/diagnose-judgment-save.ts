import { getGoogleContext } from "../artifacts/api-server/src/services/googleSheets.service";
import {
  ensureJudgmentSheetReady,
  appendJudgmentRow,
  listJudgmentRowsWithHeaders,
  deleteJudgmentRow,
  JUDGMENT_SHEET_COLUMNS,
} from "../artifacts/api-server/src/services/judgment.sheets.service";
import { loadLocalUsers } from "../artifacts/api-server/src/services/supabase.service";

async function main() {
  console.log("=== Diagnosing Judgment Save Path ===");

  const localUsers = loadLocalUsers();
  const targetUser = localUsers.find((u) => u.username === "12345") || localUsers[0];
  console.log(`Testing with user: ${targetUser.username} (${targetUser.id})`);


  // Step 1: getGoogleContext
  console.log("\n[Step 1] Calling getGoogleContext(targetUser.id, 'Judgment')...");
  let ctx: any;
  try {
    ctx = await getGoogleContext(targetUser.id, "Judgment");
    console.log("PASS [Step 1] Context resolved successfully. Spreadsheet ID:", ctx.spreadsheetId ? `...${ctx.spreadsheetId.slice(-6)}` : "NONE");
  } catch (err: any) {
    console.error("FAIL [Step 1] getGoogleContext error:", err.name, err.message);
    return;
  }

  // Step 2: ensureJudgmentSheetReady
  console.log("\n[Step 2] Calling ensureJudgmentSheetReady(targetUser.id)...");
  try {
    await ensureJudgmentSheetReady(targetUser.id);
    console.log("PASS [Step 2] ensureJudgmentSheetReady completed.");
  } catch (err: any) {
    console.error("FAIL [Step 2] ensureJudgmentSheetReady error:", err.name, err.message);
  }

  // Step 3: appendJudgmentRow with QA marker
  console.log("\n[Step 3] Calling appendJudgmentRow with QA test row...");
  const qaMarker = `QA-JUDGMENT-${Date.now()}`;
  const rowValues = [
    "44109999",              // 0: caseNumber
    "المحكمة العامة بالرياض", // 1: court
    "مدعي فحص تشخيصي",      // 2: plaintiff
    "مدعى عليه فحص",        // 3: defendant
    "المحامي الفاحص",       // 4: assignedLawyer
    qaMarker,                // 5: judgmentNumber
    "1447/08/10",            // 6: judgmentDate
    "ملخص حكم الفحص التجريبي",// 7: summary
    "نهائي",                 // 8: isFavorable
    new Date().toISOString(),// 9: createdAt
    targetUser.id,           // 10: officeId
  ];

  let newRowId: number | null = null;
  try {
    newRowId = await appendJudgmentRow(targetUser.id, rowValues);
    console.log(`PASS [Step 3] appendJudgmentRow succeeded! New Row ID: ${newRowId}`);
  } catch (err: any) {
    console.error("FAIL [Step 3] appendJudgmentRow failed:", err.name, err.message);
  }

  // Step 4: read back
  if (newRowId) {
    console.log(`\n[Step 4] Reading back judgment row ${newRowId}...`);
    try {
      const { rows } = await listJudgmentRowsWithHeaders(targetUser.id, true);
      const found = rows.find((r) => r.id === newRowId);
      if (found) {
        console.log("PASS [Step 4] Read back confirmed row exists:", found.values[5]);
      } else {
        console.error("FAIL [Step 4] Row not found in list after append!");
      }
    } catch (err: any) {
      console.error("FAIL [Step 4] listJudgmentRowsWithHeaders error:", err.message);
    }

    // Step 5: Cleanup
    console.log(`\n[Step 5] Cleaning up test judgment row ${newRowId}...`);
    try {
      await deleteJudgmentRow(targetUser.id, newRowId);
      console.log(`PASS [Step 5] Cleaned up test judgment row ${newRowId}.`);
    } catch (err: any) {
      console.error("FAIL [Step 5] Cleanup failed:", err.message);
    }
  }
}

main().catch(console.error);
