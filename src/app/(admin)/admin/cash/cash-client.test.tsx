// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { BusinessSettingsProvider } from "@/shared/lib/business-settings";

import CashClient from "./cash-client";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — el historial de caja en pantalla.
 *
 * Lo que se prueba es lo que el dueño mira al auditar: que cada turno muestre **esperado y diferencia**
 * con su tono (cuadra / falta / sobra), que un turno sin contar se diga y no se pinte como cuadrado, y
 * que la pantalla no rompa cuando el servidor falla o cuando el local no tiene turnos.
 */

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const shiftCerrado = {
  id: "shift_01",
  userId: "user_01",
  status: "closed" as const,
  openedAt: "2026-09-17T14:00:00.000Z",
  closedAt: "2026-09-17T22:00:00.000Z",
  openingAmount: 500,
  closingAmount: 1500,
  expectedAmount: 1500,
  expectedByCurrency: { NIO: 1500 },
  cashSalesAmount: 1000,
  difference: 0,
  notes: null,
};

const shiftConFaltante = {
  ...shiftCerrado,
  id: "shift_02",
  closingAmount: 1400,
  expectedAmount: 1500,
  difference: -100,
};

const shiftSinContar = {
  ...shiftCerrado,
  id: "shift_03",
  closingAmount: null,
  expectedAmount: 1500,
  difference: null,
};

const locations = [
  { id: "loc_principal", name: "Principal" },
  { id: "loc_masaya", name: "Masaya" },
];

function renderClient() {
  return render(
    <BusinessSettingsProvider
      settings={{ ...DEFAULT_BUSINESS_SETTINGS, updatedAt: new Date(0).toISOString(), updatedByUserId: null }}
    >
      <CashClient locations={locations} />
    </BusinessSettingsProvider>,
  );
}

describe("CashClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/cash/shifts")) {
        return jsonResponse({
          data: [shiftCerrado, shiftConFaltante, shiftSinContar],
          meta: { locationId: "loc_principal", total: 3, openCount: 0, closedCount: 3 },
        });
      }

      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("pide los turnos del primer local y los lista con su diferencia", async () => {
    renderClient();

    expect(await screen.findByText("Cuadra")).toBeTruthy();
    expect(screen.getByText("Falta")).toBeTruthy();

    // Un turno sin contar se dice: pintarlo de "Cuadra" afirmaría que la caja está bien sin contarla.
    // En la fila aparece dos veces a propósito —el rótulo de la diferencia y el "Contado"— y el
    // contador de la cabecera queda afuera de este `list`.
    const filas = screen.getByRole("list", { name: "Cierres de caja" });
    expect(within(filas).getAllByText("Sin contar")).toHaveLength(2);
    expect(within(filas).getAllByText("Cuadra")).toHaveLength(1);

    expect(String(fetchMock.mock.calls[0][0])).toContain("locationId=loc_principal");
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("cambiar de sucursal vuelve a pedir el historial de esa sucursal", async () => {
    const user = userEvent.setup();
    renderClient();

    await screen.findByText("Cuadra");
    await user.click(screen.getByRole("button", { name: "Masaya" }));

    await waitFor(() =>
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("locationId=loc_masaya"),
    );
  });

  it("un error del servidor se muestra con su reintento, sin lista fantasma", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ error: { message: "No se pudo leer el historial de caja." } }, false, 500),
    );

    renderClient();

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("No se pudo leer el historial de caja.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.queryByText("Cuadra")).toBeNull();
  });

  it("un local sin turnos dice que no hay cierres, no muestra una tabla vacía", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ data: [], meta: { locationId: "loc_principal", total: 0, openCount: 0, closedCount: 0 } }),
    );

    renderClient();

    expect(await screen.findByText("Todavía no hay cierres en este local")).toBeTruthy();
  });
});
