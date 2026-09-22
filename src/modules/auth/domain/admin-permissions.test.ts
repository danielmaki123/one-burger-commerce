import { describe, expect, it } from "vitest";

import {
  canDiscountPosSale,
  canManageBusinessSettings,
  canManageCash,
  canManageCashConfig,
  canPrintCashDocuments,
  canManageCriticalConfig,
  canManageInventoryOperations,
  canManageMenu,
  canManageOrderOperations,
  canManagePromotions,
  canManageUsers,
  canApproveRefund,
  canRefund,
  canUsePOS,
  canViewCashHistory,
  canViewDashboardSummary,
  canViewHistory,
  canViewOutboxEvents,
} from "@/modules/auth/domain/admin-permissions";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";

describe("admin permissions", () => {
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — **descontar plata a mano** en el mostrador.
   *
   * Un cupón es una promo cargada con su lista de códigos y sus usos: el cajero solo escribe el código. Un
   * descuento manual, en cambio, es plata que el cliente deja de pagar porque alguien lo decidió en el
   * momento: lo autoriza quien administra la caja (owner o manager), no el cajero.
   */
  it("solo owner y manager descuentan a mano en el POS (9.7)", () => {
    expect(canDiscountPosSale(ADMIN_ROLES.owner)).toBe(true);
    expect(canDiscountPosSale(ADMIN_ROLES.manager)).toBe(true);
    expect(canDiscountPosSale(ADMIN_ROLES.cashier)).toBe(false);
    expect(canDiscountPosSale(ADMIN_ROLES.kitchen)).toBe(false);
  });

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

  /**
   * Bloque 7.1 del roadmap del POS (Fase 2) — devolver plata y auditar la caja son **dos permisos
   * distintos** de administrarla.
   *
   * `canManageCash` habilita abrir, cerrar, mover plata y reabrir un turno. Devolver un cobro
   * (`canRefund`) y ver el historial de cierres (`canViewCashHistory`) son puertas propias: hoy las
   * tres responden lo mismo (owner y manager), pero separarlas permite, por ejemplo, que un encargado
   * vea el historial sin poder devolver. El cajero no tiene ninguna de las tres: no se audita ni se
   * devuelve a sí mismo.
   */
  it("devolver y ver el historial son permisos propios (Bloque 7.1)", () => {
    expect(canRefund(ADMIN_ROLES.owner)).toBe(true);
    expect(canRefund(ADMIN_ROLES.manager)).toBe(true);
    expect(canRefund(ADMIN_ROLES.cashier)).toBe(false);
    expect(canRefund(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Tarea 9 del brief (2026-09-17) — «solo el owner aprueba devoluciones (nadie la propia)».
   *
   * Firmar una devolución mueve plata del cajón y es lo que el dueño se reservó: el manager puede pedirla
   * (como quien administra la caja) pero no firmarla, y el cajero tampoco.
   */
  it("canApproveRefund: solo el dueño firma una devolución", () => {
    expect(canApproveRefund(ADMIN_ROLES.owner)).toBe(true);
    expect(canApproveRefund(ADMIN_ROLES.manager)).toBe(false);
    expect(canApproveRefund(ADMIN_ROLES.cashier)).toBe(false);
    expect(canApproveRefund(ADMIN_ROLES.kitchen)).toBe(false);

    expect(canViewCashHistory(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewCashHistory(ADMIN_ROLES.manager)).toBe(true);
    expect(canViewCashHistory(ADMIN_ROLES.cashier)).toBe(false);
    expect(canViewCashHistory(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Punto 2 del roadmap (2026-09-18) — la sección **Historial** (`/admin/history`: cierres y facturas).
   *
   * Es una sección propia y por eso tiene su permiso: adentro lista dos cosas distintas (arqueos de
   * caja y facturas emitidas). El cajero no la ve —se estaría auditando—, cocina tampoco, y el manager
   * entra pero acotado a sus sucursales (eso lo resuelve el alcance, no este permiso).
   */
  it("canViewHistory: el Historial es de owner y manager", () => {
    expect(canViewHistory(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewHistory(ADMIN_ROLES.manager)).toBe(true);
    expect(canViewHistory(ADMIN_ROLES.cashier)).toBe(false);
    expect(canViewHistory(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Fase 1a del rediseño de Caja (2026-09-19) — **configurar la caja**.
   *
   * Es una puerta propia y no una reutilización: `canManageCash` habilita operar y auditar el turno
   * (owner y manager), y `canManageBusinessSettings` es la marca del negocio. Configurar la caja cambia
   * qué monedas se cuentan, con qué billetes y si el cajero ve el esperado —las reglas con las que se
   * firma un arqueo—, así que queda en el dueño y su función dice eso y no otra cosa.
   */
  it("canManageCashConfig: la configuración de la caja es del dueño", () => {
    expect(canManageCashConfig(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCashConfig(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageCashConfig(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageCashConfig(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Fase 4 del rediseño de Caja (2026-09-22) — **imprimir el papel del arqueo** (§8.e del brief).
   *
   * «Cajero y Manager: no imprimen desde la app. Owner: sí.» El papel del cierre es el documento que queda
   * firmado, así que la puerta es del dueño y es propia: auditar la caja no tiene por qué venir con la
   * imprenta.
   */
  it("canPrintCashDocuments: el papel del arqueo lo imprime el dueño", () => {
    expect(canPrintCashDocuments(ADMIN_ROLES.owner)).toBe(true);
    expect(canPrintCashDocuments(ADMIN_ROLES.manager)).toBe(false);
    expect(canPrintCashDocuments(ADMIN_ROLES.cashier)).toBe(false);
    expect(canPrintCashDocuments(ADMIN_ROLES.kitchen)).toBe(false);
  });
});
