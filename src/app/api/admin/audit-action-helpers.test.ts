import { afterEach, describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "@/modules/audit/domain/audit-actions";

import {
  cashMovementAudit,
  paidOrderCancelledAudit,
  recordAdminAudit,
  refundRequestAudit,
  refundReviewAudit,
  settingsUpdateAudit,
  shiftCloseAudit,
  shiftHandoverAudit,
  shiftOpenAudit,
  shiftReopenAudit,
} from "./audit-action-helpers";

/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — el cableado del log a las acciones sensibles.
 *
 * El módulo de auditoría (`src/modules/audit/`) guarda el asiento; esto es **quién lo arma**. Cada
 * acción de la lista cerrada tiene que poder firmarse desde una ruta sin repetir la forma del detalle, y
 * el asiento tiene que sobrevivir a que el log falle: la plata ya se movió cuando se quiere auditar.
 */
const recordMock = vi.fn(async (input: unknown) => ({ id: "log_01", ...(input as object) }));

vi.mock("@/modules/audit/adapters/prisma-audit-log-repository", () => ({
  PrismaAuditLogRepository: class {
    record(input: unknown) {
      return recordMock(input);
    }
  },
}));

function lastEntry(): Record<string, unknown> {
  const calls = recordMock.mock.calls as unknown as [Record<string, unknown>][];
  return calls[calls.length - 1][0];
}

describe("recordAdminAudit", () => {
  afterEach(() => {
    recordMock.mockClear();
  });

  it("firma la acción con el actor real de la sesión y su detalle", async () => {
    await recordAdminAudit({
      action: "shift.reopen",
      actorUserId: "user_manager",
      targetType: "Shift",
      targetId: "shift_01",
      detail: { reason: "Conté mal los billetes" },
    });

    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "shift.reopen",
        actorUserId: "user_manager",
        targetType: "Shift",
        targetId: "shift_01",
        detail: { reason: "Conté mal los billetes" },
      }),
    );
  });

  it("no inventa el detalle cuando no hay", async () => {
    await recordAdminAudit({
      action: "settings.update",
      actorUserId: "user_owner",
      targetType: "BusinessSettings",
      targetId: "business-settings",
    });

    expect(lastEntry()).not.toHaveProperty("detail");
  });

  it("si el log falla no rompe la operación (best-effort)", async () => {
    recordMock.mockImplementationOnce(async () => {
      throw new Error("la base no responde");
    });

    await expect(
      recordAdminAudit({
        action: "shift.close",
        actorUserId: "user_1",
        targetType: "Shift",
        targetId: "shift_01",
      }),
    ).resolves.toBeUndefined();
  });
});

/**
 * La tabla es el contrato de cada atajo: qué acción firma, sobre qué objeto y con qué detalle. Si una
 * acción de la lista cerrada no aparece acá, no hay forma de emitirla desde una ruta.
 */
