import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tarea 7 del brief (2026-09-17) — la ruta del **corte X** (1.12).
 *
 * Fija dos cosas: la puerta es la del **mostrador** (quien cobra puede pedir su corte, y cocina no), y
 * sin caja abierta no inventa un arqueo: devuelve `null` con 200, que es «no hay nada que leer».
 */

const requireAdminSessionMock = vi.fn();
const requirePosLocationMock = vi.fn();
const getCurrentShiftMock = vi.fn();
const previewShiftArqueoMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

/**
 * El permiso de rol se deja **real** (`assertCanUsePos`): lo único que se dobla es la parte que toca la
 * base (sucursal + POS prendido). Si mañana alguien afloja la puerta del mostrador, este test se pone
 * rojo en vez de pasar por el mock.
 */
vi.mock("@/app/api/admin/pos/pos-route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/api/admin/pos/pos-route-helpers")
  >("@/app/api/admin/pos/pos-route-helpers");

  return {
    ...actual,
    requirePosLocation: (input: { role: Parameters<typeof actual.assertCanUsePos>[0] }) => {
      actual.assertCanUsePos(input.role);
      return requirePosLocationMock(input);
    },
  };
});

vi.mock("@/modules/pos/adapters/production-pos-shift", () => ({
  createProductionPosShiftDependencies: async () => ({
    shiftRepository: {},
    paymentRepository: {},
    businessCurrencyCode: "NIO",
    usdExchangeRate: null,
  }),
}));

vi.mock("@/modules/orders/adapters/prisma-cash-movement-repository", () => ({
  PrismaCashMovementRepository: class {},
}));
vi.mock("@/modules/orders/adapters/prisma-refund-repository", () => ({
  PrismaRefundRepository: class {},
}));

vi.mock("@/modules/orders/features/shift/get-current-shift", () => ({
  getCurrentShift: (input: unknown, deps: unknown) => getCurrentShiftMock(input, deps),
}));

vi.mock("@/modules/orders/features/shift/preview-shift-arqueo", () => ({
  previewShiftArqueo: (input: unknown, deps: unknown) => previewShiftArqueoMock(input, deps),
}));

function get() {
  return new Request("http://localhost/api/admin/pos/shift/x?locationId=loc_principal");
}

describe("GET /api/admin/pos/shift/x", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: ["loc_principal"] },
    });
    requirePosLocationMock.mockResolvedValue("loc_principal");
    getCurrentShiftMock.mockResolvedValue({
      data: { id: "shift_01", openedAt: "2026-09-17T14:00:00.000Z" },
    });
    previewShiftArqueoMock.mockResolvedValue({
      data: { shiftId: "shift_01", expectedAmount: 1300, expectedByCurrency: { NIO: 1300 } },
    });
  });

  it("devuelve el corte del turno abierto", async () => {
    const { GET } = await import("./route");

    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.expectedAmount).toBe(1300);
    expect(previewShiftArqueoMock).toHaveBeenCalledWith(
      expect.objectContaining({ shiftId: "shift_01" }),
      expect.anything(),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sin caja abierta no hay corte: 200 con data null", async () => {
    getCurrentShiftMock.mockResolvedValue({ data: null });

    const { GET } = await import("./route");
    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toBeNull();
    expect(previewShiftArqueoMock).not.toHaveBeenCalled();
  });

  it("cocina no lee la caja: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: ["loc_principal"] },
    });

    const { GET } = await import("./route");

    expect((await GET(get())).status).toBe(403);
    expect(previewShiftArqueoMock).not.toHaveBeenCalled();
  });
});
