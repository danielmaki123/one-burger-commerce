// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashShiftHandoverPanel, { type ShiftHandoverRow } from "./cash-shift-handover-panel";

/**
 * Tarea 7 del brief (2026-09-17) — **corte X y traspaso de caja** en la pantalla de caja (1.12 y 1.13).
 *
 * Lo que fijan estos casos: el corte se imprime con el monto que devolvió el **servidor** (la pantalla no
 * suma nada), el traspaso se firma con el nombre escrito y se imprime con el esperado **guardado**, y un
 * fallo del servidor se dice en pantalla en vez de imprimir un papel inventado.
 */

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
  cashMovementsAmount: 0,
  refundsAmount: 0,
};

const handover: ShiftHandoverRow = {
  id: "handover_1",
  handedByName: "María Pérez",
  receivedByName: "Carlos Ruiz",
  expectedAmount: 1500,
  expectedByCurrency: { NIO: 1500 },
  createdAt: "2026-09-18T22:31:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CashShiftHandoverPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    printLinesMock.mockClear();
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/admin/pos/shift/handover?")) return jsonResponse({ data: [] });
      if (url.startsWith("/api/admin/pos/shift/x?")) return jsonResponse({ data: arqueo });
      if (url === "/api/admin/pos/shift/handover" && init?.method === "POST") {
        return jsonResponse({ data: handover }, 201);
      }

      return jsonResponse({ data: null });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderPanel() {
    return render(
      <CashShiftHandoverPanel
        locationId="loc_norte"
        locationName="Camino de Oriente"
        actorName="María Pérez"
      />,
    );
  }

  it("sin traspasos lo dice, en vez de mostrar una lista vacía", async () => {
    renderPanel();

    expect(await screen.findByText(/todavía no cambió de manos/)).toBeTruthy();
  });

  it("el corte X se imprime con el monto del servidor", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Imprimir corte X" }));

    const xCall = fetchMock.mock.calls.find(([input]) =>
      String(input).startsWith("/api/admin/pos/shift/x?"),
    );
    expect(xCall).toBeTruthy();

    const body = (printLinesMock.mock.calls[0]?.[0] ?? []).join("\n");
    expect(body).toContain("CORTE X");
    expect(body).toContain("Camino de Oriente");
    expect(body).toContain("Esperado: C$1,500.00");
    expect(body).toContain("Entrega: María Pérez");
    expect(body).not.toContain("Recibe:");
  });

  it("sin caja abierta avisa y no imprime nada", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/shift/handover?")) return jsonResponse({ data: [] });
      return jsonResponse({ data: null });
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Imprimir corte X" }));

    expect(await screen.findByText(/No hay una caja abierta/)).toBeTruthy();
    expect(printLinesMock).not.toHaveBeenCalled();
  });

  it("firma el traspaso con el nombre escrito y lo imprime como traspaso", async () => {
    const user = userEvent.setup();
    renderPanel();

    const input = await screen.findByLabelText("Recibe la caja");
    // Sin nombre no se puede firmar: el botón está apagado hasta que se escriba.
    expect((screen.getByRole("button", { name: "Firmar traspaso" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.type(input, "Carlos Ruiz");
    await user.click(screen.getByRole("button", { name: "Firmar traspaso" }));

    const postCall = fetchMock.mock.calls.find(
      ([input2, init]) => String(input2) === "/api/admin/pos/shift/handover" && init?.method === "POST",
    );
    expect(JSON.parse(String((postCall![1] as RequestInit).body))).toEqual({
      locationId: "loc_norte",
      receivedByName: "Carlos Ruiz",
    });

    expect((await screen.findByRole("status")).textContent).toContain("recibe Carlos Ruiz");

    const body = (printLinesMock.mock.calls[0]?.[0] ?? []).join("\n");
    expect(body).toContain("TRASPASO DE CAJA");
    expect(body).toContain("Recibe: Carlos Ruiz");
  });

  it("si el servidor rechaza el traspaso lo dice y no imprime", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/shift/handover?")) return jsonResponse({ data: [] });
      if (url === "/api/admin/pos/shift/handover" && init?.method === "POST") {
        return jsonResponse(
          { error: { message: "Quien entrega y quien recibe no pueden ser la misma persona." } },
          400,
        );
      }
      return jsonResponse({ data: arqueo });
    });
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText("Recibe la caja"), "María Pérez");
    await user.click(screen.getByRole("button", { name: "Firmar traspaso" }));

    expect((await screen.findByRole("alert")).textContent).toContain("misma persona");
    expect(printLinesMock).not.toHaveBeenCalled();
  });

  it("muestra los traspasos del turno con el monto entregado", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/shift/handover?")) return jsonResponse({ data: [handover] });
      return jsonResponse({ data: arqueo });
    });
    renderPanel();

    const item = await screen.findByText(/Recibió/);
    expect(item.textContent).toContain("Carlos Ruiz");
    expect(item.textContent).toContain("María Pérez");
    expect(item.textContent).toContain("C$1,500.00");
  });
});
