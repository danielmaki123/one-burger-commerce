import { beforeEach, describe, expect, it } from "vitest";

import type { CreateRefundInput } from "@/modules/orders/ports/refund-repository";
import { InMemoryRefundRepository } from "./in-memory-refund-repository";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — el doble de memoria del puerto de devoluciones.
 *
 * Lo que se prueba es la misma semántica que el adaptador de Prisma, para que un caso de uso no
 * pueda pasar con el doble y fallar contra la base: los listados del más viejo al más nuevo y la
 * guarda de `resolve`, que no puede resolver dos veces la misma devolución.
 */

const input: CreateRefundInput = {
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
};

describe("InMemoryRefundRepository", () => {
  let repository: InMemoryRefundRepository;

  beforeEach(() => {
    repository = new InMemoryRefundRepository();
  });

  it("crea la devolución con el input tal cual y la devuelve con id y fecha", async () => {
    const refund = await repository.create(input);

    expect(refund.id).toBe("refund_1");
    expect(refund.amount).toBe(100);
    expect(refund.status).toBe("pending");
    expect(refund.approvedAt).toBeNull();
    expect(refund.createdAt).toBeTruthy();
  });

  it("busca una devolución por su id y devuelve null si no existe", async () => {
    const refund = await repository.create(input);

    expect((await repository.findById(refund.id))?.id).toBe(refund.id);
    expect(await repository.findById("refund_inexistente")).toBeNull();
  });

  it("lista todas las devoluciones del cobro, también las rechazadas", async () => {
    await repository.create(input);
    await repository.create({ ...input, reason: "Otro motivo", status: "pending" });
    const rejected = await repository.create({ ...input, amount: 50 });
    await repository.resolve(rejected.id, {
      status: "rejected",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
    });
    await repository.create({ ...input, paymentId: "pay_02" });

    const refunds = await repository.listByPayment("pay_01");

    expect(refunds).toHaveLength(3);
    expect(refunds.at(-1)?.status).toBe("rejected");
  });

  it("ordena las devoluciones del turno del más viejo al más nuevo", async () => {
    // Se dan de alta desordenadas: el doble tiene que ordenar, no devolver el orden de inserción.
    const second = await repository.create({ ...input, amount: 20 });
    const third = await repository.create({ ...input, amount: 30 });
    const first = await repository.create({ ...input, amount: 10 });
    await repository.create({ ...input, amount: 40, shiftId: null });
    // El orden se lee por el monto: los `createdAt` de un test pueden empatar al milisegundo.
    first.createdAt = "2026-09-18T05:00:00.000Z";
    second.createdAt = "2026-09-18T05:05:00.000Z";
    third.createdAt = "2026-09-18T05:10:00.000Z";

    const refunds = await repository.listByShift("shift_01");

    expect(refunds.map((refund) => refund.amount)).toEqual([10, 20, 30]);
  });

  it("lista las pendientes de la más vieja a la más nueva, que es la cola de trabajo", async () => {
    const newest = await repository.create({ ...input, amount: 20 });
    const oldest = await repository.create({ ...input, amount: 10 });
    const resolved = await repository.create({ ...input, amount: 30 });
    await repository.resolve(resolved.id, {
      status: "approved",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
    });
    oldest.createdAt = "2026-09-18T05:00:00.000Z";
    newest.createdAt = "2026-09-18T05:10:00.000Z";

    const pending = await repository.listPending();

    expect(pending.map((refund) => refund.amount)).toEqual([10, 20]);
  });

  it("resuelve una pendiente y firma quién y cuándo", async () => {
    const refund = await repository.create(input);

    const resolved = await repository.resolve(refund.id, {
      status: "approved",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
    });

    expect(resolved?.status).toBe("approved");
    expect(resolved?.approvedByUserId).toBe("user_02");
    expect(resolved?.approvedAt).toBe("2026-09-18T06:30:00.000Z");
  });

  it("no resuelve dos veces la misma devolución: la segunda devuelve null y no pisa la firma", async () => {
    const refund = await repository.create(input);

    await repository.resolve(refund.id, {
      status: "approved",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
    });
    const second = await repository.resolve(refund.id, {
      status: "rejected",
      approvedByUserId: "user_03",
      approvedAt: "2026-09-18T07:00:00.000Z",
    });

    expect(second).toBeNull();
    expect(refund.status).toBe("approved");
    expect(refund.approvedByUserId).toBe("user_02");
  });

  it("un rechazo con motivo nuevo pisa el motivo original", async () => {
    const refund = await repository.create(input);

    const rejected = await repository.resolve(refund.id, {
      status: "rejected",
      approvedByUserId: "user_02",
      approvedAt: "2026-09-18T06:30:00.000Z",
      reason: "Se cobró dos veces",
    });

    expect(rejected?.reason).toBe("Se cobró dos veces");
  });

  it("resolver una devolución que no existe devuelve null", async () => {
    expect(
      await repository.resolve("refund_inexistente", {
        status: "approved",
        approvedByUserId: "user_02",
        approvedAt: "2026-09-18T06:30:00.000Z",
      }),
    ).toBeNull();
  });
});
