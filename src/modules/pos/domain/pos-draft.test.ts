import { describe, expect, it } from "vitest";

import { PosError } from "./pos-errors";
import {
  addPosLine,
  assertPosDraftReady,
  createPosDraft,
  posDraftSubtotal,
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

    expect(setPosLineQuantity(draft, "prod_taco", 3).lines[0].quantity).toBe(3);
    expect(setPosLineQuantity(draft, "prod_taco", 0).lines).toHaveLength(0);
    expect(() => setPosLineQuantity(draft, "prod_taco", -2)).toThrow(PosError);
  });

  it("quita la línea por producto", () => {
    const draft = addPosLine(addPosLine(createPosDraft("loc_centro"), taco), refresco);

    expect(removePosLine(draft, "prod_taco").lines.map((line) => line.productId)).toEqual([
      "prod_refresco",
    ]);
  });

  it("el subtotal suma precio por cantidad, redondeado a dos decimales", () => {
    const draft = addPosLine(
      addPosLine(createPosDraft("loc_centro"), { ...taco, quantity: 3 }),
      refresco,
    );

    expect(posDraftSubtotal(draft)).toBe(130);
  });

  it("no deja confirmar un borrador vacío ni sin local", () => {
    expect(() => assertPosDraftReady(createPosDraft("loc_centro"))).toThrow(PosError);
    expect(() =>
      assertPosDraftReady({ ...addPosLine(createPosDraft("  "), taco), locationId: "  " }),
    ).toThrow(PosError);
  });

  it("deja confirmar un borrador con líneas y local", () => {
    expect(() => assertPosDraftReady(addPosLine(createPosDraft("loc_centro"), taco))).not.toThrow();
  });
});
