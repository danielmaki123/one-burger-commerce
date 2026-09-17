import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ShiftRecord } from "@/modules/orders/domain/order.types";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — la ruta que reabre un turno cerrado.
 *
 * Es la operación más sensible del arqueo y por eso se prueban las cuatro guardas juntas: quién puede
 * (`canManageCash`), que el turno sea de una sucursal del alcance (404, no 403), que haya **motivo**
 * escrito (422) y que un turno que no está cerrado no se reabra (409).
 */

const requireAdminSessionMock = vi.fn();
const findShiftByIdMock = vi.fn();
const reopenShiftMock = vi.fn();
const listLocationsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/orders/adapters/prisma-shift-repository", () => ({
  PrismaShiftRepository: class {
    findShiftById(id: string) {
      return findShiftByIdMock(id);
    }
    reopenShift(id: string, input: unknown) {
      return reopenShiftMock(id, input);
    }
  },
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: listLocationsMock },
  }),
}));

const location = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  isActive: true,
  sortOrder: 0,
  addressLine: null,
  city: null,
  addressReference: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  phone: null,
  whatsapp: null,
  businessHours: {},
  pickupLeadMinutes: 25,
  pickupMaxMinutes: null,
  acceptAlertMinutes: 10,
  prepAlertMinutes: 15,
  isAcceptingOrders: true,
  posEnabled: true,
  closedMessage: null,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
});

const closedShift: ShiftRecord = {
  id: "shift_01",
  locationId: "loc_principal",
  userId: "user_01",
  status: "closed",
  openedAt: "2026-09-17T14:00:00.000Z",
  closedAt: "2026-09-17T22:00:00.000Z",
  openingAmount: 500,
  closingAmount: 1500,
  expectedAmount: 1500,
  expectedByCurrency: { NIO: 1500 },
  cashSalesAmount: 1000,
  difference: 0,
  cashCounts: [],
  notes: null,
  createdAt: "2026-09-17T14:00:00.000Z",
  updatedAt: "2026-09-17T22:00:00.000Z",
};

function post(body: unknown) {
  return new Request("http://localhost/api/admin/cash/shifts/shift_01/reopen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "shift_01" });

describe("POST /api/admin/cash/shifts/[id]/reopen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_principal"] },
    });
    listLocationsMock.mockResolvedValue([location("loc_principal", "Principal")]);
    findShiftByIdMock.mockResolvedValue(closedShift);
    reopenShiftMock.mockResolvedValue({ ...closedShift, status: "open", closedAt: null });
  });

  it("reabre con motivo y firma quién lo hizo", async () => {
    const { POST } = await import("./route");

    const response = await POST(post({ reason: "Conté mal los billetes." }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("open");
    expect(reopenShiftMock).toHaveBeenCalledWith("shift_01", {
      userId: "user_manager",
      reason: "Conté mal los billetes.",
    });
  });

  it("sin motivo responde 422 y no toca el turno", async () => {
    const { POST } = await import("./route");

    const response = await POST(post({ reason: "   " }), { params });

    expect(response.status).toBe(422);
    expect(reopenShiftMock).not.toHaveBeenCalled();
  });

  it("un turno de otra sucursal no existe para quien no la atiende: 404", async () => {
    findShiftByIdMock.mockResolvedValue({ ...closedShift, locationId: "loc_ajena" });

    const { POST } = await import("./route");
    const response = await POST(post({ reason: "motivo" }), { params });

    expect(response.status).toBe(404);
    expect(reopenShiftMock).not.toHaveBeenCalled();
  });

  it("cocina no administra la caja: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: ["loc_principal"] },
    });

    const { POST } = await import("./route");
    const response = await POST(post({ reason: "motivo" }), { params });

    expect(response.status).toBe(403);
    expect(reopenShiftMock).not.toHaveBeenCalled();
  });

  it("un turno que ya está abierto no se reabre: 409", async () => {
    findShiftByIdMock.mockResolvedValue({ ...closedShift, status: "open", closedAt: null });

    const { POST } = await import("./route");
    const response = await POST(post({ reason: "motivo" }), { params });

    expect(response.status).toBe(409);
    expect(reopenShiftMock).not.toHaveBeenCalled();
  });
});
