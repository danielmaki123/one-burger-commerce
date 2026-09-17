import { describe, expect, it } from "vitest";

import { buildShiftCloseSheet, type ShiftCloseSheetInput } from "./shift-close-sheet";

/**
 * Bloque 13.3 del roadmap del POS (Fase 2) — la **firma del cierre**: el papel que se imprime y firma.
 *
 * Tres cosas tienen que estar sí o sí: el arqueo que quedó asentado, el **nombre** de quien cerró (no su
 * id: una firma con `cmu5…` no la firma nadie) y la línea para firmar. Y el papel no puede inventar
 * datos: sin conteo cargado lo dice, un turno abierto no se imprime como cerrado y una nota que no
 * existe no aparece.
 */

const countLines = [
  { currency: "NIO", denomination: 1000, quantity: 4, amount: 4000 },
  { currency: "NIO", denomination: 100, quantity: 5, amount: 500 },
  { currency: "USD", denomination: 20, quantity: 1, amount: 20 },
];

const currencyRows = [
  { currency: "NIO", expected: 4600, counted: 4500, difference: -100 },
  { currency: "USD", expected: 20, counted: 20, difference: 0 },
];

const closedShift: ShiftCloseSheetInput = {
  status: "closed",
  openedAt: "2026-09-18T14:00:00.000Z",
  closedAt: "2026-09-19T02:30:00.000Z",
  locationName: "Camino de Oriente",
  notes: "Faltó vuelto de un pedido",
  countLines,
  currencyRows,
  totals: {
    opening: 1000,
    counted: 4520,
    expected: 4620,
    difference: -100,
    cashSales: 4100,
    movements: -500,
    refunds: 0,
  },
  closedByName: "María Pérez",
};

const options = {
  businessName: "One Burger",
  timezone: "America/Managua",
  locale: "es-NI",
  currencyCode: "NIO",
  currencySymbol: "C$",
};

function text(input = closedShift): string {
  return buildShiftCloseSheet(input, options).join("\n");
}

describe("buildShiftCloseSheet", () => {
  it("encabeza con el negocio, la sucursal y las horas del turno en la zona del negocio", () => {
    const lines = buildShiftCloseSheet(closedShift, options);
    const body = lines.join("\n");

    expect(lines[0]).toBe("ONE BURGER");
    expect(lines[1]).toBe("CIERRE DE CAJA");
    expect(body).toContain("Camino de Oriente");
    // 14:00 UTC son las 08:00 en Managua (UTC−6): la hora del papel es la del local, no la del servidor.
    expect(body).toContain("08:00");
    expect(body).not.toContain("14:00");
    // El cierre fue 2026-09-19T02:30Z, que en Managua **todavía es el 18**: el día de caja es el del
    // negocio, no el de UTC (misma regla que el tablero de «Hoy»).
    expect(body).toContain("18/09/2026");
    expect(body).not.toContain("19/09/2026");
  });

  it("la hora del papel es la del local, no la del servidor ni la del navegador", () => {
    // El mismo turno impreso en dos zonas: si la zona se ignorara, las dos hojas dirían lo mismo.
    const managua = text();
    const madrid = buildShiftCloseSheet(closedShift, {
      ...options,
      timezone: "Europe/Madrid",
    }).join("\n");

    expect(managua).toContain("08:00"); // 14:00Z en Managua (UTC−6)
    expect(madrid).toContain("04:00"); // 14:00Z en Madrid (UTC+2 en septiembre)
    expect(madrid).not.toContain("08:00");
  });

  it("imprime el conteo billete por billete con el símbolo de su moneda", () => {
    const lines = buildShiftCloseSheet(closedShift, options);
    const body = lines.join("\n");

    expect(body).toContain("5 x NIO 100");
    expect(body).toContain("C$4,000.00");
    // Una moneda distinta se muestra con su código: `US$20` con el símbolo local sería un número falso.
    expect(body).toContain("1 x USD 20");
    expect(body).toContain("USD 20.00");
  });

  it("firma con el nombre de quien cierra y deja la línea para firmar", () => {
    const body = text();

    expect(body).toContain("Cerró: María Pérez");
    expect(body).toContain("Firma:");
    // El id de la sesión no es una firma: si no se pudo resolver el nombre, se dice.
    expect(body).not.toContain("user_");
  });

  it("un turno sin nombre resuelto no inventa el firmante", () => {
    const body = text({ ...closedShift, closedByName: null });

    expect(body).toContain("Cerró: —");
    expect(body).toContain("Firma:");
  });

  it("muestra el arqueo por moneda con el signo de la diferencia", () => {
    const body = text();

    expect(body).toContain("NIO");
    expect(body).toContain("-C$100.00");
    // La que cuadra no se marca como diferencia: va explícito.
    expect(body).toContain("sin diferencia");
  });

  it("dice el total del arqueo, el efectivo, los movimientos y lo devuelto", () => {
    const body = text();

    expect(body).toContain("Contado:");
    expect(body).toContain("C$4,520.00");
    expect(body).toContain("Esperado:");
    expect(body).toContain("C$4,620.00");
    expect(body).toContain("Ventas en efectivo: C$4,100.00");
    expect(body).toContain("Movimientos: -C$500.00");
    expect(body).toContain("Devoluciones");
  });

  it("un turno abierto no se imprime como cerrado", () => {
    const body = text({
      ...closedShift,
      status: "open",
      closedAt: null,
      // Un turno abierto no tiene conteo de cierre ni arqueo por moneda: no se estiman.
      countLines: [],
      currencyRows: [],
      totals: { ...closedShift.totals, counted: null, difference: null },
    });

    expect(body).toContain("Cerrado: sin cerrar");
    expect(body).toContain("Diferencia: Sin contar");
    expect(body).toContain("Sin conteo");
  });

  it("sin conteo cargado lo dice, y sin nota no inventa la nota", () => {
    const body = text({ ...closedShift, countLines: [], notes: null });

    expect(body).toContain("Sin conteo");
    expect(body).not.toContain("NOTA:");
  });

  it("la nota del cierre viaja al papel cuando existe", () => {
    expect(text()).toContain("NOTA: Faltó vuelto de un pedido");
  });

  it("sin detalle por moneda guardado lo dice en vez de estimarlo", () => {
    const body = text({ ...closedShift, currencyRows: [] });

    expect(body).toContain("Sin detalle por moneda");
  });
});
