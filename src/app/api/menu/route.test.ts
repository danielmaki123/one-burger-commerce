import { beforeEach, describe, expect, it, vi } from "vitest";

const getCatalogMock = vi.fn();

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: vi.fn(function Repository() {
    return {};
  }),
}));

vi.mock("@/modules/menu/features/get-catalog/get-catalog", () => ({
  getCatalog: getCatalogMock,
}));

describe("GET /api/menu", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a no-store dynamic response", async () => {
    getCatalogMock.mockResolvedValueOnce({
      categories: [{ id: "cat_1", name: "Entradas", slug: "entradas", products: [] }],
      marketingBlocks: [],
      generatedAt: "2026-09-19T00:00:00.000Z",
    });

    const route = await import("./route");
    const response = await route.GET(new Request("http://localhost/api/menu"));
    const body = await response.json();

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.categories).toHaveLength(1);
  });

  it("lee la carta con el alcance público y le pasa los filtros de la URL", async () => {
    getCatalogMock.mockResolvedValueOnce({
      categories: [],
      marketingBlocks: [],
      generatedAt: "2026-09-19T00:00:00.000Z",
    });

    const route = await import("./route");
    await route.GET(
      new Request(
        "http://localhost/api/menu?category=tacos&locationId=loc_norte&includeUnavailable=true",
      ),
    );

    expect(getCatalogMock).toHaveBeenCalledWith(
      {
        scope: "public",
        categorySlug: "tacos",
        locationId: "loc_norte",
        includeUnavailable: true,
      },
      expect.objectContaining({
        repository: expect.anything(),
        locationRepository: expect.anything(),
      }),
    );
  });
});
