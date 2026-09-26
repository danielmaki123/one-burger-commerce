// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import PosSaleLines from "./pos-sale-lines";

/**
 * Las líneas de la venta en curso.
 *
 * Lo que importa de esta pieza es que el cajero pueda **sumar, restar y sacar** sin ambigüedad y sin
 * apuntarle a la línea equivocada: la fila se direcciona por su **clave** (`producto + modificadores +
 * nota`), así que el mismo plato con dos configuraciones son dos líneas y tocar "−" en una no puede cambiar
 * la otra. También se mide el mínimo táctil, que es una ley del POS.
 */

const currency = DEFAULT_CURRENCY_FORMAT;

const lines = [
  {
    productId: "prod_taco",
    name: "Taco de birria",
    unitPrice: 35,
    packagingUnitAmount: 5,
    quantity: 2,
    modifierNames: ["Res", "Extra queso"],
  },
  {
    productId: "prod_cola",
    name: "Cola",
    unitPrice: 25,
    quantity: 1,
  },
];

afterEach(cleanup);

describe("PosSaleLines", () => {
  it("dice que la venta está vacía y no dibuja controles", () => {
    render(
      <PosSaleLines lines={[]} currency={currency} onChangeQuantity={() => {}} onRemove={() => {}} />,
    );

    expect(screen.getByText("Agregá productos del catálogo para armar la venta.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Productos de la venta" })).toBeNull();
  });

  it("muestra cada línea con sus modificadores, su precio unitario y su cantidad", () => {
    render(
      <PosSaleLines
        lines={lines}
        currency={currency}
        onChangeQuantity={() => {}}
        onRemove={() => {}}
      />,
    );

    expect(screen.getByText("Taco de birria")).toBeTruthy();
    expect(screen.getByText("Res · Extra queso")).toBeTruthy();
    expect(screen.getByText(/× 2/)).toBeTruthy();
    expect(screen.getByText("Cola")).toBeTruthy();
  });

  it("suma y resta unidades direccionando la línea por su clave", async () => {
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

    await user.click(screen.getByRole("button", { name: "Agregar una unidad de Cola" }));
    expect(onChangeQuantity).toHaveBeenCalledWith("prod_cola||", 2);

    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Taco de birria" }));
    expect(onChangeQuantity).toHaveBeenCalledWith("prod_taco||", 1);
  });

  it("saca la línea que se pide", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <PosSaleLines lines={lines} currency={currency} onChangeQuantity={() => {}} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole("button", { name: "Sacar Cola de la venta" }));
    expect(onRemove).toHaveBeenCalledWith("prod_cola||");
  });

  it("todos los controles de la línea llegan al mínimo táctil de 44 px", () => {
    render(
      <PosSaleLines
        lines={lines}
        currency={currency}
        onChangeQuantity={() => {}}
        onRemove={() => {}}
      />,
    );

    for (const nombre of [
      "Agregar una unidad de Cola",
      "Quitar una unidad de Cola",
      "Sacar Cola de la venta",
      "Agregar una unidad de Taco de birria",
      "Quitar una unidad de Taco de birria",
      "Sacar Taco de birria de la venta",
    ]) {
      expect(screen.getByRole("button", { name: nombre }).className).toContain("min-h-11");
    }

    expect(
      screen.getByRole("button", { name: "Agregar una unidad de Cola" }).className,
    ).toContain("min-w-11");
  });

  it("los controles se operan con el teclado (Enter sobre el foco)", async () => {
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

    const mas = screen.getByRole("button", { name: "Agregar una unidad de Cola" });
    mas.focus();
    await user.keyboard("{Enter}");
    expect(onChangeQuantity).toHaveBeenCalledWith("prod_cola||", 2);
  });

  it("una línea de una unidad no se puede bajar de cero por su botón: la saca el control de sacar", async () => {
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

    // La regla (cantidad 0 = fuera de la venta) vive en el dominio; la pantalla pide el 0 y el dominio
    // decide. Lo que se fija acá es que la pantalla pida lo que el cajero tocó, sin inventar el tope.
    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Cola" }));
    expect(onChangeQuantity).toHaveBeenCalledWith("prod_cola||", 0);
  });
});
