import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const listKitchenOrdersMock = vi.fn();
const requireAdminSessionMock = vi.fn();
const canOperateKitchenMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () {
    return {};
  }),
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: vi.fn(function () {
    return {};
  }),
}));

vi.mock("@/modules/orders/features/list-kitchen-orders/list-kitchen-orders", () => ({
  listKitchenOrders: listKitchenOrdersMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canOperateKitchen: canOperateKitchenMock,
}));

/**
 * `GET /api/admin/kitchen/orders` — la puerta de la superficie de Cocina.
 *
 * Tres cosas se fijan acá, y las tres son de **servidor**:
 *
 * 1. **401** sin sesión y **403** con un rol sin la capacidad (`cashier` no cocina: `D-014`). El rol
 *    llega por cliente, la autorización se aplica acá.
 * 2. **Alcance por sucursal**: se reusa `resolveOrderLocationScope` —no un segundo scope— y una sucursal
 *    pedida fuera del alcance no la muestra el filtro.
 * 3. **Sin dinero**: el cuerpo que sale no tiene ninguna clave financiera. Se afirma sobre las claves
 *    reales del payload.
 */
const KITCHEN_ORDER = {
  id: "ord_1",
  orderNumber: "P-ABC123",
  type: "pickup",
  status: "preparing",
  source: "menu",
  customerName: "Ana Lopez",
  location: { id: "loc_centro", name: "Camino de Oriente", pickupLeadMinutes: 25 },
  createdAt: "2026-09-12T17:00:00.000Z",
  stageChangedAt: "2026-09-12T17:12:00.000Z",
  preparingAt: "2026-09-12T17:12:00.000Z",
  readyAt: null,
  pickupTime: "2026-09-12T18:00:00.000Z",
  pickupScheduled: true,
  items: [{ id: "i1", productName: "Doble Bacon", quantity: 2, notes: null, modifiers: [] }],
};

function kitchenResult() {
  return {
    data: [KITCHEN_ORDER],
    meta: {
      count: 1,
      locationScope: null,
      summary: { averagePrepMinutes: 15, longestPrepMinutes: 20, prepTargetMinutes: 18 },
    },
  };
}

function request(query = "") {
  return new Request(`http://localhost/api/admin/kitchen/orders${query}`);
}

describe("GET /api/admin/kitchen/orders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "kitchen", locationIds: null },
    });
    canOperateKitchenMock.mockReturnValue(true);
    listKitchenOrdersMock.mockResolvedValue(kitchenResult());
  });

  it("responde 200 con la cola de Cocina", async () => {
    const { GET } = await import("./route");
    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].orderNumber).toBe("P-ABC123");
    expect(body.meta.summary.prepTargetMinutes).toBe(18);
  });

  it("responde 401 sin sesión", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Session required"),
    );

    const { GET } = await import("./route");
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(listKitchenOrdersMock).not.toHaveBeenCalled();
  });

  it("responde 403 al cajero: no opera Cocina, aunque vea pedidos", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "cashier", locationIds: null },
    });
    canOperateKitchenMock.mockReturnValueOnce(false);

    const { GET } = await import("./route");
    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(listKitchenOrdersMock).not.toHaveBeenCalled();
  });

  it("usa la puerta nominal `canOperateKitchen`, no otra", async () => {
    const { GET } = await import("./route");
    await GET(request());

    expect(canOperateKitchenMock).toHaveBeenCalledWith("kitchen");
  });

  it("pasa el alcance por sucursal resuelto al caso de uso (no un segundo scope)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_3", role: "manager", locationIds: ["loc_centro"] },
    });

    const { GET } = await import("./route");
    await GET(request());

    expect(listKitchenOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_centro"] }),
      expect.any(Object),
    );
  });

  it("una sucursal fuera del alcance no la muestra el filtro", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_3", role: "manager", locationIds: ["loc_centro"] },
    });

    const { GET } = await import("./route");
    await GET(request("?locationId=loc_ajena"));

    expect(listKitchenOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_centro"] }),
      expect.any(Object),
    );
  });

  it("el cuerpo no lleva una sola clave financiera, y se afirma sobre las claves reales", async () => {
    const { GET } = await import("./route");
    const response = await GET(request());
    const body = (await response.json()) as { data: Array<Record<string, unknown>> };

    const forbidden = [
      "subtotal",
      "discount",
      "packagingAmount",
      "deliveryFeeAmount",
      "tipAmount",
      "tipRate",
      "total",
      "paidWithAmount",
      "paymentMethod",
      "pickupPin",
      "payments",
      "orderLookupTokenHash",
      "paidAmount",
      "outstandingAmount",
    ];

    for (const order of body.data) {
      for (const key of forbidden) {
        expect(Object.prototype.hasOwnProperty.call(order, key), key).toBe(false);
      }
    }

    // Y el payload **sí** trae lo suyo: la lista de claves es el contrato de la superficie.
    expect(Object.keys(body.data[0]).sort()).toEqual(
      [
        "createdAt",
        "customerName",
        "id",
        "items",
        "location",
        "orderNumber",
        "pickupScheduled",
        "pickupTime",
        "preparingAt",
        "readyAt",
        "source",
        "stageChangedAt",
        "status",
        "type",
      ].sort(),
    );
  });

  it("un filtro con un valor que no existe se descarta en vez de romper la pantalla", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("?status=no-existe&type=no-existe"));

    expect(response.status).toBe(200);
    // Los dos filtros inválidos se caen (quedan sin valor); la cola se lee igual.
    expect(listKitchenOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, type: undefined }),
      expect.any(Object),
    );
  });
});
