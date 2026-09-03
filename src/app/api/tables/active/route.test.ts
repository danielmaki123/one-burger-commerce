import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    table: {
      findMany: findManyMock,
    },
  }),
}));

describe("GET /api/tables/active", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns active tables with public display fields in natural order", async () => {
    findManyMock.mockResolvedValueOnce([
      { id: "table_02", label: "Mesa 2", capacity: 4, locationId: "Barra" },
      { id: "table_10", label: "Mesa 10", capacity: 4, locationId: "Terraza" },
      { id: "table_01", label: "Mesa 1", capacity: 4, locationId: "Barra" },
    ]);

    const route = await import("./route");
    const response = await route.GET();
    const body = await response.json();

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data).toHaveLength(3);
    expect(body.data[0]).toEqual({
      id: "table_01",
      label: "Mesa 1",
      capacity: 4,
      locationId: "Barra",
    });
    expect(body.data[1]).toEqual({
      id: "table_02",
      label: "Mesa 2",
      capacity: 4,
      locationId: "Barra",
    });
    expect(body.data[2]).toEqual({
      id: "table_10",
      label: "Mesa 10",
      capacity: 4,
      locationId: "Terraza",
    });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, label: true, capacity: true, locationId: true },
      orderBy: [{ label: "asc" }],
    });
  });

  it("does not expose admin-only fields", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "table_03",
        label: "Mesa 3",
        capacity: 4,
        locationId: "Barra",
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].qrToken).toBeUndefined();
    expect(body.data[0].createdAt).toBeUndefined();
  });
});
