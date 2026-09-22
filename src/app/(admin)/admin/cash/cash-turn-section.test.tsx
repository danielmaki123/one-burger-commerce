// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashTurnSection from "./cash-turn-section";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **Turno abierto**.
 *
 * Mudado de `cash-drawer-panel.test.tsx` (el panel hacía los dos estados en una sección) y con el bug
 * **A-40** fijado: el enlace «Ver el turno abierto» apunta al detalle del turno, que redirige a quien no
 * puede verlo (`cash/history/[id]/page.tsx`). Mostrarlo al cajero era un enlace que rebota.
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const OPEN_SHIFT = { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 };

function renderTurn(overrides: Partial<ComponentProps<typeof CashTurnSection>> = {}) {
  return render(
    <CashTurnSection
      locationId="loc_norte"
      locationName="Camino de Oriente"
      actorName="Ana"
      cashCurrencies={["NIO"]}
      busy={false}
      shift={OPEN_SHIFT}
      actionError={null}
      canSeeShiftDetail={false}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe("CashTurnSection", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ data: [] })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cierra la caja con el conteo contado", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderTurn({ onClose });

    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();

    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 100"), "9");
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    expect(onClose).toHaveBeenCalledWith([{ currency: "NIO", denomination: 100, quantity: 9 }]);
  });

  it("si el servidor rechaza el cierre, lo dice y no muestra un arqueo inventado", async () => {
    renderTurn({ actionError: "No hay una caja abierta en este local." });

    expect(screen.getByRole("alert").textContent).toContain(
      "No hay una caja abierta en este local.",
    );
    expect(screen.queryByText(/Cierre registrado/)).toBeNull();
  });

  /**
   * A-40 — el detalle del turno es de quien audita. El cajero no ve el enlace (le rebotaba a Órdenes);
   * el dueño y el manager sí.
   */
  it("no ofrece el detalle del turno a quien no puede verlo (A-40)", async () => {
    renderTurn({ canSeeShiftDetail: false });

    await screen.findByText(/Caja abierta desde/);

    expect(screen.queryByRole("link", { name: "Ver el turno abierto" })).toBeNull();
  });

  it("ofrece el detalle del turno a quien audita", async () => {
    renderTurn({ canSeeShiftDetail: true });

    const link = await screen.findByRole("link", { name: "Ver el turno abierto" });

    expect(link.getAttribute("href")).toBe("/admin/cash/history/shift_1");
  });

  it("deshabilita el cierre mientras se está guardando", async () => {
    renderTurn({ busy: true });

    await screen.findByText(/Caja abierta desde/);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardando…" })).toHaveProperty("disabled", true),
    );
  });
});
