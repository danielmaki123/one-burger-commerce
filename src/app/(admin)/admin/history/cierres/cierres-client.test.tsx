// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const downloadTextFileMock = vi.fn((_input: { fileName: string; content: string }) => true);
vi.mock("@/shared/lib/download-file", () => ({
  downloadTextFile: (input: { fileName: string; content: string }) => downloadTextFileMock(input),
}));

import { CierresClient } from "./cierres-client";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Cierres**.
 *
 * La tab de consulta del arqueo: se lista lo que ya está cerrado (con sucursal y cajero), el filtro de
 * «solo descuadre» viaja a la consulta y una diferencia de cero se lee como «Cuadró», no como un número
 * suelto.
 *
 * Fase 1b del rediseño de Caja (2026-09-19): esta pantalla recibe lo que la lista embebida de Caja tenía
 * y el Historial no —el **rango abierto→cerrado** de cada turno con su fondo, y el **export CSV**— porque
 * el historial sale de Caja y se unifica acá.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  downloadTextFileMock.mockClear();
});

function shiftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift_01",
    locationId: "loc_norte",
    locationName: "Norte",
    userId: "user_ana",
    cashierName: "Ana Pérez",
    status: "closed",
    openedAt: "2026-09-17T14:00:00.000Z",
    closedAt: "2026-09-17T22:00:00.000Z",
    openingAmount: 500,
    closingAmount: 1450,
    expectedAmount: 1500,
    difference: -50,
    notes: null,
    ...overrides,
  };
}

function stubFetch(rows: unknown[]) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => ({ data: rows }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("Historial › Cierres", () => {
  it("lista los cierres con sucursal, cajero y diferencia", async () => {
    stubFetch([shiftRow()]);
    render(<CierresClient />);

    expect(await screen.findByText("Norte")).toBeTruthy();
    expect(screen.getByText("Ana Pérez")).toBeTruthy();
    expect(screen.getByText("Descuadre")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver detalle" }).getAttribute("href")).toBe(
      "/admin/cash/history/shift_01",
    );
  });

  it("un cierre que cuadró lo dice, en vez de mostrar un cero suelto", async () => {
    stubFetch([shiftRow({ difference: 0 })]);
    render(<CierresClient />);

    expect(await screen.findByText("Cuadró")).toBeTruthy();
    expect(screen.queryByText("Descuadre")).toBeNull();
  });

  it("«Solo descuadre» viaja a la consulta", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch([shiftRow()]);
    render(<CierresClient />);

    await screen.findByText("Norte");
    await user.click(screen.getByRole("button", { name: "Solo descuadre" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("onlyDifference=1"))).toBe(
        true,
      ),
    );
  });

  it("sin cierres lo dice, en vez de dejar la pantalla vacía", async () => {
    stubFetch([]);
    render(<CierresClient />);

    expect(await screen.findByText("Sin cierres en este rango")).toBeTruthy();
  });

  /**
   * Fase 1b — lo que la lista de Caja mostraba y el Historial no: el **turno completo** (cuándo abrió y
   * cuándo cerró) y el fondo con el que arrancó la caja.
   */
  it("muestra el rango abierto→cerrado y el fondo de cada turno", async () => {
    stubFetch([shiftRow()]);
    render(<CierresClient />);

    const fila = await screen.findByRole("listitem");

    expect(fila.textContent).toContain("17/09/2026");
    // 14:00 UTC son las 08:00 en Managua y 22:00 UTC las 04:00 p. m.: el rango va en la hora del local
    // y con el formato del negocio (12 horas), el mismo que usaba la lista de Caja.
    expect(fila.textContent).toContain("08:00");
    expect(fila.textContent).toContain("04:00");
    expect(fila.textContent).toContain("C$500.00");
  });

  /**
   * Fase 1b — el export CSV que la lista de Caja tenía. El Historial puede listar **todas** las
   * sucursales, así que la columna «Local» sale de cada fila y no de un nombre único.
   */
  it("baja el CSV de los cierres visibles con el local de cada fila", async () => {
    const user = userEvent.setup();
    stubFetch([
      shiftRow(),
      shiftRow({ id: "shift_02", locationName: "Casa Antigua", locationId: "loc_casa" }),
    ]);
    render(<CierresClient />);

    await user.click(await screen.findByRole("button", { name: "Exportar CSV" }));

    const input = downloadTextFileMock.mock.calls[0]?.[0];

    expect(input?.fileName).toMatch(/^cierres-.+-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(input?.content).toContain("Norte");
    expect(input?.content).toContain("Casa Antigua");
    // El encabezado del export es el del arqueo (separador `;`), no una lista de texto.
    expect(input?.content.split("\r\n")[0]).toContain("Fondo");
  });

  it("sin cierres no ofrece un archivo vacío", async () => {
    stubFetch([]);
    render(<CierresClient />);

    await screen.findByText("Sin cierres en este rango");

    expect(screen.queryByRole("button", { name: "Exportar CSV" })).toBeNull();
  });
});
