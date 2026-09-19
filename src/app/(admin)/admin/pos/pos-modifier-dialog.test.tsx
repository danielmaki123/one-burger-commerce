// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";

import PosModifierDialog from "./pos-modifier-dialog";

/**
 * El selector de modificadores del mostrador.
 *
 * Es la pieza que hoy falta para poder vender un producto con grupos obligatorios desde el POS: sin
 * preguntar los modificadores, el alta rechaza la venta (422). La **regla** (obligatorio, mínimos,
 * máximos y el armado de la selección) es la del dominio del menú
 * (`modules/menu/domain/modifier-selection`), la misma que usa la carta: acá se prueba lo que el cajero
 * ve y toca.
 *
 * jsdom no implementa el modo modal del `<dialog>` (igual que en `modal.test.tsx`): se le agrega el
 * mínimo para poder probar el contenido.
 */

beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

/** El repo no monta jest-dom: los estados se leen de la propiedad, no de un matcher. */
const checked = (element: HTMLElement) => (element as HTMLInputElement).checked;
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;

function grupo(over: Partial<PosCatalogProduct["modifierGroups"][number]> = {}) {
  return {
    id: "grupo_carne",
    name: "Tipo de carne",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    options: [
      { id: "opt_res", name: "Res", priceDelta: 0, isActive: true },
      { id: "opt_cerdo", name: "Cerdo", priceDelta: 15, isActive: true },
    ],
    ...over,
  };
}

function product(over: Partial<PosCatalogProduct> = {}): PosCatalogProduct {
  return {
    id: "prod_pastor",
    categoryId: "cat_tacos",
    subcategoryId: null,
    name: "Taco de Pastor",
    description: null,
    basePrice: 28,
    packagingFeeAmount: 0,
    images: [],
    availability: { isAvailable: true, isActive: true },
    modifierGroups: [grupo()],
    bundleRules: [],
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
    requiresOptions: true,
    categoryName: "Tacos",
    ...over,
  };
}

describe("PosModifierDialog", () => {
  it("sin producto abierto no dibuja nada", () => {
    render(
      <PosModifierDialog
        product={null}
        currency={currency}
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("muestra el producto, su grupo y sus opciones con el precio del extra", () => {
    render(
      <PosModifierDialog
        product={product()}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Taco de Pastor")).toBeTruthy();
    expect(screen.getByText("Tipo de carne")).toBeTruthy();
    expect(screen.getByText("Obligatorio")).toBeTruthy();
    expect(screen.getByText("Res")).toBeTruthy();
    expect(screen.getByText("Cerdo")).toBeTruthy();
    // El delta se muestra con su signo; el 0 como el símbolo pelado.
    expect(screen.getByText(/\+C\$15\.00/)).toBeTruthy();
  });

  it("un grupo obligatorio arranca con su primera opción y el precio del producto", () => {
    render(
      <PosModifierDialog
        product={product()}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(checked(screen.getByRole("radio", { name: "Res" }))).toBe(true);
    expect(screen.getByRole("button", { name: /Agregar.*C\$28\.00/ })).toBeTruthy();
  });

  it("cambiar la opción de un grupo de selección única reemplaza la anterior y ajusta el precio", async () => {
    const user = userEvent.setup();
    render(
      <PosModifierDialog
        product={product()}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Cerdo" }));

    expect(checked(screen.getByRole("radio", { name: "Cerdo" }))).toBe(true);
    expect(checked(screen.getByRole("radio", { name: "Res" }))).toBe(false);
    expect(screen.getByRole("button", { name: /Agregar.*C\$43\.00/ })).toBeTruthy();
  });

  it("confirmar devuelve los ids, los nombres y el precio unitario con los extras", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PosModifierDialog
        product={product()}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Cerdo" }));
    await user.click(screen.getByRole("button", { name: /^Agregar/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].id).toBe("prod_pastor");
    expect(onConfirm.mock.calls[0][1]).toEqual({
      modifierOptionIds: ["opt_cerdo"],
      modifierNames: ["Cerdo"],
      unitPrice: 43,
    });
  });

  it("un grupo opcional se puede dejar sin elegir y suma cuando se elige", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PosModifierDialog
        product={product({
          modifierGroups: [
            grupo({
              id: "grupo_extras",
              name: "Extras",
              isRequired: false,
              minSelections: 0,
              maxSelections: 3,
              options: [
                { id: "opt_papas", name: "PAPAS FRITAS", priceDelta: 119, isActive: true },
              ],
            }),
          ],
        })}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Opcional")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Agregar.*C\$28\.00/ })).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: "PAPAS FRITAS" }));
    expect(screen.getByRole("button", { name: /Agregar.*C\$147\.00/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Agregar/ }));
    expect(onConfirm.mock.calls[0][1].modifierOptionIds).toEqual(["opt_papas"]);
  });

  it("no deja elegir más opciones que el máximo del grupo", async () => {
    const user = userEvent.setup();
    render(
      <PosModifierDialog
        product={product({
          modifierGroups: [
            grupo({
              id: "grupo_extras",
              name: "Extras",
              isRequired: false,
              minSelections: 0,
              maxSelections: 1,
              options: [
                { id: "opt_papas", name: "PAPAS FRITAS", priceDelta: 119, isActive: true },
                { id: "opt_torta", name: "EXTRA TORTA", priceDelta: 75, isActive: true },
              ],
            }),
          ],
        })}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    // Con `maxSelections: 1` el grupo se comporta como radio, no como checkbox.
    expect(screen.queryByRole("checkbox", { name: "PAPAS FRITAS" })).toBeNull();
    expect(screen.getByRole("radio", { name: "PAPAS FRITAS" })).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "EXTRA TORTA" }));
    expect(checked(screen.getByRole("radio", { name: "PAPAS FRITAS" }))).toBe(false);
    expect(screen.getByRole("button", { name: /Agregar.*C\$103\.00/ })).toBeTruthy();
  });

  it("con un mínimo sin cumplir muestra el error del dominio y no deja agregar", async () => {
    const user = userEvent.setup();
    render(
      <PosModifierDialog
        product={product({
          modifierGroups: [
            grupo({
              isRequired: true,
              minSelections: 2,
              maxSelections: 3,
              options: [
                { id: "opt_res", name: "Res", priceDelta: 0, isActive: true },
                { id: "opt_cerdo", name: "Cerdo", priceDelta: 15, isActive: true },
                { id: "opt_pollo", name: "Pollo", priceDelta: 10, isActive: true },
              ],
            }),
          ],
        })}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Cerdo" }));
    await user.click(screen.getByRole("checkbox", { name: "Res" }));

    expect(screen.getByText(/Mínimo 2 selecciones/)).toBeTruthy();
    expect(disabled(screen.getByRole("button", { name: /^Agregar/ }))).toBe(true);
  });

  it("no ofrece las opciones inactivas", () => {
    render(
      <PosModifierDialog
        product={product({
          modifierGroups: [
            grupo({
              options: [
                { id: "opt_res", name: "Res", priceDelta: 0, isActive: true },
                { id: "opt_cerdo", name: "Cerdo", priceDelta: 15, isActive: false },
              ],
            }),
          ],
        })}
        currency={currency}
        open
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole("radio", { name: "Res" })).toBeTruthy();
    expect(screen.queryByText("Cerdo")).toBeNull();
  });
});
