// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PosOperationalFeed,
  PosOperationalFinancialState,
  PosOperationalOrder,
  PosOperationalSummary,
} from "@/modules/orders/domain/pos-operational-orders";

import {
  PosOperationalBand,
  buildPosOperationalBand,
  filterPosOperationalOrders,
  sortByPickupTime,
} from "./pos-operational-band";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §5, §6, §21) — **la banda de KPI del encabezado del POS**.
 *
 * Tres contratos, y ninguno se prueba con el helper que los produce:
 *
 * 1. **Los números son del servidor.** La banda dibuja `feed.summary`; no cuenta nada. Acá se fijan con
 *    literales (6 / 4 / 3 / 2) y en el orden aprobado `En proceso · Listos · Por cobrar · Programados`. Si
 *    alguien volviera a contar en React, el número dependería del viewport y este test no lo vería —por eso
 *    además se prueba `buildPosOperationalBand` contra la misma tabla de literales—.
 * 2. **Cada contador abre el panel en su modo** (`onSelect`) y el modo abierto queda marcado con
 *    `aria-pressed="true"`, que es estado y no sólo color.
 * 3. **Los filtros de modo** son la regla que decide qué lista ve el cajero: «En proceso» es producción
 *    (`new` · `confirmed` · `preparing`), «Listos» es exactamente `ready_for_pickup`, «Por cobrar» es el
 *    estado financiero canónico distinto de `paid` (`partial` incluido) y «Programados» exige las dos
 *    señales —marca del cliente **y** hora prometida—. Los pedidos se arman a mano: la expectativa sale de
 *    la regla del negocio, no de `classifyPosOperational`.
 */

afterEach(cleanup);

/** El resumen que el servidor devuelve para el local. Números distintos a propósito: uno por contador. */
const RESUMEN: PosOperationalSummary = {
  inProcess: 6,
  ready: 4,
  pendingPayment: 3,
  scheduled: 2,
};

function financialState(
  overrides: Partial<PosOperationalFinancialState> = {},
): PosOperationalFinancialState {
  return {
    status: "pending",
    paidAmount: 0,
    outstandingAmount: 350,
    unresolvedAmount: 0,
    baseCurrencyCode: "NIO",
    ...overrides,
  };
}

function operationalOrder(overrides: Partial<PosOperationalOrder> = {}): PosOperationalOrder {
  return {
    id: "ord_1",
    orderNumber: "P-1001",
    source: null,
    customerName: "Cliente",
    locationId: "loc_centro",
    locationName: "Camino de Oriente",
    status: "preparing",
    pickupTime: null,
    pickupScheduled: false,
    currencyCode: "NIO",
    total: 350,
    financialState: financialState(),
    ...overrides,
  };
}

function feed(summary: PosOperationalSummary = RESUMEN): PosOperationalFeed {
  return { orders: [], summary };
}

function renderBand(overrides: Partial<Parameters<typeof PosOperationalBand>[0]> = {}) {
  const onSelect = vi.fn();
  const onRetry = vi.fn();

  const props: Parameters<typeof PosOperationalBand>[0] = {
    feed: feed(),
    loading: false,
    error: null,
    activeMode: null,
    onSelect,
    onRetry,
    ...overrides,
  };

  render(<PosOperationalBand {...props} />);

  return { onSelect, onRetry };
}

describe("buildPosOperationalBand", () => {
  it("arma las cuatro entradas en el orden aprobado, con los números del resumen", () => {
    const entradas = buildPosOperationalBand(RESUMEN);

    expect(entradas.map((entrada) => entrada.mode)).toEqual([
      "process",
      "ready",
      "pending-payment",
      "scheduled",
    ]);
    expect(entradas.map((entrada) => entrada.label)).toEqual([
      "En proceso",
      "Listos",
      "Por cobrar",
      "Programados",
    ]);
    expect(entradas.map((entrada) => entrada.value)).toEqual([6, 4, 3, 2]);
  });
});

