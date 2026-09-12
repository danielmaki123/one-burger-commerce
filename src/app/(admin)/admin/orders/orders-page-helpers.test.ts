import { describe, expect, it } from "vitest";

import { businessDayRange, orderBucket } from "./orders-page-helpers";

/**
 * Fase 4 del checkout (D1) — un pedido puede ser para otro día.
 *
 * La bandeja del turno tiene que separarlo: si un pedido de mañana cae en "Nuevas", la
 * cocina lo empieza hoy. El día se calcula en la **zona del negocio**
 * (`BusinessSettings.timezone`), no en una fija: un negocio en otra zona ve su propio "hoy".
 */
describe("orderBucket", () => {
  const today = "2026-09-11";
  const managua = "America/Managua";

  it("agrupa por estado cuando el pedido es de hoy", () => {
    expect(
      orderBucket("new", { pickupTime: "2026-09-12T02:00:00.000Z", today, timeZone: managua }),
    ).toBe("nuevas");
    expect(
      orderBucket("preparing", {
        pickupTime: "2026-09-12T02:00:00.000Z",
        today,
        timeZone: managua,
      }),
    ).toBe("cocina");
    expect(
      orderBucket("ready_for_pickup", {
        pickupTime: "2026-09-12T02:00:00.000Z",
        today,
        timeZone: managua,
      }),
    ).toBe("listas");
  });

  it("un pedido abierto para otro día va a Programados, no al turno de hoy", () => {
    // 2026-09-13T02:00Z = sábado 12 de septiembre, 8:00 p. m. en Managua.
    expect(
      orderBucket("new", { pickupTime: "2026-09-13T02:00:00.000Z", today, timeZone: managua }),
    ).toBe("programados");
    expect(
      orderBucket("confirmed", {
        pickupTime: "2026-09-19T02:00:00.000Z",
        today,
        timeZone: managua,
      }),
    ).toBe("programados");
    // Un pedido de ayer que quedó abierto también sale del turno de hoy.
    expect(
      orderBucket("preparing", {
        pickupTime: "2026-09-11T02:00:00.000Z",
        today,
        timeZone: managua,
      }),
    ).toBe("programados");
  });

  /**
   * El mismo instante y el mismo "hoy" caen en días distintos según la zona del negocio:
   * 02:00 UTC es el 11 por la noche en Managua y el 12 al mediodía en Tokio.
   */
  it("el día se mide en la zona del negocio, no en una fija", () => {
    const pickupTime = "2026-09-12T02:00:00.000Z";

    expect(orderBucket("new", { pickupTime, today, timeZone: managua })).toBe("nuevas");
    expect(orderBucket("new", { pickupTime, today, timeZone: "Asia/Tokyo" })).toBe("programados");
  });

  it("un pedido cerrado se agrupa por estado aunque su retiro fuera de otro día", () => {
    expect(
      orderBucket("closed", { pickupTime: "2026-09-13T02:00:00.000Z", today, timeZone: managua }),
    ).toBe("cerradas");
    expect(
      orderBucket("cancelled", { pickupTime: "2026-09-13T02:00:00.000Z", today, timeZone: managua }),
    ).toBe("cerradas");
  });

  it("sin hora de retiro o sin día de referencia se agrupa como antes", () => {
    expect(orderBucket("new", { timeZone: managua })).toBe("nuevas");
    expect(orderBucket("new", { pickupTime: null, today, timeZone: managua })).toBe("nuevas");
    expect(orderBucket("new", { pickupTime: "no-es-fecha", today, timeZone: managua })).toBe(
      "nuevas",
    );
    expect(orderBucket("served", { timeZone: managua })).toBe("cerradas");
  });
});

/**
 * El rango de un día natural del negocio, que es lo que la bandeja manda a la API
 * (`dateFrom`/`dateTo` inclusive). Antes salía de la zona fija de Managua.
 */
describe("businessDayRange", () => {
  it("cubre el día entero de la zona del negocio, hasta el último milisegundo", () => {
    expect(businessDayRange("2026-09-11", "America/Managua")).toEqual({
      from: "2026-09-11T06:00:00.000Z",
      to: "2026-09-12T05:59:59.999Z",
    });
  });

  it("en otra zona el mismo día natural son otros instantes", () => {
    expect(businessDayRange("2026-09-11", "Asia/Tokyo")).toEqual({
      from: "2026-09-10T15:00:00.000Z",
      to: "2026-09-11T14:59:59.999Z",
    });
  });

  it("una fecha inválida no rompe la bandeja", () => {
    expect(businessDayRange("no-es-fecha", "America/Managua")).toEqual({
      from: undefined,
      to: undefined,
    });
  });
});
