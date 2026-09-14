import { describe, expect, it } from "vitest";

import {
  businessDayRange,
  orderBucket,
  sortQueueOrders,
} from "./orders-page-helpers";

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

/**
 * B0 — el orden de la cola del turno.
 *
 * La API devuelve por creación descendente, que es lo correcto para el historial, pero en la cola
 * manda **la hora prometida**: un pedido que entró después pero se retira antes no puede quedar
 * debajo. Antes la bandeja mostraba primero el más nuevo y el que había que empezar ya quedaba al
 * fondo (con 10 pedidos, invisible).
 */
describe("sortQueueOrders", () => {
  const order = (id: string, pickupTime: string | null, createdAt: string) => ({
    id,
    pickupTime,
    createdAt,
  });

  it("ordena por la hora prometida, no por cuándo entró", () => {
    const sorted = sortQueueOrders([
      order("tarde", "2026-09-12T02:30:00.000Z", "2026-09-12T01:00:00.000Z"),
      order("temprano", "2026-09-12T02:00:00.000Z", "2026-09-12T01:40:00.000Z"),
      order("medio", "2026-09-12T02:15:00.000Z", "2026-09-12T01:20:00.000Z"),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["temprano", "medio", "tarde"]);
  });

  it("con la misma hora prometida gana el que entró antes", () => {
    const sorted = sortQueueOrders([
      order("nuevo", "2026-09-12T02:00:00.000Z", "2026-09-12T01:30:00.000Z"),
      order("viejo", "2026-09-12T02:00:00.000Z", "2026-09-12T01:10:00.000Z"),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["viejo", "nuevo"]);
  });

  it("un pedido sin hora prometida queda después de los que sí la tienen", () => {
    // El retiro siempre trae hora; si faltara, no puede adelantarse a un compromiso con reloj.
    const sorted = sortQueueOrders([
      order("sin-hora", null, "2026-09-12T00:30:00.000Z"),
      order("con-hora", "2026-09-12T02:00:00.000Z", "2026-09-12T01:40:00.000Z"),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["con-hora", "sin-hora"]);
  });

  it("no muta la lista que recibe", () => {
    const original = [
      order("b", "2026-09-12T02:30:00.000Z", "2026-09-12T01:00:00.000Z"),
      order("a", "2026-09-12T02:00:00.000Z", "2026-09-12T01:00:00.000Z"),
    ];

    sortQueueOrders(original);

    expect(original.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});