describe("PosOperationalBand", () => {
  it("dibuja los cuatro contadores del servidor en el orden del brief", () => {
    renderBand();

    const banda = screen.getByRole("navigation", { name: "Resumen operacional del local" });
    const contadores = within(banda).getAllByRole("button");

    // El orden es parte del contrato (brief §5): primero en proceso, último programados.
    expect(contadores.map((contador) => contador.getAttribute("data-testid"))).toEqual([
      "pos-kpi-process",
      "pos-kpi-ready",
      "pos-kpi-pending-payment",
      "pos-kpi-scheduled",
    ]);

    // El nombre accesible dice el rótulo largo y el número aunque el chip muestre el corto.
    expect(contadores.map((contador) => contador.getAttribute("aria-label"))).toEqual([
      "En proceso: 6 pedidos",
      "Listos: 4 pedidos",
      "Por cobrar: 3 pedidos",
      "Programados: 2 pedidos",
    ]);

    // Y el número está visible, no sólo en el nombre accesible.
    for (const [indice, valor] of ["6", "4", "3", "2"].entries()) {
      expect(within(contadores[indice]).getByText(valor)).toBeTruthy();
    }
  });

  it("cada contador abre el panel en su modo", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderBand();

    const modos = [
      ["pos-kpi-process", "process"],
      ["pos-kpi-ready", "ready"],
      ["pos-kpi-pending-payment", "pending-payment"],
      ["pos-kpi-scheduled", "scheduled"],
    ] as const;

    for (const [testId, modo] of modos) {
      await user.click(screen.getByTestId(testId));
      expect(onSelect).toHaveBeenLastCalledWith(modo);
    }

    expect(onSelect).toHaveBeenCalledTimes(4);
  });

  it("marca el modo abierto con aria-pressed y deja el resto apagado", () => {
    renderBand({ activeMode: "pending-payment" });

    expect(screen.getByTestId("pos-kpi-pending-payment").getAttribute("aria-pressed")).toBe("true");

    for (const testId of ["pos-kpi-process", "pos-kpi-ready", "pos-kpi-scheduled"]) {
      expect(screen.getByTestId(testId).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("sin panel abierto ningún contador queda marcado", () => {
    renderBand({ activeMode: null });

    for (const testId of [
      "pos-kpi-process",
      "pos-kpi-ready",
      "pos-kpi-pending-payment",
      "pos-kpi-scheduled",
    ]) {
      expect(screen.getByTestId(testId).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("un error pide reintentar en español y llama a la acción", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderBand({ error: "No se pudo leer el feed." });

    expect(screen.getByRole("status").textContent).toContain(
      "No se pudieron leer los pedidos del local.",
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    // Con error no se dibujan contadores: un cero sería un local vacío, no un fallo de lectura.
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByTestId("pos-kpi-process")).toBeNull();
  });

  it("mientras lee lo dice en vez de mostrar ceros", () => {
    renderBand({ feed: null, loading: true });

    expect(screen.getByRole("status").textContent).toContain("Leyendo los pedidos del local…");
    expect(screen.queryByTestId("pos-kpi-process")).toBeNull();
  });
});

describe("filterPosOperationalOrders", () => {
  it("«En proceso» es producción: new, confirmed y preparing", () => {
    const pedidos = [
      operationalOrder({ id: "nuevo", status: "new" }),
      operationalOrder({ id: "confirmado", status: "confirmed" }),
      operationalOrder({ id: "preparando", status: "preparing" }),
      operationalOrder({ id: "aceptado", status: "accepted" }),
      operationalOrder({ id: "listo-cocina", status: "ready" }),
      operationalOrder({ id: "listo-retiro", status: "ready_for_pickup" }),
    ];

    expect(filterPosOperationalOrders(pedidos, "process").map((pedido) => pedido.id)).toEqual([
      "nuevo",
      "confirmado",
      "preparando",
    ]);
  });

  it("«Listos» es exactamente ready_for_pickup", () => {
    const pedidos = [
      operationalOrder({ id: "nuevo", status: "new" }),
      operationalOrder({ id: "preparando", status: "preparing" }),
      operationalOrder({ id: "listo-cocina", status: "ready" }),
      operationalOrder({ id: "listo-retiro", status: "ready_for_pickup" }),
      operationalOrder({ id: "entregado", status: "picked_up" }),
      operationalOrder({ id: "cancelado", status: "cancelled" }),
    ];

    expect(filterPosOperationalOrders(pedidos, "ready").map((pedido) => pedido.id)).toEqual([
      "listo-retiro",
    ]);
  });

  it("«Por cobrar» es todo lo que no está pago, parcial incluido", () => {
    const pedidos = [
      operationalOrder({ id: "impago", financialState: financialState({ status: "pending" }) }),
      operationalOrder({
        id: "parcial",
        financialState: financialState({
          status: "partial",
          paidAmount: 100,
          outstandingAmount: 250,
        }),
      }),
      operationalOrder({
        id: "parcial-por-revisar",
        financialState: financialState({
          status: "partial",
          paidAmount: 100,
          outstandingAmount: 250,
          unresolvedAmount: 40,
        }),
      }),
      operationalOrder({
        id: "pagado",
        financialState: financialState({
          status: "paid",
          paidAmount: 350,
          outstandingAmount: 0,
        }),
      }),
    ];

    expect(
      filterPosOperationalOrders(pedidos, "pending-payment").map((pedido) => pedido.id),
    ).toEqual(["impago", "parcial", "parcial-por-revisar"]);
  });

  it("«Programados» exige la marca del cliente y una hora prometida", () => {
    const pedidos = [
      operationalOrder({ id: "sin-hora", pickupScheduled: true, pickupTime: null }),
      operationalOrder({ id: "hora-vacia", pickupScheduled: true, pickupTime: "" }),
      operationalOrder({
        id: "sin-marca",
        pickupScheduled: false,
        pickupTime: "2026-09-13T18:00:00.000Z",
      }),
      operationalOrder({
        id: "programado",
        pickupScheduled: true,
        pickupTime: "2026-09-13T18:00:00.000Z",
      }),
    ];

    expect(filterPosOperationalOrders(pedidos, "scheduled").map((pedido) => pedido.id)).toEqual([
      "programado",
    ]);
  });
});

describe("sortByPickupTime", () => {
  it("ordena por hora prometida ascendente, no por el orden en que llegaron", () => {
    // El orden del arreglo es el de creación (el último creado retira primero).
    const pedidos = [
      operationalOrder({ id: "creado-1", pickupTime: "2026-09-13T20:00:00.000Z" }),
      operationalOrder({ id: "creado-2", pickupTime: "2026-09-13T16:30:00.000Z" }),
      operationalOrder({ id: "creado-3", pickupTime: "2026-09-13T18:00:00.000Z" }),
    ];

    expect(sortByPickupTime(pedidos).map((pedido) => pedido.id)).toEqual([
      "creado-2",
      "creado-3",
      "creado-1",
    ]);

    // No muta el feed que recibe: el panel lo vuelve a ordenar cada vez que cambia el modo.
    expect(pedidos.map((pedido) => pedido.id)).toEqual(["creado-1", "creado-2", "creado-3"]);
  });
});
