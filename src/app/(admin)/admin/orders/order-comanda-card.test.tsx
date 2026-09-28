// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderComandaCard, type ComandaCardOrder } from "./order-comanda-card";

/**
 * La comanda que la cocina lee a un brazo de distancia — **una sola tarjeta** para las dos superficies.
 *
 * Lo que se prueba acá es lo que la distingue de un ticket de caja: items con sus modificadores y la nota
 * del cliente (lo que hay que cocinar), **sin precios ni PIN**, y una urgencia que se ve sin depender del
 * color. Y lo que `TASK-ORDERS-KITCHEN-RUNTIME-002` sumó desde la referencia aprobada: la etiqueta de
 * **canal** (`MENÚ`/`POS`) —o nada, si el pedido no la declara—, el cronómetro **`PREP N m`** que cuenta
 * desde `preparingAt`, el **inicio recomendado** de un programado y la preparación real en Listos.
 */
/** 20:30 en Managua (UTC−6): las horas del test se leen como las ve la cocina. */
const NOW = Date.parse("2026-09-12T02:30:00.000Z");
const TIME_ZONE = "America/Managua";

function order(overrides: Partial<ComandaCardOrder> = {}): ComandaCardOrder {
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

function renderCard(overrides: Partial<ComandaCardOrder> = {}, props: Record<string, unknown> = {}) {
  const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <OrderComandaCard
      order={order(overrides)}
      nowMs={NOW}
      timeZone={TIME_ZONE}
      detailHref={`/admin/orders/${overrides.id ?? "ord_1"}`}
      onUpdateStatus={onUpdateStatus}
      {...props}
    />,
  );

  return { ...view, onUpdateStatus };
}

afterEach(() => {
  cleanup();
});

