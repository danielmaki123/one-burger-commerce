// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider } from "@/shared/lib/cart";

import CartPage from "./page";

/**
 * Fase 7 de `TASK-checkout-v2` — editar por ítem desde el resumen.
 *
 * Los controles ya existían (los dejó `TASK-checkout-ux`), pero la regla del programa es que
 * **ningún control sea decorativo**: cada uno implementado con su estado **y cubierto por un
 * test**. Acá se usa el carrito de verdad (`CartProvider` sobre `localStorage`), no un doble,
 * así que el test comprueba que editar cambia el pedido y el total.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const CART_KEY = "one-burger-cart";

function cartItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: "seed-prod-01",
    productName: "Taco de Birria",
    quantity: 1,
    unitPrice: 35,
    packagingUnitAmount: 0,
    packagingTotalAmount: 0,
    modifierOptionIds: [],
    modifiers: [],
    lineTotal: 35,
    ...overrides,
  };
}

function renderCart() {
  return render(
    <CartProvider>
      <CartPage />
    </CartProvider>,
  );
}

/**
 * El total del resumen ("Total a pagar"), que es el número que el cliente mira. Se acota a esa
 * fila porque el mismo importe aparece también en la línea del producto.
 */
function summaryTotal(): string {
  const row = screen.getByText("Total a pagar").parentElement as HTMLElement;

  return row.textContent ?? "";
}

describe("carrito: edición por ítem (fase 7)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("sumar unidades cambia la cantidad y el total", async () => {
    const user = userEvent.setup();
    localStorage.setItem(CART_KEY, JSON.stringify([cartItem()]));

    renderCart();
    await screen.findByText("Taco de Birria");
    expect(summaryTotal()).toContain("C$35.00");

    await user.click(screen.getByRole("button", { name: "Sumar una unidad de Taco de Birria" }));

    await waitFor(() => expect(summaryTotal()).toContain("C$70.00"));
    // La cantidad que se ve en el stepper también sube.
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("restar nunca baja de una unidad", async () => {
    const user = userEvent.setup();
    localStorage.setItem(CART_KEY, JSON.stringify([cartItem({ quantity: 2, lineTotal: 70 })]));

    renderCart();
    await screen.findByText("Taco de Birria");
    expect(summaryTotal()).toContain("C$70.00");

    await user.click(screen.getByRole("button", { name: "Restar una unidad de Taco de Birria" }));
    await waitFor(() => expect(summaryTotal()).toContain("C$35.00"));

    // En 1 el botón no puede dejar el carrito en cero: para eso está "Quitar".
    await user.click(screen.getByRole("button", { name: "Restar una unidad de Taco de Birria" }));
    expect(summaryTotal()).toContain("C$35.00");
    expect(screen.queryByText("Tu carrito está vacío")).toBeNull();
  });

  it("quitar saca la línea y deja el estado vacío", async () => {
    const user = userEvent.setup();
    localStorage.setItem(CART_KEY, JSON.stringify([cartItem()]));

    renderCart();
    await screen.findByText("Taco de Birria");

    await user.click(screen.getByRole("button", { name: "Quitar Taco de Birria del carrito" }));

    expect(await screen.findByText("Tu carrito está vacío")).toBeTruthy();
    expect(screen.queryByText("Taco de Birria")).toBeNull();
  });

  it("editar una línea no toca a la otra", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      CART_KEY,
      JSON.stringify([
        cartItem(),
        cartItem({
          productId: "seed-prod-02",
          productName: "Agua de Jamaica",
          unitPrice: 25,
          lineTotal: 25,
        }),
      ]),
    );

    renderCart();
    await screen.findByText("Agua de Jamaica");
    expect(summaryTotal()).toContain("C$60.00");

    await user.click(screen.getByRole("button", { name: "Sumar una unidad de Agua de Jamaica" }));

    // El taco sigue en 1 y el agua sube a 2: 35 + 50 = 85.
    await waitFor(() => expect(summaryTotal()).toContain("C$85.00"));
  });
});
