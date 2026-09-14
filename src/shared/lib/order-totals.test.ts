import { describe, expect, it } from "vitest";

import {
  calculateOrderTotal,
  calculateOrderTotals,
  calculatePackagingAmount,
  calculateTipAmount,
  roundCurrency,
} from "./order-totals";

/**
 * TASK-102 — la fuente canónica del total.
 *
 * `calculateOrderTotal` recibe los componentes ya calculados; es la **misma** suma que usa
 * `calculateOrderTotals`, extraída para que los lugares que no tienen las líneas del pedido (el
 * agregado de ítems de mesa, la corrección del envío, la tarjeta de resumen) no la reescriban.
 */
describe("calculateOrderTotal", () => {
  it("suma los cinco componentes en el orden canónico", () => {
    expect(
      calculateOrderTotal({
        subtotal: 100,
        discount: 10,
        packagingAmount: 5,
        deliveryFeeAmount: 20,
        tipAmount: 9,
      }),
    ).toBe(124);
  });

  it("sin descuento, empaque, envío ni propina el total es el subtotal", () => {
    expect(
      calculateOrderTotal({
        subtotal: 100,
        discount: 0,
        packagingAmount: 0,
        deliveryFeeAmount: 0,
        tipAmount: 0,
      }),
    ).toBe(100);
  });

  it("redondea a dos decimales sin arrastrar el error de punto flotante", () => {
    expect(
      calculateOrderTotal({
        subtotal: 0.1,
        discount: 0,
        packagingAmount: 0.2,
        deliveryFeeAmount: 0,
        tipAmount: 0,
      }),
    ).toBe(0.3);
  });

  it("coincide con calculateOrderTotals cuando recibe los mismos componentes", () => {
    const params = {
      subtotal: 250,
      discount: 25,
      deliveryFeeAmount: 30,
      items: [{ packagingTotalAmount: 7.5 }, { packagingTotalAmount: 2.5 }],
      tipOptIn: true,
      orderType: "pickup" as const,
      tipRate: 10,
    };

    const totals = calculateOrderTotals(params);

    expect(
      calculateOrderTotal({
        subtotal: params.subtotal,
        discount: params.discount,
        packagingAmount: totals.packagingAmount,
        deliveryFeeAmount: params.deliveryFeeAmount,
        tipAmount: totals.tipAmount,
      }),
    ).toBe(totals.total);
  });
});

/**
 * Estos casos ya existían por comportamiento; se dejan explícitos porque son la red del contrato:
 * si alguien toca la suma, tienen que seguir pasando.
 */
describe("order-totals · reglas existentes que no cambian (TASK-102)", () => {
  it("el empaque no se cobra en los pedidos de mesa", () => {
    expect(
      calculatePackagingAmount([{ packagingTotalAmount: 10 }], "table"),
    ).toBe(0);
    expect(
      calculatePackagingAmount([{ packagingTotalAmount: 10 }], "pickup"),
    ).toBe(10);
  });

  it("la propina no se aplica en mesa ni sin opt-in", () => {
    expect(
      calculateTipAmount({
        subtotal: 100,
        discount: 0,
        tipOptIn: true,
        orderType: "table",
      }).tipAmount,
    ).toBe(0);

    expect(
      calculateTipAmount({
        subtotal: 100,
        discount: 0,
        tipOptIn: false,
        orderType: "pickup",
      }).tipAmount,
    ).toBe(0);
  });

  it("la base de la propina es el subtotal menos el descuento, nunca negativa", () => {
    expect(
      calculateTipAmount({
        subtotal: 100,
        discount: 40,
        tipOptIn: true,
        orderType: "pickup",
        tipRate: 10,
      }).tipAmount,
    ).toBe(6);

    expect(
      calculateTipAmount({
        subtotal: 100,
        discount: 500,
        tipOptIn: true,
        orderType: "pickup",
        tipRate: 10,
      }).tipBase,
    ).toBe(0);
  });

  it("roundCurrency no arrastra el error de punto flotante", () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });
});
