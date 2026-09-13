import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageOrderOperationsMock = vi.fn();
const listAdminOrdersMock = vi.fn();

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

vi.mock("@/modules/orders/features/list-admin-orders/list-admin-orders", () => ({
  listAdminOrders: listAdminOrdersMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageOrderOperations: canManageOrderOperationsMock,
}));

async function listOrders(url: string) {
  const { GET } = await import("./route");
  const response = await GET(new Request(url));

  return { status: response.status, body: await response.json() };
}

/**
 * La bandeja de pedidos: el filtro por local **de verdad** y el alcance del usuario.
 *
 * Estos casos existen porque el filtro por local viajaba al servidor desde T8 y la ruta nunca lo
 * leía: el control era decorativo y ningún test lo miraba (los unitarios probaban la pantalla y el
 * E2E pasaba por una carrera de carga). Acá se prueba la ruta, que es donde estaba el agujero.
 */
describe("GET /api/admin/orders · alcance por sucursal (A)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canManageOrderOperationsMock.mockReturnValue(true);
    listAdminOrdersMock.mockResolvedValue({ data: [], meta: { count: 0 } });
  });

  it("el dueño filtra por la sucursal que pide", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });

    const { status } = await listOrders(
      "http://localhost/api/admin/orders?locationId=loc_sur",
    );

    expect(status).toBe(200);
    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_sur"] }),
      expect.anything(),
    );
  });

  it("un usuario acotado no puede ver una sucursal ajena ni pidiéndola por query", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });

    const { status } = await listOrders(
      "http://localhost/api/admin/orders?locationId=loc_sur",
    );

    expect(status).toBe(200);
    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_norte"] }),
      expect.anything(),
    );
  });

  it("un usuario acotado puede pedir una de sus sucursales", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte", "loc_sur"] },
    });

    await listOrders("http://localhost/api/admin/orders?locationId=loc_sur");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_sur"] }),
      expect.anything(),
    );
  });

  it("un usuario sin asignar ve todas (sin filtro)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_3", role: "kitchen", locationIds: [] },
    });

    await listOrders("http://localhost/api/admin/orders");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: undefined }),
      expect.anything(),
    );
  });

  it("el dueño sin filtro tampoco queda acotado", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: ["loc_norte"] },
    });

    await listOrders("http://localhost/api/admin/orders");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: undefined }),
      expect.anything(),
    );
  });

  it("devuelve 401 sin sesión", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Unauthorized"),
    );

    const { status } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(401);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });

  it("devuelve 403 cuando el rol no maneja pedidos", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_4", role: "viewer", locationIds: [] },
    });
    canManageOrderOperationsMock.mockReturnValueOnce(false);

    const { status } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(403);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });
});
