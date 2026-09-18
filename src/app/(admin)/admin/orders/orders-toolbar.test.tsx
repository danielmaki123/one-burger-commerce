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
    kitchenMode: false,
    kitchenTab: "all",
    onKitchenTabChange: vi.fn(),
    onToggleKitchenMode: vi.fn(),
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

  /**
   * Punto 3 del roadmap (2026-09-18) — el **modo cocina**.
   *
   * Es lo que el owner pidió: un botón en la barra de trabajo que esconde la barra lateral y el
   * encabezado y deja solo los carriles, con su propia salida («Salir») que devuelve el panel **sin
   * cerrar sesión**. Los tabs del panel se cambian por los cinco de la cocina (sin «Cerradas» y sin
   * «Historial»): la auditoría del turno no es trabajo de la cocina.
   */
  describe("modo cocina", () => {
    function kitchenProps(overrides: Partial<OrdersToolbarProps> = {}) {
      return props({ kitchenMode: true, kitchenTab: "all", ...overrides });
    }

    it("el botón que lo prende está en la barra de trabajo", async () => {
      const user = userEvent.setup();
      const onToggleKitchenMode = vi.fn();

      render(<OrdersToolbar {...props({ onToggleKitchenMode })} />);

      await user.click(screen.getByRole("button", { name: "Modo cocina" }));
      expect(onToggleKitchenMode).toHaveBeenCalledTimes(1);
    });

    it("en modo cocina los tabs son los cinco de la cocina y no el filtro del panel", () => {
      render(<OrdersToolbar {...kitchenProps({ statusFilter: "all" })} />);

      const kitchenLabels = ["Todas", "Nuevas", "Preparando", "Listas", "Despachadas hace poco"];
      const chips = screen
        .getByRole("group", { name: "Tabs del modo cocina" })
        .querySelectorAll("button");

      expect(Array.from(chips).map((chip) => chip.textContent)).toEqual(kitchenLabels);
      for (const id of ["all", "new", "preparing", "ready", "dispatched"]) {
        expect(screen.getByTestId(`kitchen-tab-${id}`)).toBeTruthy();
      }
      // «Cerradas» no existe en cocina: el tablero no tiene carril para eso.
      expect(screen.queryByTestId("kitchen-tab-closed")).toBeNull();
    });

    it("elegir un tab de cocina avisa cuál se eligió", async () => {
      const user = userEvent.setup();
      const onKitchenTabChange = vi.fn();

      render(<OrdersToolbar {...kitchenProps({ onKitchenTabChange })} />);

      await user.click(screen.getByTestId("kitchen-tab-dispatched"));
      expect(onKitchenTabChange).toHaveBeenCalledWith("dispatched");
    });

    it("el tab activo se lee sin depender del color", () => {
      render(<OrdersToolbar {...kitchenProps({ kitchenTab: "preparing" })} />);

      expect(
        screen.getByTestId("kitchen-tab-preparing").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByTestId("kitchen-tab-all").getAttribute("aria-pressed")).toBe("false");
    });

    it("«Salir» está en la barra y devuelve el panel sin cerrar sesión", async () => {
      const user = userEvent.setup();
      const onToggleKitchenMode = vi.fn();

      render(<OrdersToolbar {...kitchenProps({ onToggleKitchenMode })} />);

      expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
      expect(screen.queryByTestId("comandas-topbar")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Salir" }));
      expect(onToggleKitchenMode).toHaveBeenCalledTimes(1);
    });

    it("los controles de emergencia siguen a mano: busqueda, sonido y actualizar", () => {
      render(<OrdersToolbar {...kitchenProps()} />);

      expect(screen.getByLabelText("Buscar comanda")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Aviso sonoro" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Actualizar" })).toBeTruthy();
    });
  });
});
