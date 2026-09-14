// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMANDA_VIEW_CLASS, useComandaView, useFullscreen } from "./use-comanda-view";

/**
 * B3 — la vista de comandas esconde la barra lateral del panel mientras está montada.
 *
 * La clase vive en `<html>` porque la barra lateral la dibuja el shell, fuera de esta página: si el
 * día que se desmonta no se limpia, la persona queda sin navegación en el resto del panel.
 */
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove(COMANDA_VIEW_CLASS);
  vi.restoreAllMocks();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
});

describe("vista de comandas (B3)", () => {
  it("marca el documento mientras está montada y lo limpia al salir", () => {
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(false);

    const { unmount } = renderHook(() => useComandaView());
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains(COMANDA_VIEW_CLASS)).toBe(false);
  });
});

describe("pantalla completa (B3)", () => {
  function stubFullscreen() {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });

    return { requestFullscreen, exitFullscreen };
  }

  it("entra y sale del modo pantalla completa", async () => {
    const { requestFullscreen, exitFullscreen } = stubFullscreen();
    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.toggle();
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    // El navegador avisa el cambio; ahí la pantalla se entera de que está en pantalla completa.
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.documentElement,
    });
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.isFullscreen).toBe(true);

    await act(async () => {
      await result.current.toggle();
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("un navegador que lo rechaza no rompe la pantalla", async () => {
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("no permitido")),
    });
    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.isFullscreen).toBe(false);
  });

  it("sin soporte lo dice, para no ofrecer un botón que no hace nada", () => {
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useFullscreen());

    expect(result.current.supported).toBe(false);
  });
});
