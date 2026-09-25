// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import CashPartialReadingModal from "./cash-partial-reading-modal";

/**
 * Fase 5 del rediseño de Caja (2026-09-23) — la **lectura parcial** (1.12) en un modal.
 *
 * Antes la lectura parcial era un botón que imprimía: para saber cómo iba la caja había que sacar un papel
 * (y solo el dueño podía). Ahora el número se ve en pantalla y el papel es la salida, no la única puerta.
 *
 * Lo que fijan estos casos: los montos son los del **servidor** (la pantalla no suma nada), el arqueo ciego
 * manda (con el ciego prendido y sin permiso de auditoría la lectura va **sellada**), la imprenta es del
 * dueño y una falla de lectura se dice en pantalla en vez de mostrar un número inventado.
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

const printLinesMock = vi.fn<(lines: string[]) => boolean>(() => true);
vi.mock("@/shared/lib/print-lines", () => ({
  printLines: (lines: string[]) => printLinesMock(lines),
}));

const arqueo = {
  shiftId: "shift_1",
  locationId: "loc_norte",
  openedAt: "2026-09-18T14:00:00.000Z",
  generatedAt: "2026-09-18T22:30:00.000Z",
  openingAmount: 1000,
  expectedAmount: 1500,
  expectedByCurrency: { NIO: 1500 },
  cashSalesAmount: 500,
  cashMovementsAmount: -100,
  refundsAmount: 0,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CashPartialReadingModal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    printLinesMock.mockClear();
    fetchMock = vi.fn(() => jsonResponse({ data: arqueo }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function setup(overrides: Partial<React.ComponentProps<typeof CashPartialReadingModal>> = {}) {
    const onClose = vi.fn();

    render(
      <CashPartialReadingModal
        open
        locationId="loc_norte"
        locationName="Camino de Oriente"
        actorName="María Pérez"
        canPrint
        canSeeArqueo
        onClose={onClose}
        {...overrides}
      />,
    );

    return { onClose };
  }

  it("lee el corte del servidor al abrir y muestra los montos tal como llegan", async () => {
    setup();

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/admin/pos/shift/x?locationId=loc_norte");
    expect(await screen.findByText(/Lectura parcial/)).toBeTruthy();
    // Fondo, efectivo del turno, movimientos y esperado: los cuatro del arqueo del servidor.
    expect(screen.getByText(/C\$1,000\.00/)).toBeTruthy();
    expect(screen.getByText(/C\$500\.00/)).toBeTruthy();
    // El movimiento sale con su signo (el menos tipográfico del repo, no un guion).
    expect(screen.getByText(/−C\$100\.00/)).toBeTruthy();
    // El esperado aparece dos veces a propósito: el total y su detalle por moneda (NIO).
    expect(screen.getAllByText(/C\$1,500\.00/).length).toBeGreaterThan(0);
  });

  it("imprime el papel del corte con el número que dio el servidor", async () => {
    const user = userEvent.setup();
    setup();

    await screen.findByText(/Lectura parcial/);
    await user.click(screen.getByRole("button", { name: "Imprimir lectura parcial" }));

    const lines = printLinesMock.mock.calls[0]?.[0] ?? [];

    expect(lines.join("\n")).toContain("Camino de Oriente");
    expect(lines.join("\n")).toContain("1,500.00");
  });

  it("el papel lo saca el dueño: sin permiso no hay imprenta", async () => {
    setup({ canPrint: false });

    await screen.findByText(/Lectura parcial/);

    expect(screen.queryByRole("button", { name: "Imprimir lectura parcial" })).toBeNull();
  });

  it("con arqueo ciego y sin permiso de auditoría la lectura va sellada", async () => {
    // El ciego es sobre el **esperado**: el cajero ve lo que operó y no el número que el sistema espera.
    setup({ canSeeArqueo: false });

    await screen.findByText(/Lectura parcial/);

    expect(screen.queryByText(/C\$1,500\.00/)).toBeNull();
    expect(screen.getByText(/va sellada/i)).toBeTruthy();
  });

  /**
   * TASK-AUD-003 — esconder el total y dibujar los sumandos no esconde nada: el esperado es
   * `fondo + efectivo del turno + movimientos + devoluciones`, así que la pantalla no puede poner las
   * cuatro filas y ahorrarle al cajero la única operación que falta (sumarlas). Con el servidor filtrando,
   * además, esas filas quedarían en `NaN`.
   */
  it("con arqueo ciego la pantalla no dibuja los sumandos del esperado", async () => {
    setup({ canSeeArqueo: false });

    await screen.findByText(/Lectura parcial/);

    expect(screen.queryByText("Efectivo del turno")).toBeNull();
    expect(screen.queryByText("Movimientos")).toBeNull();
    expect(screen.queryByText("Devoluciones")).toBeNull();
    // El fondo lo declaró el cajero al abrir y la identidad del turno no dicen nada del esperado.
    expect(screen.getByText("Fondo")).toBeTruthy();
    expect(screen.getByText("Abierta")).toBeTruthy();
  });

  it("quien audita sí ve los sumandos, para poder explicar la diferencia", async () => {
    setup({ canSeeArqueo: true });

    await screen.findByText(/Lectura parcial/);

    expect(screen.getByText("Efectivo del turno")).toBeTruthy();
    expect(screen.getByText("Movimientos")).toBeTruthy();
    expect(screen.getByText("Devoluciones")).toBeTruthy();
  });

  it("una lectura fallida se dice, no se dibuja como una caja vacía", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ error: { message: "No hay caja abierta." } }, 409));

    setup();

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "No hay caja abierta.");
    expect(screen.queryByText(/C\$1,500\.00/)).toBeNull();
  });

  it("cierra el modal sin tocar la caja", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await screen.findByText(/Lectura parcial/);
    await user.click(screen.getByRole("button", { name: "Volver a la caja" }));

    expect(onClose).toHaveBeenCalled();
  });
});
