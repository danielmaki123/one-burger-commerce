// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CartProvider, useCart } from "@/shared/lib/cart";

/**
 * El carrito del cliente, guardado en `localStorage`.
 *
 * Este test existe por un bug real, encontrado verificando el camino real del checkout (E2E de comandas
 * contra el server de desarrollo): al **entrar a `/checkout` con el carrito lleno**, el carrito aparecía
 * vacío y el cliente no podía confirmar el pedido. La causa no era el checkout: el `CartProvider`
 * guardaba el carrito en un efecto que corre en el **primer render** (con la lista todavía vacía), así que
 * escribía `[]` encima de lo guardado **antes** de leerlo. En producción se recuperaba en el render
 * siguiente, pero con el doble montaje de StrictMode (y en la ventana entre el pisado y la lectura) el
 * pedido se perdía: un carrito perdido es una venta perdida.
 *
 * La regla que fija este archivo: **nunca** se escribe el carrito antes de haberlo leído.
 */

const CART_KEY = "one-burger-cart";

const item = {
  productId: "seed-prod-01",
  productName: "Taco de Birria",
  quantity: 1,
  unitPrice: 35,
  packagingUnitAmount: 0,
  packagingTotalAmount: 0,
  modifierOptionIds: [],
  modifiers: [],
  lineTotal: 35,
};

function Probe() {
  const { items, addItem, clearCart } = useCart();

  return (
    <div>
      <p data-testid="count">{items.length}</p>
      <button type="button" onClick={() => addItem({ ...item })}>
        Agregar
      </button>
      <button type="button" onClick={clearCart}>
        Vaciar
      </button>
    </div>
  );
}

function renderCart({ strict = true } = {}) {
  const tree = (
    <CartProvider>
      <Probe />
    </CartProvider>
  );

  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function stored(): string {
  return localStorage.getItem(CART_KEY) ?? "(nada)";
}

describe("carrito del cliente sobre localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("no pisa el carrito guardado al montar (el pedido no se pierde al entrar al checkout)", async () => {
    localStorage.setItem(CART_KEY, JSON.stringify([item]));

    renderCart();

    // El carrito guardado sigue ahí y la pantalla lo ve: es lo que el checkout necesita para mostrar
    // el formulario en vez de «Tu carrito está vacío».
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(stored()).toContain("seed-prod-01");
  });

  it("sin carrito guardado arranca vacío", async () => {
    renderCart();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
  });

  it("lo que se agrega queda guardado", async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    await waitFor(() => expect(stored()).toContain("seed-prod-01"));
  });

  it("vaciar el carrito deja el carrito guardado vacío (no lo resucita)", async () => {
    localStorage.setItem(CART_KEY, JSON.stringify([item]));
    const user = userEvent.setup();

    renderCart();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    await user.click(screen.getByRole("button", { name: "Vaciar" }));

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
    await waitFor(() => expect(JSON.parse(stored())).toEqual([]));
  });

  it("un carrito guardado corrupto no rompe la pantalla", async () => {
    localStorage.setItem(CART_KEY, "no-es-json");

    renderCart();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
  });
});
