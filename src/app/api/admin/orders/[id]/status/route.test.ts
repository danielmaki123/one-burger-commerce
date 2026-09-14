import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageOrderOperationsMock = vi.fn();
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
 * A — el cambio de estado respeta el alcance del usuario.
 *
 * Lo que importa acá es que **no se mute**: un usuario de otra sucursal no puede avanzar un pedido
 * que no le corresponde ni llamando la API a mano.
 */
describe("PATCH /api/admin/orders/[id]/status · alcance por sucursal (A)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canManageOrderOperationsMock.mockReturnValue(true);
    updateOrderStatusMock.mockResolvedValue({ data: { id: "ord_1", status: "confirmed" } });
  });

  it("un usuario acotado no puede cambiar el estado de un pedido de otra sucursal", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    findOrderByIdMock.mockResolvedValueOnce({ id: "ord_1", locationId: "loc_sur" });

    const { status, body } = await patchStatus("ord_1", { status: "confirmed" });

    expect(status).toBe(403);
    expect(body.error.message).toContain("sucursal");
    expect(updateOrderStatusMock).not.toHaveBeenCalled();
  });

  it("un usuario acotado sí cambia el estado de un pedido de su sucursal", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    findOrderByIdMock.mockResolvedValueOnce({ id: "ord_2", locationId: "loc_norte" });

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
    findOrderByIdMock.mockResolvedValueOnce({ id: "ord_3", locationId: "loc_sur" });

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
