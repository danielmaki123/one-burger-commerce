// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCashShift } from "./use-cash-shift";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado de servidor del turno, en un solo lugar.
 *
 * Lo que fija este test es el bug **A-44** y la separación de los dos errores:
 *
 * - Un 4xx/5xx **no** puede dibujarse como «sin caja abierta»: si la lectura falla, la pantalla tiene que
 *   poder decir que falló y ofrecer reintentar. Antes ese `fetch` no miraba `response.ok` y un 401 se veía
 *   igual que una caja cerrada.
 * - El error de una **acción** (abrir o cerrar) no es el error de la **lectura**: si el servidor rechaza un
 *   cierre, la pantalla sigue en el turno y muestra el aviso al lado, no se cae al estado de error.
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const OPEN_SHIFT = { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 };

describe("useCashShift", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => jsonResponse({ data: null }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lee el turno del local y queda listo", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ data: OPEN_SHIFT }));

    const { result } = renderHook(() => useCashShift("loc_norte"));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.shift).toEqual(OPEN_SHIFT);
    expect(result.current.error).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/admin/pos/shift?locationId=loc_norte");
  });

  it("sin turno abierto queda listo y con el turno en null", async () => {
    const { result } = renderHook(() => useCashShift("loc_norte"));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.shift).toBeNull();
  });

  /**
   * A-44 — el caso que estaba mal: un 401 del servidor se dibujaba como «Sin caja abierta en este local».
   */
  it("un 401 no se dibuja como «sin caja abierta»: pasa a error con el mensaje del servidor", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ error: { message: "Admin session expired" } }, 401),
    );

    const { result } = renderHook(() => useCashShift("loc_norte"));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toBe("Admin session expired");
    expect(result.current.shift).toBeNull();
  });

  it("al reintentar limpia el error y vuelve a pedir el turno", async () => {
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ error: { message: "No se pudo leer" } }, 500),
    );
    fetchMock.mockImplementationOnce(() => jsonResponse({ data: OPEN_SHIFT }));

    const { result } = renderHook(() => useCashShift("loc_norte"));
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.error).toBeNull();
    expect(result.current.shift).toEqual(OPEN_SHIFT);
  });

  it("abre el turno con el conteo y lo deja como turno abierto", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/pos/shift/open" && init?.method === "POST") {
        return jsonResponse({ data: OPEN_SHIFT }, 201);
      }
      return jsonResponse({ data: null });
    });

    const { result } = renderHook(() => useCashShift("loc_norte"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let answer: { ok: boolean } | undefined;
    await act(async () => {
      answer = await result.current.openShift([{ currency: "NIO", denomination: 100, quantity: 10 }]);
    });

    expect(answer?.ok).toBe(true);
    expect(result.current.shift).toEqual(OPEN_SHIFT);

    const openCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/admin/pos/shift/open");
    expect(JSON.parse(String((openCall![1] as RequestInit).body))).toEqual({
      locationId: "loc_norte",
      counts: [{ currency: "NIO", denomination: 100, quantity: 10 }],
    });
  });

  it("cierra el turno y guarda el cierre con su detalle por moneda", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/pos/shift/close" && init?.method === "POST") {
        return jsonResponse({
          data: { id: "shift_1", closingAmount: 900, expectedAmount: 1000, difference: -100 },
          meta: { expectedByCurrency: { NIO: 1000 } },
        });
      }
      return jsonResponse({ data: OPEN_SHIFT });
    });

    const { result } = renderHook(() => useCashShift("loc_norte"));
    await waitFor(() => expect(result.current.shift).toEqual(OPEN_SHIFT));

    await act(async () => {
      await result.current.closeShift([{ currency: "NIO", denomination: 100, quantity: 9 }]);
    });

    expect(result.current.shift).toBeNull();
    expect(result.current.closedShift).toEqual({
      id: "shift_1",
      closingAmount: 900,
      expectedAmount: 1000,
      difference: -100,
      expectedByCurrency: { NIO: 1000 },
    });
  });

  /**
   * El error de una acción no tira la pantalla al estado de error: se muestra al lado de lo que se estaba
   * haciendo (es lo que hoy hace el aviso del cierre rechazado) y el turno sigue en pantalla.
   */
  it("un error de acción queda en actionError y no cambia el estado de la lectura", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/pos/shift/close" && init?.method === "POST") {
        return jsonResponse({ error: { message: "No hay una caja abierta en este local." } }, 409);
      }
      return jsonResponse({ data: OPEN_SHIFT });
    });

    const { result } = renderHook(() => useCashShift("loc_norte"));
    await waitFor(() => expect(result.current.shift).toEqual(OPEN_SHIFT));

    let answer: { ok: boolean } | undefined;
    await act(async () => {
      answer = await result.current.closeShift([{ currency: "NIO", denomination: 100, quantity: 9 }]);
    });

    expect(answer?.ok).toBe(false);
    expect(result.current.status).toBe("ready");
    expect(result.current.actionError).toBe("No hay una caja abierta en este local.");
    expect(result.current.shift).toEqual(OPEN_SHIFT);
  });
});
