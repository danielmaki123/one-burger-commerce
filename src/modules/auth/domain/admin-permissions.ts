import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

export function canManageCriticalConfig(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageUsers(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * La personalización del negocio cambia el sitio público completo (nombre,
 * colores, moneda, propina): queda reservada al owner.
 */
export function canManageBusinessSettings(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageMenu(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * Las promos cambian lo que el cliente paga y eligen productos del menú, así que
 * van con el mismo permiso que el menú. Cocina no las toca.
 */
export function canManagePromotions(role: AdminRole) {
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

/**
 * TASK-105 — usar el punto de venta (abrir la caja, cobrar, cerrar el turno).
 *
 * `kitchen` **no** entra: cocina opera órdenes, no maneja plata. Y `cashier` entra solo acá: no es
 * un manager con menos botones, es un rol de mostrador, así que no hereda menú, promociones,
 * inventario ni configuración (hay un test que lo fija).
 */
export function canUsePOS(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.cashier
  );
}

/**
 * Bloque 7 del roadmap del POS (Fase 2) — **administrar** la caja, no cobrar en ella.
 *
 * `canUsePOS` abre el mostrador: abrir el turno, cobrar y cerrarlo. Ver el historial de cierres,
 * reabrir un turno, aprobar una devolución o registrar un movimiento de caja es control del dinero, y
 * el cajero no lo tiene: si pudiera, se auditaría a sí mismo. Mismo criterio que el menú y las promos
 * (owner + manager), y cocina queda afuera porque no maneja plata.
 */
export function canManageCash(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
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

/**
 * Outbox events carry customer PII (name, phone, address) in their payload,
 * so they stay restricted to the owner role.
 */
export function canViewOutboxEvents(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}
