import { describe, expect, it } from "vitest";

import { buildShiftXSheet, type ShiftXSheetInput } from "./shift-x-sheet";

/**
 * Tarea 7 del brief (2026-09-17) — el papel del **corte X** (1.12), que también es el del **traspaso**
 * (1.13).
 *
 * Tres cosas que el papel no puede hacer: parecer un cierre (el turno sigue abierto), firmar sin decir
 * quién entrega y quién recibe, y mezclar dólares con el símbolo de córdobas. Y una que sí tiene que
 * hacer: decir el esperado **de ahora**, en la hora del local.
 */

const corte: ShiftXSheetInput = {
  shiftId: "shift_01",
  locationName: "Camino de Oriente",
  openedAt: "2026-09-18T14:00:00.000Z",
  generatedAt: "2026-09-18T22:30:00.000Z",
  openingAmount: 1000,
  expectedAmount: 4620,
  expectedByCurrency: { NIO: 4600, USD: 20 },
  cashSalesAmount: 4100,
  cashMovementsAmount: -500,
  refundsAmount: 0,
  handedByName: "María Pérez",
  receivedByName: null,
};

const options = {
  businessName: "One Burger",
  timezone: "America/Managua",
  locale: "es-NI",
  currencyCode: "NIO",
  currencySymbol: "C$",
};

function text(input: ShiftXSheetInput = corte): string {
  return buildShiftXSheet(input, options).join("\n");
}

describe("buildShiftXSheet", () => {
  it("encabeza con el negocio, la sucursal y la hora del corte en la zona del local", () => {
    const lines = buildShiftXSheet(corte, options);
    const body = lines.join("\n");

    expect(lines[0]).toBe("ONE BURGER");
    expect(lines[1]).toContain("CORTE X");
    expect(body).toContain("Camino de Oriente");
    expect(body).toContain("shift_01");
    // 14:00 UTC son las 08:00 en Managua (UTC−6) y el corte 16:30: la hora del papel es la del local.
    // El locale del negocio imprime en 12 horas, así que el corte dice «04:30 p. m.».
    expect(body).toContain("08:00");
    expect(body).not.toContain("14:00");
    expect(body).toContain("04:30 p. m.");
  });

  it("dice el efectivo esperado de ahora, con el detalle que lo explica", () => {
    const body = text();

    expect(body).toContain("Fondo: C$1,000.00");
    expect(body).toContain("Ventas en efectivo: C$4,100.00");
    expect(body).toContain("Movimientos: -C$500.00");
    expect(body).toContain("Devoluciones aprobadas en efectivo: C$0.00");
    expect(body).toContain("Esperado: C$4,620.00");
  });

  it("el detalle por moneda usa el código de cada una, no el símbolo local", () => {
    const body = text();

    expect(body).toContain("NIO  esperado C$4,600.00");
    expect(body).toContain("USD  esperado USD 20.00");
  });

  it("aclara que no cierra la caja", () => {
    expect(text()).toContain("NO cierra la caja");
  });

  it("como traspaso firma entrega y recibe, con dos líneas de firma", () => {
    const body = text({ ...corte, receivedByName: "Carlos Ruiz" });
    const lines = buildShiftXSheet({ ...corte, receivedByName: "Carlos Ruiz" }, options);

    expect(lines[1]).toContain("TRASPASO");
    expect(body).toContain("Entrega: María Pérez");
    expect(body).toContain("Recibe: Carlos Ruiz");
    expect(lines.filter((line) => line.startsWith("Firma:")).length).toBe(2);
  });

  it("si no se sabe quién entrega no inventa el nombre, pero deja firmar", () => {
    const lines = buildShiftXSheet({ ...corte, handedByName: null, receivedByName: "Carlos Ruiz" }, options);
    const body = lines.join("\n");

    expect(body).toContain("Entrega: —");
    expect(body).toContain("Recibe: Carlos Ruiz");
    expect(lines.filter((line) => line.startsWith("Firma:")).length).toBe(2);
  });

  it("un corte sin traspaso lleva una sola firma y no menciona a nadie que reciba", () => {
    const lines = buildShiftXSheet(corte, options);
    const body = lines.join("\n");

    expect(body).toContain("Entrega: María Pérez");
    expect(body).not.toContain("Recibe:");
    expect(lines.filter((line) => line.startsWith("Firma:")).length).toBe(1);
  });
});
