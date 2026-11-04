import { google } from "googleapis";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getGoogleContext } from "../artifacts/api-server/src/services/googleSheets.service";
import {
  ensureTaskSheetReady,
  appendTaskRow,
  listTaskRowsWithHeaders,
  deleteTaskRow,
  TASK_SHEET_COLUMNS,
} from "../artifacts/api-server/src/services/task.sheets.service";
import { loadLocalUsers } from "../artifacts/api-server/src/services/supabase.service";

async function main() {
  console.log("=== Diagnosing Task Save Path ===");

  const localUsers = loadLocalUsers();
  console.log("Local users loaded:", localUsers.map((u) => ({ id: u.id, username: u.username, role: u.role, binding: Boolean(u.google_spreadsheet_id) })));

  // Pick the test user that is typically used (e.g. lawyer or local-lawyer-default or lawyer_2)
  const targetUser = localUsers.find((u) => u.username === "lawyer_2") || localUsers[0];
  console.log(`Testing with user: ${targetUser.username} (${targetUser.id})`);


  // Step 1: Check getGoogleContext
  console.log("\n[Step 1] Calling getGoogleContext(targetUser.id, 'Tasks')...");
  let ctx: any;
  try {
    ctx = await getGoogleContext(targetUser.id, "Tasks");
    console.log("PASS [Step 1] Context resolved successfully. Spreadsheet ID:", ctx.spreadsheetId ? `...${ctx.spreadsheetId.slice(-6)}` : "NONE", "Sheet Name:", ctx.sheetName);
  } catch (err: any) {
    console.error("FAIL [Step 1] getGoogleContext threw error:", err.name, err.message);
    return;
  }

  // Step 2: Test ensureTaskSheetReady
  console.log("\n[Step 2] Calling ensureTaskSheetReady(targetUser.id)...");
  try {
    await ensureTaskSheetReady(targetUser.id);
    console.log("PASS [Step 2] ensureTaskSheetReady completed without error.");
  } catch (err: any) {
    console.error("FAIL [Step 2] ensureTaskSheetReady threw error:", err.name, err.message);
  }

  // Step 3: Test appendTaskRow with exact UI payload
  console.log("\n[Step 3] Calling appendTaskRow with QA test row...");
  const qaMarker = `QA-TASK-TEST-${Date.now()}`;
  const rowValues = [
    qaMarker,                 // 0: title
    "محامي الفحص",           // 1: assignee
    "عادية",                 // 2: priority
    "2026-11-20",            // 3: dueDate
    "18 يوم",                // 4: remainingDays
    "قيد التنفيذ",           // 5: status
    "ملاحظات الفحص التشخيصي", // 6: notes
    new Date().toISOString(),// 7: createdAt
    targetUser.id,           // 8: officeId
  ];

  let newRowId: number | null = null;
  try {
    newRowId = await appendTaskRow(targetUser.id, rowValues);
    console.log(`PASS [Step 3] appendTaskRow succeeded! New Row ID: ${newRowId}`);
  } catch (err: any) {
    console.error("FAIL [Step 3] appendTaskRow failed!");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    if (err.response?.data) {
      console.error("Upstream API Error Data:", JSON.stringify(err.response.data, null, 2));
    }
    if (err.errors) {
      console.error("Upstream Errors:", JSON.stringify(err.errors, null, 2));
    }
    if (err.stack) {
      console.error("Stack trace:", err.stack);
    }
  }

  // Step 4: If appended, read it back and delete it
  if (newRowId) {
    console.log(`\n[Step 4] Reading back task row ${newRowId}...`);
    try {
      const { rows } = await listTaskRowsWithHeaders(targetUser.id, true);
      const found = rows.find((r) => r.id === newRowId);
      if (found) {
        console.log("PASS [Step 4] Read back confirmed task exists in sheet:", found.values[0]);
      } else {
        console.error("FAIL [Step 4] Task not found in list after append!");
      }
    } catch (err: any) {
      console.error("FAIL [Step 4] listTaskRowsWithHeaders error:", err.message);
    }

    console.log(`\n[Step 5] Cleaning up test task row ${newRowId}...`);
    try {
      await deleteTaskRow(targetUser.id, newRowId);
      console.log(`PASS [Step 5] Cleaned up test task row ${newRowId}.`);
    } catch (err: any) {
      console.error("FAIL [Step 5] deleteTaskRow error:", err.message);
    }
  }
}

main().catch((err) => {
  console.error("Unhandled top-level error:", err);
});
