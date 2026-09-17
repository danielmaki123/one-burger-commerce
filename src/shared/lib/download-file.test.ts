// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadTextFile } from "./download-file";

/**
 * Tarea 10 del brief (2026-09-17) — **bajar un archivo de texto** desde el navegador.
 *
 * El export de cierres lo hacía a mano y la conciliación necesitaba lo mismo: el blob, el enlace y el
 * `click()` en un solo lugar. Lo que fija este archivo es que el nombre que baja el archivo es el que se
 * pidió (un CSV sin nombre no se distingue del anterior) y que el objeto de la URL se libera.
 */

describe("downloadTextFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("dispara la descarga con el nombre y el contenido pedidos", () => {
    const createObjectURL = vi.fn(() => "blob:csv");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createElement = vi.spyOn(document, "createElement");

    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    downloadTextFile({ fileName: "conciliacion-principal-2026-09-17.csv", content: "a;b" });

    const link = createElement.mock.results.at(-1)?.value as HTMLAnchorElement;
    expect(link.download).toBe("conciliacion-principal-2026-09-17.csv");
    expect(link.href).toContain("blob:csv");
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });

  it("el tipo del archivo se declara para que el navegador no lo abra como texto plano", () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:csv");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    downloadTextFile({ fileName: "x.csv", content: "a", mimeType: "text/csv;charset=utf-8" });

    expect(createObjectURL.mock.calls[0]?.[0].type).toBe("text/csv;charset=utf-8");
  });
});
