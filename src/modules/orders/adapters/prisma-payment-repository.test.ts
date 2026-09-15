import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TASK-103 — el adaptador de Prisma del puerto de cobros.
 *
 * El cliente se mockea: lo que se prueba acá es el **mapeo** (Decimal → number, fecha → ISO, orden
 * y agregación delegadas a la base) y que las dos implementaciones del puerto hablen igual. Las
 * reglas de negocio están en `in-memory-payment-repository.test.ts`.
 */
const createMock = vi.fn();
const findManyMock = vi.fn();
const aggregateMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    payment: {
      create: createMock,
      findMany: findManyMock,
      aggregate: aggregateMock,
    },
  }),
}));

/** Prisma devuelve `Decimal`, que expone `toString()`. */
function decimal(value: string) {
  return { toString: () => value };
}

describe("PrismaPaymentRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("mapea un cobro creado, con Decimal a number y fecha a ISO", async () => {
    createMock.mockResolvedValueOnce({
      id: "pay_01",
      orderId: "ord_01",
      method: "mixed",
      amount: decimal("150.50"),
      currency: "USD",
      tip: decimal("15.05"),
      reference: "voucher-77",
      createdAt: new Date("2026-09-14T12:00:00.000Z"),
    });

    const { PrismaPaymentRepository } = await import("./prisma-payment-repository");
    const repository = new PrismaPaymentRepository();

    const payment = await repository.createPayment({
      orderId: "ord_01",
      method: "mixed",
      amount: 150.5,
      currency: "USD",
      tip: 15.05,
      reference: "voucher-77",
    });

    expect(payment).toEqual({
      id: "pay_01",
      orderId: "ord_01",
      method: "mixed",
      amount: 150.5,
      currency: "USD",
      tip: 15.05,
      reference: "voucher-77",
      createdAt: "2026-09-14T12:00:00.000Z",
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        orderId: "ord_01",
        method: "mixed",
        amount: 150.5,
        currency: "USD",
        tip: 15.05,
        reference: "voucher-77",
      },
    });
  });

  it("sin propina ni referencia escribe los valores por defecto", async () => {
    createMock.mockResolvedValueOnce({
      id: "pay_02",
      orderId: "ord_01",
      method: "cash",
      amount: decimal("100"),
      currency: null,
      tip: decimal("0"),
      reference: null,
      createdAt: new Date("2026-09-14T12:00:00.000Z"),
    });

    const { PrismaPaymentRepository } = await import("./prisma-payment-repository");
    const repository = new PrismaPaymentRepository();

    await repository.createPayment({ orderId: "ord_01", method: "cash", amount: 100 });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        orderId: "ord_01",
        method: "cash",
        amount: 100,
        currency: null,
        tip: 0,
        reference: null,
      },
    });
  });

  it("lista los cobros del pedido ordenados por fecha de cobro", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "pay_01",
        orderId: "ord_01",
        method: "cash",
        amount: decimal("60"),
        tip: decimal("0"),
        reference: null,
        createdAt: new Date("2026-09-14T12:00:00.000Z"),
      },
    ]);

    const { PrismaPaymentRepository } = await import("./prisma-payment-repository");
    const repository = new PrismaPaymentRepository();

    const payments = await repository.listPaymentsByOrder("ord_01");

    expect(payments).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { orderId: "ord_01" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("resume con la agregación de la base, no sumando en memoria", async () => {
    aggregateMock.mockResolvedValueOnce({
      _count: { _all: 2 },
      _sum: { amount: decimal("100.00"), tip: decimal("10.00") },
    });

    const { PrismaPaymentRepository } = await import("./prisma-payment-repository");
    const repository = new PrismaPaymentRepository();

    const summary = await repository.getPaymentSummary("ord_01");

    expect(summary).toEqual({ count: 2, totalAmount: 100, totalTip: 10 });
    expect(aggregateMock).toHaveBeenCalledWith({
      where: { orderId: "ord_01" },
      _count: { _all: true },
      _sum: { amount: true, tip: true },
    });
  });

  it("un pedido sin cobros resume en cero, no en null", async () => {
    aggregateMock.mockResolvedValueOnce({
      _count: { _all: 0 },
      _sum: { amount: null, tip: null },
    });

    const { PrismaPaymentRepository } = await import("./prisma-payment-repository");
    const repository = new PrismaPaymentRepository();

    expect(await repository.getPaymentSummary("ord_sin_cobros")).toEqual({
      count: 0,
      totalAmount: 0,
      totalTip: 0,
    });
  });
});
