import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

/**
 * T8 fase 2 — API de locales.
 *
 * Lee cualquier admin con sesión (la lista la usa la pantalla de locales y la de pedidos),
 * pero escribir locales es configuración del negocio: **solo el owner**, igual que
 * `/admin/settings`.
 */
const requireAdminSessionMock = vi.fn();
const canManageBusinessSettingsMock = vi.fn();
const listLocationsMock = vi.fn();
const createLocationMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageBusinessSettings: canManageBusinessSettingsMock,
}));

vi.mock("@/modules/locations/features/create-location/create-location", () => ({
  createLocation: createLocationMock,
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {
    async listLocations() {
      return listLocationsMock();
    }
  },
}));

const validPayload = {
  name: "Sucursal Norte",
  slug: "sucursal-norte",
  isActive: true,
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

function postRequest(body: unknown) {
  return new Request("http://localhost/api/admin/locations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin locations route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET devuelve los locales con su horario normalizado", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "manager" } });
    listLocationsMock.mockResolvedValueOnce([
      { id: "loc_principal", name: "Principal", slug: "principal" },
    ]);

    const { GET } = await import("./route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("loc_principal");
    // Un manager puede ver los locales aunque no pueda cambiarlos.
    expect(canManageBusinessSettingsMock).not.toHaveBeenCalled();
  });

  it("POST returns 403 when the role cannot change business settings", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "manager" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(postRequest(validPayload));

    expect(response.status).toBe(403);
    expect(createLocationMock).not.toHaveBeenCalled();
  });

  it("POST returns 201 y pasa el payload validado al caso de uso", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    createLocationMock.mockResolvedValueOnce({
      data: { id: "loc_norte", name: "Sucursal Norte" },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { POST } = await import("./route");
    const response = await POST(postRequest(validPayload));

    expect(response.status).toBe(201);
    expect(createLocationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sucursal Norte",
        slug: "sucursal-norte",
        sortOrder: 1,
        // B5: los umbrales de aviso del tablero viajan con el local. Un payload que no los traiga usa
        // los valores por defecto (10 sin aceptar, 15 en cocina) en vez de quedar sin umbral.
        acceptAlertMinutes: 10,
        prepAlertMinutes: 15,
      }),
      { repository: expect.anything() },
    );
  });

  it("POST respeta los umbrales que el owner eligió para el local (B5)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    createLocationMock.mockResolvedValueOnce({ data: { id: "loc_norte" }, meta: {} });

    const { POST } = await import("./route");
    await POST(postRequest({ ...validPayload, acceptAlertMinutes: 4, prepAlertMinutes: 22 }));

    expect(createLocationMock).toHaveBeenCalledWith(
      expect.objectContaining({ acceptAlertMinutes: 4, prepAlertMinutes: 22 }),
      expect.anything(),
    );
  });

  /**
   * TASK-308 — el interruptor del mostrador viaja con el local.
   *
   * Dos mitades de la misma regla: apagado se guarda `false`, y un payload que no trae el campo (una
   * terminal con la pantalla vieja) deja el POS **prendido**, que es como venía el negocio.
   */
  it("POST guarda el punto de venta apagado y lo deja prendido si el payload no lo trae", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValue(true);
    createLocationMock.mockResolvedValue({ data: { id: "loc_norte" }, meta: {} });

    const { POST } = await import("./route");
    await POST(postRequest({ ...validPayload, posEnabled: false }));
    await POST(postRequest(validPayload));

    expect(createLocationMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ posEnabled: false }),
      expect.anything(),
    );
    expect(createLocationMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ posEnabled: true }),
      expect.anything(),
    );
  });

  it("POST returns 400 con el campo señalado cuando el payload no tiene forma de local", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(postRequest({ name: "Norte" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.fields.slug).toBeDefined();
    expect(createLocationMock).not.toHaveBeenCalled();
  });

  it("POST returns 409 cuando el caso de uso rechaza el slug repetido", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageBusinessSettingsMock.mockReturnValueOnce(true);
    const { LocationError } = await import("@/modules/locations/domain/location-errors");
    createLocationMock.mockRejectedValueOnce(
      new LocationError(409, "CONFLICT", "Location slug already exists", {
        slug: "Ya hay un local con el identificador norte",
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(postRequest(validPayload));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error.fields.slug).toContain("norte");
  });
});
