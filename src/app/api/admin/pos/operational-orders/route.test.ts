import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §8, §10, §12) — **la ruta del feed operacional del POS**.
 *
 * Tres propiedades que se fijan acá, y que son la razón de que la ruta exista:
 *
 * 1. **Cocina no entra**: la puerta es `canUsePOS` y se resuelve en el servidor, no escondiendo la banda en
 *    React.
 * 2. **El resumen lo produce el servidor** y viaja en la misma respuesta que el feed: no hay cuatro endpoints
 *    de KPI ni agregación en el cliente.
 * 3. **El local del feed es el que el guardián del POS resolvió**, no el que la pantalla pidió por query: el
 *    alcance por sucursal no se negocia.
 */

const requireAdminSessionMock = vi.fn();
const requirePosLocationMock = vi.fn();
const listPosOperationalOrdersMock = vi.fn();
const readProductionMoneyMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/app/api/admin/pos/pos-route-helpers", () => ({
  requirePosLocation: requirePosLocationMock,
}));

vi.mock("@/modules/money/adapters/production-money-context", () => ({
  readProductionMoney: readProductionMoneyMock,
}));

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: class {},
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
}));

vi.mock(
  "@/modules/orders/features/list-pos-operational-orders/list-pos-operational-orders",
  () => ({ listPosOperationalOrders: listPosOperationalOrdersMock }),
);

async function callRoute(query = "?locationId=loc_centro") {
  const { GET } = await import("./route");

  return GET(new Request(`http://test.local/api/admin/pos/operational-orders${query}`));
}

describe("admin pos operational-orders route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    requirePosLocationMock.mockResolvedValue("loc_centro");
    readProductionMoneyMock.mockResolvedValue({ context: { baseCurrencyCode: "NIO" } });
    listPosOperationalOrdersMock.mockResolvedValue({
      orders: [{ id: "ord_1", orderNumber: "P-1" }],
      summary: { inProcess: 1, ready: 0, pendingPayment: 1, scheduled: 0 },
    });
  });

  it("devuelve el feed y el resumen que produjo el caso de uso", async () => {
    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.summary).toEqual({
      inProcess: 1,
      ready: 0,
      pendingPayment: 1,
      scheduled: 0,
    });
    // Sin caché: la banda tiene que poder cambiar cuando el cajero cobra o la cocina marca listo.
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("lee el feed del local que resolvió el guardián del POS, no del que pidió la query", async () => {
    await callRoute("?locationId=loc_ajeno");

    // El guardián resuelve rol → alcance → POS prendido; la request cruda no llega al caso de uso.
    expect(requirePosLocationMock).toHaveBeenCalledWith(
      expect.objectContaining({ requested: "loc_ajeno", role: "cashier" }),
    );
    expect(listPosOperationalOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc_centro" }),
      expect.anything(),
    );
  });

  it("cocina no entra: el 403 lo decide la puerta, no la pantalla", async () => {
    const { AuthError } = await import("@/modules/auth/domain/auth-errors");
    requirePosLocationMock.mockRejectedValue(
      new AuthError(403, "FORBIDDEN", "Insufficient permissions"),
    );

    const response = await callRoute();

    expect(response.status).toBe(403);
    expect(listPosOperationalOrdersMock).not.toHaveBeenCalled();
  });

  it("el estado financiero se expresa en la moneda base que define `money`", async () => {
    await callRoute();

    expect(listPosOperationalOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseCurrencyCode: "NIO" }),
      expect.anything(),
    );
  });

  it("sin `locationId` en la query, el guardián es el que rechaza (no se lee el local de nadie)", async () => {
    const { PosError } = await import("@/modules/pos/domain/pos-errors");
    requirePosLocationMock.mockRejectedValue(
      new PosError(400, "BAD_REQUEST", "Elegí el local."),
    );

    const response = await callRoute("");

    expect(response.status).toBe(400);
    expect(listPosOperationalOrdersMock).not.toHaveBeenCalled();
  });
});
