import { describe, expect, it } from "vitest";

import type { CashMovementRecord } from "@/modules/orders/domain/order.types";
import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import type { CreateCashMovementInput } from "@/modules/orders/ports/cash-movement-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { registerCashMovement } from "./register-cash-movement";

/**
 * Bloque 2 del roadmap del POS (Fase 2) — registrar un movimiento de caja.
 *
 * Lo que puede salir caro y por eso se fija acá: **el motivo es obligatorio** (un retiro sin motivo no
 * se audita), el monto tiene que ser positivo (el signo lo da el tipo: retiro resta, ingreso suma) y
 * solo se mueve plata de una caja **abierta** —un movimiento sobre un turno cerrado cambiaría un arqueo
 * ya firmado—.
 */

type StoredMovement = CreateCashMovementInput;

function movement(overrides: Partial<CashMovementRecord> & { id: string }): CashMovementRecord {
  return {
    shiftId: "shift_01",
    kind: "withdrawal",
    category: "supplier",
    amount: 500,
    currency: "NIO",
    reason: "Pago al proveedor de pan",
    userId: "user_01",
    approvedByUserId: null,
    approvedAt: null,
    createdAt: "2026-09-17T18:00:00.000Z",
    ...overrides,
  };
}

const openShift: ShiftRecord = {
  id: "shift_01",
  locationId: "loc_principal",
  userId: "user_01",
  status: "open",
  openedAt: "2026-09-17T14:00:00.000Z",
  closedAt: null,
  openingAmount: 500,
  closingAmount: null,
  expectedAmount: null,
  difference: null,
  cashCounts: [],
  notes: null,
  createdAt: "2026-09-17T14:00:00.000Z",
  updatedAt: "2026-09-17T14:00:00.000Z",
};

function buildDeps(shift: ShiftRecord | null = openShift) {
  const created: StoredMovement[] = [];
  const shiftRepository = {
    async findShiftById() {
      return shift;
    },
  } as unknown as ShiftRepository;

  return {
    created,
    deps: {
      shiftRepository,
      cashMovementRepository: {
        async create(input: StoredMovement) {
          created.push(input);
          return movement({ id: `mov_${created.length}`, ...input });
        },
        async listByShift() {
          return created.map((item, index) => movement({ id: `mov_${index + 1}`, ...item }));
        },
      },
    },
  };
}

const input = {
  shiftId: "shift_01",
  userId: "user_01",
  kind: "withdrawal" as const,
  category: "supplier" as const,
  amount: 500,
  currency: "nio",
  reason: "Pago al proveedor de pan",
};

describe("registerCashMovement", () => {
  it("registra el retiro con su motivo y normaliza la moneda", async () => {
    const { created, deps } = buildDeps();

    const result = await registerCashMovement(input, deps);

    expect(created).toEqual([
      {
        shiftId: "shift_01",
        kind: "withdrawal",
        category: "supplier",
        amount: 500,
        currency: "NIO",
        reason: "Pago al proveedor de pan",
        userId: "user_01",
      },
    ]);
    expect(result.data.id).toBe("mov_1");
  });

  it("rechaza un motivo vacío: un movimiento sin razón no se audita", async () => {
    const { created, deps } = buildDeps();

    await expect(registerCashMovement({ ...input, reason: "   " }, deps)).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
    expect(created).toEqual([]);
  });

  it.each([0, -100])("rechaza un monto de %s: el signo lo da el tipo de movimiento", async (amount) => {
    const { created, deps } = buildDeps();

    await expect(registerCashMovement({ ...input, amount }, deps)).rejects.toMatchObject({
      status: 422,
    });
    expect(created).toEqual([]);
  });

  it("no mueve plata de una caja cerrada", async () => {
    const { created, deps } = buildDeps({ ...openShift, status: "closed" });

    await expect(registerCashMovement(input, deps)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    expect(created).toEqual([]);
  });

  it("un turno que no existe es 404, no un movimiento huérfano", async () => {
    const { created, deps } = buildDeps(null);

    await expect(registerCashMovement(input, deps)).rejects.toMatchObject({ status: 404 });
    expect(created).toEqual([]);
  });

  it("un ingreso entra con su categoría de cambio", async () => {
    const { created, deps } = buildDeps();

    await registerCashMovement(
      { ...input, kind: "deposit", category: "change_fund", amount: 1000, reason: "Cambio para el turno" },
      deps,
    );

    expect(created[0]).toMatchObject({
      kind: "deposit",
      category: "change_fund",
      amount: 1000,
    });
  });
});
