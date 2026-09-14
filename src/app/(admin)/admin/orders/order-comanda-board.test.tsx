// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ComandaOrder } from "./order-comanda-card";
import { OrderComandaBoard } from "./order-comanda-board";

/**
 * B3 — el tablero: tres carriles en escritorio, uno por vez en celular.
 *
 * jsdom no aplica CSS, así que acá se prueba lo que el tablero **contiene** (cada comanda en su
 * carril, contadores, vacíos que enseñan, y las acciones cableadas al pedido correcto). Que en
 * celular se vea un carril por vez lo verifica el E2E, que sí tiene layout.
 */
const NOW = Date.parse("2026-09-12T02:30:00.000Z");
const TIME_ZONE = "America/Managua";

function comanda(overrides: Partial<ComandaOrder> = {}): ComandaOrder {
  return {
    id: "ord_1",
    orderNumber: "P-123",
    type: "pickup",
    status: "new",
    customerName: "Ana Pérez",
    createdAt: "2026-09-12T02:12:00.000Z",
    stageChangedAt: "2026-09-12T02:28:00.000Z",
    items: [{ id: "item_1", productName: "Hamburguesa Doble", quantity: 1, modifiers: [] }],
    ...overrides,
  };
}

function renderBoard(orders: ComandaOrder[], props: Record<string, unknown> = {}) {
  const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
  const onActiveLaneChange = vi.fn();
  const view = render(
    <OrderComandaBoard
      orders={orders}
      nowMs={NOW}
      timeZone={TIME_ZONE}
      activeLane="pending"
      onActiveLaneChange={onActiveLaneChange}
      onUpdateStatus={onUpdateStatus}
      {...props}
    />,
  );

  return { ...view, onUpdateStatus, onActiveLaneChange };
}

afterEach(() => {
  cleanup();
});

describe("tablero de comandas (B3)", () => {
  it("cada comanda aparece en el carril de su etapa", () => {
    renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "new", customerName: "Nueva" }),
      comanda({ id: "b", orderNumber: "P-2", status: "confirmed", customerName: "Aceptada" }),
      comanda({ id: "c", orderNumber: "P-3", status: "preparing", customerName: "Cocinando" }),
      comanda({ id: "d", orderNumber: "P-4", status: "ready_for_pickup", customerName: "Lista" }),
    ]);

    expect(screen.getByRole("heading", { name: /Por aceptar/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /En preparación/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Listas/ })).toBeTruthy();

    // Dos en preparación (aceptada y cocinándose), una por aceptar, una lista.
    expect(screen.getByText("Nueva")).toBeTruthy();
    expect(screen.getByText("Aceptada")).toBeTruthy();
    expect(screen.getByText("Cocinando")).toBeTruthy();
    expect(screen.getByText("Lista")).toBeTruthy();
  });

  it("lo cerrado o cancelado no está en el tablero", () => {
    renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "closed", customerName: "Cerrada" }),
      comanda({ id: "b", orderNumber: "P-2", status: "cancelled", customerName: "Cancelada" }),
    ]);

    expect(screen.queryByText("Cerrada")).toBeNull();
    expect(screen.queryByText("Cancelada")).toBeNull();
  });

  it("un carril vacío enseña qué va a aparecer ahí, en vez de quedar en blanco", () => {
    renderBoard([]);

    expect(
      screen.getAllByText(/No hay comandas nuevas\. Cuando entre un pedido, aparece acá\./).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nada en el fuego\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Todavía no hay nada listo para entregar\./).length).toBeGreaterThan(0);
  });

  it("los contadores de cada carril salen de lo que hay", () => {
    renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "new" }),
      comanda({ id: "b", orderNumber: "P-2", status: "new" }),
      comanda({ id: "c", orderNumber: "P-3", status: "ready_for_pickup" }),
    ]);

    expect(screen.getAllByRole("heading", { name: /Por aceptar \(2\)/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /Listas \(1\)/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /En preparación \(0\)/ }).length).toBeGreaterThan(0);
  });

  it("en celular se cambia de carril con el conmutador, que dice cuántas hay en cada uno", async () => {
    const user = userEvent.setup();
    const { onActiveLaneChange } = renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "new" }),
      comanda({ id: "c", orderNumber: "P-3", status: "ready_for_pickup" }),
    ]);

    const ready = screen.getByRole("button", { name: /^Listas 1$/ });
    await user.click(ready);

    expect(onActiveLaneChange).toHaveBeenCalledWith("ready");
  });

  it("las acciones de una comanda saben de qué pedido son", async () => {
    const user = userEvent.setup();
    const { onUpdateStatus } = renderBoard([
      comanda({ id: "ord_9", orderNumber: "P-9", status: "new" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Aceptar" }));

    expect(onUpdateStatus).toHaveBeenCalledWith("ord_9", "confirmed", null);
  });

  it("una comanda recién llegada se marca para que el ojo la encuentre", () => {
    const { container } = renderBoard([comanda({ id: "ord_5", status: "new" })], {
      newOrderIds: ["ord_5"],
    });

    expect(container.querySelector('[data-order="ord_5"]')?.hasAttribute("data-new-order")).toBe(
      true,
    );
  });

  it("sin conexión, las acciones del carril quedan apagadas y dicen por qué", () => {
    renderBoard([comanda({ id: "ord_5", status: "new" })], {
      disabled: true,
      disabledReason: "Sin conexión: no se puede cambiar el estado.",
    });

    expect(screen.getAllByRole("button", { name: "Aceptar" })[0].hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText(/Sin conexión: no se puede cambiar el estado\./).length).toBeGreaterThan(0);
  });
});
