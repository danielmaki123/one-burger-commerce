// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ComandaCardOrder } from "./order-comanda-card";
import { comandaThresholds } from "./comanda-helpers";
import { OrderComandaBoard } from "./order-comanda-board";

/**
 * B3 — el tablero: tres carriles en escritorio, uno por vez en celular.
 *
 * jsdom no aplica CSS, así que acá se prueba lo que el tablero **contiene** (cada comanda en su carril,
 * contadores, vacíos que enseñan, y las acciones cableadas al pedido correcto). Que en celular se vea un
 * carril por vez lo verifica el E2E, que sí tiene layout.
 *
 * `TASK-ORDERS-KITCHEN-RUNTIME-002`: el tablero consume el carril **canónico** del dominio, así que
 * `confirmed` está en el carril de ENTRADA —«Por aceptar» en esta superficie— y no en preparación.
 */
const NOW = Date.parse("2026-09-12T02:30:00.000Z");
const TIME_ZONE = "America/Managua";

function comanda(overrides: Partial<ComandaCardOrder> = {}): ComandaCardOrder {
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

function renderBoard(orders: ComandaCardOrder[], props: Record<string, unknown> = {}) {
  const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
  const onActiveLaneChange = vi.fn();
  const view = render(
    <OrderComandaBoard
      orders={orders}
      nowMs={NOW}
      timeZone={TIME_ZONE}
      activeLane="entry"
      onActiveLaneChange={onActiveLaneChange}
      onUpdateStatus={onUpdateStatus}
      thresholds={comandaThresholds({})}
      {...props}
    />,
  );

  return { ...view, onUpdateStatus, onActiveLaneChange };
}

afterEach(() => {
  cleanup();
});

describe("tablero de comandas (B3)", () => {
  it("cada comanda aparece en el carril de su etapa, y `confirmed` está en la entrada", () => {
    renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "new", customerName: "Nueva" }),
      comanda({ id: "b", orderNumber: "P-2", status: "confirmed", customerName: "Aceptada" }),
      comanda({ id: "c", orderNumber: "P-3", status: "preparing", customerName: "Cocinando" }),
      comanda({ id: "d", orderNumber: "P-4", status: "ready_for_pickup", customerName: "Lista" }),
    ]);

    // La regla canónica: aceptado todavía no está en el fuego (`A-64`).
    const entry = screen.getByRole("region", { name: "Entrada" });
    expect(within(entry).getByText("Nueva")).toBeTruthy();
    expect(within(entry).getByText("Aceptada")).toBeTruthy();

    const preparing = screen.getByRole("region", { name: "Preparando" });
    expect(within(preparing).getByText("Cocinando")).toBeTruthy();
    expect(within(preparing).queryByText("Aceptada")).toBeNull();

    expect(within(screen.getByRole("region", { name: "Listos" })).getByText("Lista")).toBeTruthy();
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

  it("con una búsqueda puesta, el carril vacío dice que es por la búsqueda (B4)", () => {
    renderBoard([], { searchTerm: "ana" });

    expect(screen.getAllByText(/Ninguna comanda de este carril coincide con «ana»\./).length).toBe(3);
    expect(screen.queryByText(/No hay comandas nuevas\./)).toBeNull();
  });

  it("los contadores de cada carril salen de lo que hay", () => {
    renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "new" }),
      comanda({ id: "b", orderNumber: "P-2", status: "confirmed" }),
      comanda({ id: "c", orderNumber: "P-3", status: "ready_for_pickup" }),
    ]);

    // Los dos primeros son la **entrada**: el aceptado también espera trabajo.
    expect(screen.getAllByRole("heading", { name: /Entrada \(2\)/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /Listos \(1\)/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /Preparando \(0\)/ }).length).toBeGreaterThan(0);
  });

  it("en celular se cambia de carril con el conmutador, que dice cuántas hay en cada uno", async () => {
    const user = userEvent.setup();
    const { onActiveLaneChange } = renderBoard([
      comanda({ id: "a", orderNumber: "P-1", status: "new" }),
      comanda({ id: "c", orderNumber: "P-3", status: "ready_for_pickup" }),
    ]);

    const ready = screen.getByRole("button", { name: /^Listos 1$/ });
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

  it("en Pedidos la comanda abre el detalle del pedido (es su superficie)", () => {
    renderBoard([comanda({ id: "ord_9", orderNumber: "P-9", status: "new" })]);

    expect(
      screen.getByRole("link", { name: "Abrir orden P-9" }).getAttribute("href"),
    ).toBe("/admin/orders/ord_9");
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
