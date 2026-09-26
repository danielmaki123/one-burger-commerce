// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InvoicePrintButton from "./invoice-print-button";

/**
 * Factura simple (2026-09-18) — el botón «Imprimir» de la hoja de 80 mm.
 *
 * Es lo único con JavaScript de la página del documento: llama al diálogo de impresión del navegador, que es
 * el que guarda el PDF. Sin dependencias y sin generador en el servidor (decisión 1.6).
 */

afterEach(cleanup);

describe("InvoicePrintButton", () => {
  beforeEach(() => {
    vi.stubGlobal("print", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda la hoja a imprimir", async () => {
    const user = userEvent.setup();
    render(<InvoicePrintButton />);

    await user.click(screen.getByRole("button", { name: "Imprimir" }));

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("el botón no sale en el papel", () => {
    render(<InvoicePrintButton />);

    expect(screen.getByRole("button", { name: "Imprimir" }).className).toContain("print:hidden");
  });
});
