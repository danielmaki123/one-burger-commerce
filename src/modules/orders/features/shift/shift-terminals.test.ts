import { describe, expect, it } from "vitest";

import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import { InMemoryShiftRepository } from "@/modules/orders/adapters/in-memory-shift-repository";
import type { ShiftBankCloseInput } from "@/modules/orders/domain/shift-bank-close";
import { runInMemoryShiftTransaction } from "@/shared/testing/in-memory-shift-transaction";

import { closeShift } from "./close-shift";
import { getCurrentShift } from "./get-current-shift";
import { openShift } from "./open-shift";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — **el turno por terminal**.
 *
 * El negocio tiene dos POS por sucursal (mostrador y barra) y los dos tienen que poder estar abiertos a la
 * vez, cada uno con su conteo y su cierre. Lo que fijan estos casos:
 *
 * 1. La terminal se **valida** contra el catálogo activo de la sucursal: sin terminales cargadas la caja se
 *    abre como siempre (una sola por local) y, con terminales cargadas, elegir una es obligatorio.
 * 2. Cada terminal ve **su** caja: dos turnos abiertos en el mismo local no se pisan.
 * 3. El arqueo de cada turno lee **sus** cobros (`Payment.shiftId`), no la ventana de tiempo del local: sin
 *    eso, las dos cajas se contarían la misma plata. Un turno sin cobros atribuidos sigue leyendo por
 *    ventana (los turnos de antes de esta fase).
 */

const LOCATION = "loc_principal";

function buildDeps(input: { terminals?: string[] } = {}) {
  const shiftRepository = new InMemoryShiftRepository();
  const paymentRepository = new InMemoryPaymentRepository();
  const locationRepository = new InMemoryLocationRepository([
    createInMemoryLocation({ id: LOCATION, name: "Principal" }),
  ]);

  return {
    shiftRepository,
    paymentRepository,
    locationRepository,
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36.5,
    // TASK-AUD-005: el cierre corre adentro de su unidad de trabajo (el doble la resuelve en memoria).
    runInShiftTransaction: runInMemoryShiftTransaction({ shiftRepository, paymentRepository }),
    ...(input.terminals ? { cashTerminalIds: input.terminals } : {}),
  };
}

