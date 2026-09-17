import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * TASK-305b + Bloque 13.1 del roadmap del POS (Fase 2) — cerrar la caja.
 *
 * El cierre es la operación que **firma el arqueo**: el servidor calcula el esperado (solo efectivo,
 * dólares convertidos, vuelto descontado) y la respuesta trae la diferencia por moneda. Además queda el
 * asiento con lo contado, lo esperado y la diferencia: el estado dice cuánto, el log dice **quién**.
 */

const requireAdminSessionMock = vi.fn();
const requirePosLocationMock = vi.fn();
const closePosShiftMock = vi.fn();
const shiftCloseAuditMock = vi.fn();

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
    counts: [{ currency: "NIO", denomination: 500, quantity: 3 }],
    notes: null,
  }),
}));

vi.mock("@/modules/pos/adapters/production-pos-shift", () => ({
  createProductionPosShiftDependencies: () => ({
    shiftRepository: {},
    paymentRepository: {},
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36,
  }),
}));

vi.mock("@/modules/pos/features/close-pos-shift/close-pos-shift", () => ({
  closePosShift: (input: unknown, deps: unknown) => closePosShiftMock(input, deps),
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  shiftCloseAudit: (input: unknown) => shiftCloseAuditMock(input),
}));

const registerShiftClosedAlertMock = vi.fn();

vi.mock("@/modules/notifications/features/register-alert-event/register-alert-event", () => ({
  registerShiftClosedAlert: (input: unknown, deps: unknown) =>
    registerShiftClosedAlertMock(input, deps),
}));

vi.mock("@/modules/notifications/adapters/prisma-notification-settings-repository", () => ({
  PrismaNotificationSettingsRepository: class {},
}));
vi.mock("@/modules/notifications/adapters/prisma-outbox-repository", () => ({
  PrismaOutboxRepository: class {},
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: {
      listLocations: async () => [
        { id: "loc_principal", name: "Camino de Oriente" },
      ],
    },
  }),
}));

const closedShift = {
  id: "shift_01",
  locationId: "loc_principal",
  status: "closed",
  closingAmount: 1400,
  expectedAmount: 1500,
  difference: -100,
};

function post() {
  return new Request("http://localhost/api/admin/pos/shift/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: "loc_principal" }),
  });
}

describe("POST /api/admin/pos/shift/close", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: {
        id: "user_manager",
        name: "María Pérez",
        role: "manager",
        locationIds: ["loc_principal"],
      },
    });
    requirePosLocationMock.mockResolvedValue("loc_principal");
    closePosShiftMock.mockResolvedValue({
      data: {
        ...closedShift,
        openedAt: "2026-09-18T14:00:00.000Z",
        closedAt: "2026-09-19T02:30:00.000Z",
        notes: null,
      },
      meta: {
        expectedByCurrency: { NIO: 1500 },
        paymentMix: { cash: 1400, card: 100, transfer: 0, other: 0, total: 1500, tips: 0, orders: 4 },
      },
    });
  });

  it("cierra la caja y firma el arqueo con su diferencia", async () => {
    const { POST } = await import("./route");

    const response = await POST(post());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.difference).toBe(-100);
    expect(shiftCloseAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_manager",
      locationId: "loc_principal",
      shiftId: "shift_01",
      counted: 1400,
      expected: 1500,
      difference: -100,
    });
  });

  /**
   * Decisión del owner (2026-09-17): **cada cierre** deja un aviso para el grupo, con el nombre de la
   * sucursal —el dueño lee el mensaje, no el id—, quién cerró y el desglose por medio de pago que el cierre
   * ya calculó. Antes solo se registraba cuando había diferencia.
   */
  it("cada cierre deja el aviso registrado con sucursal, quién cerró y el desglose", async () => {
    const { POST } = await import("./route");

    await POST(post());

    expect(registerShiftClosedAlertMock).toHaveBeenCalledWith(
      {
        shiftId: "shift_01",
        locationName: "Camino de Oriente",
        openedAt: "2026-09-18T14:00:00.000Z",
        closedAt: "2026-09-19T02:30:00.000Z",
        closedByName: "María Pérez",
        ordersCount: 4,
        cash: 1400,
        card: 100,
        transfer: 0,
        total: 1500,
        tips: 0,
        difference: -100,
        reason: null,
      },
      expect.anything(),
    );
  });

  it("una caja que cuadra también avisa: es un mensaje por cierre", async () => {
    closePosShiftMock.mockResolvedValue({
      data: {
        ...closedShift,
        closingAmount: 1500,
        difference: 0,
        openedAt: "2026-09-18T14:00:00.000Z",
        closedAt: "2026-09-19T02:30:00.000Z",
        notes: "Cerró el encargado",
      },
      meta: {
        expectedByCurrency: { NIO: 1500 },
        paymentMix: { cash: 1500, card: 0, transfer: 0, other: 0, total: 1500, tips: 0, orders: 2 },
      },
    });

    const { POST } = await import("./route");
    await POST(post());

    expect(registerShiftClosedAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ difference: 0, reason: "Cerró el encargado" }),
      expect.anything(),
    );
  });

  it("si el registro del aviso falla, el cierre igual responde 200 (no bloquea la operación)", async () => {
    registerShiftClosedAlertMock.mockRejectedValue(new Error("la base de alertas no responde"));

    const { POST } = await import("./route");

    expect((await POST(post())).status).toBe(200);
  });

  it("sin caja abierta no se firma nada: 409 del caso de uso", async () => {    closePosShiftMock.mockRejectedValue(
      new PosError(409, "CONFLICT", "No hay una caja abierta en este local."),
    );

    const { POST } = await import("./route");
    const response = await POST(post());

    expect(response.status).toBe(409);
    expect(shiftCloseAuditMock).not.toHaveBeenCalled();
  });

  it("cocina no cobra: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: ["loc_principal"] },
    });

    const { POST } = await import("./route");
    const response = await POST(post());

    expect(response.status).toBe(403);
    expect(closePosShiftMock).not.toHaveBeenCalled();
  });
});
