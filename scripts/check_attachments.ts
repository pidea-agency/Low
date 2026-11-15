import dotenv from "dotenv";
dotenv.config();
import { getSupabaseClient } from "../artifacts/api-server/src/services/supabase.service";
import { ATTACHMENTS_BUCKET } from "../artifacts/api-server/src/services/storage.service";

async function checkAttachments() {
  const client = getSupabaseClient();
  if (!client) {
    console.log("Supabase client is not configured");
    return;
  }
  const { data: attachments, error } = await client.from("attachments").select("*");
  if (error) {
    console.log("Error querying attachments table:", error.message);
    return;
  }
  console.log(`Found ${attachments?.length || 0} attachments in database.`);
  if (!attachments || attachments.length === 0) {
    console.log("No attachments exist in the database table.");
    return;
  }
  for (const att of attachments) {
    console.log(`- ID: ${att.id}, File: ${att.file_name}, Path: ${att.file_path}, Office: ${att.office_id}`);
    const { data: signedData, error: signedErr } = await client.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(att.file_path, 60);
    if (signedErr || !signedData?.signedUrl) {
      console.log(`  [MISSING IN STORAGE] Record ${att.id} (${att.file_path}) does NOT exist in Supabase storage bucket! Error: ${signedErr?.message}`);
    } else {
      console.log(`  [EXISTS IN STORAGE] Verified in Supabase Storage.`);
    }
  }
}
checkAttachments().catch(console.error);
