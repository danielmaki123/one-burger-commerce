// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KITCHEN_MODE_STORAGE_KEY } from "./kitchen-mode";
import { COMANDA_VIEW_CLASS, useComandaView } from "./use-comanda-view";

/**
 * B3/B6 · Punto 3 (2026-09-18) — el chrome del panel se esconde solo en el modo cocina.
 *
 * Desde el layout unificado (opción (a) del owner, 2026-09-18) Órdenes entra **con** barra lateral y
 * encabezado: esconderlos es un modo explícito que se prende y se sale. La clase vive en `<html>`
 * porque la barra lateral la dibuja el shell, fuera de esta página: si el día que se desmonta no se
 * limpia, la persona queda sin navegación en el resto del panel.
 *
 * El modo es **del dispositivo**: se guarda en el navegador y se restaura al montar, así que una tablet
 * de cocina queda en modo cocina al recargar y el mostrador no.
 */
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove(COMANDA_VIEW_CLASS);
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("vista de comandas (B3)", () => {
  it("arranca con el chrome del panel: la barra lateral se ve", () => {
    renderHook(() => useComandaView());

    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(false);
  });

  it("el modo cocina se prende y se sale", () => {
    const { result } = renderHook(() => useComandaView());

    act(() => result.current.setImmersive(true));
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(true);

    act(() => result.current.setImmersive(false));
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(false);
  });

  it("el modo se limpia al desmontar, aunque esté prendido", () => {
    const { result, unmount } = renderHook(() => useComandaView());
    act(() => result.current.setImmersive(true));
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(false);
  });

  it("la elección queda guardada en el dispositivo", async () => {
    const { result } = renderHook(() => useComandaView());

    act(() => result.current.setImmersive(true));
    await waitFor(() => expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBe("1"));

    act(() => result.current.setImmersive(false));
    await waitFor(() => expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBeNull());
  });

  it("un dispositivo que quedó en modo cocina arranca así al volver", async () => {
    window.localStorage.setItem(KITCHEN_MODE_STORAGE_KEY, "1");

    const { result } = renderHook(() => useComandaView());

    await waitFor(() => expect(result.current.immersive).toBe(true));
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(true);
  });

  it("el modo no se limpia de la memoria del dispositivo al desmontar", async () => {
    const { result, unmount } = renderHook(() => useComandaView());
    act(() => result.current.setImmersive(true));
    await waitFor(() => expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBe("1"));

    unmount();

    // La clase sí se va (nadie queda sin navegación), pero la tablet sigue siendo de cocina.
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(false);
    expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBe("1");
  });

  /**
   * Bug que encontró el E2E (2026-09-18): al entrar sin tocar nada, el efecto que guarda escribía
   * «apagado» **antes** de que el efecto que restaura leyera el almacenamiento, así que la tablet de
   * cocina se apagaba sola al recargar. Por eso solo se persiste una elección explícita.
   */
  it("entrar sin tocar nada no borra la preferencia guardada", async () => {
    window.localStorage.setItem(KITCHEN_MODE_STORAGE_KEY, "1");

    const { result } = renderHook(() => useComandaView());

    await waitFor(() => expect(result.current.immersive).toBe(true));
    expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBe("1");
  });

  it("entrar en un dispositivo sin preferencia no escribe nada", async () => {
    renderHook(() => useComandaView());

    expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBeNull();
  });

  it("un navegador que niega el almacenamiento no rompe la pantalla", () => {
    const denied = {
      getItem: () => {
        throw new Error("acceso denegado");
      },
      setItem: () => {
        throw new Error("acceso denegado");
      },
      removeItem: () => {
        throw new Error("acceso denegado");
      },
    };
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: denied });

    try {
      const { result } = renderHook(() => useComandaView());

      expect(result.current.immersive).toBe(false);
      expect(() => act(() => result.current.setImmersive(true))).not.toThrow();
      expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(true);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
