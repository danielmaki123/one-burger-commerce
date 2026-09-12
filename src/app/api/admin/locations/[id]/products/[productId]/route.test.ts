import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { LocationError } from "@/modules/locations/domain/location-errors";

/**
 * T8 fase 4 — el precio y la disponibilidad de un producto en un local.
 *
 * El PUT manda el estado completo del producto en ese local; "volver al precio base" es
 * mandar `priceOverride: null` con el producto vendible y disponible, y el caso de uso se
 * encarga de borrar la excepción.
 */
const requireAdminSessionMock = vi.fn();
const canManageBusinessSettingsMock = vi.fn();
const setLocationProductMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageBusinessSettings: canManageBusinessSettingsMock,
}));

vi.mock("@/modules/locations/features/set-location-product/set-location-product", () => ({
  setLocationProduct: setLocationProductMock,
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

const params = Promise.resolve({ id: "loc_norte", productId: "prod_1" });
const payload = { priceOverride: 40, isAvailable: true, isActive: true };

function putRequest(body: unknown) {
  return new Request("http://localhost/api/admin/locations/loc_norte/products/prod_1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin location product route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("PUT returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { PUT } = await import("./route");
    const response = await PUT(putRequest(payload), { params });

    expect(response.status).toBe(401);
  });

  it("PUT returns 403 cuando el rol no puede cambiar la configuración", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "manager" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(false);

    const { PUT } = await import("./route");
    const response = await PUT(putRequest(payload), { params });

    expect(response.status).toBe(403);
    expect(setLocationProductMock).not.toHaveBeenCalled();
  });

  it("PUT returns 200 y guarda la excepción del local", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    setLocationProductMock.mockResolvedValueOnce({
      data: { locationId: "loc_norte", productId: "prod_1", priceOverride: 40 },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { PUT } = await import("./route");
    const response = await PUT(putRequest(payload), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.priceOverride).toBe(40);
    expect(setLocationProductMock).toHaveBeenCalledWith("loc_norte", "prod_1", payload, {
      locationRepository: expect.anything(),
      menuRepository: expect.anything(),
    });
  });

  it("PUT returns 422 con el campo señalado cuando el precio no sirve", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    setLocationProductMock.mockRejectedValueOnce(
      new LocationError(422, "VALIDATION_ERROR", "Invalid payload", {
        priceOverride: "El precio no puede ser negativo",
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(putRequest({ ...payload, priceOverride: -1 }), { params });
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error.fields.priceOverride).toContain("negativo");
  });

  it("PUT returns 400 cuando el payload no tiene forma", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);

    const { PUT } = await import("./route");
    const response = await PUT(putRequest({ priceOverride: "caro" }), { params });

    expect(response.status).toBe(400);
    expect(setLocationProductMock).not.toHaveBeenCalled();
  });

  it("PUT returns 404 cuando el producto no existe en el negocio", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    setLocationProductMock.mockRejectedValueOnce(
      new LocationError(404, "NOT_FOUND", "Product not found"),
    );

    const { PUT } = await import("./route");
    const response = await PUT(putRequest(payload), { params });

    expect(response.status).toBe(404);
  });
});
