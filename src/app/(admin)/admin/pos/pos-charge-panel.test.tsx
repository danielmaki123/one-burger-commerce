// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PosChargePanel from "./pos-charge-panel";

/**
 * El bloque de cobro: lo que dice si se puede cobrar **ahora** y por qué no.
 *
 * Mejoras visuales (2026-09-19): la caja cerrada deja de ser una línea más y pasa a ser una **tarjeta
 * de alerta con borde ámbar**, que es lo primero que el cajero tiene que ver cuando toca «Cobrar» y no
 * puede (el mockup la muestra así).
 *
 * El componente no tenía test propio: se agrega acá al tocarlo (AGENTS.md § Testing).
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

function renderPanel(over: Partial<React.ComponentProps<typeof PosChargePanel>> = {}) {
  const onCharge = vi.fn();

  const { unmount } = render(
    <PosChargePanel
      needsOpenShift={false}
      canCharge
      blockedReason={null}
      total={145}
      currency={currency}
      charging={false}
      saleError={null}
      restoredSale={false}
      onCharge={onCharge}
      {...over}
    />,
  );

  return { onCharge, unmount };
}

describe("PosChargePanel", () => {
  it("el botón dice el total y cobra", async () => {
    const user = userEvent.setup();
    const { onCharge } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Cobrar/ }));

    expect(onCharge).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Cobrar/ }).textContent).toContain("145.00");
  });

  it("sin caja abierta avisa con una tarjeta de alerta ámbar", () => {
    renderPanel({ needsOpenShift: true, canCharge: false });

    const alerta = screen.getByRole("status");

    expect(alerta.textContent).toContain("Caja cerrada");
    expect(alerta.textContent).toContain("arqueo");
    // El borde ámbar es la señal visual del mockup (no el estado de preparación del sistema).
    expect(alerta.className).toContain("border-brand-amber");
  });

  it("con la caja abierta no dice nada de la caja", () => {
    renderPanel();

    expect(screen.queryByText(/Caja cerrada/)).toBeNull();
  });

  it("el motivo de bloqueo (caja de otro día) se muestra igual de visible", () => {
    renderPanel({ blockedReason: "Cerrá la caja de ayer antes de cobrar.", canCharge: false });

    expect(screen.getByText(/Cerrá la caja de ayer/)).toBeTruthy();
  });

  it("sin caja no se puede cobrar", () => {
    renderPanel({ needsOpenShift: true, canCharge: false });

    expect((screen.getByRole("button", { name: /Cobrar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("con un motivo de bloqueo el botón queda deshabilitado", () => {
    renderPanel({ blockedReason: "Cerrá la caja de ayer antes de cobrar.", canCharge: true });

    expect((screen.getByRole("button", { name: /Cobrar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("muestra el error del cobro y la venta recuperada", () => {
    const { unmount } = renderPanel({ saleError: "No se pudo cobrar." });

    expect(screen.getByRole("alert").textContent).toContain("No se pudo cobrar.");

    unmount();

    renderPanel({ restoredSale: true });
    expect(screen.getByText(/Recuperamos la venta/)).toBeTruthy();
  });
});
