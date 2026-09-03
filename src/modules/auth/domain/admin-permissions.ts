import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

export function canManageCriticalConfig(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageUsers(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageMenu(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

export function canApproveReservations(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageInventoryOperations(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

export function canManageOrderOperations(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.kitchen
  );
}

export function canViewDashboardSummary(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewAdminOverview(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewActivityFeed(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewDailyReports(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewInventoryReports(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}
