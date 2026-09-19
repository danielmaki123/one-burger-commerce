// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { posLineKey, type PosDraftLine } from "@/modules/pos/domain/pos-draft";

import PosSaleLines from "./pos-sale-lines";

/**
 * Las líneas de la venta en curso. El bloque se extrajo de `pos-client.tsx` (deuda con techo congelado) sin
 * cambiar su comportamiento; este test lo fija con lo que el cajero hace de verdad: sumar, restar y sacar.
 *
 * La cantidad que sale del botón es **una intención**, no una regla: con 1 unidad, restar manda 0 y es el
 * dominio el que decide que 0 saca el producto de la venta.
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

const lines: PosDraftLine[] = [
  { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 30, quantity: 2 },
  { productId: "seed-prod-02", name: "Agua de Jamaica", unitPrice: 10, quantity: 1, notes: "Sin hielo" },
];

describe("PosSaleLines", () => {
  it("sin productos dice cómo armar la venta", () => {
    render(
      <PosSaleLines lines={[]} currency={currency} onChangeQuantity={() => {}} onRemove={() => {}} />,
    );

    expect(screen.getByText("Agregá productos del catálogo para armar la venta.")).toBeTruthy();
  });

  it("cada línea dice su producto, su precio y su cantidad", () => {
    render(
      <PosSaleLines lines={lines} currency={currency} onChangeQuantity={() => {}} onRemove={() => {}} />,
    );

    expect(screen.getByRole("list", { name: "Productos de la venta" })).toBeTruthy();
    expect(screen.getByText("Taco de Birria")).toBeTruthy();
    expect(screen.getByText(/30\.00 × 2/)).toBeTruthy();
    expect(screen.getByText("Agua de Jamaica")).toBeTruthy();
  });

  it("sumar y restar mandan la cantidad nueva de la línea", async () => {
    const user = userEvent.setup();
    const onChangeQuantity = vi.fn();
    render(
      <PosSaleLines
        lines={lines}
        currency={currency}
        onChangeQuantity={onChangeQuantity}
        onRemove={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Agregar una unidad de Taco de Birria" }));
    expect(onChangeQuantity).toHaveBeenLastCalledWith(posLineKey(lines[0]), 3);

    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Taco de Birria" }));
    expect(onChangeQuantity).toHaveBeenLastCalledWith(posLineKey(lines[0]), 1);
  });

  it("con una sola unidad, restar manda 0 (el dominio decide que eso la saca)", async () => {
    const user = userEvent.setup();
    const onChangeQuantity = vi.fn();
    render(
      <PosSaleLines
        lines={lines}
        currency={currency}
        onChangeQuantity={onChangeQuantity}
        onRemove={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Agua de Jamaica" }));

    expect(onChangeQuantity).toHaveBeenLastCalledWith(posLineKey(lines[1]), 0);
  });

  it("sacar manda la línea a sacar, direccionada por su clave", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <PosSaleLines lines={lines} currency={currency} onChangeQuantity={() => {}} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole("button", { name: "Sacar Agua de Jamaica de la venta" }));

    expect(onRemove).toHaveBeenCalledWith(posLineKey(lines[1]));
  });

  /**
   * Los modificadores elegidos se ven en la línea: es lo único que distingue dos DOBLE del mismo
   * producto, y es lo que la cocina necesita leer para prepararlos bien.
   */
  it("una línea con modificadores los muestra y no se confunde con otra del mismo producto", async () => {
    const user = userEvent.setup();
    const conExtras = {
      productId: "prod_doble",
      name: "DOBLE",
      unitPrice: 424,
      quantity: 1,
      modifierOptionIds: ["opt_papas"],
      modifierNames: ["PAPAS FRITAS"],
    };
    const sinExtras = {
      productId: "prod_doble",
      name: "DOBLE",
      unitPrice: 305,
      quantity: 1,
      modifierOptionIds: ["opt_sin"],
      modifierNames: ["SIN EXTRAS"],
    };
    const onRemove = vi.fn();

    render(
      <PosSaleLines
        lines={[conExtras, sinExtras]}
        currency={currency}
        onChangeQuantity={() => {}}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("PAPAS FRITAS")).toBeTruthy();
    expect(screen.getByText("SIN EXTRAS")).toBeTruthy();

    // Cada "Sacar" apunta a su propia configuración, no a las dos del mismo producto.
    await user.click(screen.getAllByRole("button", { name: "Sacar DOBLE de la venta" })[0]);
    expect(onRemove).toHaveBeenCalledWith(posLineKey(conExtras));
  });
});