describe("openShift · terminal", () => {
  it("una sucursal sin terminales cargadas abre la caja como siempre (sin terminal)", async () => {
    const deps = buildDeps();

    const opened = await openShift(
      { locationId: LOCATION, userId: "user_01", openingAmount: 500 },
      deps,
    );

    expect(opened.data.terminalId).toBeNull();
  });

  it("con terminales cargadas, elegir una es obligatorio", async () => {
    const deps = buildDeps({ terminals: ["term_caja_1", "term_barra"] });

    await expect(
      openShift({ locationId: LOCATION, userId: "user_01", openingAmount: 0 }, deps),
    ).rejects.toMatchObject({
      status: 422,
      fields: { terminalId: "Elegí en qué terminal del local estás." },
    });
  });

  it("rechaza una terminal que no está activa en el local", async () => {
    // Una terminal de otra sucursal (o una apagada) no puede abrir una caja acá aunque venga en el payload.
    const deps = buildDeps({ terminals: ["term_caja_1"] });

    await expect(
      openShift(
        { locationId: LOCATION, userId: "user_01", terminalId: "term_barra" },
        deps,
      ),
    ).rejects.toMatchObject({
      status: 422,
      fields: { terminalId: "Esa terminal no está activa en este local." },
    });
  });

  it("rechaza una terminal cuando el local no tiene ninguna cargada", async () => {
    const deps = buildDeps();

    await expect(
      openShift({ locationId: LOCATION, userId: "user_01", terminalId: "term_barra" }, deps),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("dos terminales del mismo local abren su propia caja a la vez", async () => {
    const deps = buildDeps({ terminals: ["term_caja_1", "term_barra"] });

    const caja1 = await openShift(
      { locationId: LOCATION, userId: "user_01", terminalId: "term_caja_1" },
      deps,
    );
    const barra = await openShift(
      { locationId: LOCATION, userId: "user_02", terminalId: "term_barra" },
      deps,
    );

    expect(caja1.data.id).not.toBe(barra.data.id);
    expect(deps.shiftRepository.shifts).toHaveLength(2);
  });

  it("la misma terminal no abre dos cajas", async () => {
    const deps = buildDeps({ terminals: ["term_caja_1"] });
    await openShift({ locationId: LOCATION, userId: "user_01", terminalId: "term_caja_1" }, deps);

    await expect(
      openShift({ locationId: LOCATION, userId: "user_02", terminalId: "term_caja_1" }, deps),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("un turno sin terminal sigue bloqueando la caja del local (el cubo del índice)", async () => {
    // Los turnos de antes de la fase (y las sucursales sin terminales) comparten el cubo «sin terminal»: ahí
    // sigue habiendo una sola caja abierta por local.
    const deps = buildDeps();
    await openShift({ locationId: LOCATION, userId: "user_01" }, deps);

    await expect(openShift({ locationId: LOCATION, userId: "user_02" }, deps)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("getCurrentShift · terminal", () => {
  it("cada terminal ve su propia caja", async () => {
    const deps = buildDeps({ terminals: ["term_caja_1", "term_barra"] });
    await openShift({ locationId: LOCATION, userId: "user_01", terminalId: "term_caja_1" }, deps);
    await openShift({ locationId: LOCATION, userId: "user_02", terminalId: "term_barra" }, deps);

    const caja1 = await getCurrentShift({ locationId: LOCATION, terminalId: "term_caja_1" }, deps);
    const barra = await getCurrentShift({ locationId: LOCATION, terminalId: "term_barra" }, deps);

    expect(caja1.data?.terminalId).toBe("term_caja_1");
    expect(barra.data?.terminalId).toBe("term_barra");
    expect(caja1.data?.id).not.toBe(barra.data?.id);
  });

  it("una terminal sin caja abierta devuelve null, aunque el local tenga otra caja abierta", async () => {
    const deps = buildDeps({ terminals: ["term_caja_1", "term_barra"] });
    await openShift({ locationId: LOCATION, userId: "user_01", terminalId: "term_caja_1" }, deps);

    const barra = await getCurrentShift({ locationId: LOCATION, terminalId: "term_barra" }, deps);

    expect(barra.data).toBeNull();
  });

  it("sin terminal sigue devolviendo la caja del local (una sola)", async () => {
    const deps = buildDeps();
    const opened = await openShift({ locationId: LOCATION, userId: "user_01" }, deps);

    const current = await getCurrentShift({ locationId: LOCATION }, deps);

    expect(current.data?.id).toBe(opened.data.id);
  });
});

describe("closeShift · arqueo por turno", () => {
  it("el arqueo lee los cobros del turno, no los del local", async () => {
    // Dos cajas abiertas: 500 en efectivo entraron a la caja 1 y 300 a la barra. Sin leer por turno, cada
    // cierre esperaría 800 (la ventana del local) y las dos cajas se contarían la misma plata.
    const deps = buildDeps({ terminals: ["term_caja_1", "term_barra"] });
    const caja1 = await openShift(
      { locationId: LOCATION, userId: "user_01", openingAmount: 0, terminalId: "term_caja_1" },
      deps,
    );
    const barra = await openShift(
      { locationId: LOCATION, userId: "user_02", openingAmount: 0, terminalId: "term_barra" },
      deps,
    );

    seedPayment(deps.paymentRepository, 500, caja1.data.id);
    seedPayment(deps.paymentRepository, 300, barra.data.id);

    const cierreCaja1 = await closeShift({ shiftId: caja1.data.id, closingAmount: 500 }, deps);
    const cierreBarra = await closeShift({ shiftId: barra.data.id, closingAmount: 300 }, deps);

    expect(cierreCaja1.data?.expectedAmount).toBe(500);
    expect(cierreCaja1.data?.difference).toBe(0);
    expect(cierreBarra.data?.expectedAmount).toBe(300);
    expect(cierreBarra.data?.difference).toBe(0);
  });

  it("un turno **con** terminal no cae a la ventana aunque no tenga cobros suyos", async () => {
    // El caso que cazó el E2E de la fase: si la caja del mostrador (sin ventas) cayera a la ventana del
    // local, «esperaría» la venta cobrada en la barra — la plata contada dos veces.
    const deps = buildDeps({ terminals: ["term_caja_1", "term_barra"] });
    const caja1 = await openShift(
      { locationId: LOCATION, userId: "user_01", openingAmount: 0, terminalId: "term_caja_1" },
      deps,
    );
    const barra = await openShift(
      { locationId: LOCATION, userId: "user_02", openingAmount: 0, terminalId: "term_barra" },
      deps,
    );

    seedPayment(deps.paymentRepository, 300, barra.data.id);

    const cierreCaja1 = await closeShift({ shiftId: caja1.data.id, closingAmount: 0 }, deps);

    expect(cierreCaja1.data?.expectedAmount).toBe(0);
    expect(cierreCaja1.data?.difference).toBe(0);
  });

  it("un turno sin cobros atribuidos sigue leyendo por ventana (los turnos de antes de la fase)", async () => {
    const deps = buildDeps();
    const opened = await openShift(
      { locationId: LOCATION, userId: "user_01", openingAmount: 100 },
      deps,
    );
    // Un cobro **sin** turno (el sitio público, o un turno viejo): entra por la ventana de tiempo.
    seedPayment(deps.paymentRepository, 250, null);

    const closed = await closeShift({ shiftId: opened.data.id, closingAmount: 350 }, deps);

    expect(closed.data?.expectedAmount).toBe(350);
  });
});

/** Un cobro en efectivo: con `shiftId` entra al turno; sin él, a la ventana del local. */
function seedPayment(
  paymentRepository: InMemoryPaymentRepository,
  amount: number,
  shiftId: string | null,
) {
  const orderId = `ord_${paymentRepository.payments.length + 1}`;
  paymentRepository.seedOrderLocation(orderId, LOCATION);
  paymentRepository.payments.push({
    id: `pay_${paymentRepository.payments.length + 1}`,
    orderId,
    method: "cash",
    amount,
    currency: null,
    changeAmount: 0,
    tip: 0,
    reference: null,
    createdAt: new Date().toISOString(),
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
  });

  if (shiftId) {
    paymentRepository.paymentShifts[`pay_${paymentRepository.payments.length}`] = shiftId;
  }
}

export type { ShiftBankCloseInput };
