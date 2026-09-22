import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.fn();
const listLocationsMock = vi.fn();
const getCashConfigMock = vi.fn();
const updateCashConfigMock = vi.fn();
const cashConfigUpdateAuditMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: () => listLocationsMock() },
  }),
}));

vi.mock("@/modules/cash-config/features/get-cash-config/get-cash-config", () => ({
  getCashConfig: (input: unknown, deps: unknown) => getCashConfigMock(input, deps),
}));

vi.mock("@/modules/cash-config/features/update-cash-config/update-cash-config", () => ({
  updateCashConfig: (input: unknown, deps: unknown) => updateCashConfigMock(input, deps),
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  cashConfigUpdateAudit: (input: unknown) => cashConfigUpdateAuditMock(input),
}));

const { GET, PUT } = await import("./route");

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — `GET`/`PUT /api/admin/cash/config`.
 *
 * Lo que fijan estos casos es la **puerta** y el alcance: la configuración de caja cambia las reglas con
 * las que se firma un arqueo, así que es del dueño (el manager y el cajero no entran ni con URL directa), y
 * una sucursal fuera del alcance responde 403 aunque el id viaje a mano.
 */

const LOCATIONS = [
  { id: "loc_principal", name: "Principal", isActive: true, sortOrder: 0, posEnabled: true },
  { id: "loc_norte", name: "Norte", isActive: true, sortOrder: 1, posEnabled: true },
];

function sessionFor(role: "owner" | "manager" | "cashier" | "kitchen", locationIds: string[] = []) {
  return { isAuthenticated: true, user: { id: `user_${role}`, role, name: "Quien sea", locationIds } };
}

function getRequest(query: string) {
  return new Request(`http://localhost/api/admin/cash/config?${query}`);
}

function putRequest(body: unknown) {
  return new Request("http://localhost/api/admin/cash/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CONFIG = {
  locationId: "loc_principal",
  usdEnabled: true,
  blindCount: true,
  updatedAt: "2026-09-22T15:00:00.000Z",
  updatedByUserId: "user_owner",
  denominations: [{ currency: "NIO", value: 1000, isActive: true, sortOrder: 0 }],
};

describe("/api/admin/cash/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLocationsMock.mockResolvedValue(LOCATIONS);
    getCashConfigMock.mockResolvedValue(CONFIG);
    updateCashConfigMock.mockResolvedValue(CONFIG);
    cashConfigUpdateAuditMock.mockResolvedValue(undefined);
  });

  it("el dueño lee la config de una sucursal", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("owner"));

    const response = await GET(getRequest("locationId=loc_principal"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ locationId: "loc_principal", usdEnabled: true });
    expect(getCashConfigMock).toHaveBeenCalledWith(
      { locationId: "loc_principal" },
      expect.objectContaining({ repository: expect.anything() }),
    );
  });

  it("sin sucursal no lee cualquier cosa: 403", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("owner"));

    const response = await GET(getRequest(""));

    expect(response.status).toBe(403);
    expect(getCashConfigMock).not.toHaveBeenCalled();
  });

  it.each(["manager", "cashier", "kitchen"] as const)(
    "%s no entra: la config de caja es del dueño",
    async (role) => {
      requireAdminSessionMock.mockResolvedValue(sessionFor(role));

      const response = await GET(getRequest("locationId=loc_principal"));

      expect(response.status).toBe(403);
      expect(getCashConfigMock).not.toHaveBeenCalled();
    },
  );

  it("el dueño guarda y la acción queda firmada en el log de auditoría", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("owner"));

    const response = await PUT(
      putRequest({ locationId: "loc_principal", usdEnabled: true, blindCount: false }),
    );

    expect(response.status).toBe(200);
    expect(updateCashConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc_principal" }),
      expect.objectContaining({ updatedByUserId: "user_owner" }),
    );
    expect(cashConfigUpdateAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user_owner",
        locationId: "loc_principal",
        usdEnabled: true,
        blindCount: true,
      }),
    );
  });

  it("un manager no puede guardar (ni con la sucursal a mano)", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("manager", ["loc_principal"]));

    const response = await PUT(putRequest({ locationId: "loc_principal", usdEnabled: true }));

    expect(response.status).toBe(403);
    expect(updateCashConfigMock).not.toHaveBeenCalled();
    expect(cashConfigUpdateAuditMock).not.toHaveBeenCalled();
  });

  it("un error de validación del dominio sale como 422 con su campo", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("owner"));
    const { CashConfigError } = await import("@/modules/cash-config/domain/cash-config-errors");
    updateCashConfigMock.mockRejectedValue(
      new CashConfigError(422, "VALIDATION_ERROR", "Revisá la configuración de la caja.", {
        denominations: "Dejá al menos un billete activo",
      }),
    );

    const response = await PUT(putRequest({ locationId: "loc_principal", denominations: [] }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.denominations).toContain("activo");
    expect(cashConfigUpdateAuditMock).not.toHaveBeenCalled();
  });
});
