import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { ProductRecord, PublicMenuCategory } from "@/modules/menu/domain/menu.types";

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
const getPublicMenuMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canUsePOS: canUsePOSMock,
}));

vi.mock("@/modules/menu/features/get-public-menu/get-public-menu", () => ({
  getPublicMenu: getPublicMenuMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
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

const menu: { categories: PublicMenuCategory[] } = {
  categories: [
    {
      id: "cat_tacos",
      name: "Tacos",
      slug: "tacos",
      sortOrder: 0,
      color: null,
      subcategories: [],
      products: [
        product({ id: "prod_taco", name: "Taco de birria" }),
        product({ id: "prod_cola", name: "Cola", basePrice: 25 }),
      ],
    },
  ],
};

async function callRoute(query: string) {
  const { GET } = await import("./route");

  return GET(new Request(`http://localhost/api/admin/pos/catalog${query}`));
}

describe("admin pos catalog route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canUsePOSMock.mockReturnValue(true);
    getPublicMenuMock.mockResolvedValue(menu);
  });

  it("sin sesión responde 401 (no arma el catálogo)", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    const response = await callRoute("?locationId=loc_norte");

    expect(response.status).toBe(401);
    expect(getPublicMenuMock).not.toHaveBeenCalled();
  });

  it("cocina no usa el punto de venta: 403", async () => {
    canUsePOSMock.mockReturnValue(false);

    const response = await callRoute("?locationId=loc_norte");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(getPublicMenuMock).not.toHaveBeenCalled();
  });

  it("sin local pedido responde 400 con el campo señalado", async () => {
    const response = await callRoute("");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.fields.locationId).toBeTruthy();
  });

  it("devuelve el catálogo del local con precios resueltos y sin consulta", async () => {
    const response = await callRoute("?locationId=loc_norte");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPublicMenuMock).toHaveBeenCalledWith(
      { locationId: "loc_norte" },
      expect.objectContaining({
        repository: expect.anything(),
        locationRepository: expect.anything(),
      }),
    );
    expect(body.data.products.map((item: { id: string }) => item.id)).toEqual([
      "prod_taco",
      "prod_cola",
    ]);
    expect(body.data.total).toBe(2);
  });

  it("busca por nombre en la misma llamada (el filtro es del caso de uso)", async () => {
    const response = await callRoute("?locationId=loc_norte&query=cola");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.products.map((item: { id: string }) => item.id)).toEqual(["prod_cola"]);
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
    expect(getPublicMenuMock).not.toHaveBeenCalled();
  });
});
