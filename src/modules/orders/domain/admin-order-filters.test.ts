import { describe, expect, it } from "vitest";

import {
  ADMIN_ORDER_ACTIVE_STATUSES,
  ADMIN_ORDER_DATE_PRESETS,
  ADMIN_ORDER_PAYMENT_FILTERS,
  ADMIN_ORDER_STATUS_GROUPS,
  isPendingPaymentState,
  matchesAdminOrderPaymentFilter,
  resolveAdminOrderRange,
  resolveAdminOrderStatusGroup,
  resolveFinancialStateLabel,
} from "@/modules/orders/domain/admin-order-filters";

/**
 * `TASK-ORDERS-RUNTIME-5B` — los **filtros** del listado de Pedidos, en el dominio.
 *
 * Todo lo que decide qué pedidos entran al listado vive acá y no en la pantalla: los rangos de fecha
 * (Hoy · Ayer · 7 días · 30 días), el agrupamiento de estados del `<select>`, y el filtro por estado de
 * pago. La pantalla sólo traduce el control a un valor y lo escribe en la URL.
 *
 * **La zona horaria es la del negocio y entra por parámetro**: «hoy» es el día del local, no el del
 * navegador de quien mira (`A-63`). Los valores esperados se derivan de la regla del negocio (el día
 * natural en la zona), no de volver a llamar a la función.
 */

const MANAGUA = "America/Managua";

describe("resolveAdminOrderRange — los cuatro rangos aprobados", () => {
  it("«hoy» va de las 00:00 a la última hora del día del negocio", () => {
    // 2026-09-30 00:00 en Managua (UTC−6) es 06:00Z, y el día termina 1 ms antes del 01/10 00:00 local.
    const range = resolveAdminOrderRange({
      preset: "today",
      timeZone: MANAGUA,
      now: new Date("2026-09-30T18:30:00.000Z"),
    });

    expect(range.from).toBe("2026-09-30T06:00:00.000Z");
    expect(range.to).toBe("2026-10-01T05:59:59.999Z");
  });

  it("«ayer» es el día natural anterior, completo", () => {
    const range = resolveAdminOrderRange({
      preset: "yesterday",
      timeZone: MANAGUA,
      now: new Date("2026-09-30T18:30:00.000Z"),
    });

    expect(range.from).toBe("2026-09-29T06:00:00.000Z");
    expect(range.to).toBe("2026-09-30T05:59:59.999Z");
  });

  it("«7 días» incluye hoy y los seis días anteriores", () => {
    const range = resolveAdminOrderRange({
      preset: "7d",
      timeZone: MANAGUA,
      now: new Date("2026-09-30T18:30:00.000Z"),
    });

    // 7 días contando hoy: arranca el 24/09 a las 00:00 locales y termina con el día de hoy.
    expect(range.from).toBe("2026-09-24T06:00:00.000Z");
    expect(range.to).toBe("2026-10-01T05:59:59.999Z");
  });

  it("«30 días» incluye hoy y los veintinueve anteriores", () => {
    const range = resolveAdminOrderRange({
      preset: "30d",
      timeZone: MANAGUA,
      now: new Date("2026-09-30T18:30:00.000Z"),
    });

    expect(range.from).toBe("2026-09-01T06:00:00.000Z");
    expect(range.to).toBe("2026-10-01T05:59:59.999Z");
  });

  /**
   * La medianoche del negocio no es la del servidor: a las 23:40 locales del 30/09, en UTC ya es el 01/10.
   * Este es el caso que `A-63` documentaba: con la zona del navegador (o del servidor) el rango se corría un
   * día entero.
   */
  it("a las 23:40 locales el rango sigue siendo el día del negocio", () => {
    const range = resolveAdminOrderRange({
      preset: "today",
      timeZone: MANAGUA,
      now: new Date("2026-10-01T05:40:00.000Z"),
    });

    expect(range.from).toBe("2026-09-30T06:00:00.000Z");
    expect(range.to).toBe("2026-10-01T05:59:59.999Z");
  });

  it("sin preset no hay rango: el filtro queda abierto, no se inventa un día", () => {
    const range = resolveAdminOrderRange({
      preset: null,
      timeZone: MANAGUA,
      now: new Date("2026-09-30T18:30:00.000Z"),
    });

    expect(range).toEqual({ from: undefined, to: undefined });
  });

  it("los presets son exactamente los cuatro aprobados", () => {
    expect(ADMIN_ORDER_DATE_PRESETS).toEqual(["today", "yesterday", "7d", "30d"]);
  });
});

