import bcrypt from "bcryptjs";
import type { AppUserWithHash } from "../services/supabase.service";

let _localUsersCache: AppUserWithHash[] | null = null;

export function loadLocalUsers(): AppUserWithHash[] {
  if (_localUsersCache) {
    return _localUsersCache;
  }
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const superHash = bcrypt.hashSync("123456", 10);
  const officeAdminHash = bcrypt.hashSync("123456", 10);
  const lawyerHash = bcrypt.hashSync("12345", 10);

  _localUsersCache = [
    {
      id: "local-admin",
      username: "123456",
      email: "admin@law.internal",
      role: "super_admin",
      display_name: "المشرف العام (Super Admin)",
      status: "active",
      subscription_end_date: oneYearFromNow.toISOString(),
      subscription_notes: "حساب المشرف العام الدائم للمنظومة",
      plan_tier: "pro",
      billing_cycle: "annual",
      ai_quota_limit: -1,
      ai_usage_count: 0,
      admin_id: null,
      office_name: null,
      password_hash: superHash,
      created_at: new Date().toISOString(),
    },
    {
      id: "local-office-admin",
      username: "admin1",
      email: "office.admin@law.local",
      role: "admin",
      display_name: "مدير المكتب (أدمن)",
      office_name: "مكتب المحاماة الرئيسي",
      status: "active",
      subscription_end_date: oneYearFromNow.toISOString(),
      subscription_notes: "اشتراك سنوي معتمد للمكتب",
      plan_tier: "plus",
      billing_cycle: "annual",
      ai_quota_limit: 100,
      ai_usage_count: 0,
      admin_id: null,
      password_hash: officeAdminHash,
      created_at: new Date().toISOString(),
    },
    {
      id: "local-lawyer-default",
      username: "12345",
      email: "lawyer@law.internal",
      role: "staff",
      display_name: "المحامي الافتراضي",
      status: "active",
      admin_id: "local-office-admin",
      password_hash: lawyerHash,
      created_at: new Date().toISOString(),
    },
  ];
  return _localUsersCache;
}

export function saveLocalUsers(users: AppUserWithHash[]): void {
  _localUsersCache = users;
}
