import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { createProductionInvoiceDependencies } from "@/modules/invoices/adapters/production-invoice";
import { emitInvoice, type EmitInvoiceDependencies } from "@/modules/invoices/features/emit-invoice/emit-invoice";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * TASK-AUD-006 — la numeración de la factura bajo **concurrencia real**.
 *
 * El correlativo se calcula leyendo la factura más nueva y sumando uno (`findLatestNumber` →
 * `nextInvoiceNumber`), y la base tiene dos índices únicos: `Invoice.number` y `Invoice.orderId`. Esa red
 * evita que dos documentos con el mismo número queden **persistidos**, pero la emisión que pierde la carrera
 * **falla**: el cajero ve un error y el pedido queda sin factura. Acá se mide qué pasa de verdad contra
 * PostgreSQL (un doble en memoria no puede perder una carrera por un índice único) y se fija lo que tiene que
 * pasar: dos emisiones simultáneas **nunca** fallan.
 *
 * La factura es una **factura simple, explícitamente no fiscal**: no hay autorización ni rango oficial de
 * numeración, así que la invariante es del documento, no de una autoridad.
 */

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_test",
      name: "Cajera de prueba",
      email: "cajera@invoice.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "cashier",
    },
  });

  await prisma.location.create({
    data: {
      id: "loc_test",
      name: "Local de prueba",
      slug: "local-de-prueba-invoice",
      businessHours: [],
    },
  });
}

/** Un pedido cobrado y listo para facturar. */
async function paidOrder(orderNumber: string): Promise<string> {
  const prisma = getPrismaClient();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      type: "pickup",
      status: "ready",
      customerName: "Cliente de prueba",
      customerWhatsapp: `+5058888${orderNumber.slice(-4)}`,
      locationId: "loc_test",
      subtotal: 100,
      total: 100,
    },
  });

  await prisma.payment.create({
    data: { orderId: order.id, method: "cash", amount: 100, currency: "NIO" },
  });

  return order.id;
}

function emit(orderId: string) {
  return emitInvoice({ orderId, actorUserId: "user_test" }, production);
}

let production: Awaited<ReturnType<typeof createProductionInvoiceDependencies>>;

describe("TASK-AUD-006 · numeración de facturas bajo concurrencia (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
    production = await createProductionInvoiceDependencies();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("dos emisiones simultáneas de pedidos distintos: las dos salen, con números distintos", async () => {
    const prisma = getPrismaClient();
    const primero = await paidOrder("P-0001");
    const segundo = await paidOrder("P-0002");

    // Dos cajas (o un reintento de red) emitiendo al mismo tiempo: las dos leen el mismo «último número» y
    // calculan el mismo correlativo. Lo que no puede pasar es que una de las dos falle: el pedido quedaría
    // sin factura y el cajero vería un error que no hizo nada.
    //
    // El cruce se fuerza con una **barrera**: el doble del repositorio deja que las dos emisiones lean el
    // último número antes de que ninguna inserte. Sin la barrera, el caso depende del azar del planificador
    // (y pasaba sin arreglar nada el 100% de las veces en la máquina de desarrollo).
    let leyeron = 0;
    let liberar: (() => void) | null = null;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const conBarrera: EmitInvoiceDependencies = {
      ...production,
      invoiceRepository: new Proxy(production.invoiceRepository, {
        get(target, property, receiver) {
          if (property !== "findLatestNumber") return Reflect.get(target, property, receiver);

          return async () => {
            const latest = await target.findLatestNumber();

            leyeron += 1;
            if (leyeron === 2) liberar?.();
            await espera;

            return latest;
          };
        },
      }),
    };

    const emitirConBarrera = (orderId: string) =>
      emitInvoice({ orderId, actorUserId: "user_test" }, conBarrera);

    const [a, b] = await Promise.all([
      emitirConBarrera(primero),
      emitirConBarrera(segundo),
    ]);

    expect(a.invoice.number).not.toBe(b.invoice.number);

    const invoices = await prisma.invoice.findMany({ orderBy: { number: "asc" } });

    expect(invoices).toHaveLength(2);
    expect(invoices.map((invoice) => invoice.number)).toEqual(
      [a.invoice.number, b.invoice.number].sort(),
    );
  });

  it("dos emisiones simultáneas del MISMO pedido: una sola factura, las dos respuestas la describen", async () => {
    const prisma = getPrismaClient();
    const orderId = await paidOrder("P-0003");

    // El caso real: el cajero toca «facturar» dos veces (o la pantalla reintenta). Secuencialmente el caso
    // de uso ya devuelve la factura existente (`reused`); en simultáneo las dos pasan la comprobación previa.
    const [a, b] = await Promise.all([emit(orderId), emit(orderId)]);

    expect(a.invoice.id).toBe(b.invoice.id);
    expect(await prisma.invoice.count({ where: { orderId } })).toBe(1);
  });

  it("un reintento después de emitir devuelve la misma factura", async () => {
    const orderId = await paidOrder("P-0004");

    const primera = await emit(orderId);
    const reintento = await emit(orderId);

    expect(reintento.reused).toBe(true);
    expect(reintento.invoice.number).toBe(primera.invoice.number);
  });
});
