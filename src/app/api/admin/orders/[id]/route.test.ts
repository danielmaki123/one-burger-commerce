import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canViewOrdersMock = vi.fn();
const loadOrderDetailForSessionMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canViewOrders: canViewOrdersMock,
}));

vi.mock("./order-detail-composition", () => ({
  loadOrderDetailForSession: loadOrderDetailForSessionMock,
}));

async function getOrder(id = "ord_1") {
  const { GET } = await import("./route");
  const response = await GET(new Request(`http://localhost/api/admin/orders/${id}`), {
    params: Promise.resolve({ id }),
  });

  return { status: response.status, body: await response.json() };
}

/**
 * `GET /api/admin/orders/[id]` — la puerta del **detalle**.
 *
 * Lo que cambia con `TASK-ORDERS-RUNTIME-5B` (`A-60`, `A-66`):
 *
 * 1. La puerta es **`canViewOrders`**: el `cashier` entra (localiza el pedido que va a cobrar) y el
 *    `kitchen` recibe **403** — su superficie es `/admin/kitchen`, y el detalle de Pedidos le mostraba
 *    montos, PIN, cobros y factura.
 * 2. El alcance por sucursal y el recorte financiero se aplican **dentro de la composición**, antes de
 *    proyectar: la ruta no puede olvidarse de ninguno de los dos porque no arma la respuesta.
 */
describe("GET /api/admin/orders/[id] · la puerta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canViewOrdersMock.mockReturnValue(true);
    loadOrderDetailForSessionMock.mockResolvedValue({ id: "ord_1", locationId: "loc_1" });
  });

  it("devuelve el detalle proyectado y le pasa la sesión a la composición", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "cashier", locationIds: ["loc_1"] },
    });

    const { status, body } = await getOrder();

    expect(status).toBe(200);
    expect(body.data.id).toBe("ord_1");
    expect(loadOrderDetailForSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ord_1", role: "cashier", assignedLocationIds: ["loc_1"] }),
    );
  });

  it("usa `canViewOrders`, no la puerta gruesa de pedidos", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "manager", locationIds: [] },
    });

    await getOrder();

    expect(canViewOrdersMock).toHaveBeenCalledWith("manager");
  });

  it("cocina recibe 403 en el detalle y no se proyecta nada", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_5", role: "kitchen", locationIds: [] },
    });
    canViewOrdersMock.mockReturnValueOnce(false);

    const { status } = await getOrder();

    expect(status).toBe(403);
    expect(loadOrderDetailForSessionMock).not.toHaveBeenCalled();
  });

  it("devuelve 401 sin sesión", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Unauthorized"),
    );

    const { status } = await getOrder();

    expect(status).toBe(401);
  });

  it("la respuesta no se cachea: el saldo y el estado cambian", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/orders/ord_1"), {
      params: Promise.resolve({ id: "ord_1" }),
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
