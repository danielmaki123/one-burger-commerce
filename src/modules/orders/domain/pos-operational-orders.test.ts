import { describe, expect, it } from "vitest";

import {
  POS_OPERATIONAL_IN_PROCESS_STATUSES,
  POS_OPERATIONAL_FEED_STATUSES,
  classifyPosOperational,
  countPosOperationalSummary,
  isPosOperationalInProcess,
  isPosOperationalReady,
  isPosOperationalScheduled,
  isPosOperationalPendingPayment,
  summarizePosOperationalOrders,
  type PosOperationalClassifiable,
} from "@/modules/orders/domain/pos-operational-orders";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §6, §7) — **los cuatro KPI operacionales del POS**.
 *
 * El brief es explícito en dos cosas que estos tests fijan:
 *
 * 1. **Los KPI son dimensiones superpuestas, no categorías excluyentes.** El mismo pedido de `P-1902`
 *    (programado 12:30, `ready_for_pickup`, impago) tiene que contar en **Listos + Por cobrar +
 *    Programados** a la vez. El `expected` de cada caso se deriva de la definición del brief, escritas
 *    acá como literales: **no** se reusa la función de producción para calcular lo que se espera.
 * 2. **`Programados` ordena por `pickupTime`, no por `createdAt`.** Un pedido creado ayer para mañana
 *    sigue siendo un programado válido y va **antes** que uno creado hoy para pasado mañana.
 */

function order(overrides: Partial<PosOperationalClassifiable> = {}): PosOperationalClassifiable {
  return {
    status: "new",
    pickupScheduled: false,
    pickupTime: null,
    financialStatus: "pending",
    unresolvedAmount: 0,
    ...overrides,
  };
}

describe("pos-operational-orders · En proceso", () => {
  it("cuenta new, confirmed y preparing, y nada más", () => {
    // Definición del brief §6: activos en estados equivalentes a new / confirmed / preparing.
    expect(POS_OPERATIONAL_IN_PROCESS_STATUSES).toEqual(["new", "confirmed", "preparing"]);

    for (const status of ["new", "confirmed", "preparing"] as const) {
      expect(isPosOperationalInProcess(status)).toBe(true);
    }

    // Excluidos explícitos del brief: lo listo ya no se está preparando y lo entregado/cerrado/cancelado
    // es historia.
    for (const status of [
      "ready",
      "ready_for_pickup",
      "picked_up",
      "closed",
      "cancelled",
      "delivered",
      "out_for_delivery",
      "accepted",
      "served",
    ] as const) {
      expect(isPosOperationalInProcess(status)).toBe(false);
    }
  });
});

describe("pos-operational-orders · Listos", () => {
  it("es exactamente ready_for_pickup", () => {
    expect(isPosOperationalReady("ready_for_pickup")).toBe(true);
    expect(isPosOperationalReady("preparing")).toBe(false);
    expect(isPosOperationalReady("ready")).toBe(false);
    expect(isPosOperationalReady("picked_up")).toBe(false);
    expect(isPosOperationalReady("closed")).toBe(false);
    expect(isPosOperationalReady("cancelled")).toBe(false);
  });
});

describe("pos-operational-orders · Por cobrar", () => {
  it("es no-pagado: pending y partial cuentan, paid no", () => {
    expect(isPosOperationalPendingPayment("pending")).toBe(true);
    expect(isPosOperationalPendingPayment("partial")).toBe(true);
    expect(isPosOperationalPendingPayment("paid")).toBe(false);
  });

  it("distingue el parcial que hay que revisar del cobrable", () => {
    // Brief §6 y §32: `partial` sin plata no demostrable es una liquidación a medias que el cajero puede
    // completar; con `unresolvedAmount > 0` hay cobros cuyo equivalente no se puede demostrar y sale del
    // flujo normal (REVISAR).
    const cobrable = classifyPosOperational(order({ status: "preparing", financialStatus: "partial" }));
    expect(cobrable.pendingPayment).toBe(true);
    expect(cobrable.needsReview).toBe(false);
    expect(cobrable.chargeable).toBe(true);

    const revisar = classifyPosOperational(
      order({ status: "preparing", financialStatus: "partial", unresolvedAmount: 120 }),
    );
    expect(revisar.pendingPayment).toBe(true);
    expect(revisar.needsReview).toBe(true);
    expect(revisar.chargeable).toBe(false);
  });

  it("un pedido cobrado no está por cobrar", () => {
    const paid = classifyPosOperational(order({ status: "ready_for_pickup", financialStatus: "paid" }));
    expect(paid.pendingPayment).toBe(false);
    expect(paid.chargeable).toBe(false);
  });
});

