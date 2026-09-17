import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShiftError } from "@/modules/orders/domain/shift-errors";

/**
 * TASK-305b + Bloque 13.1 del roadmap del POS (Fase 2) — abrir la caja.
 *
 * Abrir la caja arranca el arqueo: a partir de acá todos los cobros caen en este turno. La ruta resuelve
 * sesión, permiso de POS y sucursal, deja el fondo en manos del caso de uso y **firma** la apertura en el
 * log con el fondo con el que se abrió (antes quedaba como estado, sin quién).
 */

const requireAdminSessionMock = vi.fn();
const requirePosLocationMock = vi.fn();
const openShiftMock = vi.fn();
const shiftOpenAuditMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/app/api/admin/pos/pos-route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/api/admin/pos/pos-route-helpers")
  >("@/app/api/admin/pos/pos-route-helpers");

  return {
    ...actual,
    requirePosLocation: (input: unknown) => requirePosLocationMock(input),
  };
});

vi.mock("@/app/api/admin/pos/shift/shift-payload", () => ({
  parseShiftCashPayload: () => ({
    locationId: "loc_principal",
    counts: [{ currency: "NIO", denomination: 500, quantity: 2 }],
    notes: null,
  }),
}));

vi.mock("@/modules/pos/adapters/production-pos-shift", () => ({
  createProductionPosShiftDependencies: () => ({
    shiftRepository: {},
    locationRepository: {},
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36,
  }),
}));

vi.mock("@/modules/orders/features/shift/open-shift", () => ({
  openShift: (input: unknown, deps: unknown) => openShiftMock(input, deps),
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  shiftOpenAudit: (input: unknown) => shiftOpenAuditMock(input),
}));

const openedShift = {
  id: "shift_01",
  locationId: "loc_principal",
  userId: "user_manager",
  status: "open",
  openedAt: "2026-09-18T14:00:00.000Z",
  closedAt: null,
  openingAmount: 1000,
  closingAmount: null,
  expectedAmount: null,
  difference: null,
  cashCounts: [],
  notes: null,
  createdAt: "2026-09-18T14:00:00.000Z",
  updatedAt: "2026-09-18T14:00:00.000Z",
};

function post() {
  return new Request("http://localhost/api/admin/pos/shift/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: "loc_principal" }),
  });
}

describe("POST /api/admin/pos/shift/open", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_principal"] },
    });
    requirePosLocationMock.mockResolvedValue("loc_principal");
    openShiftMock.mockResolvedValue({ data: openedShift });
  });

  it("abre la caja y firma la apertura con su fondo", async () => {
    const { POST } = await import("./route");

    const response = await POST(post());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe("shift_01");
    expect(openShiftMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc_principal", userId: "user_manager" }),
      expect.anything(),
    );
    expect(shiftOpenAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_manager",
      shiftId: "shift_01",
      locationId: "loc_principal",
      openingAmount: 1000,
    });
  });

  it("cocina no cobra: 403 y la caja no se abre", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: ["loc_principal"] },
    });

    const { POST } = await import("./route");
    const response = await POST(post());

    expect(response.status).toBe(403);
    expect(openShiftMock).not.toHaveBeenCalled();
    expect(shiftOpenAuditMock).not.toHaveBeenCalled();
  });

  it("si la caja ya está abierta no se firma nada: el error del caso de uso llega tal cual", async () => {
    openShiftMock.mockRejectedValue(
      new ShiftError(409, "CONFLICT", "Ya hay una caja abierta en este local."),
    );

    const { POST } = await import("./route");
    const response = await POST(post());

    expect(response.status).toBe(409);
    expect(shiftOpenAuditMock).not.toHaveBeenCalled();
  });
});
