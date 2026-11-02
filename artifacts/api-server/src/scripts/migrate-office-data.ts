import { fetchAllRawPoaRows, assignOfficeToLegacyRow as assignPoaOffice, POA_OFFICE_COL_INDEX } from "../services/poa.sheets.service";
import { fetchAllRawTaskRows, assignOfficeToLegacyRow as assignTaskOffice, TASK_OFFICE_COL_INDEX } from "../services/task.sheets.service";
import { fetchAllRawJudgmentRows, assignOfficeToLegacyRow as assignJudgmentOffice, JUDGMENT_OFFICE_COL_INDEX } from "../services/judgment.sheets.service";

/**
 * One-time migration script to assign legacy/unmigrated Google Sheets records to a designated office.
 *
 * Usage:
 *   pnpm run migrate:office --office-id <OFFICE_ID> [--dry-run]
 *
 * Example:
 *   pnpm run migrate:office --office-id office_main --dry-run
 *   pnpm run migrate:office --office-id office_main
 */

function parseArgs(): { officeId: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let officeId = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--office-id" && args[i + 1]) {
      officeId = args[i + 1].trim();
      i++;
    } else if (args[i].startsWith("--office-id=")) {
      officeId = args[i].split("=")[1].trim();
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: pnpm run migrate:office --office-id <OFFICE_ID> [--dry-run]

Options:
  --office-id <ID>   The target office ID to assign unmigrated records to (REQUIRED).
  --dry-run          Simulate migration and list affected records without modifying the spreadsheet.
  -h, --help         Show this help message.
      `);
      process.exit(0);
    }
  }

  if (!officeId) {
    console.error("Error: --office-id <OFFICE_ID> is required.\nRun with --help for usage details.");
    process.exit(1);
  }

  return { officeId, dryRun };
}

async function runMigration() {
  const { officeId, dryRun } = parseArgs();

  console.log("=================================================");
  console.log(" Google Sheets Multi-Office Data Migration Tool ");
  console.log("=================================================");
  console.log(`Target Office ID: ${officeId}`);
  console.log(`Mode:            ${dryRun ? "DRY-RUN (No changes will be written)" : "LIVE EXECUTION (Modifying sheets)"}`);
  console.log("-------------------------------------------------");

  if (!dryRun) {
    console.warn("⚠️  WARNING: You are about to update Google Sheets records.");
    console.warn("⚠️  Ensure you have created a backup copy of your Google Spreadsheet before continuing!");
    console.log("-------------------------------------------------");
  }

  // 1. Scan POA
  console.log("🔍 Scanning 'Attorney' (POA) sheet for unassigned records...");
  const poaRows = await fetchAllRawPoaRows(true);
  const unassignedPoa = poaRows.filter((r) => {
    const val = r.values[POA_OFFICE_COL_INDEX];
    return !val || !val.trim();
  });
  console.log(`   Found ${unassignedPoa.length} unassigned POA rows (Row IDs: ${unassignedPoa.map((r) => r.id).join(", ") || "none"})`);

  // 2. Scan Tasks
  console.log("🔍 Scanning 'Tasks' sheet for unassigned records...");
  const { rows: taskRows } = await fetchAllRawTaskRows(true);
  const unassignedTasks = taskRows.filter((r) => {
    const val = r.values[TASK_OFFICE_COL_INDEX];
    return !val || !val.trim();
  });
  console.log(`   Found ${unassignedTasks.length} unassigned Tasks rows (Row IDs: ${unassignedTasks.map((r) => r.id).join(", ") || "none"})`);

  // 3. Scan Judgments
  console.log("🔍 Scanning 'Judgment' sheet for unassigned records...");
  const { rows: judgmentRows } = await fetchAllRawJudgmentRows(true);
  const unassignedJudgments = judgmentRows.filter((r) => {
    const val = r.values[JUDGMENT_OFFICE_COL_INDEX];
    return !val || !val.trim();
  });
  console.log(`   Found ${unassignedJudgments.length} unassigned Judgments rows (Row IDs: ${unassignedJudgments.map((r) => r.id).join(", ") || "none"})`);

  const totalUnassigned = unassignedPoa.length + unassignedTasks.length + unassignedJudgments.length;
  console.log("-------------------------------------------------");
  console.log(`Total records requiring migration: ${totalUnassigned}`);

  if (totalUnassigned === 0) {
    console.log("✅ All records already have an assigned office ID. Nothing to migrate.");
    return;
  }

  if (dryRun) {
    console.log("\n[DRY RUN COMPLETE] No records were modified. Run without --dry-run to apply changes.");
    return;
  }

  // Apply migrations
  console.log("\n🚀 Applying migration updates to Google Sheets...");

  // POA updates
  if (unassignedPoa.length > 0) {
    console.log(`Updating ${unassignedPoa.length} POA records...`);
    for (const r of unassignedPoa) {
      await assignPoaOffice(r.id, officeId);
      console.log(`  ✓ Updated POA row ${r.id} -> officeId: "${officeId}"`);
    }
  }

  // Tasks updates
  if (unassignedTasks.length > 0) {
    console.log(`Updating ${unassignedTasks.length} Task records...`);
    for (const r of unassignedTasks) {
      await assignTaskOffice(r.id, officeId);
      console.log(`  ✓ Updated Task row ${r.id} -> officeId: "${officeId}"`);
    }
  }

  // Judgment updates
  if (unassignedJudgments.length > 0) {
    console.log(`Updating ${unassignedJudgments.length} Judgment records...`);
    for (const r of unassignedJudgments) {
      await assignJudgmentOffice(r.id, officeId);
      console.log(`  ✓ Updated Judgment row ${r.id} -> officeId: "${officeId}"`);
    }
  }

  console.log("-------------------------------------------------");
  console.log(`🎉 Migration successfully completed! ${totalUnassigned} records assigned to office "${officeId}".`);
}

runMigration().catch((err) => {
  console.error("Migration failed with error:", err);
  process.exit(1);
});

