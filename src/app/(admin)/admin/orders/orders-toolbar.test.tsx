// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrdersToolbar, type OrdersToolbarProps } from "./orders-toolbar";

/**
 * La barra de trabajo de Órdenes es **una sola** para todo el shell (2026-09-18, layout unificado):
 * los tabs de estado son el filtro de la pantalla —carriles para los activos, lista para cerradas—,
 * y el local, los contadores y los controles del turno viven acá y no dentro de una vista.
 *
 * Se prueba sola porque el bug que la motivó fue justamente de shell: el mismo dato con dos barras
 * distintas según la vista.
 */

afterEach(cleanup);

function props(overrides: Partial<OrdersToolbarProps> = {}): OrdersToolbarProps {
  return {
    statusFilter: "all",
    onStatusChange: vi.fn(),
    typeFilter: "all",
    onTypeChange: vi.fn(),
    paymentFilter: "all",
    onPaymentChange: vi.fn(),
    lateOnly: false,
    onToggleLateOnly: vi.fn(),
    searchTerm: "",
    onSearchTermChange: vi.fn(),
    showLocationFilter: false,
    scopeLocationIds: null,
    scopedLocations: [],
    locationFilter: "all",
    onLocationChange: vi.fn(),
    counters: { pending: 0, preparing: 0, ready: 0 },
    averagePrepMinutes: null,
    lastUpdatedAt: null,
    nowMs: 0,
    offline: false,
    soundEnabled: false,
    onToggleSound: vi.fn(),
    immersive: false,
    onToggleImmersive: vi.fn(),
    onRefresh: vi.fn(),
    showClearFilters: false,
    onClearFilters: vi.fn(),
    ...overrides,
  };
}

describe("OrdersToolbar", () => {
  it("los cinco tabs de estado son el filtro de la pantalla y se leen completos", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(<OrdersToolbar {...props({ onStatusChange })} />);

    const labels = ["Todas", "Nuevas", "Preparando", "Listas", "Cerradas"];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }

    await user.click(screen.getByRole("button", { name: "Cerradas" }));
    expect(onStatusChange).toHaveBeenCalledWith("closed");
  });

  it("marca el tab activo sin depender del color", () => {
    render(<OrdersToolbar {...props({ statusFilter: "preparing" })} />);

    expect(
      screen.getByRole("button", { name: "Preparando" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Todas" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("solo ofrece el local cuando hay más de una sucursal en el alcance", async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();
    const scopedLocations = [
      { id: "loc_1", name: "Camino de Oriente" },
      { id: "loc_2", name: "Carretera Masaya" },
    ];

    const { rerender } = render(
      <OrdersToolbar {...props({ showLocationFilter: false, scopedLocations })} />,
    );
    expect(screen.queryByLabelText("Local de las comandas")).toBeNull();

    rerender(
      <OrdersToolbar
        {...props({ showLocationFilter: true, scopedLocations, onLocationChange })}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Local de las comandas"), "loc_2");
    expect(onLocationChange).toHaveBeenCalledWith("loc_2");
  });

  it("con alcance, la opción por defecto son las sucursales del usuario", () => {
    render(
      <OrdersToolbar
        {...props({
          showLocationFilter: true,
          scopeLocationIds: ["loc_1"],
          scopedLocations: [{ id: "loc_1", name: "Camino de Oriente" }],
        })}
      />,
    );

    const options = Array.from(
      screen.getByLabelText("Local de las comandas").querySelectorAll("option"),
    ).map((option) => option.textContent);
    expect(options).toEqual(["Mis sucursales", "Camino de Oriente"]);
  });

  it("la preparación promedio no miente cuando todavía no hay datos", () => {
    const { rerender } = render(<OrdersToolbar {...props({ averagePrepMinutes: null })} />);

    expect(screen.getByTestId("orders-average-prep").textContent).toBe(
      "Preparación promedio: sin datos todavía",
    );

    rerender(<OrdersToolbar {...props({ averagePrepMinutes: 12 })} />);
    expect(screen.getByTestId("orders-average-prep").textContent).toBe(
      "Preparación promedio hoy: 12 min",
    );
  });

  it("la frescura avisa cuando no hay conexión y el botón Actualizar vuelve a pedir la lista", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <OrdersToolbar
        {...props({ offline: true, lastUpdatedAt: null, onRefresh })}
      />,
    );

    expect(screen.getByTestId("orders-freshness").textContent).toMatch(/Sin conexión/);

    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("el aviso sonoro dice si está encendido y se puede apagar", async () => {
    const user = userEvent.setup();
    const onToggleSound = vi.fn();

    render(<OrdersToolbar {...props({ soundEnabled: true, onToggleSound })} />);

    const sound = screen.getByRole("button", { name: "Aviso sonoro" });
    expect(sound.getAttribute("aria-pressed")).toBe("true");

    await user.click(sound);
    expect(onToggleSound).toHaveBeenCalledTimes(1);
  });

  it("limpiar filtros solo aparece cuando hay algo que limpiar", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();

    const { rerender } = render(<OrdersToolbar {...props({ showClearFilters: false })} />);
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();

    rerender(<OrdersToolbar {...props({ showClearFilters: true, onClearFilters })} />);

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
