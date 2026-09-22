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

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — la config del conteo, que ahora llega por props.
 *
 * Desde que la config es del local, el componente no decide monedas ni billetes: los recibe. Acá se pasa la
 * moneda del negocio con los nueve billetes de fábrica, que es el caso más común.
 */
const countConfig = {
  currencies: ["NIO"],
  denominations: { NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1] },
};

describe("CashOpenSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("abre la caja con el conteo de billetes y manda el conteo", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <CashOpenSection
        countConfig={countConfig}
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
        countConfig={countConfig}
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
        blindCount={false}
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
        countConfig={countConfig}
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
        countConfig={countConfig}
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

  /**
   * Fase 2 del rediseño de Caja (2026-09-22) — la grilla sale de la **config del local**, no de una lista
   * fija: un billete desactivado no se ofrece y el dólar aparece solo si la sucursal lo maneja.
   */
  it("dibuja solo los billetes que la config del local ofrece", () => {
    render(
      <CashOpenSection
        countConfig={{ currencies: ["NIO"], denominations: { NIO: [1000, 500] } }}
        busy={false}
        closedShift={null}
        actionError={null}
        canSeeCloseDetail={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Cantidad de billetes de NIO 1000")).toBeTruthy();
    expect(screen.getByLabelText("Cantidad de billetes de NIO 500")).toBeTruthy();
    expect(screen.queryByLabelText("Cantidad de billetes de NIO 200")).toBeNull();
    expect(screen.queryByLabelText("Cantidad de billetes de USD 20")).toBeNull();
  });

  it("una sucursal con dólares habilitados los muestra en la grilla", () => {
    render(
      <CashOpenSection
        countConfig={{ currencies: ["NIO", "USD"], denominations: { NIO: [1000], USD: [20] } }}
        busy={false}
        closedShift={null}
        actionError={null}
        canSeeCloseDetail={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Cantidad de billetes de NIO 1000")).toBeTruthy();
    expect(screen.getByLabelText("Cantidad de billetes de USD 20")).toBeTruthy();
  });

  /**
   * Fase 4 del rediseño de Caja (2026-09-22) — **arqueo ciego** (`blindCount`, el default de la config).
   *
   * El cajero ve que el cierre quedó registrado y **sellado**, sin la diferencia ni el arqueo: es la
   * decisión del brief (§7/§11) y ahora la manda la config. Quien **audita** la sigue viendo aunque el ciego
   * esté prendido — es su trabajo—, así que el flag no le esconde el número al dueño.
   */
  it("con arqueo ciego el operario no ve la diferencia", () => {
    render(
      <CashOpenSection
        countConfig={countConfig}
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
    expect(resumen.textContent).toContain("sellado");
    expect(resumen.textContent).not.toContain("diferencia");
    expect(resumen.textContent).not.toContain("100.00");
  });

  it("quien audita ve la diferencia aunque el arqueo sea ciego", () => {
    render(
      <CashOpenSection
        countConfig={countConfig}
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

    expect(resumen.textContent).toContain("diferencia");
    expect(resumen.textContent).not.toContain("sellado");
  });
});
