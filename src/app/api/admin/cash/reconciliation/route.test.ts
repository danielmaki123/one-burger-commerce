import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tarea 10 del brief (2026-09-17) — la ruta de la **conciliación** (11.1/11.2).
 *
 * Fija la puerta (la caja se audita: el cajero no entra), que la fecha se valide **antes** de tocar la
 * base y que la respuesta no se cachee: es un reporte del día, no una página.
 */

const requireAdminSessionMock = vi.fn();
const requireCashScopeMock = vi.fn();
const reconciliationForRouteMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

/**
 * El permiso de rol se deja **real** (`assertCanManageCash`): lo único que se dobla es la consulta de
 * sucursales. Si mañana alguien afloja la puerta de la caja, este test se pone rojo en vez de pasar por
 * el mock.
 */
vi.mock("@/app/api/admin/cash/cash-route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/api/admin/cash/cash-route-helpers")
  >("@/app/api/admin/cash/cash-route-helpers");

  return {
    ...actual,
    requireCashScope: (input: { role: Parameters<typeof actual.assertCanManageCash>[0] }) => {
      actual.assertCanManageCash(input.role);
      return requireCashScopeMock();
    },
  };
});

vi.mock("./reconciliation-composition", () => ({
  reconciliationForRoute: (input: unknown) => reconciliationForRouteMock(input),
}));

const locations = [{ id: "loc_principal", name: "Principal" }];

function get(query = "locationId=loc_principal&date=2026-09-17") {
  return new Request(`http://localhost/api/admin/cash/reconciliation?${query}`);
}

describe("GET /api/admin/cash/reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", name: "Dueño", role: "owner", locationIds: [] },
    });
    requireCashScopeMock.mockResolvedValue(locations);
    reconciliationForRouteMock.mockResolvedValue({
      data: { date: "2026-09-17", locationId: "loc_principal", payments: [], summary: {} },
    });
  });

  it("devuelve la conciliación del día y el local pedidos", async () => {
    const { GET } = await import("./route");
    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.date).toBe("2026-09-17");
    expect(reconciliationForRouteMock).toHaveBeenCalledWith({
      locations,
      requestedLocationId: "loc_principal",
      requestedDate: "2026-09-17",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("una fecha que no es un día del negocio se rechaza antes de tocar la base", async () => {
    const { GET } = await import("./route");
    const response = await GET(get("locationId=loc_principal&date=17/09/2026"));

    expect(response.status).toBe(422);
    expect(reconciliationForRouteMock).not.toHaveBeenCalled();
  });

  it("sin fecha la resuelve la composición (el día del negocio)", async () => {
    const { GET } = await import("./route");
    await GET(get("locationId=loc_principal"));

    expect(reconciliationForRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDate: null }),
    );
  });

  it("el cajero no audita la caja: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", name: "Cajero", role: "cashier", locationIds: ["loc_principal"] },
    });

    const { GET } = await import("./route");
    const response = await GET(get());

    expect(response.status).toBe(403);
    expect(reconciliationForRouteMock).not.toHaveBeenCalled();
  });
});
