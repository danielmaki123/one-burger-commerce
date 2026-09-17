// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const lines = [
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

  it("sumar y restar mandan la cantidad nueva del producto", async () => {
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
    expect(onChangeQuantity).toHaveBeenLastCalledWith("seed-prod-01", 3);

    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Taco de Birria" }));
    expect(onChangeQuantity).toHaveBeenLastCalledWith("seed-prod-01", 1);
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

    expect(onChangeQuantity).toHaveBeenLastCalledWith("seed-prod-02", 0);
  });

  it("sacar manda el producto a sacar", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <PosSaleLines lines={lines} currency={currency} onChangeQuantity={() => {}} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole("button", { name: "Sacar Agua de Jamaica de la venta" }));

    expect(onRemove).toHaveBeenCalledWith("seed-prod-02");
  });
});
