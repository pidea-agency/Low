/**
 * Legacy Admin Dashboard re-export.
 * User management has been split into dedicated modular components in `pages/users.tsx`
 * and the office-wide admin overview in `pages/dashboard-admin.tsx`.
 */
export { default } from './users';
export type { OfficeMember as AppUser } from './users';
