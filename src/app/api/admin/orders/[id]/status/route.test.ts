import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageOrderOperationsMock = vi.fn();
const canDeliverOrderMock = vi.fn();
const findOrderByIdMock = vi.fn();
const updateOrderStatusMock = vi.fn();

vi.mock("@/modules/notifications/adapters/outbox-subscriber", () => ({
  registerOutboxEventBusHandlers: vi.fn(),
}));

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () {
    return { findOrderById: findOrderByIdMock };
  }),
}));

vi.mock("@/modules/orders/features/update-order-status/update-order-status", () => ({
  updateOrderStatus: updateOrderStatusMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageOrderOperations: canManageOrderOperationsMock,
  // `TASK-ORDER-POS-OPERATIONAL-006` (brief §19) — la puerta **nominal** de la entrega. El doble la declara
  // porque la autorización de la ruta ahora usa las dos: la gruesa para el flujo completo y la nominal para
  // que el cajero pueda firmar `ready_for_pickup → picked_up`.
  canDeliverOrder: canDeliverOrderMock,
}));

async function patchStatus(id: string, body: unknown) {
  const { PATCH } = await import("./route");
  const response = await PATCH(
    new Request(`http://localhost/api/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

  return { status: response.status, body: await response.json() };
}

/**
 * El pedido que devuelve el repositorio, con los dos campos que la **capacidad de Cocina** necesita para
 * decidir (`TASK-ORDERS-KITCHEN-RUNTIME-002`): el tipo y el estado actual. El adaptador real siempre los
 * trae; un doble que los omita haría fallar la puerta por un dato que en producción existe.
 */
function existingOrder(over: Record<string, unknown>) {
  return { type: "pickup", status: "new", ...over };
}

/**
 * A — el cambio de estado respeta el alcance del usuario.
 *
 * Lo que importa acá es que **no se mute**: un usuario de otra sucursal no puede avanzar un pedido
 * que no le corresponde ni llamando la API a mano.
 */
describe("PATCH /api/admin/orders/[id]/status · alcance por sucursal (A)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canManageOrderOperationsMock.mockReturnValue(true);
    canDeliverOrderMock.mockReturnValue(false);
    updateOrderStatusMock.mockResolvedValue({ data: { id: "ord_1", status: "confirmed" } });
  });

  it("un usuario acotado no puede cambiar el estado de un pedido de otra sucursal", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    findOrderByIdMock.mockResolvedValueOnce(existingOrder({ id: "ord_1", locationId: "loc_sur" }));

    const { status, body } = await patchStatus("ord_1", { status: "confirmed" });

    expect(status).toBe(403);
    expect(body.error.message).toContain("sucursal");
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("un usuario acotado sí cambia el estado de un pedido de su sucursal", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    findOrderByIdMock.mockResolvedValueOnce(existingOrder({ id: "ord_2", locationId: "loc_norte" }));

    const { status } = await patchStatus("ord_2", { status: "confirmed" });

    expect(status).toBe(200);
    expect(updateOrderStatusMock).toHaveBeenCalledWith(
      "ord_2",
      expect.objectContaining({
        status: "confirmed",
        // B5: el cambio queda firmado por quien lo hizo. Con cuentas compartidas, "quién aceptó esto"
        // es la pregunta que se hace después, cuando algo sale mal.
        changedByUserId: "admin_2",
      }),
      expect.anything(),
    );
  });

  it("el dueño cambia el estado de cualquier sucursal", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(existingOrder({ id: "ord_3", locationId: "loc_sur" }));

    const { status } = await patchStatus("ord_3", { status: "confirmed" });

    expect(status).toBe(200);
  });

  it("un pedido que no existe responde 404 sin intentar el cambio", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    findOrderByIdMock.mockResolvedValueOnce(null);

    const { status } = await patchStatus("ord_fantasma", { status: "confirmed" });

    expect(status).toBe(404);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("devuelve 401 sin sesión", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Unauthorized"),
    );

    const { status } = await patchStatus("ord_1", { status: "confirmed" });

    expect(status).toBe(401);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });
});

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §18, §19) — **el cajero entrega y nada más**.
 *
 * El `cashier` no tiene la capacidad **gruesa** (`canManageOrderOperations`), así que la única forma de que
 * pueda cerrar su día desde el POS es la puerta **nominal** de la entrega. Lo que estos casos fijan es que esa
 * puerta **no venga con más de lo que dice**: preparar, cancelar y cerrar siguen rechazados, y una entrega
 * sobre un pedido que no está listo también.
 *
 * El doble de las dos puertas reproduce sus valores reales (`admin-permissions.ts`): gruesa = owner, manager,
 * kitchen; nominal = owner, manager, cashier.
 */
describe("PATCH /api/admin/orders/[id]/status · entrega por el cajero (brief §19)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canManageOrderOperationsMock.mockReturnValue(false);
    canDeliverOrderMock.mockReturnValue(true);
    updateOrderStatusMock.mockResolvedValue({ data: { id: "ord_1", status: "picked_up" } });
  });

  it("el cajero entrega un pedido listo", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_cajera", role: "cashier", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(
      existingOrder({ id: "ord_1", locationId: "loc_norte", status: "ready_for_pickup" }),
    );

    const { status } = await patchStatus("ord_1", { status: "picked_up" });

    expect(status).toBe(200);
    expect(updateOrderStatusMock).toHaveBeenCalledWith(
      "ord_1",
      expect.objectContaining({ status: "picked_up", changedByUserId: "admin_cajera" }),
      expect.anything(),
    );
  });

  it("el cajero NO prepara: la puerta nominal sólo firma la entrega", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_cajera", role: "cashier", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(
      existingOrder({ id: "ord_1", locationId: "loc_norte", status: "confirmed" }),
    );

    const { status } = await patchStatus("ord_1", { status: "preparing" });

    expect(status).toBe(403);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("el cajero NO cancela", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_cajera", role: "cashier", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(
      existingOrder({ id: "ord_1", locationId: "loc_norte", status: "confirmed" }),
    );

    const { status } = await patchStatus("ord_1", { status: "cancelled", note: "se arrepintió" });

    expect(status).toBe(403);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("el cajero NO cierra el pedido", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_cajera", role: "cashier", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(
      existingOrder({ id: "ord_1", locationId: "loc_norte", status: "picked_up" }),
    );

    const { status } = await patchStatus("ord_1", { status: "closed" });

    expect(status).toBe(403);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("entregar un pedido que no está listo se rechaza: la transición depende del estado real", async () => {
    // `preparing → picked_up` no es una transición válida del dominio, y la puerta nominal no la inventa.
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_cajera", role: "cashier", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(
      existingOrder({ id: "ord_1", locationId: "loc_norte", status: "preparing" }),
    );

    const { status } = await patchStatus("ord_1", { status: "picked_up" });

    expect(status).toBe(403);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("cocina no entrega: no tiene ni la gruesa ni la nominal", async () => {
    requireAdminSessionMock.mockReturnValue(false);
    canDeliverOrderMock.mockReturnValue(false);

    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_cocina", role: "kitchen", locationIds: [] },
    });
    findOrderByIdMock.mockResolvedValueOnce(
      existingOrder({ id: "ord_1", locationId: "loc_norte", status: "ready_for_pickup" }),
    );

    const { status } = await patchStatus("ord_1", { status: "picked_up" });

    expect(status).toBe(403);
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });
});