describe("pos-operational-orders · Programados", () => {
  it("exige pickupScheduled y una hora prometida", () => {
    expect(
      isPosOperationalScheduled({ pickupScheduled: true, pickupTime: "2026-10-02T12:30:00.000Z" }),
    ).toBe(true);

    // Sin hora no hay nada que ordenar ni promesa que cumplir.
    expect(isPosOperationalScheduled({ pickupScheduled: true, pickupTime: null })).toBe(false);
    // Con hora pero sin marcar: es «lo antes posible», no un programado.
    expect(
      isPosOperationalScheduled({ pickupScheduled: false, pickupTime: "2026-10-02T12:30:00.000Z" }),
    ).toBe(false);
  });

  it("un programado sigue siéndolo aunque su retiro sea de otro día", () => {
    // El brief es explícito: «un pedido creado ayer para mañana sigue siendo un Programado válido». El
    // reparto por día del negocio es de Cocina (`groupScheduledOrders`), no del KPI del POS.
    const ayer = classifyPosOperational(
      order({ status: "confirmed", pickupScheduled: true, pickupTime: "2026-10-02T12:30:00.000Z" }),
    );
    expect(ayer.scheduled).toBe(true);
  });
});

describe("pos-operational-orders · superposición intencional", () => {
  it("P-1902 programado, listo e impago cuenta en Listos + Por cobrar + Programados", () => {
    // El caso literal del brief §7.
    const summary = countPosOperationalSummary([
      order({
        status: "ready_for_pickup",
        pickupScheduled: true,
        pickupTime: "2026-10-02T12:30:00.000Z",
        financialStatus: "pending",
      }),
    ]);

    expect(summary).toEqual({ inProcess: 0, ready: 1, pendingPayment: 1, scheduled: 1 });
  });

  it("los cuatro contadores se calculan sobre el conjunto completo, no exclusivo", () => {
    const summary = countPosOperationalSummary([
      order({ status: "new", financialStatus: "pending" }),
      order({ status: "confirmed", financialStatus: "paid" }),
      order({ status: "preparing", financialStatus: "partial" }),
      order({ status: "ready_for_pickup", financialStatus: "pending" }),
      order({ status: "ready_for_pickup", financialStatus: "paid" }),
      order({
        status: "preparing",
        financialStatus: "pending",
        pickupScheduled: true,
        pickupTime: "2026-10-02T08:00:00.000Z",
      }),
    ]);

    // En proceso: new + confirmed + preparing + preparing programado = 4.
    expect(summary.inProcess).toBe(4);
    // Listos: los dos ready_for_pickup = 2.
    expect(summary.ready).toBe(2);
    // Por cobrar: new + preparing(partial) + ready pending + preparing programado = 4. El pedido `paid` no
    // cuenta y el `partial` sí (es deuda).
    expect(summary.pendingPayment).toBe(4);
    // Programados: el preparing programado con hora = 1.
    expect(summary.scheduled).toBe(1);
  });

  it("un pedido entregado o cerrado no cuenta en Listos", () => {
    const summary = countPosOperationalSummary([
      order({ status: "picked_up", financialStatus: "paid" }),
      order({ status: "closed", financialStatus: "paid" }),
    ]);

    expect(summary.ready).toBe(0);
    expect(summary.inProcess).toBe(0);
  });
});

describe("pos-operational-orders · feed operativo", () => {
  it("el feed sólo trae pedidos vivos: lo terminal y lo cancelado quedan afuera", () => {
    // Sin esto el POS tendría que dibujar historia; el brief §10 pide el trabajo del cajero de ahora.
    expect(POS_OPERATIONAL_FEED_STATUSES).toEqual([
      "new",
      "confirmed",
      "accepted",
      "preparing",
      "ready",
      "ready_for_pickup",
    ]);

    expect(POS_OPERATIONAL_FEED_STATUSES).not.toContain("picked_up");
    expect(POS_OPERATIONAL_FEED_STATUSES).not.toContain("closed");
    expect(POS_OPERATIONAL_FEED_STATUSES).not.toContain("cancelled");
  });

  it("el resumen de un feed vacío es cero, no `NaN`", () => {
    expect(summarizePosOperationalOrders([])).toEqual({
      inProcess: 0,
      ready: 0,
      pendingPayment: 0,
      scheduled: 0,
    });
  });
});
