import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicMenuMock = vi.fn();

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: vi.fn(function Repository() {
    return {};
  }),
}));

vi.mock("@/modules/menu/features/get-public-menu/get-public-menu", () => ({
  getPublicMenu: getPublicMenuMock,
}));

describe("GET /api/menu", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a no-store dynamic response", async () => {
    getPublicMenuMock.mockResolvedValueOnce({
      categories: [{ id: "cat_1", name: "Entradas", slug: "entradas", products: [] }],
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
});
