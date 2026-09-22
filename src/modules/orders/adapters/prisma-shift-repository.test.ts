import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TASK-104 — el adaptador de Prisma del puerto de turnos.
 *
 * Lo que se prueba acá es lo que el doble de memoria **no** puede: que el índice único parcial de la
 * migración se traduzca a un conflicto de dominio (en vez de reventar con el error de Prisma) y que
 * el cierre use el `status: "open"` en el `WHERE` (así dos terminales no pisan el arqueo).
 */
const createMock = vi.fn();
const findFirstMock = vi.fn();
const findUniqueMock = vi.fn();
const updateManyMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    shift: {
      create: createMock,
      findFirst: findFirstMock,
      findUnique: findUniqueMock,
      updateMany: updateManyMock,
      findMany: findManyMock,
    },
  }),
}));

function decimal(value: string) {
  return { toString: () => value };
}

const OPEN_SHIFT_ROW = {
  id: "shift_01",
  locationId: "loc_principal",
  userId: "user_01",
  status: "open",
  openedAt: new Date("2026-09-14T08:00:00.000Z"),
  closedAt: null,
  openingAmount: decimal("500.00"),
  closingAmount: null,
  expectedAmount: null,
  // Bloque 1.1/1.2 del roadmap del POS (Fase 2): el arqueo por moneda y el efectivo del turno.
  expectedByCurrency: null,
  cashSalesAmount: null,
  difference: null,
  notes: null,
  cashCounts: [],
  createdAt: new Date("2026-09-14T08:00:00.000Z"),
  updatedAt: new Date("2026-09-14T08:00:00.000Z"),
};

describe("PrismaShiftRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("abre un turno y mapea Decimal y fechas", async () => {
    createMock.mockResolvedValueOnce(OPEN_SHIFT_ROW);

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    const shift = await repository.openShift({
      locationId: "loc_principal",
      userId: "user_01",
      openingAmount: 500,
    });

    expect(shift.openingAmount).toBe(500);
    expect(shift.openedAt).toBe("2026-09-14T08:00:00.000Z");
    expect(shift.status).toBe("open");
    expect(shift.closingAmount).toBeNull();
    expect(createMock).toHaveBeenCalledWith({
      data: {
        locationId: "loc_principal",
        userId: "user_01",
        openingAmount: 500,
        notes: null,
        cashCounts: undefined,
      },
      include: { cashCounts: true },
    });
  });

  it("traduce el índice único parcial a un conflicto de dominio", async () => {
    // Dos cajas abren a la vez: la base rechaza la segunda con P2002.
    createMock.mockRejectedValueOnce({ code: "P2002" });
    findFirstMock.mockResolvedValueOnce(OPEN_SHIFT_ROW);

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    await expect(
      repository.openShift({ locationId: "loc_principal", userId: "user_02" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("si el choque no deja un turno abierto, propaga el error original", async () => {
    createMock.mockRejectedValueOnce({ code: "P2002" });
    findFirstMock.mockResolvedValueOnce(null);

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    await expect(
      repository.openShift({ locationId: "loc_principal", userId: "user_02" }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("cierra el turno con la guarda de estado en el WHERE", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce({
      ...OPEN_SHIFT_ROW,
      status: "closed",
      closedAt: new Date("2026-09-14T16:00:00.000Z"),
      closingAmount: decimal("640.00"),
      expectedAmount: decimal("665.00"),
      expectedByCurrency: { NIO: 665 },
      cashSalesAmount: decimal("165.00"),
      difference: decimal("-25.00"),
    });

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    const closed = await repository.closeShift("shift_01", {
      closingAmount: 640,
      expectedAmount: 665,
      expectedByCurrency: { NIO: 665 },
      cashSalesAmount: 165,
    });

    expect(closed?.difference).toBe(-25);
    expect(closed?.closingAmount).toBe(640);
    // Bloque 1.1/1.2: el arqueo congelado se escribe **y** se devuelve al leerlo.
    expect(closed?.expectedByCurrency).toEqual({ NIO: 665 });
    expect(closed?.cashSalesAmount).toBe(165);
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // La guarda: si otra terminal ya cerró, esto afecta 0 filas.
        where: { id: "shift_01", status: "open" },
        data: expect.objectContaining({
          expectedByCurrency: { NIO: 665 },
          cashSalesAmount: 165,
        }),
      }),
    );
  });

  it("cerrar un turno ya cerrado devuelve null sin tocar la fila", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    expect(
      await repository.closeShift("shift_01", { closingAmount: 999, expectedAmount: 999 }),
    ).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("el cierre ciego deja la diferencia en null", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce({
      ...OPEN_SHIFT_ROW,
      status: "closed",
      closedAt: new Date("2026-09-14T16:00:00.000Z"),
      closingAmount: null,
      expectedAmount: decimal("665.00"),
      difference: null,
    });

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    const closed = await repository.closeShift("shift_01", {
      closingAmount: null,
      expectedAmount: 665,
    });

    expect(closed?.closingAmount).toBeNull();
    expect(closed?.difference).toBeNull();
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closingAmount: null, difference: null }),
      }),
    );
  });

  it("lista los turnos del local, del más nuevo al más viejo", async () => {
    findManyMock.mockResolvedValueOnce([OPEN_SHIFT_ROW]);

    const { PrismaShiftRepository } = await import("./prisma-shift-repository");
    const repository = new PrismaShiftRepository();

    const shifts = await repository.listShifts("loc_principal");

    expect(shifts).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { locationId: "loc_principal" },
      // Fase 3 del rediseño de Caja: además del conteo, el cuadre por banco con el nombre del banco (el
      // historial y el detalle lo imprimen).
      include: { cashCounts: true, bankCloses: { include: { bank: true } } },
      orderBy: { openedAt: "desc" },
    });
  });
});
