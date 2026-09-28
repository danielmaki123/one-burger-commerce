import { describe, expect, it } from "vitest";

import {
  assertKitchenStatusTransition,
  canKitchenReachStatus,
  KITCHEN_STATUS_TRANSITIONS,
  KITCHEN_TERMINAL_STATUS,
} from "./order-kitchen-transitions";

/**
 * La **capacidad de Cocina**, aplicada en el servidor (`TASK-ORDERS-KITCHEN-RUNTIME-002`).
 *
 * La spec es explícita: Cocina opera **sólo** `new → confirmed`, `confirmed → preparing` y
 * `preparing → ready_for_pickup`, y **termina en Listo**. La retirada (`ready_for_pickup → picked_up`) y
 * el cierre (`picked_up → closed`) son de Pedidos, y cobrar es del POS.
 *
 * Esto **no** es un segundo workflow: es la **lista blanca** de la superficie, derivada del workflow
 * único (`order-workflows.ts`). El workflow dice qué transiciones existen; esto dice cuáles puede tocar
 * esta capacidad. Si el workflow cambia, esta lista blanca no puede inventar una transición que él no
 * permita: se prueba contra él.
 */

describe("qué puede hacer Cocina con una comanda", () => {
  it("las tres transiciones de la spec, y ninguna más", () => {
    expect(KITCHEN_STATUS_TRANSITIONS).toEqual([
      { from: "new", to: "confirmed" },
      { from: "confirmed", to: "preparing" },
      { from: "preparing", to: "ready_for_pickup" },
    ]);
  });

  it("Cocina termina en Listo: `ready_for_pickup` no avanza a ningún lado", () => {
    expect(KITCHEN_TERMINAL_STATUS).toBe("ready_for_pickup");
    expect(canKitchenReachStatus("ready_for_pickup")).toBe(true);
  });

  it("aceptar, empezar y terminar están permitidos", () => {
    expect(canKitchenReachStatus("confirmed")).toBe(true);
    expect(canKitchenReachStatus("preparing")).toBe(true);
    expect(canKitchenReachStatus("ready_for_pickup")).toBe(true);
  });

  it("la retirada y el cierre **no** son de Cocina: son del mostrador (Pedidos)", () => {
    expect(canKitchenReachStatus("picked_up")).toBe(false);
    expect(canKitchenReachStatus("closed")).toBe(false);
    expect(canKitchenReachStatus("served")).toBe(false);
  });

  it("nada de dinero ni de entrega pasa por Cocina", () => {
    for (const status of ["out_for_delivery", "delivered"] as const) {
      expect(canKitchenReachStatus(status), status).toBe(false);
    }
  });

  it("`new` no es un destino: sólo el estado inicial del pedido", () => {
    expect(canKitchenReachStatus("new")).toBe(false);
  });
});

describe("assertKitchenStatusTransition · la puerta que ve el servidor", () => {
  it("deja pasar las tres de la cocina, en un pedido de retiro", () => {
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "new", next: "confirmed" }),
    ).not.toThrow();
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "confirmed", next: "preparing" }),
    ).not.toThrow();
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "preparing", next: "ready_for_pickup" }),
    ).not.toThrow();
  });

  it("rechaza la retirada: eso lo firma el mostrador, no la cocina", () => {
    expect(() =>
      assertKitchenStatusTransition({
        type: "pickup",
        current: "ready_for_pickup",
        next: "picked_up",
      }),
    ).toThrow(/mostrador/);
  });

  it("rechaza el cierre", () => {
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "picked_up", next: "closed" }),
    ).toThrow(/mostrador/);
  });

  it("rechaza un salto: no se puede terminar sin haber empezado", () => {
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "confirmed", next: "ready_for_pickup" }),
    ).toThrow(/no es una transición de cocina/);
  });

  it("rechaza una transición que el workflow del dominio ni siquiera permite", () => {
    // `new → preparing` no existe en el flujo de retiro: la puerta de cocina no puede crearla.
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "new", next: "preparing" }),
    ).toThrow(/no es una transición de cocina/);
  });

  it("en mesa, la cocina avanza su equivalente (`accepted`) y termina en `served`", () => {
    expect(() =>
      assertKitchenStatusTransition({ type: "table", current: "new", next: "accepted" }),
    ).not.toThrow();
    expect(() =>
      assertKitchenStatusTransition({ type: "table", current: "accepted", next: "preparing" }),
    ).not.toThrow();
    expect(() =>
      assertKitchenStatusTransition({ type: "table", current: "preparing", next: "served" }),
    ).not.toThrow();
    expect(() =>
      assertKitchenStatusTransition({ type: "table", current: "served", next: "closed" }),
    ).toThrow(/mostrador/);
  });

  it("rechaza un estado de entrega: delivery está fuera del MVP", () => {
    expect(() =>
      assertKitchenStatusTransition({ type: "delivery", current: "preparing", next: "ready" }),
    ).toThrow(/no es una transición de cocina/);
  });

  it("no bloquea el rechazo: cancelar un pedido desde la comanda sigue siendo posible", () => {
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "new", next: "cancelled" }),
    ).not.toThrow();
    expect(() =>
      assertKitchenStatusTransition({ type: "pickup", current: "confirmed", next: "cancelled" }),
    ).not.toThrow();
  });

  it("el rechazo de la puerta es un **403** de dominio, no un error genérico", () => {
    // 403 y no 404: la comanda existe y el usuario la ve; lo que le falta es la **capacidad**.
    try {
      assertKitchenStatusTransition({ type: "pickup", current: "picked_up", next: "closed" });
      throw new Error("la puerta tenía que rechazar");
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: "FORBIDDEN" });
    }
  });
});
