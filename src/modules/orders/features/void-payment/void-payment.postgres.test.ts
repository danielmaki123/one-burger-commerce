import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { voidPaymentForRoute } from "@/app/api/admin/payments/void-payment-composition";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { closeShift } from "@/modules/orders/features/shift/close-shift";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * TASK-AUD-059 — **un cobro anulado no cuenta** (alcance remanente de A-15).
 *
 * La anulación de un cobro es una decisión sobre el arqueo, y las dos propiedades que la hacen confiable
 * dependen de PostgreSQL, así que no se pueden demostrar con un doble:
 *
 * 1. **El arqueo deja de verlo**: el cobro anulado sale de los cobros del turno (efectivo, desglose por
 *    medio y cuadre por banco) sin que se borre la fila —el monto y el medio originales quedan—.
 * 2. **Dos anulaciones simultáneas no se pisan**: la guarda es el `voidedAt: null` del `WHERE`, así que la
 *    segunda afecta 0 filas y termina en conflicto en vez de reescribir la firma de la primera.
 *
 * Corre contra PostgreSQL real (`npm run test:postgres`), en el job `migrations` de CI. La composición es
 * la **misma** que usa la ruta: un test que se arma su propio runner no prueba el que corre en producción.
 */

const SHIFT_ID = "shift_test";
const TERMINAL = "term_caja_1";
const LOCATION = "loc_test";

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_owner",
      name: "Dueña de prueba",
      email: "duena@a59.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "owner",
    },
  });

  await prisma.location.create({
    data: { id: LOCATION, name: "Local de prueba", slug: "local-a59", businessHours: [] },
  });

  await prisma.posTerminal.create({
    data: { id: TERMINAL, locationId: LOCATION, label: "Caja 1" },
  });

  await prisma.shift.create({
    data: {
      id: SHIFT_ID,
      locationId: LOCATION,
      userId: "user_owner",
      status: "open",
      openingAmount: 0,
      terminalId: TERMINAL,
    },
  });
}

/** Un pedido con su cobro en efectivo dentro del turno. Devuelve el id del cobro. */
async function charge(orderNumber: string, amount: number): Promise<string> {
  const prisma = getPrismaClient();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      type: "pickup",
      status: "ready",
      customerName: "Cliente de prueba",
      customerWhatsapp: "+50588887777",
      locationId: LOCATION,
      subtotal: amount,
      total: amount,
    },
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      method: "cash",
      amount,
      currency: "NIO",
      changeAmount: 0,
      shiftId: SHIFT_ID,
    },
  });

  return payment.id;
}

async function closeDeps() {
  return createProductionPosShiftDependencies({ locationId: LOCATION });
}

