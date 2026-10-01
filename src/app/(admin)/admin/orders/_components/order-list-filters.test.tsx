// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderListFilters } from "./order-list-filters";
import { DEFAULT_ORDER_LIST_FILTERS, type OrderListFilters as Filters } from "../order-list-filters";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **la barra de filtros**: cada control avisa al padre y el «Limpiar filtros»
 * aparece sólo cuando hay algo que limpiar.
 *
 * Es el caso que el E2E de producción destapó como no determinista (el campo de búsqueda y el botón de
 * limpiar): acá se prueba la mitad de la UI sin navegador, con el padre simulado.
 */
function renderFilters(overrides: Partial<Filters> = {}, showClear = false) {
  const onChange = vi.fn();
  const onClear = vi.fn();

  const view = render(
    <OrderListFilters
      filters={{ ...DEFAULT_ORDER_LIST_FILTERS, ...overrides }}
      locations={[
        { id: "loc_camino", name: "Camino de Oriente" },
        { id: "loc_masaya", name: "Carretera Masaya" },
      ]}
      showLocationFilter
      onChange={onChange}
      onClear={onClear}
      showClear={showClear}
    />,
  );

  return { onChange, onClear, ...view };
}

afterEach(cleanup);

describe("OrderListFilters", () => {
  it("el buscador se escribe en el campo y avisa al padre con una demora", async () => {
    vi.useFakeTimers();

    try {
      const { onChange } = renderFilters();
      const input = screen.getByTestId("orders-search");

      fireEvent.change(input, { target: { value: "P-1059" } });

      // El campo muestra lo tecleado aunque el padre todavía no lo sepa (la demora es de 300 ms).
      expect((input as HTMLInputElement).value).toBe("P-1059");
      expect(onChange).not.toHaveBeenCalled();

      vi.advanceTimersByTime(350);

      expect(onChange).toHaveBeenCalledWith({ search: "P-1059" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("el campo no se resetea solo mientras se escribe", () => {
    renderFilters({ search: "" });
    const input = screen.getByTestId("orders-search") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "P-" } });
    expect(input.value).toBe("P-");

    // Un cambio de un control vecino re-renderiza el padre con los mismos filtros: el texto no se pierde.
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "process" } });
    expect(input.value).toBe("P-");
  });

  it("los desplegables avisan al padre al instante", () => {
    const { onChange } = renderFilters();

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "process" } });
    expect(onChange).toHaveBeenCalledWith({ status: "process" });

    fireEvent.change(screen.getByLabelText("Pago"), { target: { value: "paid" } });
    expect(onChange).toHaveBeenCalledWith({ payment: "paid" });

    fireEvent.change(screen.getByLabelText("Rango"), { target: { value: "30d" } });
    expect(onChange).toHaveBeenCalledWith({ date: "30d" });
  });

  it("«Limpiar filtros» aparece sólo cuando hay filtros puestos", () => {
    const { unmount } = renderFilters({}, false);
    expect(screen.queryByTestId("orders-clear-filters")).toBeNull();
    unmount();

    renderFilters({ payment: "paid" }, true);
    expect(screen.getByTestId("orders-clear-filters")).toBeTruthy();
  });

  it("el control de sucursal sólo se dibuja con más de una sucursal a la vista", () => {
    const { unmount } = renderFilters();
    expect(screen.getByLabelText("Sucursal")).toBeTruthy();
    unmount();

    render(
      <OrderListFilters
        filters={DEFAULT_ORDER_LIST_FILTERS}
        locations={[{ id: "loc_camino", name: "Camino de Oriente" }]}
        showLocationFilter={false}
        onChange={vi.fn()}
        onClear={vi.fn()}
        showClear={false}
      />,
    );

    expect(screen.queryByLabelText("Sucursal")).toBeNull();
  });

  it("«Solo programados» es un interruptor con estado", () => {
    const { onChange } = renderFilters();

    const toggle = screen.getByRole("button", { name: "Solo programados" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ scheduledOnly: true });
  });
});
