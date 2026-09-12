import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

/**
 * T8 fase 4 — el catálogo de un local (lectura).
 *
 * Devuelve **todos** los productos del negocio con la excepción del local al lado, así la
 * pantalla puede mostrar el precio base y el del local, y marcar lo que el local no vende.
 */
const requireAdminSessionMock = vi.fn();
const listLocationCatalogMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock(
  "@/modules/locations/features/list-location-catalog/list-location-catalog",
  () => ({ listLocationCatalog: listLocationCatalogMock }),
);

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

const params = Promise.resolve({ id: "loc_norte" });

describe("admin location catalog route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params });

    expect(response.status).toBe(401);
  });

  it("GET devuelve el catálogo del local con su resumen", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "manager" } });
    listLocationCatalogMock.mockResolvedValueOnce({
      data: [{ productId: "prod_1", name: "Taco", price: 40, isSold: true }],
      meta: { total: 1, sold: 1, unavailable: 0, overridden: 1 },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data[0].price).toBe(40);
    expect(json.meta.overridden).toBe(1);
    expect(listLocationCatalogMock).toHaveBeenCalledWith("loc_norte", {
      locationRepository: expect.anything(),
      menuRepository: expect.anything(),
    });
  });

  it("GET returns 404 cuando el local no existe", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    const { LocationError } = await import("@/modules/locations/domain/location-errors");
    listLocationCatalogMock.mockRejectedValueOnce(
      new LocationError(404, "NOT_FOUND", "Location not found"),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params });

    expect(response.status).toBe(404);
  });
});
