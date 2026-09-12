import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T8 fase 6 — la ruta pública de locales.
 *
 * Sin sesión: es lo que el checkout necesita para mostrar dónde se retira.
 */
const listPublicLocationsMock = vi.fn();

vi.mock(
  "@/modules/locations/features/list-public-locations/list-public-locations",
  () => ({ listPublicLocations: listPublicLocationsMock }),
);

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
}));

describe("public locations route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET devuelve los locales activos", async () => {
    listPublicLocationsMock.mockResolvedValueOnce({
      data: [{ id: "loc_principal", name: "Principal", pickupLeadMinutes: 25 }],
    });

    const { GET } = await import("./route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Principal");
  });

  it("GET devuelve 500 controlado si la lectura falla", async () => {
    listPublicLocationsMock.mockRejectedValueOnce(new Error("boom"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
  });
});