const shortcuts: Array<[string, () => Promise<void>, Record<string, unknown>]> = [
  [
    "shift.open",
    () =>
      shiftOpenAudit({
        actorUserId: "user_manager",
        shiftId: "shift_01",
        locationId: "loc_principal",
        openingAmount: 1000,
      }),
    {
      action: "shift.open",
      targetType: "Shift",
      targetId: "shift_01",
      detail: { locationId: "loc_principal", openingAmount: 1000 },
    },
  ],
  [
    "shift.close",
    () =>
      shiftCloseAudit({
        actorUserId: "user_manager",
        locationId: "loc_principal",
        shiftId: "shift_01",
        counted: 1400,
        expected: 1500,
        difference: -100,
      }),
    {
      action: "shift.close",
      targetType: "Shift",
      targetId: "shift_01",
      detail: { locationId: "loc_principal", counted: 1400, expected: 1500, difference: -100 },
    },
  ],
  [
    "shift.close sin turno devuelto (apunta a la sucursal)",
    () =>
      shiftCloseAudit({
        actorUserId: "user_manager",
        locationId: "loc_principal",
        counted: null,
        expected: null,
        difference: null,
      }),
    { action: "shift.close", targetType: "Shift", targetId: "loc_principal" },
  ],
  [
    "shift.reopen",
    () =>
      shiftReopenAudit({
        actorUserId: "user_manager",
        shiftId: "shift_01",
        reason: "Conté mal los billetes",
      }),
    {
      action: "shift.reopen",
      targetType: "Shift",
      targetId: "shift_01",
      detail: { reason: "Conté mal los billetes" },
    },
  ],
  [
    "shift.handover",
    () =>
      shiftHandoverAudit({
        actorUserId: "user_cashier",
        handoverId: "handover_01",
        shiftId: "shift_01",
        locationId: "loc_principal",
        handedByName: "María López",
        receivedByName: "Carlos Ruiz",
        expectedAmount: 1500,
      }),
    {
      action: "shift.handover",
      targetType: "Shift",
      targetId: "shift_01",
      detail: {
        handoverId: "handover_01",
        locationId: "loc_principal",
        handedByName: "María López",
        receivedByName: "Carlos Ruiz",
        expectedAmount: 1500,
      },
    },
  ],
  [
    "cash_movement.create",
    () =>
      cashMovementAudit({
        actorUserId: "user_manager",
        movementId: "mov_01",
        shiftId: "shift_01",
        kind: "withdrawal",
        amount: 500,
        currency: "NIO",
      }),
    {
      action: "cash_movement.create",
      targetType: "CashMovement",
      targetId: "mov_01",
      detail: { shiftId: "shift_01", kind: "withdrawal", amount: 500, currency: "NIO" },
    },
  ],
  [
    "refund.request",
    () =>
      refundRequestAudit({
        actorUserId: "user_manager",
        refundId: "ref_01",
        orderId: "order_01",
        amount: 500,
        currency: "NIO",
        status: "pending",
      }),
    {
      action: "refund.request",
      targetType: "Refund",
      targetId: "ref_01",
      detail: { orderId: "order_01", amount: 500, currency: "NIO", status: "pending" },
    },
  ],
  [
    "refund.approve",
    () =>
      refundReviewAudit({
        actorUserId: "user_owner",
        refundId: "ref_01",
        decision: "approved",
        note: "Se devolvió en efectivo",
      }),
    {
      action: "refund.approve",
      targetType: "Refund",
      targetId: "ref_01",
      detail: { note: "Se devolvió en efectivo" },
    },
  ],
  [
    "refund.reject",
    () =>
      refundReviewAudit({
        actorUserId: "user_owner",
        refundId: "ref_01",
        decision: "rejected",
        note: "El cobro estaba bien",
      }),
    {
      action: "refund.reject",
      targetType: "Refund",
      targetId: "ref_01",
      detail: { note: "El cobro estaba bien" },
    },
  ],
  [
    "order.cancel_paid",
    () =>
      paidOrderCancelledAudit({
        actorUserId: "user_manager",
        orderId: "order_01",
        refundsRequested: 2,
      }),
    {
      action: "order.cancel_paid",
      targetType: "Order",
      targetId: "order_01",
      detail: { refundsRequested: 2 },
    },
  ],
  [
    "settings.update",
    () => settingsUpdateAudit({ actorUserId: "user_owner" }),
    { action: "settings.update", targetType: "BusinessSettings", targetId: "business-settings" },
  ],
];

describe("los atajos de cada acción sensible", () => {
  afterEach(() => {
    recordMock.mockClear();
  });

  it.each(shortcuts)("%s firma su acción, su objetivo y su detalle", async (_name, run, expected) => {
    await run();

    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(lastEntry()).toMatchObject({ actorUserId: expect.any(String), ...expected });
  });

  /**
   * El gate del cableado: una acción declarada en `AUDIT_ACTIONS` y sin atajo es una acción que **nadie
   * puede firmar** (la lista cerrada promete más de lo que el sistema hace). Si se agrega una acción
   * nueva al dominio, esto se pone en rojo hasta que exista su atajo y su caso en la tabla.
   */
  it("no queda ninguna acción de la lista cerrada sin forma de firmarse", () => {
    const wired = shortcuts.map(([, , expected]) => expected.action);

    expect([...new Set(wired)].sort()).toEqual([...AUDIT_ACTIONS].sort());
  });
});
