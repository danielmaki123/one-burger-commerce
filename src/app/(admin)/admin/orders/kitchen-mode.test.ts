// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { KITCHEN_MODE_STORAGE_KEY, readKitchenMode, writeKitchenMode } from "./kitchen-mode";

/**
 * Punto 3 del roadmap (2026-09-18) — el modo cocina **por dispositivo**.
 *
 * Una tablet de cocina queda en modo cocina y el mostrador no: la preferencia vive en el navegador, no
 * en la cuenta ni en la base (es presentación, no un permiso). El modo entra con el `<html>`: el shell
 * del panel dibuja la barra lateral fuera de esta página, así que esta pantalla solo puede esconderla
 * por una clase, y la preferencia tiene que **sobrevivir a recargar y a cambiar de pestaña**.
 *
 * Lo que se guarda es la preferencia, no el estado de la pantalla: se lee al montar y se escribe al
 * cambiar. Un valor ilegible no puede dejar el panel sin chrome.
 */
afterEach(() => {
  window.localStorage.clear();
});

describe("preferencia de modo cocina en el dispositivo", () => {
  it("sin nada guardado el panel arranca con su chrome", () => {
    expect(readKitchenMode()).toBe(false);
  });

  it("lo que se guarda se vuelve a leer", () => {
    writeKitchenMode(true);
    expect(readKitchenMode()).toBe(true);

    writeKitchenMode(false);
    expect(readKitchenMode()).toBe(false);
  });

  it("la clave es la del panel, no la de una pestaña", () => {
    writeKitchenMode(true);

    expect(window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY)).toBe("1");
  });

  it("un valor ilegible se lee como apagado en vez de romper", () => {
    window.localStorage.setItem(KITCHEN_MODE_STORAGE_KEY, "quizá");

    expect(readKitchenMode()).toBe(false);
  });

  it("un navegador que bloquea el almacenamiento no rompe la pantalla", () => {
    // Safari en modo privado, o una política que niega el acceso: la pantalla sigue usable.
    const denied = {
      getItem: () => {
        throw new Error("acceso denegado");
      },
      setItem: () => {
        throw new Error("acceso denegado");
      },
    };
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: denied });

    try {
      expect(readKitchenMode()).toBe(false);
      expect(() => writeKitchenMode(true)).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
