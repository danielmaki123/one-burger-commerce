import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canViewOrdersMock = vi.fn();
const listAdminOrdersMock = vi.fn();
const loadOrderListContextMock = vi.fn();

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

vi.mock("./order-list-context", () => ({
  loadOrderListContext: loadOrderListContextMock,
  listAdminOrderRepositories: () => ({ repository: {}, locationRepository: {} }),
}));

vi.mock("@/modules/orders/features/list-admin-orders/list-admin-orders", () => ({
  listAdminOrders: listAdminOrdersMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canViewOrders: canViewOrdersMock,
}));

async function listOrders(url: string) {
  const { GET } = await import("./route");
  const response = await GET(new Request(url));

  return { status: response.status, body: await response.json() };
}

const EMPTY_RESULT = {
  data: [],
  meta: { page: 1, pageSize: 25, total: 0 },
  kpi: { total: 0, active: 0, pendingPayment: 0, scheduled: 0 },
};

const ALL_SCOPE_CONTEXT = {
  scope: { kind: "all" },
  locationScope: null,
  timeZone: "America/Managua",
  baseCurrencyCode: "NIO",
};

/**
 * `GET /api/admin/orders` — **el listado administrativo**: quién entra, qué filtros aplica y qué devuelve.
 *
 * Tres cosas que la ruta vieja no cumplía y que estos casos fijan:
 *
 * 1. **La puerta es `canViewOrders`** (`D-014`): el `cashier` entra —es quien tiene que localizar el pedido
 *    que va a cobrar— y el `kitchen` recibe **403** (su superficie es `/admin/kitchen`). La ruta vieja
 *    usaba `canManageOrderOperations`, que hacía exactamente lo contrario (`A-66`).
 * 2. **Los siete filtros de la URL se aplican de verdad**: `search`, `date`, `location`, `status`,
 *    `payment`, `scheduled` y `page`. El filtro por local ya había viajado ignorado una vez; acá se afirma
 *    que lo que se pide es lo que se aplica.
 * 3. **La respuesta no proyecta de más**: sin `orderLookupTokenHash` ni GPS (`A-61`). Lo que el caso de uso
 *    devuelve se pasa tal cual, y el caso de uso ya proyecta lo mínimo.
 */
describe("GET /api/admin/orders · la puerta (D-014, A-66)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canViewOrdersMock.mockReturnValue(true);
    loadOrderListContextMock.mockResolvedValue(ALL_SCOPE_CONTEXT);
    listAdminOrdersMock.mockResolvedValue(EMPTY_RESULT);
  });

  it("usa `canViewOrders`, no la puerta gruesa de pedidos", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_4", role: "cashier", locationIds: [] },
    });

    const { status } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(200);
    expect(canViewOrdersMock).toHaveBeenCalledWith("cashier");
  });

  it("el cajero **entra**: es quien localiza el pedido que va a cobrar", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_4", role: "cashier", locationIds: [] },
    });

    const { status, body } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(listAdminOrdersMock).toHaveBeenCalled();
  });

  it("cocina recibe 403 y el caso de uso no se llama", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_5", role: "kitchen", locationIds: [] },
    });
    canViewOrdersMock.mockReturnValueOnce(false);

    const { status } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(403);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });

  it("devuelve 401 sin sesión", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Unauthorized"),
    );

    const { status } = await listOrders("http://localhost/api/admin/orders");

    expect(status).toBe(401);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/orders · el contexto de la sesión", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canViewOrdersMock.mockReturnValue(true);
    listAdminOrdersMock.mockResolvedValue(EMPTY_RESULT);
  });

  it("el alcance del usuario entra como filtro del caso de uso", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "manager", locationIds: ["loc_norte"] },
    });
    loadOrderListContextMock.mockResolvedValueOnce({
      scope: { kind: "restricted", locationIds: ["loc_norte"] },
      locationScope: ["loc_norte"],
      timeZone: "America/Managua",
      baseCurrencyCode: "NIO",
    });

    await listOrders("http://localhost/api/admin/orders");

    expect(loadOrderListContextMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "manager", locationIds: ["loc_norte"] }),
    );
    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_norte"] }),
      expect.anything(),
    );
  });

  it("el dueño filtra por la sucursal que pide", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });
    loadOrderListContextMock.mockResolvedValueOnce(ALL_SCOPE_CONTEXT);

    await listOrders("http://localhost/api/admin/orders?locationId=loc_sur");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_sur"] }),
      expect.anything(),
    );
  });

  it("declara el alcance del usuario en `meta` para que la pantalla no lo reimplemente", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "manager", locationIds: ["loc_norte", "loc_sur"] },
    });
    loadOrderListContextMock.mockResolvedValueOnce({
      scope: { kind: "restricted", locationIds: ["loc_norte", "loc_sur"] },
      locationScope: ["loc_norte", "loc_sur"],
      timeZone: "America/Managua",
      baseCurrencyCode: "NIO",
    });

    const { body } = await listOrders("http://localhost/api/admin/orders");

    expect(body.meta.locationScope).toEqual(["loc_norte", "loc_sur"]);
  });

  it("el dueño no queda acotado: su alcance viaja como `null` (= todas)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: ["loc_norte"] },
    });
    loadOrderListContextMock.mockResolvedValueOnce(ALL_SCOPE_CONTEXT);

    const { body } = await listOrders("http://localhost/api/admin/orders");

    expect(body.meta.locationScope).toBeNull();
  });

  it("la moneda base del contexto es la que usa el caso de uso (sale de `money`)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });
    loadOrderListContextMock.mockResolvedValueOnce(ALL_SCOPE_CONTEXT);

    await listOrders("http://localhost/api/admin/orders");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ baseCurrencyCode: "NIO" }),
    );
  });
});