describe("resolveAdminOrderStatusGroup — el agrupamiento del control de estado", () => {
  it("«proceso» es lo aceptado y lo que está en cocina, no lo nuevo ni lo cerrado", () => {
    expect(resolveAdminOrderStatusGroup("process")).toEqual([
      "confirmed",
      "accepted",
      "preparing",
      "out_for_delivery",
    ]);
  });

  it("cada grupo devuelve sólo estados del esquema y ninguno se repite entre grupos", () => {
    expect(resolveAdminOrderStatusGroup("new")).toEqual(["new"]);
    expect(resolveAdminOrderStatusGroup("ready")).toEqual(["ready", "ready_for_pickup"]);
    expect(resolveAdminOrderStatusGroup("closed")).toEqual([
      "picked_up",
      "delivered",
      "served",
      "closed",
    ]);
    expect(resolveAdminOrderStatusGroup("cancelled")).toEqual(["cancelled"]);

    const all = ADMIN_ORDER_STATUS_GROUPS.flatMap((group) =>
      resolveAdminOrderStatusGroup(group),
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it("«todos» no filtra estados", () => {
    expect(resolveAdminOrderStatusGroup("all")).toEqual([]);
  });
});

/**
 * El KPI «N activas» y el grupo «proceso» **no** son lo mismo, y el test lo dice: «activas» es todo lo
 * que todavía es trabajo del local —incluidos los programados que ya están aceptados— y deja afuera lo
 * que terminó (retirado, cerrado, entregado, servido) y lo cancelado.
 */
describe("ADMIN_ORDER_ACTIVE_STATUSES", () => {
  it("deja afuera lo terminado y lo cancelado", () => {
    expect(ADMIN_ORDER_ACTIVE_STATUSES).not.toContain("cancelled");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).not.toContain("closed");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).not.toContain("picked_up");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).not.toContain("delivered");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).not.toContain("served");
  });

  it("incluye lo que todavía espera trabajo, aunque esté listo", () => {
    expect(ADMIN_ORDER_ACTIVE_STATUSES).toContain("new");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).toContain("confirmed");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).toContain("preparing");
    expect(ADMIN_ORDER_ACTIVE_STATUSES).toContain("ready_for_pickup");
  });
});

/**
 * El **estado financiero** es de `payments`: acá sólo se decide qué entra en «Pendientes» y qué en
 * «Pagados», y cómo se rotula. `unresolvedAmount` **nunca** se convierte con una tasa vigente: si hay
 * plata cobrada que no se puede demostrar, el pedido se marca para revisar.
 */
describe("el filtro por estado de pago", () => {
  it("«Pendientes» incluye pending y partial, y deja paid afuera", () => {
    expect(ADMIN_ORDER_PAYMENT_FILTERS).toEqual(["all", "pending", "paid"]);

    expect(matchesAdminOrderPaymentFilter({ filter: "pending", state: "pending" })).toBe(true);
    expect(matchesAdminOrderPaymentFilter({ filter: "pending", state: "partial" })).toBe(true);
    expect(matchesAdminOrderPaymentFilter({ filter: "pending", state: "paid" })).toBe(false);
  });

  it("«Pagados» es sólo paid", () => {
    expect(matchesAdminOrderPaymentFilter({ filter: "paid", state: "paid" })).toBe(true);
    expect(matchesAdminOrderPaymentFilter({ filter: "paid", state: "partial" })).toBe(false);
    expect(matchesAdminOrderPaymentFilter({ filter: "paid", state: "pending" })).toBe(false);
  });

  it("«todos» no filtra", () => {
    expect(matchesAdminOrderPaymentFilter({ filter: "all", state: "pending" })).toBe(true);
    expect(matchesAdminOrderPaymentFilter({ filter: "all", state: "paid" })).toBe(true);
  });

  it("el KPI de pendientes cuenta el complemento de paid, no sólo pending (D-020)", () => {
    // La precedencia de `payments`: `partial` es un pedido que **todavía no está pago** —o tiene saldo, o
    // tiene plata no demostrable—. Contarlo como pagado escondería deuda.
    expect(isPendingPaymentState("pending")).toBe(true);
    expect(isPendingPaymentState("partial")).toBe(true);
    expect(isPendingPaymentState("paid")).toBe(false);
  });
});

describe("resolveFinancialStateLabel — el rótulo aprobado", () => {
  it("los tres estados tienen su rótulo", () => {
    expect(
      resolveFinancialStateLabel({ state: "pending", unresolvedAmount: 0 }),
    ).toEqual({ label: "PENDIENTE", tone: "pending", needsReview: false });

    expect(
      resolveFinancialStateLabel({ state: "partial", unresolvedAmount: 0 }),
    ).toEqual({ label: "PARCIAL", tone: "partial", needsReview: false });

    expect(resolveFinancialStateLabel({ state: "paid", unresolvedAmount: 0 })).toEqual({
      label: "PAGADO",
      tone: "paid",
      needsReview: false,
    });
  });

  it("parcial con plata no demostrable se marca PARCIAL · REVISAR", () => {
    expect(
      resolveFinancialStateLabel({ state: "partial", unresolvedAmount: 120.5 }),
    ).toEqual({ label: "PARCIAL · REVISAR", tone: "review", needsReview: true });
  });

  it("un resolvedor no inventa: un paidsin saldo no se marca para revisar", () => {
    // `paid` con `unresolvedAmount > 0` no existe en la precedencia de `payments`; si llegara, el rótulo
    // sigue siendo el de `paid` y no se convierte ningún monto.
    expect(
      resolveFinancialStateLabel({ state: "paid", unresolvedAmount: 10 }),
    ).toEqual({ label: "PAGADO", tone: "paid", needsReview: false });
  });
});
