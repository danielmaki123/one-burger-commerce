// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PosCatalogCategoryChip } from "@/modules/pos/ports/pos-catalog";

import PosCategoryChips from "./pos-category-chips";

/**
 * Los chips de categoría del mostrador.
 *
 * El contador viene del servidor (`categories` de la respuesta del catálogo): acá no se agrupa ni se
 * cuenta nada. El chip activo filtra el grid y volver a tocarlo lo apaga.
 */

afterEach(cleanup);

const categorias: PosCatalogCategoryChip[] = [
  { id: "cat_burgers", name: "ONE BURGER", count: 4 },
  { id: "cat_bebidas", name: "BEBIDAS", count: 2 },
];

function renderChips(over: Partial<React.ComponentProps<typeof PosCategoryChips>> = {}) {
  const onSelect = vi.fn();

  render(
    <PosCategoryChips categories={categorias} activeCategoryId={null} onSelect={onSelect} {...over} />,
  );

  return { onSelect };
}

describe("PosCategoryChips", () => {
  it("muestra cada categoría con su contador y el total en «Todos»", () => {
    renderChips();

    const grupo = screen.getByRole("group", { name: "Categorías del catálogo" });

    expect(within(grupo).getByRole("button", { name: /Todos/ }).textContent).toContain("6");
    expect(within(grupo).getByRole("button", { name: /ONE BURGER/ }).textContent).toContain("4");
    expect(within(grupo).getByRole("button", { name: /BEBIDAS/ }).textContent).toContain("2");
  });

  it("elegir una categoría avisa cuál", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderChips();

    await user.click(screen.getByRole("button", { name: /BEBIDAS/ }));

    expect(onSelect).toHaveBeenCalledWith("cat_bebidas");
  });

  it("volver a tocar la categoría activa la apaga", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderChips({ activeCategoryId: "cat_bebidas" });

    await user.click(screen.getByRole("button", { name: /BEBIDAS/ }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("«Todos» vuelve a mostrar todo", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderChips({ activeCategoryId: "cat_bebidas" });

    await user.click(screen.getByRole("button", { name: /Todos/ }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("el chip activo se anuncia como tal", () => {
    renderChips({ activeCategoryId: "cat_burgers" });

    expect(
      screen.getByRole("button", { name: /ONE BURGER/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: /BEBIDAS/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("los chips se desplazan en horizontal, no se envuelven", () => {
    renderChips();

    const grupo = screen.getByRole("group", { name: "Categorías del catálogo" });

    // Envolver empujaría el catálogo fuera de la pantalla en un mostrador con muchas categorías.
    expect(grupo.className).toContain("overflow-x-auto");
    expect(grupo.className).not.toContain("flex-wrap");
  });

  it("con una sola categoría no hay nada que filtrar", () => {
    renderChips({ categories: [categorias[0]] });

    expect(screen.queryByRole("group", { name: "Categorías del catálogo" })).toBeNull();
  });
});
