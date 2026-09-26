// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";

import PosCatalogCard from "./pos-catalog-card";

/**
 * La tarjeta del catálogo del mostrador, con sus tres estados.
 *
 * El caso que importa: un producto **agotado** se ve (el cajero tiene que poder avisarlo) y **no**
 * ofrece "Agregar", porque el alta lo rechazaría con 409. El que exige modificadores sigue diciendo que
 * se elige en la carta hasta que el mostrador los pregunte.
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

function product(over: Partial<PosCatalogProduct> = {}): PosCatalogProduct {
  return {
    id: "prod_doble",
    categoryId: "cat_burgers",
    subcategoryId: null,
    name: "DOBLE",
    description: null,
    basePrice: 305,
    packagingFeeAmount: 35,
    images: [],
    availability: { isAvailable: true, isActive: true },
    modifierGroups: [],
    bundleRules: [],
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
    requiresOptions: false,
    categoryName: "ONE BURGER",
    ...over,
  };
}

describe("PosCatalogCard", () => {
  it("un producto que se vende de un toque se agrega con su botón", async () => {
    const onAdd = vi.fn();
    render(<PosCatalogCard product={product()} currency={currency} onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: "Agregar DOBLE a la venta" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe("prod_doble");
  });

  it("muestra la foto del producto y, sin foto, el respaldo", () => {
    const { unmount } = render(
      <PosCatalogCard
        product={product({
          images: [
            { id: "img_1", url: "https://cdn.test/doble.png", alt: "DOBLE", isPrimary: true },
          ],
        })}
        currency={currency}
        onAdd={() => {}}
      />,
    );

    expect(screen.getByRole("img", { name: "DOBLE" }).getAttribute("src")).toBe(
      "https://cdn.test/doble.png",
    );

    unmount();

    render(<PosCatalogCard product={product()} currency={currency} onAdd={() => {}} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("pos-catalog-photo-fallback")).toBeTruthy();
  });

  it("muestra el nombre y el precio del local en mono, sin repetir la categoría de los chips", () => {
    render(<PosCatalogCard product={product()} currency={currency} onAdd={() => {}} />);

    expect(screen.getByText("DOBLE")).toBeTruthy();
    expect(screen.getByText(/305\.00/)).toBeTruthy();
    // La categoría vive en los chips (que además filtran): la tarjeta no la repite.
    expect(screen.queryByText("ONE BURGER")).toBeNull();
  });

  it("la tarjeta es compacta y el control de agregar conserva el mínimo táctil", () => {
    render(<PosCatalogCard product={product()} currency={currency} onAdd={() => {}} />);

    const agregar = screen.getByRole("button", { name: "Agregar DOBLE a la venta" });
    expect(agregar.className).toContain("min-h-11");
    expect(agregar.className).toContain("min-w-11");

    // La foto no puede comerse el viewport: la densidad es parte del contrato de la pantalla.
    expect(screen.getByTestId("pos-catalog-photo-fallback").className).toContain("h-20");
  });

  it("un producto agotado se ve, dice «Agotado» y no tiene botón", () => {
    render(
      <PosCatalogCard
        product={product({ availability: { isAvailable: false, isActive: true } })}
        currency={currency}
        onAdd={() => {}}
      />,
    );

    expect(screen.getByText("DOBLE")).toBeTruthy();
    expect(screen.getByText("Agotado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Agregar DOBLE/ })).toBeNull();
  });

  it("un agotado que además exige opciones muestra «Agotado», no las dos cosas", () => {
    render(
      <PosCatalogCard
        product={product({
          availability: { isAvailable: false, isActive: true },
          requiresOptions: true,
        })}
        currency={currency}
        onAdd={() => {}}
      />,
    );

    expect(screen.getByText("Agotado")).toBeTruthy();
    expect(screen.queryByText("Se elige en la carta")).toBeNull();
  });

  it("un producto que exige opciones también se agrega: el selector las pregunta", async () => {
    const onAdd = vi.fn();
    render(
      <PosCatalogCard product={product({ requiresOptions: true })} currency={currency} onAdd={onAdd} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Agregar DOBLE a la venta" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Se elige en la carta")).toBeNull();
  });
});
