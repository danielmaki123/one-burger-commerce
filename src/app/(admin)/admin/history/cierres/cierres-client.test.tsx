// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CierresClient } from "./cierres-client";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Cierres**.
 *
 * La tab de consulta del arqueo: se lista lo que ya está cerrado (con sucursal y cajero), el filtro de
 * «solo descuadre» viaja a la consulta y una diferencia de cero se lee como «Cuadró», no como un número
 * suelto.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function shiftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift_01",
    locationId: "loc_norte",
    locationName: "Norte",
    userId: "user_ana",
    cashierName: "Ana Pérez",
    closedAt: "2026-09-17T22:00:00.000Z",
    closingAmount: 1450,
    expectedAmount: 1500,
    difference: -50,
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
});