describe("GET /api/admin/orders · los filtros de la URL", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canViewOrdersMock.mockReturnValue(true);
    loadOrderListContextMock.mockResolvedValue(ALL_SCOPE_CONTEXT);
    listAdminOrdersMock.mockResolvedValue(EMPTY_RESULT);
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });
  });

  it("pasa la búsqueda recortada y el pago al caso de uso", async () => {
    await listOrders("http://localhost/api/admin/orders?search=%20ana%20&payment=pending");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ana", payment: "pending" }),
      expect.anything(),
    );
  });

  it("traduce el preset de fecha a una ventana del día del negocio", async () => {
    await listOrders("http://localhost/api/admin/orders?date=today");

    const [filter] = listAdminOrdersMock.mock.calls[0];
    expect(filter.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(filter.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(filter.dateFrom).getTime()).toBeLessThan(new Date(filter.dateTo).getTime());
  });

  it("traduce el grupo de estado a la lista de estados del esquema", async () => {
    await listOrders("http://localhost/api/admin/orders?status=ready");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ["ready", "ready_for_pickup"] }),
      expect.anything(),
    );
  });

  it("`scheduled=1` filtra los programados", async () => {
    await listOrders("http://localhost/api/admin/orders?scheduled=1");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledOnly: true }),
      expect.anything(),
    );
  });

  it("sin `scheduled` no filtra", async () => {
    await listOrders("http://localhost/api/admin/orders");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledOnly: false }),
      expect.anything(),
    );
  });

  it("pasa la página y el tamaño de página", async () => {
    await listOrders("http://localhost/api/admin/orders?page=3&pageSize=50");

    expect(listAdminOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, pageSize: 50 }),
      expect.anything(),
    );
  });

  it("un filtro con un valor inválido se rechaza con 400 y no llega a la base", async () => {
    const { status } = await listOrders("http://localhost/api/admin/orders?status=inventado");

    expect(status).toBe(400);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });

  it("rechaza una búsqueda desmedida en vez de pasarla a la base", async () => {
    const { status } = await listOrders(
      `http://localhost/api/admin/orders?search=${"a".repeat(200)}`,
    );

    expect(status).toBe(400);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });

  it("rechaza un tamaño de página más grande que el techo", async () => {
    const { status } = await listOrders("http://localhost/api/admin/orders?pageSize=5000");

    expect(status).toBe(400);
    expect(listAdminOrdersMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/orders · la proyección de la respuesta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    canViewOrdersMock.mockReturnValue(true);
    loadOrderListContextMock.mockResolvedValue(ALL_SCOPE_CONTEXT);
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "owner", locationIds: [] },
    });
  });

  it("devuelve `data`, `meta` y `kpi` tal como los resolvió el caso de uso", async () => {
    listAdminOrdersMock.mockResolvedValueOnce({
      data: [
        {
          id: "ord_1",
          orderNumber: "P-1",
          source: "pos",
          customerName: "Ana",
          customerWhatsapp: "+50588887777",
          locationName: "Principal",
          pickupTime: null,
          pickupScheduled: false,
          status: "preparing",
          stageChangedAt: "2026-09-30T18:24:00.000Z",
          total: 350,
          currencyCode: "NIO",
          financialState: {
            status: "partial",
            paidAmount: 100,
            outstandingAmount: 250,
            unresolvedAmount: 0,
            baseCurrencyCode: "NIO",
          },
        },
      ],
      meta: { page: 2, pageSize: 10, total: 30 },
      kpi: { total: 30, active: 4, pendingPayment: 3, scheduled: 2 },
    });

    const { status, body } = await listOrders("http://localhost/api/admin/orders?page=2&pageSize=10");

    expect(status).toBe(200);
    expect(body.meta).toMatchObject({ page: 2, pageSize: 10, total: 30 });
    expect(body.kpi).toEqual({ total: 30, active: 4, pendingPayment: 3, scheduled: 2 });
    expect(body.data[0].financialState.status).toBe("partial");
  });

  /**
   * `A-61` — la respuesta **no** puede llevar el token de consulta del cliente ni los campos de GPS. La
   * proyección los deja afuera en el caso de uso, y este caso fija que la ruta no los reintroduzca al
   * esparcir la respuesta.
   */
  it("no serializa el token de consulta ni el GPS", async () => {
    listAdminOrdersMock.mockResolvedValueOnce({
      data: [{ id: "ord_1", orderNumber: "P-1", financialState: { status: "pending" } }],
      meta: { page: 1, pageSize: 25, total: 1 },
      kpi: { total: 1, active: 1, pendingPayment: 1, scheduled: 0 },
    });

    const { body } = await listOrders("http://localhost/api/admin/orders");
    const serialized = JSON.stringify(body);

    for (const forbidden of [
      "orderLookupTokenHash",
      "customerLat",
      "customerLng",
      "geoAccuracy",
      "geoCapturedAt",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
