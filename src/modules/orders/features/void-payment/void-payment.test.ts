import { describe, expect, it, vi } from "vitest";

import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import { InMemoryRefundRepository } from "@/modules/orders/adapters/in-memory-refund-repository";
import type { PaymentRecord, RefundRecord } from "@/modules/orders/domain/order.types";
import {
  voidPayment,
  type VoidPaymentScope,
} from "@/modules/orders/features/void-payment/void-payment";

/**
 * TASK-AUD-059 — **anular un cobro** (alcance remanente de A-15).
 *
 * La invariante que fija este test: un cobro mal registrado **no se borra ni se edita** —se marca con
 * cuándo, quién y por qué— y deja de contar para todo lo que sume plata. Anular no es devolver: la
 * devolución mueve plata que salió del cajón y tiene cupo; esto corrige el registro.
 *
 * Lo que se prueba acá es la **orquestación**: quién puede, qué se rechaza y que todo pase adentro de la
 * unidad de trabajo. La propiedad que depende de PostgreSQL (que el arqueo deje de verlo y que dos
 * anulaciones simultáneas no se pisen) vive en `void-payment.postgres.test.ts`.
 */

const VOIDED_AT = "2026-09-25T15:00:00.000Z";

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay_01",
    orderId: "ord_01",
    method: "cash",
    amount: 500,
    currency: "NIO",
    changeAmount: 0,
    tip: 0,
    reference: null,
    createdAt: "2026-09-25T14:00:00.000Z",
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    ...overrides,
  };
}

function refund(overrides: Partial<RefundRecord> = {}): RefundRecord {
  return {
    id: "refund_01",
    paymentId: "pay_01",
    orderId: "ord_01",
    shiftId: "shift_01",
    kind: "full",
    method: "cash",
    amount: 500,
    currency: "NIO",
    reason: "pedido cancelado",
    status: "pending",
    requestedByUserId: "user_manager",
    approvedByUserId: null,
    approvedAt: null,
    createdAt: "2026-09-25T14:10:00.000Z",
    ...overrides,
  };
}

/**
 * Un doble que **rompe si el caso de uso toca un repositorio fuera de la transacción**: es la forma de
 * fijar que la anulación entera (leer, comprobar y marcar) vive adentro de la unidad de trabajo.
 */
function buildDeps(payments: PaymentRecord[], refunds: RefundRecord[]) {
  const paymentRepository = new InMemoryPaymentRepository();
  paymentRepository.payments = payments;

  const refundRepository = new InMemoryRefundRepository();
  refundRepository.refunds = refunds;

  let insideTransaction = false;

  const guard = <T extends object>(target: T): T =>
    new Proxy(target, {
      get(object, property, receiver) {
        const value = Reflect.get(object, property, receiver);

        if (typeof value !== "function") return value;

        return (...args: unknown[]) => {
          if (!insideTransaction) {
            throw new Error(`${String(property)} se llamó fuera de la transacción`);
          }

          return value.apply(object, args);
        };
      },
    });

  const scope: VoidPaymentScope = {
    paymentRepository: guard(paymentRepository),
    refundRepository: guard(refundRepository),
  };

  const recordVoidAudit = vi.fn(async () => ({ data: null }));
  const calls = { transaction: 0 };

  const runInVoidPaymentTransaction = async <T,>(
    work: (scope: VoidPaymentScope) => Promise<T>,
  ): Promise<T> => {
    calls.transaction += 1;
    insideTransaction = true;

    try {
      return await work(scope);
    } finally {
      insideTransaction = false;
    }
  };

  return {
    paymentRepository,
    refundRepository,
    recordVoidAudit,
    calls,
    deps: {
      runInVoidPaymentTransaction,
      recordVoidAudit,
      now: () => new Date(VOIDED_AT),
    },
  };
}

