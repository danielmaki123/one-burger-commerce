// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderComandaCard, type ComandaOrder } from "./order-comanda-card";

/**
 * B3 — la comanda que la cocina lee a un brazo de distancia.
 *
 * Lo que se prueba acá es lo que la distingue de un ticket de caja: items con sus modificadores y la
 * nota del cliente (lo que hay que cocinar), **sin precios ni PIN** (eso es del mostrador), y una
 * urgencia que se ve sin depender del color: el chip dice el tiempo en palabras y lleva ícono.
 */
/** 20:30 en Managua (UTC−6): las horas del test se leen como las ve la cocina. */
const NOW = Date.parse("2026-09-12T02:30:00.000Z");
const TIME_ZONE = "America/Managua";

function order(overrides: Partial<ComandaOrder> = {}): ComandaOrder {
  return {
    id: "ord_1",
    orderNumber: "P-123",
    type: "pickup",
    status: "new",
    customerName: "Ana Pérez",
    createdAt: "2026-09-12T02:12:00.000Z",
    stageChangedAt: "2026-09-12T02:28:00.000Z",
    items: [
      {
        id: "item_1",
        productName: "Hamburguesa Doble",
        quantity: 2,
        notes: "Sin cebolla",
        modifiers: [
          { id: "mod_1", name: "Término medio" },
          { id: "mod_2", name: "Extra queso" },
        ],
      },
    ],
    ...overrides,
  };
}

function renderCard(overrides: Partial<ComandaOrder> = {}, props: Record<string, unknown> = {}) {
  const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <OrderComandaCard
      order={order(overrides)}
      nowMs={NOW}
      timeZone={TIME_ZONE}
      onUpdateStatus={onUpdateStatus}
      {...props}
    />,
  );

  return { ...view, onUpdateStatus };
}

afterEach(() => {
  cleanup();
});

describe("comanda: lo que la cocina necesita leer (B3)", () => {
  it("dice el número, cuándo entró y hace cuánto está en la etapa", () => {
    renderCard();

    expect(screen.getByText("P-123")).toBeTruthy();
    expect(screen.getByText(/Entró 8:12 p\. m\./)).toBeTruthy();
    expect(screen.getByText("hace 2 min")).toBeTruthy();
  });

  it("deja abrir el detalle: el mostrador lo necesita para cobrar", () => {
    renderCard();

    const link = screen.getByRole("link", { name: "Abrir orden P-123" });
    expect(link.getAttribute("href")).toBe("/admin/orders/ord_1");
    // El enlace cubre la información de la comanda, no las acciones (un botón dentro de un enlace
    // es HTML inválido).
    expect(link.textContent).toContain("Ana Pérez");
    expect(link.textContent).not.toContain("Aceptar");
  });

  it("nombra al cliente: es lo primero que se canta", () => {
    renderCard();

    expect(screen.getByText("Ana Pérez")).toBeTruthy();
  });

  it("lista los items con su cantidad, sus modificadores y la nota del cliente", () => {
    renderCard();

    expect(screen.getByText("2 × Hamburguesa Doble")).toBeTruthy();
    expect(screen.getByText("(Término medio, Extra queso)")).toBeTruthy();
    expect(screen.getByText("Sin cebolla")).toBeTruthy();
  });

  it("no muestra precios ni el PIN: eso es del mostrador", () => {
    const { container } = renderCard();

    expect(container.textContent).not.toMatch(/C\$/);
    expect(container.textContent).not.toMatch(/PIN/i);
  });

  it("muestra el retiro y si está programado", () => {
    renderCard({
      pickupTime: "2026-09-12T02:30:00.000Z",
      pickupScheduled: true,
    });

    expect(screen.getByText(/Retiro 8:30 p\. m\. · Programado/)).toBeTruthy();
  });

  it("las acciones del flujo van en la comanda (ancho completo)", async () => {
    const user = userEvent.setup();
    const { onUpdateStatus } = renderCard();

    await user.click(screen.getByRole("button", { name: "Aceptar" }));

    expect(onUpdateStatus).toHaveBeenCalledWith("confirmed", null);
  });
});

describe("comanda: la urgencia se ve y se lee (B3)", () => {
  it("recién entrada es una comanda normal", () => {
    const { container } = renderCard({ stageChangedAt: "2026-09-12T02:25:00.000Z" });

    expect(container.querySelector("[data-urgency]")?.getAttribute("data-urgency")).toBe("normal");
    expect(screen.getByText("hace 5 min")).toBeTruthy();
  });

  it("a los 10 minutos avisa, con fondo de advertencia y su ícono", () => {
    const { container } = renderCard({ stageChangedAt: "2026-09-12T02:18:00.000Z" });

    expect(container.querySelector("[data-urgency]")?.getAttribute("data-urgency")).toBe("warning");
    const chip = screen.getByText("hace 12 min");
    expect(chip.querySelector("svg")).toBeTruthy();
  });

  it("a los 15 minutos está atrasada: lo dice con palabras, no solo con color", () => {
    const { container } = renderCard({ stageChangedAt: "2026-09-12T02:13:00.000Z" });

    expect(container.querySelector("[data-urgency]")?.getAttribute("data-urgency")).toBe("late");
    const chip = screen.getByText("Atrasado hace 17 min");
    expect(chip.querySelector("svg")).toBeTruthy();
  });

  it("el umbral sale de la configuración del local cuando la hay (B5)", () => {
    const { container } = renderCard(
      { stageChangedAt: "2026-09-12T02:23:00.000Z" },
      { warningMinutes: 5, lateMinutes: 8 },
    );

    expect(container.querySelector("[data-urgency]")?.getAttribute("data-urgency")).toBe("warning");
  });

  it("una comanda recién llegada se resalta un momento, sin gritar", () => {
    const { container } = renderCard({}, { isNew: true });

    expect(container.querySelector("[data-new-order]")).toBeTruthy();
  });
});

