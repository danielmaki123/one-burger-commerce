// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePosShift } from "./use-pos-shift";

/**
 * La caja del mostrador: el turno de la terminal elegida y los dos motivos por los que **no** se cobra.
 *
 * Lo que se prueba son las dos reglas que pueden costar plata: sin caja no se habilita el cobro, y la caja
 * de otro día en un local con cierre obligatorio bloquea el cobro con su motivo escrito. La comparación de
 * días la hace la regla del dominio con la **zona del negocio** (por eso el turno se arma con offset).
 */

const locations = [
  { id: "loc_norte", name: "Camino de Oriente", requireShiftClose: true },
  { id: "loc_sur", name: "Carretera Masaya", requireShiftClose: false },
];

const businessTimezone = "America/Managua";

/** Un turno abierto a la hora indicada (UTC), para forzar caja de hoy o de otro día del negocio. */
function shiftOpenedAt(iso: string) {
  return { id: "shift_1", openedAt: iso, openingAmount: 1000 };
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);
}

describe("usePosShift", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => jsonResponse({ data: null }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sin caja abierta no habilita el cobro y pide abrirla", async () => {
    const { result } = renderHook(() =>
      usePosShift({ locationId: "loc_norte", terminalId: null, locations, timezone: businessTimezone }),
    );

    await waitFor(() => expect(result.current.shiftLoading).toBe(false));
    expect(result.current.shift).toBeNull();
    expect(result.current.canCharge).toBe(false);
    expect(result.current.needsOpenShift).toBe(true);
    expect(result.current.blockedReason).toBeNull();
  });

  it("con la caja abierta habilita el cobro y no pide nada", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ data: shiftOpenedAt(new Date().toISOString()) }),
    );

    const { result } = renderHook(() =>
      usePosShift({ locationId: "loc_norte", terminalId: null, locations, timezone: businessTimezone }),
    );

    await waitFor(() => expect(result.current.shift).not.toBeNull());
    expect(result.current.canCharge).toBe(true);
    expect(result.current.needsOpenShift).toBe(false);
    expect(result.current.blockedReason).toBeNull();
  });

  it("la caja de otro día en un local con cierre obligatorio bloquea el cobro con su motivo", async () => {
    const ayer = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    fetchMock.mockImplementation(() => jsonResponse({ data: shiftOpenedAt(ayer) }));

    const { result } = renderHook(() =>
      usePosShift({ locationId: "loc_norte", terminalId: null, locations, timezone: businessTimezone }),
    );

    await waitFor(() => expect(result.current.shift).not.toBeNull());
    expect(result.current.blockedReason).toContain("exige cerrar la caja todos los días");
    expect(result.current.canCharge).toBe(true);
  });

  it("sin cierre obligatorio la caja vieja no bloquea el cobro", async () => {
    const ayer = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    fetchMock.mockImplementation(() => jsonResponse({ data: shiftOpenedAt(ayer) }));

    const { result } = renderHook(() =>
      usePosShift({ locationId: "loc_sur", terminalId: null, locations, timezone: businessTimezone }),
    );

    await waitFor(() => expect(result.current.shift).not.toBeNull());
    expect(result.current.blockedReason).toBeNull();
  });

  it("lee la caja de la terminal elegida", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ data: shiftOpenedAt(new Date().toISOString()) }),
    );

    const { result } = renderHook(() =>
      usePosShift({
        locationId: "loc_norte",
        terminalId: "term_barra",
        locations,
        timezone: businessTimezone,
      }),
    );

    await waitFor(() => expect(result.current.shift).not.toBeNull());
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "/api/admin/pos/shift?locationId=loc_norte&terminalId=term_barra",
    );
  });

  it("un error de lectura deja la caja en «sin abrir» y no rompe la pantalla", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("red caída")));

    const { result } = renderHook(() =>
      usePosShift({ locationId: "loc_norte", terminalId: null, locations, timezone: businessTimezone }),
    );

    await waitFor(() => expect(result.current.shiftLoading).toBe(false));
    expect(result.current.shift).toBeNull();
    expect(result.current.canCharge).toBe(false);
  });

  it("el refresco de fondo vuelve a leer la caja sin mostrar la carga", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ data: shiftOpenedAt(new Date().toISOString()) }),
    );

    const { result } = renderHook(() =>
      usePosShift({ locationId: "loc_norte", terminalId: null, locations, timezone: businessTimezone }),
    );
    await waitFor(() => expect(result.current.shift).not.toBeNull());

    fetchMock.mockImplementation(() => jsonResponse({ data: null }));
    await result.current.refreshShift();

    await waitFor(() => expect(result.current.shift).toBeNull());
    expect(result.current.shiftLoading).toBe(false);
  });
});
