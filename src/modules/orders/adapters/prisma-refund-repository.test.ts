import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — el adaptador de Prisma del puerto de devoluciones.
 *
 * Lo que se prueba acá es lo que el doble de memoria **no** puede: que el `Decimal` de Postgres se
 * traduzca a `number` (y las fechas a ISO), que la cola de aprobaciones salga **de la más vieja a la
 * más nueva** (es una cola de trabajo: la primera que llegó se atiende primero) y que `resolve` use el
 * `status: "pending"` en el `WHERE` (así dos terminales no aprueban dos veces la misma devolución).
 */
const createMock = vi.fn();
const findManyMock = vi.fn();
const updateManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    refund: {
      create: createMock,
      findMany: findManyMock,
      updateMany: updateManyMock,
      findUnique: findUniqueMock,
    },
  }),
}));

function decimal(value: string) {
  return { toString: () => value };
}

const REFUND_ROW = {
  id: "refund_01",
  paymentId: "pay_01",
  orderId: "order_01",
  shiftId: "shift_01",
  kind: "partial",
  method: "cash",
  amount: decimal("100.00"),
  currency: "NIO",
  reason: "Producto frío",
  status: "pending",
  requestedByUserId: "user_01",
  approvedByUserId: null,
  approvedAt: null,
  createdAt: new Date("2026-09-18T05:00:00.000Z"),
};

describe("PrismaRefundRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("crea la devolución y mapea Decimal y fechas a ISO", async () => {
    createMock.mockResolvedValueOnce(REFUND_ROW);

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    const refund = await repository.create({
      paymentId: "pay_01",
      orderId: "order_01",
      shiftId: "shift_01",
      kind: "partial",
      method: "cash",
      amount: 100,
      currency: "NIO",
      reason: "Producto frío",
      status: "pending",
      requestedByUserId: "user_01",
      approvedByUserId: null,
      approvedAt: null,
    });

    expect(refund.amount).toBe(100);
    expect(refund.createdAt).toBe("2026-09-18T05:00:00.000Z");
    expect(refund.approvedAt).toBeNull();
    expect(refund.status).toBe("pending");
    expect(createMock).toHaveBeenCalledWith({
      data: {
        paymentId: "pay_01",
        orderId: "order_01",
        shiftId: "shift_01",
        kind: "partial",
        method: "cash",
        amount: 100,
        currency: "NIO",
        reason: "Producto frío",
        status: "pending",
        requestedByUserId: "user_01",
        approvedByUserId: null,
        approvedAt: null,
      },
    });
  });

  it("busca una devolución por su id y devuelve null si no existe", async () => {
    findUniqueMock.mockResolvedValueOnce(REFUND_ROW);

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    const found = await repository.findById("refund_01");

    expect(found?.id).toBe("refund_01");
    expect(found?.amount).toBe(100);
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "refund_01" } });

    findUniqueMock.mockResolvedValueOnce(null);
    expect(await repository.findById("refund_inexistente")).toBeNull();
  });

  it("traduce la fecha de aprobación cuando la devolución ya está resuelta", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        ...REFUND_ROW,
        status: "approved",
        approvedByUserId: "user_02",
        approvedAt: new Date("2026-09-18T06:30:00.000Z"),
      },
    ]);

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    const refunds = await repository.listByPayment("pay_01");

    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.approvedAt).toBe("2026-09-18T06:30:00.000Z");
    expect(refunds[0]?.approvedByUserId).toBe("user_02");
    // Todas las devoluciones del cobro (también las rechazadas): el cupo se calcula sobre eso.
    expect(findManyMock).toHaveBeenCalledWith({
      where: { paymentId: "pay_01" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("lista las devoluciones del turno del más viejo al más nuevo", async () => {
    findManyMock.mockResolvedValueOnce([REFUND_ROW]);

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    const refunds = await repository.listByShift("shift_01");

    expect(refunds).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { shiftId: "shift_01" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("lista las pendientes de la más vieja a la más nueva, que es la cola de trabajo", async () => {
    findManyMock.mockResolvedValueOnce([REFUND_ROW, { ...REFUND_ROW, id: "refund_02" }]);

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    const pending = await repository.listPending();

    expect(pending.map((refund) => refund.id)).toEqual(["refund_01", "refund_02"]);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("resuelve la devolución pendiente con la guarda de estado en el WHERE", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce({
      ...REFUND_ROW,
      status: "approved",
      approvedByUserId: "user_02",
      approvedAt: new Date("2026-09-18T06:30:00.000Z"),
    });

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    const resolved = await repository.resolve("refund_01", {
      status: "approved",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
    });

    expect(resolved?.status).toBe("approved");
    expect(resolved?.approvedAt).toBe("2026-09-18T06:30:00.000Z");
    expect(updateManyMock).toHaveBeenCalledWith({
      // La guarda: si otra terminal ya la resolvió, esto afecta 0 filas.
      where: { id: "refund_01", status: "pending" },
      data: expect.objectContaining({
        status: "approved",
        approvedByUserId: "user_02",
        approvedAt: new Date("2026-09-18T06:30:00.000Z"),
      }),
    });
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "refund_01" } });
  });

  it("un rechazo con motivo nuevo pisa el motivo original", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce({
      ...REFUND_ROW,
      status: "rejected",
      reason: "Se cobró dos veces",
      approvedByUserId: "user_02",
      approvedAt: new Date("2026-09-18T06:30:00.000Z"),
    });

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    await repository.resolve("refund_01", {
      status: "rejected",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
      reason: "Se cobró dos veces",
    });

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "refund_01", status: "pending" },
      data: expect.objectContaining({ reason: "Se cobró dos veces" }),
    });
  });

  it("resolver una devolución ya resuelta devuelve null sin releerla", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    const { PrismaRefundRepository } = await import("./prisma-refund-repository");
    const repository = new PrismaRefundRepository();

    expect(
      await repository.resolve("refund_01", {
        status: "rejected",
        approvedByUserId: "user_02",
        approvedAt: "2026-09-18T06:30:00.000Z",
      }),
    ).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
