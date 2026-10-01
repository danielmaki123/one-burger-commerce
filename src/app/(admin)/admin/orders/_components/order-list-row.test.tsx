// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderListRowView } from "./order-list-row";
import type { OrderListRow } from "../order-list-types";

/**
 * `TASK-ORDERS-RUNTIME-5B` (`A-63`) — **la fila del listado formatea la hora en la zona del negocio**.
 *
 * Es el caso que `A-63` pedía y el que la mutación de la revisión adversarial rompe: si alguien volviera a
 * `toLocaleTimeString()`, la hora saldría en la zona del **navegador** y este test lo caza.
 *
 * La zona del negocio se fija en **Tokio** a propósito: el arnés corre en la zona de la máquina, así que con
 * el negocio en la misma zona el test pasaría por casualidad.
 */
vi.mock("@/shared/lib/business-settings", () => ({
  useBusinessSettings: () => ({ timezone: "Asia/Tokyo", currencyCode: "NIO" }),
  useCurrencyFormat: () => ({ symbol: "C$", locale: "es-NI" }),
}));

afterEach(cleanup);

function row(overrides: Partial<OrderListRow> = {}): OrderListRow {
  return {
    id: "ord_1",
    orderNumber: "P-1059",
    source: "pos",
    customerName: "Mostrador",
    customerWhatsapp: "+50588887777",
    locationName: "Camino de Oriente",
    // 17:45 en Managua es 23:45 UTC: con la zona del navegador (UTC en el arnés) la hora sería otra.
    pickupTime: "2026-09-30T23:45:00.000Z",
    pickupScheduled: true,
    status: "ready_for_pickup",
    stageChangedAt: "2026-09-30T23:10:00.000Z",
    total: 350,
    currencyCode: "NIO",
    financialState: {
      status: "partial",
      paidAmount: 100,
      outstandingAmount: 250,
      unresolvedAmount: 40,
      baseCurrencyCode: "NIO",
    },
    ...overrides,
  };
}

describe("OrderListRowView", () => {
  it("muestra la hora prometida en la zona del negocio, no en la del navegador (A-63)", () => {
    render(<OrderListRowView order={row()} />);

    /**
     * La hora esperada sale de la **regla del negocio**, no de la función de producción: `23:45Z` en Tokio
     * (UTC+9) es `8:45 a. m.`. Si alguien formateara con la zona del navegador, el arnés (Managua, UTC−6)
     * mostraría `5:45 p. m.` y el aserto falla.
     */
    const cells = screen.getAllByText(/Retiro/);

    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.textContent).toMatch(/8:45/);
      expect(cell.textContent).not.toMatch(/5:45/);
      expect(cell.textContent).not.toMatch(/17:45/);
    }
  });

  it("rotula PROGRAMADO sólo cuando el retiro es programado", () => {
    const { unmount } = render(<OrderListRowView order={row()} />);
    expect(screen.getAllByText("Programado").length).toBeGreaterThan(0);
    unmount();

    render(<OrderListRowView order={row({ pickupScheduled: false })} />);
    expect(screen.queryByText("Programado")).toBeNull();
    expect(screen.getAllByText("ASAP").length).toBeGreaterThan(0);
  });

  /**
   * El rótulo financiero lo resuelve el **dominio**: un parcial con plata no demostrable se marca para
   * revisar. La fila no decide qué es «parcial».
   *
   * Se consultan **todas** las apariciones: la fila dibuja la disposición de celular y la de escritorio (una
   * oculta por CSS según el ancho) y las dos tienen que decir lo mismo.
   */
  it("rotula PARCIAL · REVISAR cuando hay plata sin demostrar", () => {
    render(<OrderListRowView order={row()} />);

    const labels = screen.getAllByTestId("order-list-financial");

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label.textContent).toBe("PARCIAL · REVISAR");
  });

  it("rotula PAGADO cuando el pedido está cobrado", () => {
    render(
      <OrderListRowView
        order={row({
          financialState: {
            status: "paid",
            paidAmount: 350,
            outstandingAmount: 0,
            unresolvedAmount: 0,
            baseCurrencyCode: "NIO",
          },
        })}
      />,
    );

    expect(screen.getAllByTestId("order-list-financial")[0].textContent).toBe("PAGADO");
  });

  it("etiqueta el canal y abre el pedido con su número", () => {
    render(<OrderListRowView order={row()} />);

    expect(screen.getAllByText("POS").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Abrir pedido P-1059" })).toBeTruthy();
  });

  it("un pedido sin canal declarado no inventa etiqueta", () => {
    render(<OrderListRowView order={row({ source: null })} />);

    expect(screen.queryByText("POS")).toBeNull();
    expect(screen.queryByText("MENÚ")).toBeNull();
  });
});
