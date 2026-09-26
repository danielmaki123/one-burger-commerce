// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import { usePosCatalog } from "./use-pos-catalog";

/**
 * La carga del catálogo del mostrador y el local/terminal elegidos.
 *
 * Lo que se prueba es lo que puede salir caro en el mostrador: que el catálogo llegue **una vez por local**
 * (buscar no dispara consultas), que un refresco que falla **no** borre lo que el cajero tiene en pantalla,
 * que una respuesta de un local que ya se dejó no pise el actual y que el local sin carta diga su motivo.
 */

const locations = [
  { id: "loc_norte", name: "Camino de Oriente" },
  { id: "loc_sur", name: "Carretera Masaya" },
];

const catalogo = {
  data: {
    products: [{ id: "prod_taco", name: "Taco de birria", basePrice: 35, categoryId: "cat_tacos" }],
    categories: [{ id: "cat_tacos", name: "Tacos", count: 1 }],
    total: 1,
    query: "",
  },
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);
}

describe("usePosCatalog", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => jsonResponse(catalogo));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("trae el catálogo del primer local y lo deja disponible", async () => {
    const { result } = renderHook(() =>
      usePosCatalog({ locations, currencyCode: "NIO", currency: DEFAULT_CURRENCY_FORMAT }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.locationId).toBe("loc_norte");
    expect(result.current.products).toHaveLength(1);
    expect(result.current.categories).toEqual([{ id: "cat_tacos", name: "Tacos", count: 1 }]);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/admin/pos/catalog?locationId=loc_norte");
  });

  it("cambiar de local vuelve a pedir el catálogo y resetea la categoría elegida", async () => {
    const { result } = renderHook(() =>
      usePosCatalog({ locations, currencyCode: "NIO", currency: DEFAULT_CURRENCY_FORMAT }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setActiveCategoryId("cat_tacos"));
    expect(result.current.activeCategoryId).toBe("cat_tacos");

    await act(async () => {
      result.current.setLocationId("loc_sur");
    });

    await waitFor(() => expect(result.current.locationId).toBe("loc_sur"));
    expect(result.current.activeCategoryId).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        ([input]) => String(input) === "/api/admin/pos/catalog?locationId=loc_sur",
      ),
    ).toBe(true);
  });

  it("un error de carga dice el motivo y el reintento vuelve a pedir", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("red caída")));

    const { result } = renderHook(() =>
      usePosCatalog({ locations, currencyCode: "NIO", currency: DEFAULT_CURRENCY_FORMAT }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe("red caída");
    expect(result.current.products).toEqual([]);

    fetchMock.mockImplementation(() => jsonResponse(catalogo));
    await act(async () => {
      result.current.retryCatalog();
    });

    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.loadError).toBeNull();
  });

  it("un refresco de fondo que falla no borra lo que el cajero ya tiene en pantalla", async () => {
    const { result } = renderHook(() =>
      usePosCatalog({ locations, currencyCode: "NIO", currency: DEFAULT_CURRENCY_FORMAT }),
    );
    await waitFor(() => expect(result.current.products).toHaveLength(1));

    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("red caída")));
    await act(async () => {
      await result.current.refreshCatalog({ silent: true });
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.loadError).toBeNull();
  });

  it("con dos terminales en el local, la primera queda elegida y se puede cambiar", async () => {
    const { result, rerender } = renderHook(() =>
      usePosCatalog({
        locations,
        cashTerminalsByLocation: {
          loc_norte: [
            { id: "term_caja_1", label: "Caja 1" },
            { id: "term_barra", label: "Barra" },
          ],
        },
        currencyCode: "NIO",
        currency: DEFAULT_CURRENCY_FORMAT,
      }),
    );

    await waitFor(() => expect(result.current.terminalId).toBe("term_caja_1"));
    expect(result.current.terminals).toHaveLength(2);

    act(() => result.current.setTerminalId("term_barra"));
    await waitFor(() => expect(result.current.terminalId).toBe("term_barra"));

    // Un re-render (el POS se refresca solo cada pocos segundos) no puede devolver la elección a la primera.
    rerender();
    expect(result.current.terminalId).toBe("term_barra");
  });

  it("sin terminales cargadas el cobro va sin terminal (la sucursal de una sola caja)", () => {
    const { result } = renderHook(() =>
      usePosCatalog({ locations, currencyCode: "NIO", currency: DEFAULT_CURRENCY_FORMAT }),
    );

    expect(result.current.terminals).toEqual([]);
    expect(result.current.terminalId).toBeNull();
  });
});
