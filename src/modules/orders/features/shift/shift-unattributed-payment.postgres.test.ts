import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { closeShift } from "@/modules/orders/features/shift/close-shift";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * TASK-AUD-054 — **ningún cobro puede quedar fuera de todo arqueo**.
 *
 * El cobro de un pedido que ya existe (`POST /api/admin/orders/[id]/payment`) se registra aunque no haya
 * caja abierta —decisión deliberada: perder la venta sería peor— y en ese caso queda **sin turno**
 * (`Payment.shiftId = null`). El arqueo de un turno **con terminal** leía **solo** los cobros atribuidos a ese
 * turno, así que ese cobro no entraba al arqueo de nadie: la plata estaba en el cajón y ningún cierre la
 * explicaba.
 *
 * La invariante que se fija acá: **todo cobro entra al arqueo de exactamente un turno** — el suyo si tiene
 * `shiftId`, y si no lo tiene, el del turno cuya ventana de tiempo lo contiene (una sola caja lo va a leer,
 * porque los cobros de las otras terminales sí están atribuidos).
 */

const SHIFT_ID = "shift_test";
const TERMINAL = "term_caja_1";

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_test",
      name: "Cajera de prueba",
      email: "cajera@a54.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "cashier",
    },
  });

  await prisma.location.create({
    data: {
      id: "loc_test",
      name: "Local de prueba",
      slug: "local-a54",
      businessHours: [],
    },
  });

  // La terminal de la caja: el turno la referencia (`Shift.terminalId` es una FK a `PosTerminal`).
  await prisma.posTerminal.create({
    data: { id: TERMINAL, locationId: "loc_test", label: "Caja 1" },
  });

  await prisma.shift.create({
    data: {
      id: SHIFT_ID,
      locationId: "loc_test",
      userId: "user_test",
      status: "open",
      openingAmount: 0,
      // Un turno **con terminal**: es el caso que solo leía sus cobros atribuidos.
      terminalId: TERMINAL,
    },
  });
}

/** Un pedido cobrado sin caja abierta: el `Payment` queda sin turno. */
async function chargeWithoutShift(orderNumber: string, amount: number): Promise<void> {
  const prisma = getPrismaClient();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      type: "pickup",
      status: "ready",
      customerName: "Cliente de prueba",
      customerWhatsapp: "+50588887770",
      locationId: "loc_test",
      subtotal: amount,
      total: amount,
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      method: "cash",
      amount,
      currency: "NIO",
      changeAmount: 0,
      // Sin turno: no había caja abierta cuando se cobró.
      shiftId: null,
    },
  });
}

async function closeDeps() {
  return createProductionPosShiftDependencies({ locationId: "loc_test" });
}

describe("TASK-AUD-054 · un cobro sin turno entra al arqueo de su ventana (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("el cierre de un turno CON terminal cuenta el cobro que entró sin caja abierta", async () => {
    await chargeWithoutShift("P-A54-1", 100);

    const cierre = await closeShift({ shiftId: SHIFT_ID, closingAmount: 100 }, await closeDeps());

    expect(
      cierre.data?.expectedAmount,
      "el cobro sin turno no entró al arqueo de nadie: la plata estaba en el cajón y ningún cierre la explicaba",
    ).toBe(100);
    expect(cierre.data?.cashSalesAmount).toBe(100);
    expect(cierre.data?.difference).toBe(0);
  });

  it("dos turnos con terminal no se cuentan la misma plata: cada uno ve lo suyo y lo sin turno", async () => {
    const prisma = getPrismaClient();

    // El turno de la otra caja, abierto a la vez (dos terminales del mismo local).
    await prisma.posTerminal.create({
      data: { id: "term_barra", locationId: "loc_test", label: "Barra" },
    });
    await prisma.shift.create({
      data: {
        id: "shift_barra",
        locationId: "loc_test",
        userId: "user_test",
        status: "open",
        openingAmount: 0,
        terminalId: "term_barra",
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: "P-A54-2",
        type: "pickup",
        status: "ready",
        customerName: "Cliente de prueba",
        customerWhatsapp: "+50588887771",
        locationId: "loc_test",
        subtotal: 300,
        total: 300,
      },
    });

    // 300 atribuidos a la barra y 100 sin turno (cobrados sin caja abierta).
    await prisma.payment.create({
      data: { orderId: order.id, method: "card", amount: 300, currency: "NIO", shiftId: "shift_barra" },
    });
    await prisma.payment.create({
      data: { orderId: order.id, method: "cash", amount: 100, currency: "NIO", shiftId: null },
    });

    const cierreCaja = await closeShift({ shiftId: SHIFT_ID, closingAmount: 100 }, await closeDeps());

    // La caja ve su venta (100 en efectivo, sin turno) y **no** los 300 de la barra.
    expect(cierreCaja.data?.expectedAmount).toBe(100);
    expect(cierreCaja.data?.cashSalesAmount).toBe(100);
    expect(cierreCaja.data?.cardSalesAmount).toBe(0);
  });
});
