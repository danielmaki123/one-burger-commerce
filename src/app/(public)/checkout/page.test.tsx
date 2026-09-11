// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/shared/lib/cart";

import CheckoutPage from "./page";

const push = vi.fn();

let mockCart: {
  items: CartItem[];
  subtotal: number;
  clearCart: ReturnType<typeof vi.fn>;
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/shared/lib/cart", () => ({
  useCart: () => mockCart,
}));

const twoItems: CartItem[] = [
  {
    productId: "prod-1",
    productName: "Hamburguesa Clásica",
    quantity: 1,
    unitPrice: 200,
    packagingUnitAmount: 10,
    packagingTotalAmount: 10,
    modifierOptionIds: [],
    lineTotal: 210,
  },
  {
    productId: "prod-2",
    productName: "Papas Fritas",
    quantity: 2,
    unitPrice: 80,
    packagingUnitAmount: 5,
    packagingTotalAmount: 10,
    modifierOptionIds: [],
    lineTotal: 170,
  },
];

function countMatches(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

function confirmButtons() {
  return screen.getAllByRole("button", { name: /Confirmar pedido/ });
}

describe("checkout sin redundancias", () => {
  // Sin esto el DOM se acumula entre tests y las consultas por `screen` ven
  // elementos de la corrida anterior (el repo no usa `globals: true`).
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    push.mockReset();
    mockCart = { items: [], subtotal: 0, clearCart: vi.fn() };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("con el carrito vacío muestra el estado compartido", () => {
    render(<CheckoutPage />);

    expect(screen.getByText("Tu carrito está vacío")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver menú" })).toBeTruthy();
  });

  it("dice cada cosa una sola vez", () => {
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    const { container } = render(<CheckoutPage />);
    const html = container.innerHTML;

    expect(countMatches(html, "Confirmá tu pedido")).toBe(1);
    expect(countMatches(html, "Resumen del pedido")).toBe(1);
    expect(countMatches(html, "Subtotal")).toBe(1);
    expect(countMatches(html, "Empaque")).toBe(1);
    // El total, una sola vez: el importe del CTA no repite la fila "Total a pagar".
    expect(countMatches(html, "Total a pagar")).toBe(1);
    // En el DOM hay un CTA por viewport; visible queda uno solo (lo verifica el E2E,
    // que es el único que puede evaluar el CSS).
    expect(confirmButtons()).toHaveLength(2);

    // Lo que se fue con la limpieza.
    expect(html).not.toContain("Tu bolsa");
    expect(html).not.toContain("Total estimado");
    expect(html).not.toContain("Listo para confirmar");
    expect(html).not.toContain("Paso final");
    expect(html).not.toContain("Número de mesa");
    expect(html).not.toContain("Mesa");
    expect(html).not.toContain("Delivery");
  });

  it("muestra el CTA de escritorio y el de móvil en contenedores exclusivos", () => {
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    const { container } = render(<CheckoutPage />);

    // Sin esto, los dos CTA quedan visibles a la vez en algún ancho de pantalla.
    expect(container.querySelectorAll(".hidden.lg\\:block").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".lg\\:hidden").length).toBeGreaterThan(0);
  });

  it("lista el pedido completo, no solo el primer producto", () => {
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    render(<CheckoutPage />);

    expect(screen.getAllByText("Hamburguesa Clásica").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Papas Fritas").length).toBeGreaterThan(0);
    expect(screen.getByText("3 productos")).toBeTruthy();
  });

  it("avisa cómo se paga una sola vez y con el texto del negocio", () => {
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    const { container } = render(<CheckoutPage />);

    expect(
      countMatches(container.innerHTML, "Pagás en el local al retirar tu pedido."),
    ).toBe(1);
  });

  it("no arranca con el botón deshabilitado", () => {
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    render(<CheckoutPage />);

    for (const button of confirmButtons()) {
      expect(button.hasAttribute("disabled")).toBe(false);
    }
  });

  it("al tocar con datos faltantes señala el campo, lo enfoca y muestra un solo aviso", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    render(<CheckoutPage />);
    await user.click(confirmButtons()[0]);

    const messages = screen.getAllByText("Falta completar nombre.");
    expect(messages).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preselecciona el primer turno de retiro calculado", async () => {
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };

    render(<CheckoutPage />);

    await waitFor(() => {
      const soonest = screen.getByRole("button", { name: /^Lo antes posible · / });
      expect(soonest.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("envía el pedido con el turno preseleccionado", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 380, clearCart: vi.fn() };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "order-1",
            orderNumber: "OB-1",
            type: "pickup",
            status: "new",
            total: 380,
            subtotal: 380,
            orderLookupToken: "token-1",
          },
        }),
      }),
    );

    render(<CheckoutPage />);
    await user.type(screen.getByLabelText("Nombre completo"), "Cliente E2E");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.customerName).toBe("Cliente E2E");
    expect(body.type).toBe("pickup");
    expect(typeof body.pickupTime).toBe("string");
    expect(Number.isNaN(new Date(body.pickupTime).getTime())).toBe(false);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/success/order-1?token=token-1"));
  });
});
