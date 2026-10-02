import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { ProductRecord } from "@/modules/menu/domain/menu.types";

/**
 * TASK-302 — la ruta del catálogo del punto de venta.
 *
 * Lo que fija: cocina **no** entra (`canUsePOS`), sin local no hay catálogo, y el alcance por
 * sucursal se aplica también acá (un cajero asignado a un local no lee el catálogo de otro). La
 * traducción del menú público al catálogo del POS se prueba en su propio test de módulo; acá se
 * prueba la composición.
 */

const requireAdminSessionMock = vi.fn();
const canUsePOSMock = vi.fn();
const listCatalogMock = vi.fn();
const findLocationByIdMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canUsePOS: canUsePOSMock,
}));

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` — la composición del catálogo se movió a
 * `catalog/pos-catalog-composition.ts` (tope de 50 líneas del handler). El doble del **puerto** es el que
 * ahora ejerce la ruta: `getCatalog` ya no se llama desde acá.
 */
vi.mock("@/modules/pos/adapters/production-pos-catalog", () => ({
  createProductionPosCatalog: () => ({ listCatalog: listCatalogMock }),
}));

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37) — el catálogo publica los **medios configurados** del local.
 * El doble evita que el unitario dependa de la base: el job `verify` del CI no tiene `DATABASE_URL`.
 */
const configuredPaymentMethodsMock = vi.fn();

vi.mock("@/modules/pos/adapters/production-configured-payment-methods", () => ({
  createProductionConfiguredPaymentMethods: () => ({
    listPaymentMethods: configuredPaymentMethodsMock,
  }),
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

// TASK-308: la ruta resuelve el local y después pregunta si el POS está prendido ahí. El doble
// devuelve la fila que el test arme, para poder probar el local apagado sin tocar la base.
vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { findLocationById: findLocationByIdMock },
  }),
}));

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`) — la ruta publica el **contexto monetario** y las
 * monedas aceptadas junto con el catálogo. El doble evita que el unitario dependa de una base: el job
 * `verify` del CI no tiene `DATABASE_URL`.
 */
vi.mock("@/modules/money/adapters/production-money-context", () => ({
  readProductionMoney: async () => ({
    context: {
      baseCurrencyCode: "NIO",
      locale: "es-NI",
      rates: { USD: 36.5 },
      knownCurrencyCodes: ["NIO", "USD"],
    },
    currencies: [
      { code: "NIO", name: "Córdoba", symbol: "C$", decimals: 2, isBase: true },
      { code: "USD", name: "Dólar", symbol: "US$", decimals: 2, isBase: false },
    ],
  }),
}));

function product(over: Partial<ProductRecord> & { id: string; name: string }): ProductRecord {
  return {
    categoryId: "cat_tacos",
    subcategoryId: null,
    description: null,
    basePrice: 35,
    packagingFeeAmount: null,
    images: [],
    availability: { isAvailable: true, isActive: true },
    modifierGroups: [],
    bundleRules: [],
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
    ...over,
  };
}

async function callRoute(query: string) {
  const { GET } = await import("./route");

  return GET(new Request(`http://localhost/api/admin/pos/catalog${query}`));
}

/** La vista del catálogo tal como la devuelve el caso de uso del POS (productos con su categoría). */
function catalogView(query: string) {
  return {
    products: [
      { ...product({ id: "prod_taco", name: "Taco de birria" }), requiresOptions: false, categoryName: "Tacos" },
      {
        ...product({ id: "prod_cola", name: "Cola", basePrice: 25 }),
        requiresOptions: false,
        categoryName: "Tacos",
      },
    ],
    categories: [{ id: "cat_tacos", name: "Tacos", count: 2 }],
    total: 2,
    query,
  };
}

