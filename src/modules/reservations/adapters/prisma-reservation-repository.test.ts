import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    table: {
      findMany: findManyMock,
    },
  }),
}));

describe("PrismaReservationRepository.listTables", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns tables in natural operational order", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "table_10",
        label: "Mesa 10",
        capacity: 4,
        isActive: true,
        locationId: "Terraza",
      },
      {
        id: "table_2",
        label: "Mesa 2",
        capacity: 4,
        isActive: true,
        locationId: "Barra",
      },
      {
        id: "table_1",
        label: "Mesa 1",
        capacity: 4,
        isActive: true,
        locationId: "Barra",
      },
    ]);

    const { PrismaReservationRepository } = await import(
      "./prisma-reservation-repository"
    );

    const repository = new PrismaReservationRepository();
    const result = await repository.listTables();

    expect(result.map((table) => table.label)).toEqual([
      "Mesa 1",
      "Mesa 2",
      "Mesa 10",
    ]);
    expect(result[0]?.locationId).toBe("Barra");
  });
});
