// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnlineStatus } from "./online-status";

/**
 * Bloque 12.4 del roadmap del POS (Fase 2) — el estado de conexión del mostrador.
 *
 * El POS cobra contra el servidor: si la terminal se quedó sin red, el botón de cobrar no puede quedar
 * como si todo estuviera bien (el cajero cobraría y el pedido no se registraría). Este hook es la única
 * fuente de ese estado —lo escucha del navegador, no lo adivina— y por eso se prueba con los dos eventos
 * reales.
 */

function Probe() {
  return <p data-testid="estado">{useOnlineStatus() ? "en línea" : "sin conexión"}</p>;
}

describe("useOnlineStatus", () => {
  afterEach(() => {
    cleanup();
  });

  it("arranca en línea y pasa a sin conexión cuando el navegador lo avisa", () => {
    render(<Probe />);
    expect(screen.getByTestId("estado").textContent).toBe("en línea");

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("estado").textContent).toBe("sin conexión");

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByTestId("estado").textContent).toBe("en línea");
  });

  it("escucha el estado real de `navigator.onLine` al montar", () => {
    const spy = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);

    render(<Probe />);
    expect(screen.getByTestId("estado").textContent).toBe("sin conexión");

    spy.mockRestore();
  });

  it("deja de escuchar al desmontarse (no filtra listeners)", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");

    render(<Probe />);
    cleanup();

    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    removeSpy.mockRestore();
  });
});