describe("comanda: lo que la cocina necesita leer", () => {
  it("dice el número, cuándo entró y hace cuánto está en la etapa", () => {
    renderCard();

    expect(screen.getByText("P-123")).toBeTruthy();
    expect(screen.getByText(/Entró 8:12 p\. m\./)).toBeTruthy();
    expect(screen.getByText("hace 2 min")).toBeTruthy();
  });

  it("deja abrir el detalle cuando la superficie lo tiene (el mostrador lo necesita para cobrar)", () => {
    renderCard();

    const link = screen.getByRole("link", { name: "Abrir orden P-123" });
    expect(link.getAttribute("href")).toBe("/admin/orders/ord_1");
    // El enlace cubre la información de la comanda, no las acciones (un botón dentro de un enlace
    // es HTML inválido).
    expect(link.textContent).toContain("Ana Pérez");
    expect(link.textContent).not.toContain("Aceptar");
  });

  it("en Cocina **no** enlaza a ninguna parte: el detalle del pedido no es de esa superficie", () => {
    renderCard({}, { detailHref: undefined });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Ana Pérez")).toBeTruthy();
  });

  it("lista los items con su cantidad, sus modificadores y la nota del cliente", () => {
    renderCard();

    // La referencia del KDS separa la cantidad en un badge (`2x`, en ámbar y mono) del nombre del
    // producto, y los modificadores van como sub-balas ámbar debajo.
    expect(screen.getByText("2x")).toBeTruthy();
    expect(screen.getByText("Hamburguesa Doble")).toBeTruthy();
    expect(screen.getByText(/Término medio/)).toBeTruthy();
    expect(screen.getByText(/Extra queso/)).toBeTruthy();
    expect(screen.getByText(/Sin cebolla/)).toBeTruthy();
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

describe("comanda: el canal de origen (TASK-ORDERS-KITCHEN-RUNTIME-002)", () => {
  it("etiqueta el canal del pedido del menú", () => {
    renderCard({ source: "menu" });

    expect(screen.getByText("Menú")).toBeTruthy();
  });

  it("etiqueta el canal del pedido del mostrador", () => {
    renderCard({ source: "pos" });

    expect(screen.getByText("POS")).toBeTruthy();
  });

  it("un pedido sin canal declarado sale **sin** etiqueta: no se adivina de dónde vino", () => {
    renderCard({ source: null });

    expect(screen.queryByText("Menú")).toBeNull();
    expect(screen.queryByText("POS")).toBeNull();
  });
});

describe("comanda: el cronómetro de preparación", () => {
  it("en preparando se rotula `PREP N m` y cuenta desde `preparingAt`, no desde que entró", () => {
    // Entró 18 minutos antes y lleva 8 en el fuego: lo que importa es lo segundo.
    renderCard({
      status: "preparing",
      stageChangedAt: "2026-09-12T02:22:00.000Z",
      preparingAt: "2026-09-12T02:22:00.000Z",
    });

    expect(screen.getByTestId("kitchen-prep-timer").textContent).toBe("PREP 08m");
  });

  it("fuera de preparando no hay cronómetro de cocina", () => {
    renderCard({ status: "confirmed" });

    expect(screen.queryByTestId("kitchen-prep-timer")).toBeNull();
  });

  it("un pedido aceptado y sin empezar dice que espera, en vez de mostrar un cronómetro", () => {
    renderCard({ status: "confirmed", preparingAt: null });

    expect(screen.getByTestId("kitchen-waiting-start")).toBeTruthy();
    expect(screen.queryByTestId("kitchen-prep-timer")).toBeNull();
  });
});

describe("comanda: el programado y el inicio recomendado", () => {
  it("muestra el inicio recomendado: la hora prometida menos el lead del local", () => {
    renderCard({
      pickupTime: "2026-09-12T03:00:00.000Z", // 9:00 p. m. en Managua
      pickupScheduled: true,
      pickupLeadMinutes: 25, // 8:35 p. m.
    });

    expect(screen.getByText(/Inicio recomendado/)).toBeTruthy();
    expect(screen.getByText("8:35 p. m.")).toBeTruthy();
  });

  it("un pedido del POS no tiene hora prometida y dice «lo antes posible», sin inventar una hora", () => {
    renderCard({ pickupTime: null, pickupScheduled: false, pickupLeadMinutes: 25 });

    expect(screen.getByText("Retiro: lo antes posible")).toBeTruthy();
    expect(screen.queryByText(/Inicio recomendado/)).toBeNull();
  });

  it("sin hora prometida no hay inicio recomendado aunque haya lead", () => {
    renderCard({ pickupTime: null, pickupScheduled: true, pickupLeadMinutes: 25 });

    expect(screen.queryByText(/Inicio recomendado/)).toBeNull();
  });
});

describe("comanda: la preparación real en Listos", () => {
  it("muestra la preparación `preparingAt → readyAt`, no desde que entró el pedido", () => {
    renderCard({
      status: "ready_for_pickup",
      // Entró 30 minutos antes, pero la cocina tardó 14.
      preparingAt: "2026-09-12T02:06:00.000Z",
      readyAt: "2026-09-12T02:20:00.000Z",
    });

    expect(screen.getByText(/✓ LISTO · Preparación 14 min/)).toBeTruthy();
    expect(screen.getByText("Espera mostrador / Caja")).toBeTruthy();
  });

  it("sin sello de preparación lo dice sin inventar un tiempo", () => {
    renderCard({ status: "ready_for_pickup", preparingAt: null, readyAt: null });

    expect(screen.getByText("✓ LISTO")).toBeTruthy();
    expect(screen.queryByText(/Preparación \d+ min/)).toBeNull();
  });

  it("en Listos **no** hay acción: el pedido ya salió de cocina", () => {
    renderCard({ status: "ready_for_pickup" });

    expect(screen.queryByRole("button", { name: "Aceptar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aceptar" })).toBeNull();
  });
});

describe("comanda: la urgencia se ve y se lee", () => {
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

  it("el umbral sale de la configuración del local cuando la hay", () => {
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
