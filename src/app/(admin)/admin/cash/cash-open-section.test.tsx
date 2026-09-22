// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import CashOpenSection from "./cash-open-section";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **Sin turno**.
 *
 * Estos casos vivían en `cash-drawer-panel.test.tsx` (el panel hacía los dos estados a la vez); se mudaron
 * con la pantalla. Lo que fijan:
 *
 * - El conteo sale en el payload que arma la pantalla (la plata la deriva el servidor del conteo).
 * - Después de cerrar, el aviso muestra **el id del turno y la diferencia** a quien lo cerró, y el arqueo
 *   completo **solo** a quien audita (tareas 5 y 6 del brief del POS: sin cierre ciego, sin detalle para
 *   el operario).
 */

const cashCurrencies = ["NIO"];

describe("CashOpenSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("abre la caja con el conteo de billetes y manda el conteo", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <CashOpenSection
        cashCurrencies={cashCurrencies}
        busy={false}
        closedShift={null}
        actionError={null}
        canSeeCloseDetail={false}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/Sin caja abierta en este local/)).toBeTruthy();

    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 100"), "10");
    await user.click(screen.getByRole("button", { name: "Abrir caja" }));

    expect(onOpen).toHaveBeenCalledWith([{ currency: "NIO", denomination: 100, quantity: 10 }]);
    expect(screen.getByRole("region", { name: "Caja del local" })).toBeTruthy();
  });

  it("muestra el cierre registrado con la diferencia y sin el arqueo para quien no audita", () => {
    render(
      <CashOpenSection
        cashCurrencies={cashCurrencies}
        busy={false}
        closedShift={{
          id: "shift_1",
          closingAmount: 900,
          expectedAmount: 1000,
          difference: -100,
          expectedByCurrency: { NIO: 1000 },
        }}
        actionError={null}
        canSeeCloseDetail={false}
        onOpen={vi.fn()}
      />,
    );

    const resumen = screen.getByRole("status");

    expect(resumen.textContent).toContain("Cierre registrado");
    expect(resumen.textContent).toContain("diferencia");
    expect(resumen.textContent).toContain("shift_1");
    expect(resumen.textContent).not.toContain("esperado");
  });

  it("quien audita ve el arqueo completo con el detalle por moneda", () => {
    render(
      <CashOpenSection
        cashCurrencies={cashCurrencies}
        busy={false}
        closedShift={{
          id: "shift_1",
          closingAmount: 900,
          expectedAmount: 1000,
          difference: -100,
          expectedByCurrency: { NIO: 1000 },
        }}
        actionError={null}
        canSeeCloseDetail
        onOpen={vi.fn()}
      />,
    );

    const resumen = screen.getByRole("status");

    expect(resumen.textContent).toContain("Cierre registrado");
    expect(resumen.textContent).toContain("Contado");
    expect(resumen.textContent).toContain("esperado");
    expect(resumen.textContent).toContain("NIO");
  });

  it("si el servidor rechaza la apertura, lo dice sin inventar un turno", () => {
    render(
      <CashOpenSection
        cashCurrencies={cashCurrencies}
        busy={false}
        closedShift={null}
        actionError="No se pudo abrir la caja."
        canSeeCloseDetail={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("No se pudo abrir la caja.");
    expect(screen.getByText(/Sin caja abierta en este local/)).toBeTruthy();
  });
});
