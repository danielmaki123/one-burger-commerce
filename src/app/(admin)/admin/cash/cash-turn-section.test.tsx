// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import CashTurnSection from "./cash-turn-section";

/**
 * jsdom no implementa el modo modal del `<dialog>` (igual que en `modal.test.tsx`): el cierre de la Fase 3
 * vive en un modal y hay que poder abrirlo en el test.
 */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

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
      countConfig={{ currencies: ["NIO"], denominations: { NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1] } }}
      banks={[]}
      busy={false}
      shift={OPEN_SHIFT}
      actionError={null}
      canSeeShiftDetail={false}
      canSeeCloseDetail={false}
      blindCount={false}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe("CashTurnSection", () => {
  /**
   * El mismo `fetch` sirve a tres lecturas de la pantalla: el turno, los traspasos y —al abrir el cierre—
   * el corte X. El mock contesta por ruta: devolver la misma forma a todas rompía el panel de traspasos.
   */
  function mockFetch(arqueo: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes("/api/admin/pos/shift/x")
          ? jsonResponse({ data: arqueo })
          : jsonResponse({ data: [] }),
      ),
    );
  }

  beforeEach(() => {
    mockFetch(null);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** El modal dibuja su contenido aunque esté cerrado (es un `<dialog>`): se busca adentro del diálogo. */
  function closeButton() {
    return within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar caja" });
  }

  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — el cierre pasó a un **modal**: el conteo y el cuadre por
   * banco se hacen ahí, con el consolidado y la diferencia a la vista antes de firmar.
   */
  it("el botón abre el modal y el cierre sale con el conteo contado", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderTurn({ onClose });

    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));
    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 100"), "9");
    await user.click(closeButton());

    expect(onClose).toHaveBeenCalledWith([{ currency: "NIO", denomination: 100, quantity: 9 }], []);
  });

  it("con arqueo ciego y sin permiso de auditoría, el cajero no ve lo cobrado ni la diferencia", async () => {
    const user = userEvent.setup();
    mockFetch({ nonCashByCurrency: { NIO: 500 } });

    renderTurn({ blindCount: true, canSeeCloseDetail: false });

    await screen.findByText(/Caja abierta desde/);
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    expect(screen.queryByText(/Cobrado sin pasar por el cajón/)).toBeNull();
    expect(screen.getByText(/Con el arqueo ciego no ves lo cobrado/)).toBeTruthy();
  });

  it("quien audita ve el cuadre aunque el local tenga el arqueo ciego prendido", async () => {
    const user = userEvent.setup();
    mockFetch({ nonCashByCurrency: { NIO: 500 } });

    renderTurn({ blindCount: true, canSeeCloseDetail: true });

    await screen.findByText(/Caja abierta desde/);
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    // La lectura del corte X llega después de abrir: el cuadre aparece cuando el servidor contesta.
    expect(await screen.findByText(/Cobrado sin pasar por el cajón/)).toBeTruthy();
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

  /**
   * Hallazgo H1 de la auditoría post-deploy (2026-09-23) — **dónde aparecen los bancos**.
   *
   * El cuadre por banco vive dentro del modal del cierre y el modal se dibuja al abrirlo: el owner configuró
   * dos bancos y no los encontró en Caja. La nota lo dice **antes** de abrir, y solo cuando hay bancos
   * configurados (en una sucursal sin bancos sería ruido sobre algo que no existe).
   */
  it("avisa dónde aparecen los bancos, solo cuando hay bancos configurados", async () => {
    const { unmount } = renderTurn({
      banks: [
        { id: "bank_bac", name: "BAC", code: "BAC" },
        { id: "bank_banpro", name: "BANPRO", code: null },
      ],
    });

    expect(
      await screen.findByText(/Los bancos configurados aparecen al abrir el cierre/),
    ).toBeTruthy();

    unmount();
    renderTurn({ banks: [] });

    expect(screen.queryByText(/Los bancos configurados aparecen al abrir el cierre/)).toBeNull();
  });

  it("deshabilita la apertura del cierre mientras se está guardando", async () => {
    renderTurn({ busy: true });

    await screen.findByText(/Caja abierta desde/);

    expect(screen.getByRole("button", { name: "Cerrar caja" })).toHaveProperty("disabled", true);
  });
});
