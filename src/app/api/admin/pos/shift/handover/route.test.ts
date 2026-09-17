import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tarea 7 del brief (2026-09-17) — la ruta del **traspaso de caja** (1.13).
 *
 * Fija la puerta (quien cobra traspasa; cocina no entra), que el traspaso se firme con el **usuario de la
 * sesión** como quien entrega y que un nombre vacío no llegue al caso de uso. El permiso de rol se deja
 * **real** (`assertCanUsePos`): si mañana alguien afloja la puerta del mostrador, esto se pone rojo.
 */

const requireAdminSessionMock = vi.fn();
const requirePosLocationMock = vi.fn();
const registerPosShiftHandoverMock = vi.fn();
const listPosShiftHandoversMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/app/api/admin/pos/pos-route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/api/admin/pos/pos-route-helpers")
  >("@/app/api/admin/pos/pos-route-helpers");

  return {
    ...actual,
    requirePosLocation: (input: { role: Parameters<typeof actual.assertCanUsePos>[0] }) => {
      actual.assertCanUsePos(input.role);
      return requirePosLocationMock(input);
    },
  };
});

vi.mock("./handover-composition", () => ({
  registerPosShiftHandover: (input: unknown) => registerPosShiftHandoverMock(input),
  listPosShiftHandovers: (input: unknown) => listPosShiftHandoversMock(input),
}));

const location = "loc_principal";

function get() {
  return new Request(`http://localhost/api/admin/pos/shift/handover?locationId=${location}`);
}

function post(body: unknown) {
  return new Request("http://localhost/api/admin/pos/shift/handover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/pos/shift/handover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", name: "María López", role: "cashier", locationIds: [location] },
    });
    requirePosLocationMock.mockResolvedValue(location);
    listPosShiftHandoversMock.mockResolvedValue({ data: [] });
    registerPosShiftHandoverMock.mockResolvedValue({
      data: { id: "handover_01", shiftId: "shift_01", receivedByName: "Carlos Ruiz" },
    });
  });

  it("GET lista los traspasos del turno abierto", async () => {
    listPosShiftHandoversMock.mockResolvedValue({
      data: [{ id: "handover_01", receivedByName: "Carlos Ruiz", expectedAmount: 1500 }],
    });

    const { GET } = await import("./route");
    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].receivedByName).toBe("Carlos Ruiz");
    expect(listPosShiftHandoversMock).toHaveBeenCalledWith({ locationId: location, shiftId: null });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("POST firma el traspaso a nombre de quien entrega (la sesión)", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      post({ locationId: location, receivedByName: "  Carlos   Ruiz  " }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("handover_01");
    // La ruta recorta los extremos; los espacios de adentro los prolija el dominio
    // (`resolveHandoverReceiver`), que es donde vive la regla del nombre.
    expect(registerPosShiftHandoverMock).toHaveBeenCalledWith({
      locationId: location,
      receivedByName: "Carlos   Ruiz",
      notes: null,
      actorUserId: "user_cashier",
      actorName: "María López",
    });
  });

  it("cocina no traspasa la caja: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", name: "Cocina", role: "kitchen", locationIds: [location] },
    });

    const { POST } = await import("./route");
    const response = await POST(post({ locationId: location, receivedByName: "Carlos Ruiz" }));

    expect(response.status).toBe(403);
    expect(registerPosShiftHandoverMock).not.toHaveBeenCalled();
  });

  it("sin nombre de quien recibe no llega al caso de uso: 422", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ locationId: location, receivedByName: "   " }));

    expect(response.status).toBe(422);
    expect(registerPosShiftHandoverMock).not.toHaveBeenCalled();
  });
});
