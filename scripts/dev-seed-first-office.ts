/**
 * Dev-only seed script: creates an initial local office admin account for local development.
 * Never executed automatically during migrations or production deployments.
 *
 * Usage:
 *   node --env-file=../../.env --import tsx scripts/dev-seed-first-office.ts
 */

import { getSupabaseClient, createSupabaseUser } from "../artifacts/api-server/src/services/supabase.service";
import bcrypt from "bcryptjs";

async function seedFirstOffice() {
  const client = getSupabaseClient();
  if (!client) {
    console.error("Supabase client not configured.");
    process.exit(1);
  }

  const username = process.env.DEV_ADMIN_USERNAME || "admin1";
  const password = process.env.DEV_ADMIN_PASSWORD || "admin123";
  const email = process.env.DEV_ADMIN_EMAIL || "office.admin@law.local";

  const { data: existing } = await client
    .from("app_users")
    .select("id, username")
    .eq("username", username)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[Dev Seed] User "${username}" already exists (id: ${existing[0].id}).`);
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await createSupabaseUser({
    username,
    email,
    password_hash: passwordHash,
    role: "admin",
    display_name: "مدير المكتب (تطوير محلي)",
    office_name: "مكتب المحاماة الرئيسي (تطوير محلي)",
    status: "active",
    plan_tier: "plus",
    billing_cycle: "annual",
    ai_quota_limit: 100,
  });

  // Ensure office record exists
  await client.from("offices").upsert({
    id: user.id,
    name: "مكتب المحاماة الرئيسي (تطوير محلي)",
    admin_id: user.id,
  });

  await client
    .from("app_users")
    .update({ office_id: user.id })
    .eq("id", user.id);

  console.log(`[Dev Seed] Successfully created dev office admin "${username}" (id: ${user.id}).`);
}

seedFirstOffice().catch((err) => {
  console.error("[Dev Seed] Error:", err);
  process.exit(1);
});
