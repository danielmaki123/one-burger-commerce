// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { printLines } from "./print-lines";

/**
 * Bloque 10 del roadmap del POS (Fase 2) — imprimir un texto con la hoja del sistema.
 *
 * Los tres papeles del POS (ticket de cocina, ticket de cliente y hoja de cierre) hacen lo mismo: abrir
 * una ventana, escribir las líneas en un `<pre>` y llamar a `print()`. Estaba copiado en cada pantalla;
 * vive acá y se prueba una vez. Sin dependencias ni impresora de red (la decisión del owner para el
 * bloque de impresión).
 */

function fakeWindow() {
  const doc = { write: vi.fn(), close: vi.fn() };
  const opened = { document: doc, focus: vi.fn(), print: vi.fn() };

  return { opened, doc };
}

describe("printLines", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("abre una ventana, escribe el texto y manda a imprimir", () => {
    const { opened, doc } = fakeWindow();
    const open = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);

    const printed = printLines(["ONE BURGER", "Total C$140.00"]);

    expect(printed).toBe(true);
    expect(open).toHaveBeenCalledWith("", "_blank", expect.stringContaining("width="));
    expect(doc.write).toHaveBeenCalledWith(expect.stringContaining("ONE BURGER"));
    expect(doc.write).toHaveBeenCalledWith(expect.stringContaining("Total C$140.00"));
    expect(doc.close).toHaveBeenCalled();
    expect(opened.focus).toHaveBeenCalled();
    expect(opened.print).toHaveBeenCalled();
  });

  it("escapa el texto: un nombre con `<` no rompe la hoja", () => {
    const { opened, doc } = fakeWindow();
    vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);

    printLines(["2 x Taco <especial> & soda"]);

    const html = doc.write.mock.calls[0][0] as string;
    expect(html).toContain("Taco &lt;especial&gt; &amp; soda");
    expect(html).not.toContain("Taco <especial>");
  });

  it("si el navegador bloquea la ventana no rompe nada y lo dice", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(printLines(["ONE BURGER"])).toBe(false);
  });
});
