// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CartProvider, useCart } from "@/shared/lib/cart";

import { MenuProductCard, type PublicMenuProductCardData } from "./menu-product-card";

const ADDABLE: PublicMenuProductCardData = {
  id: "seed-prod-01",
  name: "Taco de Birria",
  description: "Taco de res estilo Jalisco",
  basePrice: 35,
  images: [{ url: "/taco.jpg", alt: "Taco de Birria" }],
  modifierGroups: [],
};

const NEEDS_CHOICES: PublicMenuProductCardData = {
  id: "seed-prod-03",
  name: "Taco de Pastor",
  description: "Cerdo marinado",
  basePrice: 28,
  images: [],
  modifierGroups: [
    {
      isRequired: true,
      minSelections: 1,
      options: [{ priceDelta: 0, isActive: true }],
    },
  ],
};

function CartProbe() {
  const { items } = useCart();
  return <p>Carrito: {items.length}</p>;
}

function renderCard(product: PublicMenuProductCardData) {
  return render(
    <CartProvider>
      <CartProbe />
      <MenuProductCard product={product} />
    </CartProvider>,
  );
}

describe("tarjeta de producto del menú (T3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra nombre, precio e imagen, y no repite la descripción", () => {
    renderCard(ADDABLE);

    const card = screen.getByRole("link", { name: "Ver Taco de Birria" });
    const article = card.closest("article") as HTMLElement;

    expect(within(article).getByText("Taco de Birria")).toBeTruthy();
    expect(within(article).getByText(/C\$/)).toBeTruthy();
    expect(within(article).getByAltText("Taco de Birria")).toBeTruthy();
    // La descripción vive en la pantalla del producto: la tarjeta es para elegir rápido.
    expect(within(article).queryByText("Taco de res estilo Jalisco")).toBeNull();
  });

  it("el '+' agrega al carrito sin abrir el producto y lo anuncia", async () => {
    const user = userEvent.setup();
    renderCard(ADDABLE);

    expect(screen.getByText("Carrito: 0")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Agregar Taco de Birria al carrito" }));

    expect(screen.getByText("Carrito: 1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Agregado al carrito");
  });

  it("cuando hay que elegir opciones no dibuja un '+' que no agrega", () => {
    renderCard(NEEDS_CHOICES);

    expect(screen.queryByRole("button", { name: /Agregar Taco de Pastor/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver Taco de Pastor" })).toHaveProperty(
      "pathname",
      "/menu/seed-prod-03",
    );
  });
});
