import { getGoogleContext } from "../artifacts/api-server/src/services/googleSheets.service";
import {
  ensurePoaSheetReady,
  appendPoaRow,
  listPoaRows,
  deletePoaRow,
  getPoaRowById,
  POA_SHEET_COLUMNS,
} from "../artifacts/api-server/src/services/poa.sheets.service";
import { loadLocalUsers } from "../artifacts/api-server/src/services/supabase.service";

async function main() {
  console.log("=== Diagnosing Power of Attorney (POA) Roundtrip ===");

  const localUsers = loadLocalUsers();
  const targetUser = localUsers.find((u) => u.username === "12345") || localUsers[0];
  console.log(`Testing with user: ${targetUser.username} (${targetUser.id})`);

  // Ensure user is allowed to use global sheet if fallback
  process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = `${targetUser.id},${targetUser.username}`;

  // Step 1: getGoogleContext
  console.log("\n[Step 1] Calling getGoogleContext(targetUser.id, 'Attorney')...");
  let ctx: any;
  try {
    ctx = await getGoogleContext(targetUser.id, "Attorney");
    console.log("PASS [Step 1] Context resolved successfully. Spreadsheet ID:", ctx.spreadsheetId ? `...${ctx.spreadsheetId.slice(-6)}` : "NONE");
  } catch (err: any) {
    console.error("FAIL [Step 1] getGoogleContext error:", err.name, err.message);
    return;
  }

  // Step 2: ensurePoaSheetReady
  console.log("\n[Step 2] Calling ensurePoaSheetReady(targetUser.id)...");
  try {
    await ensurePoaSheetReady(targetUser.id);
    console.log("PASS [Step 2] ensurePoaSheetReady completed.");
  } catch (err: any) {
    console.error("FAIL [Step 2] ensurePoaSheetReady error:", err.name, err.message);
  }

  // Step 3: appendPoaRow with QA marker
  const timestamp = Date.now();
  const qaMarker = `QA-DIAG-${timestamp}`;
  console.log(`\n[Step 3] Calling appendPoaRow with QA test row (${qaMarker})...`);

  // Columns:
  // 0: اسم العميل (clientName)
  // 1: رقم الوكالة (poaNumber)
  // 2: تاريخ الإصدار هجري (issueDateHijri)
  // 3: تاريخ الانتهاء هجري (expiryDateHijri)
  // 4: الأيام المتبقية (daysRemaining)
  // 5: ملاحظات (notes)
  // 6: تاريخ الإنشاء (createdAt)
  // 7: معرف المكتب (officeId)
  const rowValues = [
    "عميل فحص تشخيصي",         // 0: clientName
    qaMarker,                  // 1: poaNumber
    "1446/01/01",              // 2: issueDateHijri
    "1447/01/01",              // 3: expiryDateHijri
    "120",                     // 4: daysRemaining
    "ملاحظات فحص تشخيصي للوكالة", // 5: notes
    new Date().toISOString(),  // 6: createdAt
    targetUser.id,             // 7: officeId
  ];

  let newRowId: number | null = null;
  try {
    newRowId = await appendPoaRow(targetUser.id, rowValues);
    console.log(`PASS [Step 3] appendPoaRow succeeded! New Row ID: ${newRowId}`);
  } catch (err: any) {
    console.error("FAIL [Step 3] appendPoaRow failed:", err.name, err.message);
  }

  // Step 4: read back through getPoaRowById & listPoaRows
  if (newRowId) {
    console.log(`\n[Step 4] Reading back POA row ${newRowId} via getPoaRowById and listPoaRows...`);
    try {
      const byId = await getPoaRowById(targetUser.id, newRowId);
      if (byId) {
        console.log("PASS [Step 4a] getPoaRowById confirmed row exists:", byId.values[1]);
      } else {
        console.error("FAIL [Step 4a] getPoaRowById returned null for rowId:", newRowId);
      }

      const rows = await listPoaRows(targetUser.id, true);
      const found = rows.find((r) => r.id === newRowId || r.values[1] === qaMarker);
      if (found) {
        console.log("PASS [Step 4b] listPoaRows confirmed row exists:", found.values[1], "with id:", found.id);
        console.log("Values retrieved:", JSON.stringify(found.values));
      } else {
        console.error("FAIL [Step 4b] Row not found in listPoaRows after append!");
        console.log("Total rows found in office list:", rows.length);
        if (rows.length > 0) {
          console.log("Sample row:", JSON.stringify(rows[0]));
        }
      }
    } catch (err: any) {
      console.error("FAIL [Step 4] Read back error:", err.message);
    }

    // Step 5: Cleanup
    console.log(`\n[Step 5] Cleaning up test POA row ${newRowId}...`);
    try {
      await deletePoaRow(targetUser.id, newRowId);
      console.log(`PASS [Step 5] Cleaned up test POA row ${newRowId}.`);
    } catch (err: any) {
      console.error("FAIL [Step 5] Cleanup failed:", err.message);
    }
  }
}

main().catch(console.error);