describe("voidPayment", () => {
  it("marca el cobro con cuándo, quién y por qué, sin borrarlo, y firma el asiento", async () => {
    const built = buildDeps([payment()], []);

    const result = await voidPayment(
      {
        paymentId: "pay_01",
        actorRole: "owner",
        actorUserId: "user_owner",
        reason: "  cobro duplicado del pedido  ",
      },
      built.deps,
    );

    expect(result.data.voidedAt).toBe(VOIDED_AT);
    expect(result.data.voidedByUserId).toBe("user_owner");
    expect(result.data.voidReason).toBe("cobro duplicado del pedido");

    // El cobro original **sigue existiendo** con su monto: la anulación es una marca, no un borrado.
    expect(built.paymentRepository.payments).toHaveLength(1);
    expect(built.paymentRepository.payments[0]).toMatchObject({
      id: "pay_01",
      amount: 500,
      method: "cash",
      voidedAt: VOIDED_AT,
    });

    expect(built.recordVoidAudit).toHaveBeenCalledTimes(1);
    expect(built.recordVoidAudit).toHaveBeenCalledWith({
      paymentId: "pay_01",
      orderId: "ord_01",
      amount: 500,
      currency: "NIO",
      method: "cash",
      reason: "cobro duplicado del pedido",
      actorUserId: "user_owner",
    });
  });

  it("hace toda la operación adentro de una sola unidad de trabajo", async () => {
    const built = buildDeps([payment()], []);

    await voidPayment(
      { paymentId: "pay_01", actorRole: "owner", actorUserId: "user_owner", reason: "mal cargado" },
      built.deps,
    );

    expect(built.calls.transaction).toBe(1);
  });

  it("solo el dueño anula: ni el manager, ni el cajero, ni cocina", async () => {
    for (const role of ["manager", "cashier", "kitchen"] as const) {
      const built = buildDeps([payment()], []);

      await expect(
        voidPayment(
          { paymentId: "pay_01", actorRole: role, actorUserId: "user_x", reason: "mal cargado" },
          built.deps,
        ),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

      // El permiso se corta **antes** de abrir la transacción y de tocar el cobro.
      expect(built.calls.transaction).toBe(0);
      expect(built.paymentRepository.payments[0].voidedAt).toBeNull();
    }
  });

  it("exige el motivo antes de abrir la transacción", async () => {
    const built = buildDeps([payment()], []);

    await expect(
      voidPayment(
        { paymentId: "pay_01", actorRole: "owner", actorUserId: "user_owner" },
        built.deps,
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR", fields: { reason: expect.any(String) } });

    expect(built.calls.transaction).toBe(0);
  });

  it("no anula un cobro que no existe", async () => {
    const built = buildDeps([], []);

    await expect(
      voidPayment(
        { paymentId: "pay_fantasma", actorRole: "owner", actorUserId: "user_owner", reason: "mal cargado" },
        built.deps,
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("no anula dos veces el mismo cobro: el segundo intento es un conflicto", async () => {
    const built = buildDeps([payment({ voidedAt: VOIDED_AT, voidedByUserId: "user_owner", voidReason: "duplicado" })], []);

    await expect(
      voidPayment(
        { paymentId: "pay_01", actorRole: "owner", actorUserId: "user_owner", reason: "otra vez" },
        built.deps,
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    // El motivo original no se pisa: lo que ya está firmado no se reescribe.
    expect(built.paymentRepository.payments[0].voidReason).toBe("duplicado");
  });

  /**
   * Una devolución pendiente o aprobada **mueve plata**: si además se anulara el cobro, esa plata se
   * descontaría dos veces del arqueo (la devolución resta y el cobro desaparece). Por eso el camino es
   * resolver la devolución primero: rechazarla, o dejar que salga.
   */
  it("no anula un cobro con una devolución en curso o aprobada", async () => {
    for (const status of ["pending", "approved"] as const) {
      const built = buildDeps([payment()], [refund({ status })]);

      await expect(
        voidPayment(
          { paymentId: "pay_01", actorRole: "owner", actorUserId: "user_owner", reason: "mal cargado" },
          built.deps,
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

      expect(built.paymentRepository.payments[0].voidedAt).toBeNull();
    }
  });

  it("una devolución rechazada no bloquea la corrección del cobro", async () => {
    const built = buildDeps([payment()], [refund({ status: "rejected" })]);

    const result = await voidPayment(
      { paymentId: "pay_01", actorRole: "owner", actorUserId: "user_owner", reason: "mal cargado" },
      built.deps,
    );

    expect(result.data.voidedAt).toBe(VOIDED_AT);
  });

  it("un asiento de auditoría que falla no deshace la anulación", async () => {
    const built = buildDeps([payment()], []);
    built.recordVoidAudit.mockRejectedValue(new Error("el log no responde"));

    const result = await voidPayment(
      { paymentId: "pay_01", actorRole: "owner", actorUserId: "user_owner", reason: "mal cargado" },
      built.deps,
    );

    expect(result.data.voidedAt).toBe(VOIDED_AT);
  });
});
