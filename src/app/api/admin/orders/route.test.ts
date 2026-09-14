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

  /**
   * B4 — la búsqueda y la forma de pago llegan al caso de uso tal cual vinieron.
   *
   * Es el mismo agujero que tuvo el filtro por local (viajaba en la query y la ruta lo ignoraba): acá
   * se afirma que lo que se pide es lo que se aplica.
   */
  it("pasa la búsqueda recortada y la forma de pago al caso de uso (B4)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });

    const { status } = await listOrders(
      "http://localhost/api/admin/orders?search=%20ana%20&paymentMethod=cash",
    );

    expect(status).toBe(200);
    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ana", paymentMethod: "cash" }),
      expect.anything(),
    );
  });

  it("rechaza una búsqueda desmedida en vez de pasarla a la base (B4)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });

    const { status } = await listOrders(
      `http://localhost/api/admin/orders?search=${"a".repeat(200)}`,
    );

    expect(status).toBe(400);
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

  /**
   * B3 — la comanda se dibuja con lo que devuelve esta ruta.
   *
   * La respuesta se arma esparciendo el resultado del caso de uso, así que es una guarda: el día que
   * alguien mapee los campos "para no mandar de más" y se olvide de los ítems o del sello de la etapa,
   * la pantalla se queda sin lo que necesita y el test lo dice.
   */
  it("la respuesta lleva los ítems con sus modificadores y el sello de la etapa (B3)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });
    listAdminOrdersMock.mockResolvedValueOnce({
      data: [
        {
          id: "ord_1",
          orderNumber: "P-1",
          status: "preparing",
          stageChangedAt: "2026-09-12T18:24:00.000Z",
          locationName: "Principal",
          items: [
            {
              id: "item_1",
              productName: "Doble",
              quantity: 2,
              notes: "sin cebolla",
              modifiers: [{ name: "Término medio" }],
            },
          ],
        },
      ],
      meta: { count: 1 },
    });

    const { status, body } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(200);
    expect(body.data[0].stageChangedAt).toBe("2026-09-12T18:24:00.000Z");
    expect(body.data[0].items[0]).toMatchObject({
      productName: "Doble",
      quantity: 2,
      notes: "sin cebolla",
    });
    expect(body.data[0].items[0].modifiers[0].name).toBe("Término medio");
  });
});