describe("TASK-AUD-059 · un cobro anulado no cuenta para la plata (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("el arqueo del turno deja de contar el cobro anulado, sin borrar el cobro original", async () => {
    const malCobrado = await charge("P-A59-1", 500);
    await charge("P-A59-2", 300);

    const antes = await closeShift({ shiftId: SHIFT_ID, closingAmount: 800 }, await closeDeps());
    expect(antes.data?.expectedAmount, "los dos cobros válidos tienen que sumar al arqueo").toBe(800);

    // Se reabre para poder cerrar otra vez (el cierre es un documento: no se firma dos veces).
    await getPrismaClient().shift.update({
      where: { id: SHIFT_ID },
      data: { status: "open", closingAmount: null, expectedAmount: null, difference: null },
    });

    await voidPaymentForRoute({
      paymentId: malCobrado,
      role: "owner",
      actorUserId: "user_owner",
      reason: "cobro duplicado del pedido",
    });

    const cierre = await closeShift({ shiftId: SHIFT_ID, closingAmount: 300 }, await closeDeps());

    expect(
      cierre.data?.expectedAmount,
      "el cobro anulado seguía contando en el arqueo: expected +500",
    ).toBe(300);
    expect(cierre.data?.cashSalesAmount).toBe(300);

    // El registro original **se conserva**: la fila está, con su monto, su medio y su marca.
    const original = await getPrismaClient().payment.findUniqueOrThrow({ where: { id: malCobrado } });
    expect(original.amount.toString()).toBe("500");
    expect(original.voidReason).toBe("cobro duplicado del pedido");
    expect(original.voidedByUserId).toBe("user_owner");
    expect(original.voidedAt).not.toBeNull();

    // Y queda el asiento de la acción sensible, con el monto y el motivo.
    const asiento = await getPrismaClient().adminAuditLog.findFirst({
      where: { action: "payment.void", targetId: malCobrado },
    });
    expect(asiento).toMatchObject({ actorUserId: "user_owner", targetType: "Payment" });
  });

  it("un cobro anulado libera el saldo del pedido: se puede volver a cobrar", async () => {
    const malCobrado = await charge("P-A59-3", 400);
    const orderId = (await getPrismaClient().payment.findUniqueOrThrow({ where: { id: malCobrado } })).orderId;
    const payments = new PrismaPaymentRepository();

    expect((await payments.getPaymentSummary(orderId)).totalAmount).toBe(400);

    await voidPaymentForRoute({
      paymentId: malCobrado,
      role: "owner",
      actorUserId: "user_owner",
      reason: "se cobró en la caja equivocada",
    });

    const despues = await payments.getPaymentSummary(orderId);
    expect(
      despues.totalAmount,
      "el pedido seguía apareciendo cobrado con un cobro anulado",
    ).toBe(0);
    expect(despues.count).toBe(0);
  });

  it("dos anulaciones simultáneas no se pisan: una sola firma", async () => {
    const paymentId = await charge("P-A59-4", 250);

    const [primera, segunda] = await Promise.allSettled([
      voidPaymentForRoute({
        paymentId,
        role: "owner",
        actorUserId: "user_owner",
        reason: "el primer motivo",
      }),
      voidPaymentForRoute({
        paymentId,
        role: "owner",
        actorUserId: "user_owner",
        reason: "el segundo motivo",
      }),
    ]);

    const resultados = [primera, segunda];
    const ganadoras = resultados.filter((resultado) => resultado.status === "fulfilled");
    const perdedoras = resultados.filter((resultado) => resultado.status === "rejected");

    expect(ganadoras, "las dos anulaciones se firmaron a la vez").toHaveLength(1);
    expect(perdedoras).toHaveLength(1);
    expect((perdedoras[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      code: "CONFLICT",
    });

    const fila = await getPrismaClient().payment.findUniqueOrThrow({ where: { id: paymentId } });
    const motivoGanador = (ganadoras[0] as PromiseFulfilledResult<{ data: { voidReason: string | null } }>)
      .value.data.voidReason;

    // La firma que quedó es la de quien ganó: el motivo del perdedor no pisa nada.
    expect(fila.voidReason).toBe(motivoGanador);
  });

  /**
   * El otro lado de la regla: anular y devolver la misma plata no pueden convivir. La devolución viva
   * (pendiente o aprobada) bloquea la anulación, y la anulación bloquea la aprobación. Así el arqueo no
   * descuenta dos veces el mismo cobro.
   */
  it("un cobro con una devolución viva no se anula", async () => {
    const paymentId = await charge("P-A59-5", 350);

    await getPrismaClient().refund.create({
      data: {
        paymentId,
        orderId: (await getPrismaClient().payment.findUniqueOrThrow({ where: { id: paymentId } })).orderId,
        shiftId: SHIFT_ID,
        kind: "full",
        method: "cash",
        amount: 350,
        currency: "NIO",
        reason: "el cliente se arrepintió",
        status: "pending",
        requestedByUserId: "user_owner",
      },
    });

    await expect(
      voidPaymentForRoute({
        paymentId,
        role: "owner",
        actorUserId: "user_owner",
        reason: "cobro duplicado",
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    const fila = await getPrismaClient().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(fila.voidedAt).toBeNull();
  });
});
