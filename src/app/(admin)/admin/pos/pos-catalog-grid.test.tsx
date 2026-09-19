// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PosCatalogCategoryChip, PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";

import PosCatalogGrid from "./pos-catalog-grid";

/**
 * El panel del catálogo del mostrador: el buscador, los chips de categoría, las tarjetas y sus estados.
 *
 * Se extrajo de `pos-client.tsx` (deuda con techo congelado) al sumar los chips: la pantalla sigue
 * teniendo el estado del filtro, pero el panel es una pieza con sus propios estados.
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

function product(over: Partial<PosCatalogProduct> & { id: string; name: string }): PosCatalogProduct {
  return {
    categoryId: "cat_burgers",
    subcategoryId: null,
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

const productos = [
  product({ id: "prod_doble", name: "DOBLE" }),
  product({ id: "prod_cola", name: "COCA COLA", categoryId: "cat_bebidas", categoryName: "BEBIDAS" }),
];

const categorias: PosCatalogCategoryChip[] = [
  { id: "cat_burgers", name: "ONE BURGER", count: 1 },
  { id: "cat_bebidas", name: "BEBIDAS", count: 1 },
];

function renderGrid(over: Partial<React.ComponentProps<typeof PosCatalogGrid>> = {}) {
  const onAdd = vi.fn();
  const onQueryChange = vi.fn();
  const onCategorySelect = vi.fn();
  const onRetry = vi.fn();

  const { unmount } = render(
    <PosCatalogGrid
      products={productos}
      categories={categorias}
      query=""
      onQueryChange={onQueryChange}
      activeCategoryId={null}
      onCategorySelect={onCategorySelect}
      loading={false}
      loadError={null}
      onRetry={onRetry}
      currency={currency}
      onAdd={onAdd}
      {...over}
    />,
  );

  return { onAdd, onQueryChange, onCategorySelect, onRetry, unmount };
}

describe("PosCatalogGrid", () => {
  it("dibuja el buscador, los chips y las tarjetas", () => {
    renderGrid();

    expect(screen.getByLabelText("Buscar en el catálogo")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Categorías del catálogo" })).toBeTruthy();
    expect(
      within(screen.getByRole("list", { name: "Productos del local" })).getByText("DOBLE"),
    ).toBeTruthy();
  });

  it("el buscador filtra sin salir de la pantalla", () => {
    renderGrid({ query: "cola" });

    expect(screen.getByText("COCA COLA")).toBeTruthy();
    expect(screen.queryByText("DOBLE")).toBeNull();
  });

  it("el chip activo filtra por su categoría", () => {
    renderGrid({ activeCategoryId: "cat_burgers" });

    expect(screen.getByText("DOBLE")).toBeTruthy();
    expect(screen.queryByText("COCA COLA")).toBeNull();
  });

  it("escribir avisa el término y elegir un chip avisa la categoría", async () => {
    const user = userEvent.setup();
    const { onQueryChange, onCategorySelect } = renderGrid();

    await user.type(screen.getByLabelText("Buscar en el catálogo"), "taco");
    await user.click(screen.getByRole("button", { name: /BEBIDAS/ }));

    expect(onQueryChange).toHaveBeenCalled();
    expect(onCategorySelect).toHaveBeenCalledWith("cat_bebidas");
  });

  it("mientras carga lo dice y no dibuja el grid", () => {
    renderGrid({ products: [], loading: true });

    expect(screen.getByText("Cargando el catálogo…")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Productos del local" })).toBeNull();
  });

  it("si el catálogo no cargó, explica y ofrece reintentar", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderGrid({ products: [], loadError: "Se cayó la red." });

    expect(screen.getByText("Se cayó la red.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("distingue el local sin productos del filtro sin resultados", () => {
    const { unmount } = renderGrid({ products: [] });

    expect(screen.getByText("El local no tiene productos vendibles")).toBeTruthy();

    unmount();

    renderGrid({ query: "sushi" });
    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });
});
