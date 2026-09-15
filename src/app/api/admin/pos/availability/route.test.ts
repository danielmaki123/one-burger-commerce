import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";

/**
 * TASK-308 — ¿este admin tiene mostrador en algún lado?
 *
 * Es la pregunta que contesta la navegación: con el POS apagado en todos los locales del staff, la
 * entrada de "Caja" no se muestra. El alcance por sucursal se aplica igual que en el resto del POS:
 * prender el POS en un local que este cajero no atiende no le habilita nada.
 */

const requireAdminSessionMock = vi.fn();
const canUsePOSMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canUsePOS: canUsePOSMock,
}));

const locationRepository = new InMemoryLocationRepository([
  createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
  createInMemoryLocation({ id: "loc_apagado", name: "Apagado", posEnabled: false }),
  createInMemoryLocation({ id: "loc_sur", name: "Sur", posEnabled: false }),
]);

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({ repository: locationRepository }),
}));

async function callRoute() {
  const { GET } = await import("./route");

  return GET();
}

describe("admin pos availability route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canUsePOSMock.mockReturnValue(true);
  });

  it("cocina no pregunta por el mostrador: 403", async () => {
    canUsePOSMock.mockReturnValue(false);

    const response = await callRoute();

    expect(response.status).toBe(403);
  });

  it("dice que hay mostrador cuando algún local lo tiene prendido", async () => {
    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.available).toBe(true);
  });

  it("dice que no hay mostrador si el único local del cajero lo tiene apagado", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "cashier", locationIds: ["loc_apagado"] },
    });

    const body = await (await callRoute()).json();

    expect(body.data.available).toBe(false);
  });
});
