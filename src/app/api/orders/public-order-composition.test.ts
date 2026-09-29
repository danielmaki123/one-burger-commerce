import { describe, expect, it } from "vitest";

import { buildPublicOrderInput } from "./public-order-composition";

/**
 * La composición del alta pública: **canal**, **hora** y **programado**.
 *
 * Las tres son decisiones del servidor, y las tres se equivocaron alguna vez: el canal no existía (se
 * agregó con `TASK-ORDERS-KITCHEN-RUNTIME-002`), la hora viajaba del cliente (un formulario lento la
 * volvía una hora del pasado) y `pickupScheduled` se creía lo que dijera el request.
 */
const PARSED = {
  type: "pickup" as const,
  customerName: "Ana López",
  customerWhatsapp: "+50588887777",
  items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
};

const ACCEPTED_AT = new Date("2026-09-12T23:35:00.000Z");

describe("buildPublicOrderInput", () => {
  it("declara el canal `menu`: el menú público es esta puerta", () => {
    const input = buildPublicOrderInput({
      parsed: PARSED,
      acceptancePickupTime: ACCEPTED_AT,
      requestedPickupTime: false,
      currencyCode: "NIO",
    });

    expect(input.source).toBe("menu");
  });

  it("el canal del cuerpo del request **no** puede cambiarlo", () => {
    const input = buildPublicOrderInput({
      // Un cuerpo hostil que intenta declararse del mostrador.
      parsed: { ...PARSED, source: "pos" } as typeof PARSED,
      acceptancePickupTime: ACCEPTED_AT,
      requestedPickupTime: false,
      currencyCode: "NIO",
    });

    expect(input.source).toBe("menu");
  });

  it("la hora prometida es la del servidor, en ISO", () => {
    const input = buildPublicOrderInput({
      parsed: PARSED,
      acceptancePickupTime: ACCEPTED_AT,
      requestedPickupTime: true,
      currencyCode: "NIO",
    });

    expect(input.pickupTime).toBe("2026-09-12T23:35:00.000Z");
  });

  it("`pickupScheduled` sale de si el cliente eligió una hora, no de lo que diga el cuerpo", () => {
    expect(
      buildPublicOrderInput({
        parsed: { ...PARSED, pickupScheduled: true } as typeof PARSED,
        acceptancePickupTime: ACCEPTED_AT,
        requestedPickupTime: false,
        currencyCode: "NIO",
      }).pickupScheduled,
    ).toBe(false);

    expect(
      buildPublicOrderInput({
        parsed: PARSED,
        acceptancePickupTime: ACCEPTED_AT,
        requestedPickupTime: true,
        currencyCode: "NIO",
      }).pickupScheduled,
    ).toBe(true);
  });

  it("la clave de idempotencia viaja, y sin clave queda `null`", () => {
    expect(
      buildPublicOrderInput({
        parsed: PARSED,
        acceptancePickupTime: ACCEPTED_AT,
        requestedPickupTime: false,
        currencyCode: "NIO",
        idempotencyKey: "op-1",
      }).idempotencyKey,
    ).toBe("op-1");

    expect(
      buildPublicOrderInput({
        parsed: PARSED,
        acceptancePickupTime: ACCEPTED_AT,
        requestedPickupTime: false,
        currencyCode: "NIO",
      }).idempotencyKey,
    ).toBeNull();
  });

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-89`) — la moneda con la que el pedido congela sus
   * montos la resuelve la **ruta** (`money`) y viaja en el input; el cuerpo del request no la elige.
   */
  it("la moneda del pedido viaja en el input y no sale del cuerpo del request", () => {
    const input = buildPublicOrderInput({
      parsed: PARSED,
      acceptancePickupTime: ACCEPTED_AT,
      requestedPickupTime: false,
      currencyCode: "NIO",
    });

    expect(input.currencyCode).toBe("NIO");
  });
});
