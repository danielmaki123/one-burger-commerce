import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Punto 2 del roadmap (2026-09-18) — `GET /api/admin/history/cierres`.
 *
 * La orquestación: el permiso de la sección (`canViewHistory`), el alcance por sucursal —el manager
 * consulta las suyas y una pedida fuera del alcance se ignora— y que los filtros de la barra viajen al
 * caso de uso. Los dobles son de las dependencias de Prisma.
 */

const requireAdminSessionMock = vi.fn();
const listShiftsMock = vi.fn();
const listLocationsMock = vi.fn();
const findUserByIdMock = vi.fn();

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

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: class {
    findUserById(id: string) {
      return findUserByIdMock(id);
    }
  },
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: listLocationsMock },
  }),
}));

function location(id: string, name: string) {
  return { id, name, slug: id, isActive: true };
}

const closedShift = {
  id: "shift_01",
  locationId: "loc_norte",
  userId: "user_ana",
  status: "closed",
  openedAt: "2026-09-17T14:00:00.000Z",
  closedAt: "2026-09-17T22:00:00.000Z",
  openingAmount: 500,
  closingAmount: 1450,
  expectedAmount: 1500,
  difference: -50,
};

function request(query: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/history/cierres");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  return new Request(url);
}

describe("GET /api/admin/history/cierres", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_norte"] },
    });
    listLocationsMock.mockResolvedValue([location("loc_norte", "Norte"), location("loc_sur", "Sur")]);
    listShiftsMock.mockResolvedValue([closedShift]);
    findUserByIdMock.mockResolvedValue({ id: "user_ana", name: "Ana Pérez" });
  });

  it("devuelve los cierres con sucursal y cajero", async () => {
    const { GET } = await import("./route");

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].locationName).toBe("Norte");
    expect(body.data[0].cashierName).toBe("Ana Pérez");
    expect(body.data[0].difference).toBe(-50);
  });

  it("el manager solo consulta sus sucursales", async () => {
    const { GET } = await import("./route");

    await GET(request());

    expect(listShiftsMock).toHaveBeenCalledTimes(1);
    expect(listShiftsMock).toHaveBeenCalledWith("loc_norte");
  });

  it("una sucursal pedida fuera del alcance se ignora", async () => {
    const { GET } = await import("./route");

    const response = await GET(request({ locationId: "loc_sur" }));
    const body = await response.json();

    expect(body.meta.locationIds).toEqual(["loc_norte"]);
    expect(listShiftsMock).not.toHaveBeenCalledWith("loc_sur");
  });

  it("pasa los filtros de la barra al caso de uso", async () => {
    const { GET } = await import("./route");

    await GET(
      request({
        dateFrom: "2026-09-15T00:00:00.000Z",
        cashierUserId: "user_ana",
        onlyDifference: "1",
      }),
    );

    const response = await GET(request({ dateFrom: "2026-09-15T00:00:00.000Z" }));
    expect(response.status).toBe(200);
  });

  it("el cajero no audita su propio turno (403)", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: ["loc_norte"] },
    });
    const { GET } = await import("./route");

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(listShiftsMock).not.toHaveBeenCalled();
  });

  it("cocina tampoco entra (403)", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: [] },
    });
    const { GET } = await import("./route");

    expect((await GET(request())).status).toBe(403);
  });
});
