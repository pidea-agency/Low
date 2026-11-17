import {
  createOfficeMember,
  updateOfficeMember,
  createSupabaseAdmin,
  updateSupabaseAdmin,
  findUserByIdOrUsername,
  listSupabaseAdmins,
  getSupabaseClient,
} from '../artifacts/api-server/src/services/supabase.service.js';

async function run() {
  console.log('================================================================');
  console.log('🚀 STARTING APP_USERS & OFFICES REAL DATABASE VERIFICATION');
  console.log('================================================================\n');

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not available');

  const admins = await listSupabaseAdmins();
  if (!admins.length) throw new Error('No admin accounts found in DB');
  const testOfficeId = admins[0].id;
  console.log(`Using existing Admin Office ID: ${testOfficeId} (${admins[0].office_name || admins[0].username})\n`);

  // ─────────────────────────────────────────────────────────────
  // 1. APP_USERS (Staff Member) Round-Trip Verification
  // ─────────────────────────────────────────────────────────────
  console.log('▶ TEST 1: APP_USERS (Staff Member) - Creation & Readback');
  const staffUsername = `test_staff_${Date.now()}`;
  const staffPayload = {
    username: staffUsername,
    display_name: 'محامٍ تجريبي للتحقق',
    email: `${staffUsername}@testlawfirm.sa`,
    phone: '966501234567',
    role_title: 'محامٍ ممارس',
    legal_specialty: 'تجاري',
    license_number: 'SA-LAW-88192',
    license_expiry_date: '2027-08-20',
    joined_office_at: '2024-03-01',
  };

  const createResult = await createOfficeMember(testOfficeId, staffPayload);
  const staffId = createResult.member.id;
  console.log('✓ Created Staff Member ID:', staffId);

  // Read back via findUserByIdOrUsername
  const fetchedStaffAfterCreate = await findUserByIdOrUsername(staffId);
  console.log('\n[RAW JSON - APP_USERS AFTER CREATE]:');
  console.log(JSON.stringify({
    id: fetchedStaffAfterCreate?.id,
    username: fetchedStaffAfterCreate?.username,
    display_name: fetchedStaffAfterCreate?.display_name,
    legal_specialty: fetchedStaffAfterCreate?.legal_specialty,
    license_number: fetchedStaffAfterCreate?.license_number,
    license_expiry_date: fetchedStaffAfterCreate?.license_expiry_date,
    joined_office_at: fetchedStaffAfterCreate?.joined_office_at,
  }, null, 2));

  // Validate fields
  if (fetchedStaffAfterCreate?.legal_specialty !== 'تجاري') throw new Error('legal_specialty mismatch');
  if (fetchedStaffAfterCreate?.license_number !== 'SA-LAW-88192') throw new Error('license_number mismatch');
  if (fetchedStaffAfterCreate?.license_expiry_date !== '2027-08-20') throw new Error('license_expiry_date mismatch');
  if (fetchedStaffAfterCreate?.joined_office_at !== '2024-03-01') throw new Error('joined_office_at mismatch');
  console.log('✓ APP_USERS create verification PASSED!\n');

  // Update staff member fields
  console.log('▶ TEST 2: APP_USERS (Staff Member) - Update & Readback');
  console.log('Checking member before update:', {
    staffId,
    testOfficeId,
    fetchedAdminId: fetchedStaffAfterCreate?.admin_id,
    fetchedRole: fetchedStaffAfterCreate?.role,
  });
  const updatedStaffPayload = {
    legal_specialty: 'جنائي',
    license_number: 'SA-LAW-99201',
    license_expiry_date: '2028-12-31',
    joined_office_at: '2023-01-15',
  };
  await updateOfficeMember(testOfficeId, staffId, updatedStaffPayload);

  // Read back via findUserByIdOrUsername
  const fetchedStaffAfterUpdate = await findUserByIdOrUsername(staffId);
  console.log('\n[RAW JSON - APP_USERS AFTER UPDATE]:');
  console.log(JSON.stringify({
    id: fetchedStaffAfterUpdate?.id,
    username: fetchedStaffAfterUpdate?.username,
    display_name: fetchedStaffAfterUpdate?.display_name,
    legal_specialty: fetchedStaffAfterUpdate?.legal_specialty,
    license_number: fetchedStaffAfterUpdate?.license_number,
    license_expiry_date: fetchedStaffAfterUpdate?.license_expiry_date,
    joined_office_at: fetchedStaffAfterUpdate?.joined_office_at,
  }, null, 2));

  if (fetchedStaffAfterUpdate?.legal_specialty !== 'جنائي') throw new Error('updated legal_specialty mismatch');
  if (fetchedStaffAfterUpdate?.license_number !== 'SA-LAW-99201') throw new Error('updated license_number mismatch');
  if (fetchedStaffAfterUpdate?.license_expiry_date !== '2028-12-31') throw new Error('updated license_expiry_date mismatch');
  if (fetchedStaffAfterUpdate?.joined_office_at !== '2023-01-15') throw new Error('updated joined_office_at mismatch');
  console.log('✓ APP_USERS update verification PASSED!\n');

  // Cleanup test staff
  await supabase.from('app_users').delete().eq('id', staffId);
  console.log('✓ Cleaned up test staff user.\n');

  // ─────────────────────────────────────────────────────────────
  // 2. OFFICES (Super-Admin Level) Round-Trip Verification
  // ─────────────────────────────────────────────────────────────
  console.log('▶ TEST 3: OFFICES - Creation & Readback');
  const officeUsername = `test_office_${Date.now()}`;
  const officePayload = {
    username: officeUsername,
    password: 'Password123!',
    office_name: 'شركة الراية للمحاماة والاستشارات القانونية',
    display_name: 'أ. عبد الرحمن الراية',
    email: `${officeUsername}@alrayalaw.sa`,
    phone: '0567890123',
    commercial_registration_number: '1010998877',
    billing_contact_name: 'عبدالله المحاسب',
    billing_contact_phone: '0551122334',
    billing_contact_email: 'billing-test@alrayalaw.sa',
    office_address: 'الرياض - طريق الملك فهد - برج المجد الدور 14',
    plan_tier: 'pro',
    billing_cycle: 'annual' as const,
  };

  const createdOffice = await createSupabaseAdmin(officePayload);
  console.log('✓ Created Office Admin ID:', createdOffice.id);

  // Read back via findUserByIdOrUsername
  const fetchedOfficeAfterCreate = await findUserByIdOrUsername(createdOffice.id);
  console.log('\n[RAW JSON - OFFICES AFTER CREATE]:');
  console.log(JSON.stringify({
    id: fetchedOfficeAfterCreate?.id,
    username: fetchedOfficeAfterCreate?.username,
    office_name: fetchedOfficeAfterCreate?.office_name,
    commercial_registration_number: fetchedOfficeAfterCreate?.commercial_registration_number,
    billing_contact_name: fetchedOfficeAfterCreate?.billing_contact_name,
    billing_contact_phone: fetchedOfficeAfterCreate?.billing_contact_phone,
    billing_contact_email: fetchedOfficeAfterCreate?.billing_contact_email,
    office_address: fetchedOfficeAfterCreate?.office_address,
  }, null, 2));

  // Validate fields
  if (fetchedOfficeAfterCreate?.commercial_registration_number !== '1010998877') throw new Error('commercial_registration_number mismatch');
  if (fetchedOfficeAfterCreate?.billing_contact_name !== 'عبدالله المحاسب') throw new Error('billing_contact_name mismatch');
  if (fetchedOfficeAfterCreate?.billing_contact_phone !== '0551122334') throw new Error('billing_contact_phone mismatch');
  if (fetchedOfficeAfterCreate?.billing_contact_email !== 'billing-test@alrayalaw.sa') throw new Error('billing_contact_email mismatch');
  if (fetchedOfficeAfterCreate?.office_address !== 'الرياض - طريق الملك فهد - برج المجد الدور 14') throw new Error('office_address mismatch');
  console.log('✓ OFFICES create verification PASSED!\n');

  // Update office admin fields
  console.log('▶ TEST 4: OFFICES - Update & Readback');
  const updatedOfficePayload = {
    commercial_registration_number: '1010112233',
    billing_contact_name: 'سارة المالية',
    billing_contact_phone: '0559988776',
    billing_contact_email: 'accounts-updated@alrayalaw.sa',
    office_address: 'جدة - طريق الملك عبدالعزيز - مركز النخبة',
  };
  await updateSupabaseAdmin(createdOffice.id, updatedOfficePayload);

  // Read back via findUserByIdOrUsername
  const fetchedOfficeAfterUpdate = await findUserByIdOrUsername(createdOffice.id);
  console.log('\n[RAW JSON - OFFICES AFTER UPDATE]:');
  console.log(JSON.stringify({
    id: fetchedOfficeAfterUpdate?.id,
    username: fetchedOfficeAfterUpdate?.username,
    office_name: fetchedOfficeAfterUpdate?.office_name,
    commercial_registration_number: fetchedOfficeAfterUpdate?.commercial_registration_number,
    billing_contact_name: fetchedOfficeAfterUpdate?.billing_contact_name,
    billing_contact_phone: fetchedOfficeAfterUpdate?.billing_contact_phone,
    billing_contact_email: fetchedOfficeAfterUpdate?.billing_contact_email,
    office_address: fetchedOfficeAfterUpdate?.office_address,
  }, null, 2));

  if (fetchedOfficeAfterUpdate?.commercial_registration_number !== '1010112233') throw new Error('updated commercial_registration_number mismatch');
  if (fetchedOfficeAfterUpdate?.billing_contact_name !== 'سارة المالية') throw new Error('updated billing_contact_name mismatch');
  if (fetchedOfficeAfterUpdate?.billing_contact_phone !== '0559988776') throw new Error('updated billing_contact_phone mismatch');
  if (fetchedOfficeAfterUpdate?.billing_contact_email !== 'accounts-updated@alrayalaw.sa') throw new Error('updated billing_contact_email mismatch');
  if (fetchedOfficeAfterUpdate?.office_address !== 'جدة - طريق الملك عبدالعزيز - مركز النخبة') throw new Error('updated office_address mismatch');
  console.log('✓ OFFICES update verification PASSED!\n');

  // Cleanup test office
  await supabase.from('app_users').delete().eq('id', createdOffice.id);
  console.log('✓ Cleaned up test office admin.\n');

  console.log('================================================================');
  console.log('🎉 ALL DATABASE ROUND-TRIP VERIFICATIONS SUCCEEDED 100%!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
