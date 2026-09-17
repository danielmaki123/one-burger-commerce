import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShiftError } from "@/modules/orders/domain/shift-errors";

/**
 * Bloque 2.3 del roadmap del POS (Fase 2) — la ruta de movimientos de un turno.
 *
 * La guarda completa (sesión, permiso de control, alcance por sucursal y turno existente) vive en
 * `requireCashShiftId` y se prueba en su propio archivo; acá se fija la orquestación: que el `GET`
 * devuelva el historial del turno pedido, que el `POST` registre el movimiento con su autor y que un
 * payload inválido no llegue al caso de uso.
 */

const requireCashShiftIdMock = vi.fn();
const requireAdminSessionMock = vi.fn();
const listByShiftMock = vi.fn();
const createMovementMock = vi.fn();

vi.mock("@/app/api/admin/cash/cash-route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/api/admin/cash/cash-route-helpers")
  >("@/app/api/admin/cash/cash-route-helpers");

  return {
    ...actual,
    requireCashShiftId: (params: unknown) => requireCashShiftIdMock(params),
  };
});

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/orders/adapters/prisma-cash-movement-repository", () => ({
  PrismaCashMovementRepository: class {
    listByShift(shiftId: string) {
      return listByShiftMock(shiftId);
    }
    create(input: unknown) {
      return createMovementMock(input);
    }
  },
}));

vi.mock("@/modules/orders/adapters/prisma-shift-repository", () => ({
  PrismaShiftRepository: class {
    // El caso de uso vuelve a leer el turno para exigir que esté **abierto**: sin esto el doble
    // devolvía `undefined` y el `POST` moría con 500 en lugar de registrar.
    async findShiftById(id: string) {
      return {
        id,
        locationId: "loc_principal",
        userId: "user_01",
        status: "open",
        openedAt: "2026-09-17T14:00:00.000Z",
        closedAt: null,
        openingAmount: 1000,
        closingAmount: null,
        expectedAmount: null,
        difference: null,
        cashCounts: [],
        notes: null,
        createdAt: "2026-09-17T14:00:00.000Z",
        updatedAt: "2026-09-17T14:00:00.000Z",
      };
    }
  },
}));

const params = Promise.resolve({ id: "shift_01" });

function post(body: unknown) {
  return new Request("http://localhost/api/admin/cash/shifts/shift_01/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  kind: "withdrawal",
  category: "supplier",
  amount: 500,
  currency: "NIO",
  reason: "Pago al proveedor de pan",
};

describe("/api/admin/cash/shifts/[id]/movements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: [] },
    });
    requireCashShiftIdMock.mockResolvedValue("shift_01");
    listByShiftMock.mockResolvedValue([
      {
        id: "mov_01",
        shiftId: "shift_01",
        kind: "withdrawal",
        category: "supplier",
        amount: 500,
        currency: "NIO",
        reason: "Pago al proveedor",
        userId: "user_manager",
        approvedByUserId: null,
        approvedAt: null,
        createdAt: "2026-09-17T18:00:00.000Z",
      },
    ]);
    createMovementMock.mockImplementation(async (input: unknown) => ({
      id: "mov_02",
      ...(input as object),
    }));
  });

  it("GET devuelve el historial del turno pedido", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reason).toBe("Pago al proveedor");
    expect(listByShiftMock).toHaveBeenCalledWith("shift_01");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("POST registra el movimiento con su autor y responde 201", async () => {
    const { POST } = await import("./route");

    const response = await POST(post(validBody), { params });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      shiftId: "shift_01",
      kind: "withdrawal",
      amount: 500,
      userId: "user_manager",
    });
  });

  it("un monto inválido no llega al caso de uso: 422", async () => {
    const { POST } = await import("./route");

    const response = await POST(post({ ...validBody, amount: -500 }), { params });

    expect(response.status).toBe(422);
    expect(createMovementMock).not.toHaveBeenCalled();
  });

  it("sin caja abierta el caso de uso responde 409 (el turno ya se cerró)", async () => {
    createMovementMock.mockRejectedValue(
      new ShiftError(409, "CONFLICT", "La caja ya está cerrada."),
    );

    const { POST } = await import("./route");
    const response = await POST(post(validBody), { params });

    expect(response.status).toBe(409);
  });

  it("un turno fuera del alcance no se lee: el error de la guarda llega tal cual", async () => {
    requireCashShiftIdMock.mockRejectedValue(
      new ShiftError(404, "NOT_FOUND", "No encontramos ese turno de caja."),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params });

    expect(response.status).toBe(404);
    expect(listByShiftMock).not.toHaveBeenCalled();
  });
});
