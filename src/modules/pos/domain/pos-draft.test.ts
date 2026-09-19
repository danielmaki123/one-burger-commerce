import { describe, expect, it } from "vitest";

import { calculateOrderTotals } from "@/shared/lib/order-totals";

import { PosError } from "./pos-errors";
import {
  addPosLine,
  assertPosDraftReady,
  createPosDraft,
  posDraftSubtotal,
  posDraftTotals,
  posLineKey,
  removePosLine,
  setPosLineQuantity,
} from "./pos-draft";

/**
 * TASK-301 — el borrador de una venta de mostrador.
 *
 * Es el estado que el cajero arma tocando productos: qué se lleva, cuánto y con qué nota. No sabe
 * nada de empaque, propina ni descuentos —eso lo resuelve el servidor al crear el pedido, igual que
 * en el checkout— y tampoco conoce `Order`: el borrador es del POS, no una segunda versión del
 * pedido (`plna.md` FASE 3: cero duplicación).
 */

const taco = { productId: "prod_taco", name: "Taco de birria", unitPrice: 35 };
const refresco = { productId: "prod_refresco", name: "Refresco", unitPrice: 25 };

describe("borrador del POS", () => {
  it("arranca vacío con su local y sin líneas", () => {
    const draft = createPosDraft("loc_centro");

    expect(draft.locationId).toBe("loc_centro");
    expect(draft.lines).toEqual([]);
    expect(posDraftSubtotal(draft)).toBe(0);
  });

  it("agrega una línea con cantidad 1 por defecto", () => {
    const draft = addPosLine(createPosDraft("loc_centro"), taco);

    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]).toMatchObject({ productId: "prod_taco", quantity: 1, unitPrice: 35 });
  });

  it("suma cantidades cuando es el mismo producto con la misma nota", () => {
    const draft = addPosLine(addPosLine(createPosDraft("loc_centro"), taco), taco);

    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].quantity).toBe(2);
  });

  it("mantiene separadas las líneas del mismo producto con notas distintas", () => {
    const conNota = addPosLine(createPosDraft("loc_centro"), { ...taco, notes: "sin cebolla" });
    const draft = addPosLine(conNota, { ...taco, notes: "bien cocido" });

    expect(draft.lines).toHaveLength(2);
    expect(draft.lines.map((line) => line.quantity)).toEqual([1, 1]);
  });

  /**
   * Los modificadores son parte de **qué** se está vendiendo, no de cómo se cobra: un DOBLE con papas y
   * un DOBLE sin extras cuestan distinto, así que son dos líneas. El caso que esto evita es el peor: dos
   * configuraciones distintas sumadas en una sola línea, con el precio de una.
   */
  it("mantiene separadas las líneas del mismo producto con modificadores distintos", () => {
    const conPapas = addPosLine(createPosDraft("loc_centro"), {
      ...taco,
      unitPrice: 424,
      modifierOptionIds: ["opt_papas"],
      modifierNames: ["PAPAS FRITAS"],
    });
    const draft = addPosLine(conPapas, {
      ...taco,
      modifierOptionIds: ["opt_sin"],
      modifierNames: ["SIN EXTRAS"],
    });

    expect(draft.lines).toHaveLength(2);
    expect(draft.lines.map((line) => line.modifierOptionIds)).toEqual([["opt_papas"], ["opt_sin"]]);
    expect(draft.lines.map((line) => line.modifierNames)).toEqual([
      ["PAPAS FRITAS"],
      ["SIN EXTRAS"],
    ]);
  });

  it("suma cantidad cuando es el mismo producto con los mismos modificadores, sin importar el orden", () => {
    const conExtras = addPosLine(createPosDraft("loc_centro"), {
      ...taco,
      modifierOptionIds: ["opt_papas", "opt_torta"],
    });
    const draft = addPosLine(conExtras, {
      ...taco,
      modifierOptionIds: ["opt_torta", "opt_papas"],
    });

    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].quantity).toBe(2);
  });

  it("cambiar la cantidad de una configuración no toca a la otra del mismo producto", () => {
    const conPapas = addPosLine(createPosDraft("loc_centro"), {
      ...taco,
      unitPrice: 424,
      modifierOptionIds: ["opt_papas"],
    });
    const draft = addPosLine(conPapas, { ...taco, modifierOptionIds: ["opt_torta"] });

    const cambiado = setPosLineQuantity(draft, posLineKey(draft.lines[0]), 3);

    expect(cambiado.lines.map((line) => line.quantity)).toEqual([3, 1]);
  });

  it("la identidad de una línea es producto + modificadores + nota", () => {
    expect(posLineKey({ productId: "p1" })).toBe("p1||");
    expect(posLineKey({ productId: "p1", modifierOptionIds: ["b", "a"] })).toBe("p1|a,b|");
    expect(posLineKey({ productId: "p1", notes: "sin cebolla" })).toBe("p1||sin cebolla");
    expect(posLineKey({ productId: "p1", modifierOptionIds: ["a"] })).not.toBe(
      posLineKey({ productId: "p1" }),
    );
  });

  it("el precio de la línea ya trae los modificadores y el subtotal sale de ahí", () => {
    const draft = addPosLine(createPosDraft("loc_centro"), {
      ...taco,
      // 35 del taco + 119 de las papas, que es como el servidor cotiza la línea al crear el pedido.
      unitPrice: 35 + 119,
      quantity: 2,
      modifierOptionIds: ["opt_papas"],
    });

    expect(posDraftSubtotal(draft)).toBe(308);
  });

  it("no muta el borrador anterior (el estado de React se reemplaza, no se toca)", () => {
    const original = createPosDraft("loc_centro");
    const conLinea = addPosLine(original, taco);

    expect(original.lines).toHaveLength(0);
    expect(conLinea.lines).toHaveLength(1);
  });

  it("rechaza una cantidad que no sea un entero positivo", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(() => addPosLine(createPosDraft("loc_centro"), { ...taco, quantity })).toThrow(PosError);
    }
  });

  it("rechaza un precio negativo y un producto sin id", () => {
    expect(() => addPosLine(createPosDraft("loc_centro"), { ...taco, unitPrice: -1 })).toThrow(
      PosError,
    );
    expect(() => addPosLine(createPosDraft("loc_centro"), { ...taco, productId: "  " })).toThrow(
      PosError,
    );
  });

  it("setQuantity cambia la cantidad y con 0 saca la línea", () => {
    const draft = addPosLine(createPosDraft("loc_centro"), taco);
    const key = posLineKey(draft.lines[0]);

    expect(setPosLineQuantity(draft, key, 3).lines[0].quantity).toBe(3);
    expect(setPosLineQuantity(draft, key, 0).lines).toHaveLength(0);
    expect(() => setPosLineQuantity(draft, key, -2)).toThrow(PosError);
  });

  it("quita la línea por su clave", () => {
    const draft = addPosLine(addPosLine(createPosDraft("loc_centro"), taco), refresco);

    expect(
      removePosLine(draft, posLineKey(draft.lines[0])).lines.map((line) => line.productId),
    ).toEqual(["prod_refresco"]);
  });

  it("el subtotal suma precio por cantidad, redondeado a dos decimales", () => {
    const draft = addPosLine(
      addPosLine(createPosDraft("loc_centro"), { ...taco, quantity: 3 }),
      refresco,
    );

    expect(posDraftSubtotal(draft)).toBe(130);
  });

  it("el total del borrador incluye el empaque y sale de la fórmula del servidor (TASK-303b)", () => {
    const draft = addPosLine(createPosDraft("loc_centro"), {
      ...taco,
      quantity: 2,
      packagingUnitAmount: 5,
    });

    const totals = posDraftTotals(draft);

    expect(totals).toEqual({ subtotal: 70, packagingAmount: 10, total: 80 });
    // El contrato que importa: es la MISMA fórmula que usa el servidor al crear el pedido.
    expect(totals.total).toBe(
      calculateOrderTotals({
        subtotal: 70,
        discount: 0,
        deliveryFeeAmount: 0,
        items: [{ packagingTotalAmount: 10 }],
        tipOptIn: false,
        orderType: "pickup",
      }).total,
    );
  });

  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el descuento de un cupón entra por el **mismo** total.
   *
   * El subtotal y el empaque no cambian (el cupón descuenta sobre lo que se pidió, no sobre el empaque) y
   * el total sale de `calculateOrderTotals`, que es la fórmula del servidor: el número que ve el cajero es
   * el que se cobra.
   */
  it("un descuento baja el total sin tocar el subtotal ni el empaque", () => {
    const draft = addPosLine(createPosDraft("loc_centro"), {
      ...taco,
      quantity: 2,
      packagingUnitAmount: 5,
    });

    expect(posDraftTotals(draft, 7)).toEqual({ subtotal: 70, packagingAmount: 10, total: 73 });
    expect(posDraftTotals(draft, 7).total).toBe(
      calculateOrderTotals({
        subtotal: 70,
        discount: 7,
        deliveryFeeAmount: 0,
        items: [{ packagingTotalAmount: 10 }],
        tipOptIn: false,
        orderType: "pickup",
      }).total,
    );
  });

  it("un descuento más grande que la venta no deja el total en negativo", () => {
    const draft = addPosLine(createPosDraft("loc_centro"), { ...taco, quantity: 1 });

    expect(posDraftTotals(draft, 9999).total).toBe(0);
  });

  it("no deja confirmar un borrador vacío ni sin local", () => {
    expect(() => assertPosDraftReady(createPosDraft("loc_centro"))).toThrow(PosError);
    expect(() =>
      assertPosDraftReady({ ...addPosLine(createPosDraft("  "), taco), locationId: "  " }),
    ).toThrow(PosError);  });

  it("deja confirmar un borrador con líneas y local", () => {
    expect(() => assertPosDraftReady(addPosLine(createPosDraft("loc_centro"), taco))).not.toThrow();
  });
});
