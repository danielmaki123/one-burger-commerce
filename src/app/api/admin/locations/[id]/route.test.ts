import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { LocationError } from "@/modules/locations/domain/location-errors";

/**
 * T8 fase 2 — API de un local.
 *
 * Igual que las promos: el PATCH recibe el local **completo**, que es lo que manda el
 * formulario. Un campo que falta es un error de la pantalla, no un borrado silencioso.
 */
const requireAdminSessionMock = vi.fn();
const canManageBusinessSettingsMock = vi.fn();
const updateLocationMock = vi.fn();
const deleteLocationMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageBusinessSettings: canManageBusinessSettingsMock,
}));

vi.mock("@/modules/locations/features/update-location/update-location", () => ({
  updateLocation: updateLocationMock,
}));

vi.mock("@/modules/locations/features/delete-location/delete-location", () => ({
  deleteLocation: deleteLocationMock,
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
}));

const payload = {
  name: "Sucursal Norte",
  slug: "sucursal-norte",
  isActive: false,
  sortOrder: 1,
  addressLine: null,
  city: null,
  addressReference: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  phone: null,
  whatsapp: null,
  businessHours: {
    mon: { open: "12:00", close: "22:00", closed: false },
    tue: { open: "12:00", close: "22:00", closed: false },
    wed: { open: "12:00", close: "22:00", closed: false },
    thu: { open: "12:00", close: "22:00", closed: false },
    fri: { open: "12:00", close: "22:00", closed: false },
    sat: { open: "12:00", close: "22:00", closed: false },
    sun: { open: "12:00", close: "22:00", closed: false },
  },
  pickupLeadMinutes: 25,
  pickupMaxMinutes: null,
  isAcceptingOrders: true,
  closedMessage: null,
};

const params = Promise.resolve({ id: "loc_norte" });

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/locations/loc_norte", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin location detail route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("PATCH returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(401);
  });

  it("PATCH returns 403 cuando el rol no puede cambiar la configuración", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "manager" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(false);

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(403);
    expect(updateLocationMock).not.toHaveBeenCalled();
  });

  it("PATCH returns 200 y actualiza el local completo", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    updateLocationMock.mockResolvedValueOnce({
      data: { id: "loc_norte", isActive: false },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.isActive).toBe(false);
    expect(updateLocationMock).toHaveBeenCalledWith(
      "loc_norte",
      expect.objectContaining({ slug: "sucursal-norte" }),
      { repository: expect.anything() },
    );
  });

  it("PATCH returns 404 cuando el local no existe", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    updateLocationMock.mockRejectedValueOnce(new LocationError(404, "NOT_FOUND", "Location not found"));

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(404);
  });

  it("DELETE returns 200 y confirma el id borrado", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    deleteLocationMock.mockResolvedValueOnce({
      data: { id: "loc_norte" },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("loc_norte");
  });

  it("DELETE returns 409 cuando es el último local activo", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    deleteLocationMock.mockRejectedValueOnce(
      new LocationError(409, "CONFLICT", "Cannot delete the last active location", {
        id: "Este es el último local activo",
      }),
    );

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error.fields.id).toContain("último local activo");
  });

  it("DELETE returns 403 cuando el rol no puede cambiar la configuración", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "kitchen" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(false);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });

    expect(response.status).toBe(403);
    expect(deleteLocationMock).not.toHaveBeenCalled();
  });
});