describe("admin pos catalog route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canUsePOSMock.mockReturnValue(true);
    listCatalogMock.mockImplementation(async ({ query }: { query: string }) => catalogView(query));
    configuredPaymentMethodsMock.mockResolvedValue([]);
    findLocationByIdMock.mockResolvedValue({ id: "loc_norte", posEnabled: true });
  });

  it("sin sesión responde 401 (no arma el catálogo)", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    const response = await callRoute("?locationId=loc_norte");

    expect(response.status).toBe(401);
    expect(listCatalogMock).not.toHaveBeenCalled();
  });

  it("cocina no usa el punto de venta: 403", async () => {
    canUsePOSMock.mockReturnValue(false);

    const response = await callRoute("?locationId=loc_norte");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listCatalogMock).not.toHaveBeenCalled();
  });

  it("sin local pedido responde 400 con el campo señalado", async () => {
    const response = await callRoute("");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.fields.locationId).toBeTruthy();
  });

  it("devuelve el catálogo del local con los agotados incluidos y los chips de categoría", async () => {
    const response = await callRoute("?locationId=loc_norte");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listCatalogMock).toHaveBeenCalledWith({ locationId: "loc_norte", query: "" });
    expect(body.data.products.map((item: { id: string }) => item.id)).toEqual([
      "prod_taco",
      "prod_cola",
    ]);
    expect(body.data.total).toBe(2);
    // La vista es `PosCatalogProduct extends ProductRecord`: el precio del local viaja en `basePrice`
    // (no en un campo paralelo) y la categoría con su contador viene armada del servidor.
    expect(body.data.products[0].basePrice).toBe(35);
    expect(body.data.products[0]).not.toHaveProperty("price");
    expect(body.data.products[0].requiresOptions).toBe(false);
    expect(body.data.categories).toEqual([{ id: "cat_tacos", name: "Tacos", count: 2 }]);
  });

  it("publica el contexto de `money`, las monedas aceptadas y los medios configurados del local", async () => {
    // `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §40): es lo que el POS necesita para cobrar con el
    // catálogo real, y viaja en la **misma** respuesta del **mismo** local.
    configuredPaymentMethodsMock.mockResolvedValue([
      {
        id: "pm_cash",
        name: "Efectivo",
        kind: "cash",
        entityId: null,
        currencyCodes: [],
        requiresReference: false,
        isActive: true,
        locations: [],
      },
      {
        id: "pm_solo_sur",
        name: "Zelle",
        kind: "wallet",
        entityId: null,
        currencyCodes: ["USD"],
        requiresReference: true,
        isActive: true,
        locations: [{ locationId: "loc_sur", isActive: true }],
      },
    ]);

    const body = await (await callRoute("?locationId=loc_norte")).json();

    expect(body.money.baseCurrencyCode).toBe("NIO");
    expect(body.acceptedCurrencies).toEqual(["NIO", "USD"]);
    // El medio de la otra sucursal **no** se ofrece acá: la disponibilidad la aplica el dominio de `payments`.
    expect(body.paymentMethods.map((method: { id: string }) => method.id)).toEqual(["pm_cash"]);
  });

  it("le pasa la búsqueda al caso de uso: la ruta no filtra", async () => {
    const response = await callRoute("?locationId=loc_norte&query=cola");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listCatalogMock).toHaveBeenCalledWith({ locationId: "loc_norte", query: "cola" });
    // El filtro vive en el caso de uso (`get-catalog.test.ts`); acá se devuelve lo que él trajo.
    expect(body.data.query).toBe("cola");
  });

  it("un local fuera del alcance del staff responde 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "cashier", locationIds: ["loc_norte"] },
    });

    const response = await callRoute("?locationId=loc_sur");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.fields.locationId).toContain("acceso");
    expect(listCatalogMock).not.toHaveBeenCalled();
  });

  // TASK-308: el local con el POS apagado no lee el catálogo ni por URL directa.
  it("un local con el punto de venta apagado responde 403", async () => {
    findLocationByIdMock.mockResolvedValue({ id: "loc_norte", posEnabled: false });

    const response = await callRoute("?locationId=loc_norte");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listCatalogMock).not.toHaveBeenCalled();
  });
});
