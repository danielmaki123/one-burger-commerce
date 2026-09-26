// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./use-media-query";

/**
 * El hook que decide si el panel de venta se comporta como **columna** (escritorio/tablet) o como **sheet**
 * (móvil).
 *
 * La pantalla lo necesita por accesibilidad, no por estética: en móvil, con el sheet cerrado, el panel de
 * venta tiene que quedar `inert` y fuera del árbol accesible; en escritorio, el mismo panel es la venta y
 * `inert` la dejaría inoperable. Eso no se puede resolver con CSS.
 *
 * Tres cosas que se prueban acá:
 *
 * 1. **ssr-safe**: sin `matchMedia` (jsdom y el render del servidor) devuelve el valor inicial y **no
 *    explota**.
 * 2. **Reactivo**: cuando la media query cambia, el valor cambia.
 * 3. **Limpieza**: al desmontar se saca el listener (nada de listeners huérfanos en una pantalla que se
 *    monta y se desmonta todo el día).
 */

type Listener = (event: { matches: boolean }) => void;

function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const removeEventListener = vi.fn((_type: string, listener: Listener) => {
    listeners.delete(listener);
  });

  const matchMedia = vi.fn((query: string) => ({
    matches: initialMatches,
    media: query,
    addEventListener: (_type: string, listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener,
    dispatch: (matches: boolean) => {
      for (const listener of listeners) listener({ matches });
    },
    listeners,
  }));

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return { matchMedia, removeEventListener, listeners };
}

afterEach(() => {
  cleanup();
  // `delete` deja el entorno como estaba: el resto de la suite (jsdom) no tiene matchMedia.
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useMediaQuery", () => {
  it("sin matchMedia (ssr o jsdom pelado) devuelve el valor inicial", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 64rem)"));

    expect(result.current).toBe(false);
  });

  it("devuelve lo que dice la media query en el primer render", () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useMediaQuery("(min-width: 64rem)"));
    expect(result.current).toBe(true);
  });

  it("cambia cuando la media query cambia", () => {
    const media = stubMatchMedia(false);

    const { result } = renderHook(() => useMediaQuery("(min-width: 64rem)"));
    expect(result.current).toBe(false);

    act(() => {
      (media.matchMedia.mock.results[0]!.value as { dispatch: (matches: boolean) => void }).dispatch(true);
    });

    expect(result.current).toBe(true);
  });

  it("saca su listener al desmontar", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 64rem)"));

    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
    expect(media.removeEventListener).toHaveBeenCalled();
  });
});
