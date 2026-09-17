import { describe, expect, it } from "vitest";

import {
  canManageBusinessSettings,
  canManageCash,
  canManageCriticalConfig,
  canManageInventoryOperations,
  canManageMenu,
  canManageOrderOperations,
  canManagePromotions,
  canManageUsers,
  canUsePOS,
  canViewDashboardSummary,
  canViewOutboxEvents,
} from "@/modules/auth/domain/admin-permissions";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";

describe("admin permissions", () => {
  /**
   * TASK-105 — el permiso del punto de venta.
   *
   * La caja no es un permiso más de los que ya existían: `kitchen` opera órdenes pero no cobra, y
   * `cashier` cobra pero no toca el menú ni la configuración. Por eso es una función propia y no una
   * reutilización de `canManageOrderOperations`.
   */
  it("lets owner, manager and cashier use the POS", () => {
    expect(canUsePOS(ADMIN_ROLES.owner)).toBe(true);
    expect(canUsePOS(ADMIN_ROLES.manager)).toBe(true);
    expect(canUsePOS(ADMIN_ROLES.cashier)).toBe(true);
    expect(canUsePOS(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("el cajero no hereda los permisos de manager (TASK-105)", () => {
    // La caja cobra, no administra: si heredara permisos de manager, el rol nuevo abriría la puerta
    // a editar el menú y las promociones.
    expect(canManageMenu(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManagePromotions(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageUsers(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageBusinessSettings(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageInventoryOperations(ADMIN_ROLES.cashier)).toBe(false);
    expect(canViewOutboxEvents(ADMIN_ROLES.cashier)).toBe(false);
  });
  it("lets owner and manager manage the menu", () => {
    expect(canManageMenu(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageMenu(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageMenu(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets all admin roles operate orders", () => {
    expect(canManageOrderOperations(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageOrderOperations(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageOrderOperations(ADMIN_ROLES.kitchen)).toBe(true);
  });

  it("lets only owner manage users and critical config", () => {
    expect(canManageUsers(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCriticalConfig(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageUsers(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageUsers(ADMIN_ROLES.kitchen)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner view dashboard summary", () => {
    expect(canViewDashboardSummary(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewDashboardSummary(ADMIN_ROLES.manager)).toBe(false);
    expect(canViewDashboardSummary(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner read outbox events because they carry customer PII", () => {
    expect(canViewOutboxEvents(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewOutboxEvents(ADMIN_ROLES.manager)).toBe(false);
    expect(canViewOutboxEvents(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets owner and manager run inventory operations", () => {
    expect(canManageInventoryOperations(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageInventoryOperations(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageInventoryOperations(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner change the business settings", () => {
    expect(canManageBusinessSettings(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageBusinessSettings(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageBusinessSettings(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets owner and manager manage promotions", () => {
    // Una promo toca precios del menú: es trabajo de manager, no de cocina.
    expect(canManagePromotions(ADMIN_ROLES.owner)).toBe(true);
    expect(canManagePromotions(ADMIN_ROLES.manager)).toBe(true);
    expect(canManagePromotions(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Bloque 7 del roadmap del POS (Fase 2) — administrar la caja es otra cosa que cobrar.
   *
   * `canUsePOS` habilita el mostrador (abrir, cobrar, cerrar). Ver el historial de cierres, reabrir un
   * turno, aprobar una devolución o hacer un movimiento de caja es **control del dinero**: si el
   * cajero pudiera, se estaría auditando a sí mismo, que es exactamente lo que el arqueo evita.
   */
  it("solo owner y manager administran la caja (Bloque 7)", () => {
    expect(canManageCash(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCash(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageCash(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageCash(ADMIN_ROLES.kitchen)).toBe(false);
  });
});
