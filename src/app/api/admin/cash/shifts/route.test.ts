import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocationRecord } from "@/modules/locations/domain/location.types";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — la ruta del historial de caja.
 *
 * Lo que se prueba acá es la orquestación: el permiso (un cajero no audita su propio turno, así que
 * `requireCashScope` corta con 403), que el local pedido caiga dentro del alcance y que la lectura
 * devuelva los turnos **tal como se guardaron** (sin recalcular el arqueo). El cálculo del resumen
 * vive en `listLocationShifts`, probado aparte.
 *
 * Los dobles son de las dependencias de Prisma (la composición), no del helper: así el permiso y el
 * alcance reales también quedan bajo test.
 */

const requireAdminSessionMock = vi.fn();
const listShiftsMock = vi.fn();
const listLocationsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/orders/adapters/prisma-shift-repository", () => ({
  PrismaShiftRepository: class {
    listShifts(locationId: string) {
      return listShiftsMock(locationId);
    }
  },
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: listLocationsMock },
  }),
}));

function location(id: string, name: string): LocationRecord {
  return {
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
    acceptAlertMinutes: 10,
    prepAlertMinutes: 15,
    isAcceptingOrders: true,
    posEnabled: true,
    requireShiftClose: false,
    closedMessage: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  };
}

const closedShift = {
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

function request(locationId?: string) {
  const url = new URL("http://localhost/api/admin/cash/shifts");
  if (locationId) url.searchParams.set("locationId", locationId);

  return new Request(url);
}

describe("GET /api/admin/cash/shifts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_principal"] },
    });
    listLocationsMock.mockResolvedValue([
      location("loc_principal", "Principal"),
      location("loc_masaya", "Masaya"),
    ]);
    listShiftsMock.mockResolvedValue([closedShift]);
  });

  it("devuelve los turnos del local pedido, con el arqueo tal como se guardó", async () => {
    const { GET } = await import("./route");

    const response = await GET(request("loc_principal"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].expectedByCurrency).toEqual({ NIO: 1500 });
    expect(body.data[0].cashSalesAmount).toBe(1000);
    expect(body.meta).toEqual({
      locationId: "loc_principal",
      total: 1,
      openCount: 0,
      closedCount: 1,
    });
    expect(listShiftsMock).toHaveBeenCalledWith("loc_principal");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sin locationId cae al primer local del alcance, no al vacío", async () => {
    listShiftsMock.mockResolvedValue([]);

    const { GET } = await import("./route");
    const body = await (await GET(request())).json();

    expect(listShiftsMock).toHaveBeenCalledWith("loc_principal");
    expect(body.meta.locationId).toBe("loc_principal");
  });

  it("un local pedido fuera del alcance no se lee: cae al primero permitido", async () => {
    const { GET } = await import("./route");
    await GET(request("loc_masaya"));

    expect(listShiftsMock).toHaveBeenCalledWith("loc_principal");
  });

  it("el cajero no audita su propio turno: 403 y no se lee nada", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: ["loc_principal"] },
    });

    const { GET } = await import("./route");
    const response = await GET(request("loc_principal"));

    expect(response.status).toBe(403);
    expect(listShiftsMock).not.toHaveBeenCalled();
  });
});
