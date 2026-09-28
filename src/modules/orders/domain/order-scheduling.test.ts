import { describe, expect, it } from "vitest";

import {
  DEFAULT_PICKUP_LEAD_MINUTES,
  groupScheduledOrders,
  isScheduledForAnotherDay,
  resolveRecommendedStart,
  resolveRecommendedStartForOrder,
} from "./order-scheduling";

/**
 * El scheduling del retiro, en **un solo lugar** (`orders/domain`).
 *
 * Antes no existía: el «inicio recomendado» se calculaba —cuando se calculaba— dentro de cada pantalla
 * de React, y el promedio de preparación se medía desde la creación. La referencia aprobada de Cocina
 * muestra `Inicio recomendado 17:35` para un retiro de `18:00`, y ese número sale de
 * `pickupTime − Location.pickupLeadMinutes`, no de una estimación inventada por la UI.
 *
 * La autoridad del lead es el **local** (`Location.pickupLeadMinutes`); el del negocio sólo es el
 * respaldo. Acá entra por parámetro porque el dominio no consulta la base.
 */
const TZ = "America/Managua"; // UTC-6, sin horario de verano.

describe("inicio recomendado del programado", () => {
  it("es la hora prometida menos el lead del local", () => {
    // 18:00 en Managua = 00:00Z del día siguiente.
    expect(
      resolveRecommendedStart({
        pickupTime: "2026-09-13T00:00:00.000Z",
        pickupLeadMinutes: 25,
      }),
    ).toBe("2026-09-12T23:35:00.000Z");
  });

  it("un lead de 0 significa «empezar a la hora prometida», no «sin dato»", () => {
    expect(
      resolveRecommendedStart({ pickupTime: "2026-09-13T00:00:00.000Z", pickupLeadMinutes: 0 }),
    ).toBe("2026-09-13T00:00:00.000Z");
  });

  it("sin hora prometida no hay inicio recomendado: el pedido del POS dice «lo antes posible»", () => {
    // Es el caso real de la venta de mostrador (`commit-sale.ts:183`: `pickupTime: null`). Inventarle
    // una hora sería mentirle a la cocina.
    expect(resolveRecommendedStart({ pickupTime: null, pickupLeadMinutes: 25 })).toBeNull();
    expect(resolveRecommendedStart({ pickupTime: undefined, pickupLeadMinutes: 25 })).toBeNull();
  });

  it("una hora ilegible tampoco inventa un inicio", () => {
    expect(
      resolveRecommendedStart({ pickupTime: "no es una fecha", pickupLeadMinutes: 25 }),
    ).toBeNull();
  });

  it("un lead inservible cae al valor por defecto, explícitamente", () => {
    const pickupTime = "2026-09-13T00:00:00.000Z";
    const expected = new Date(
      Date.parse(pickupTime) - DEFAULT_PICKUP_LEAD_MINUTES * 60_000,
    ).toISOString();

    for (const value of [null, undefined, 0.5, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        resolveRecommendedStart({ pickupTime, pickupLeadMinutes: value }),
        String(value),
      ).toBe(expected);
    }
  });

  it("el helper del pedido lee los dos campos que ya existen en la cola", () => {
    expect(
      resolveRecommendedStartForOrder(
        { pickupTime: "2026-09-13T00:00:00.000Z", pickupLeadMinutes: 20 },
      ),
    ).toBe("2026-09-12T23:40:00.000Z");
  });
});

describe("qué pedidos son «programados» y cuáles son «ahora»", () => {
  const today = "2026-09-12";
  const at = (iso: string) => ({ pickupTime: iso, pickupScheduled: true });

  it("un retiro para otro día del negocio es programado", () => {
    expect(
      isScheduledForAnotherDay(at("2026-09-13T15:00:00.000Z"), { today, timeZone: TZ }),
    ).toBe(true);
  });

  it("un retiro para hoy no es «de otro día», aunque sea más tarde", () => {
    expect(
      isScheduledForAnotherDay(at("2026-09-12T23:00:00.000Z"), { today, timeZone: TZ }),
    ).toBe(false);
  });

  it("un pedido sin hora prometida no es programado: es «lo antes posible»", () => {
    expect(
      isScheduledForAnotherDay(
        { pickupTime: null, pickupScheduled: false },
        { today, timeZone: TZ },
      ),
    ).toBe(false);
  });

  it("una hora ilegible no manda el pedido al grupo de programados", () => {
    expect(
      isScheduledForAnotherDay(
        { pickupTime: "no es una fecha", pickupScheduled: true },
        { today, timeZone: TZ },
      ),
    ).toBe(false);
  });

  /**
   * Los dos grupos internos del carril **ENTRADA** (spec de Cocina § *Carriles*): lo que se puede tomar
   * ya y lo que está comprometido para más tarde u otro día. El reparto conserva el orden recibido.
   */
  it("reparte ENTRADA en «ahora» y «programados» conservando el orden", () => {
    const grouped = groupScheduledOrders(
      [
        { id: "a", pickupTime: null, pickupScheduled: false },
        { id: "b", pickupTime: "2026-09-12T23:00:00.000Z", pickupScheduled: true },
        { id: "c", pickupTime: "2026-09-13T15:00:00.000Z", pickupScheduled: true },
        { id: "d", pickupTime: "2026-09-12T20:00:00.000Z", pickupScheduled: true },
      ],
      { today, timeZone: TZ },
    );

    expect(grouped.now.map((order) => order.id)).toEqual(["a", "b", "d"]);
    expect(grouped.scheduled.map((order) => order.id)).toEqual(["c"]);
  });
});
