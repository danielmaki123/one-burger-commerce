import { describe, expect, it } from "vitest";

import {
  CASH_DIFFERENCE_LABEL,
  countsTotalOf,
  formatCashDifference,
  formatShiftDateTime,
  formatSignedAmount,
  getCashDifferenceTone,
} from "./cash-shift-helpers";

const formatAmount = (value: number) => `C$${value.toFixed(2)}`;

describe("cash shift helpers", () => {
  /**
   * Bloque 1 del roadmap del POS (Fase 2) — mostrar un arqueo sin mentir.
   *
   * Un cierre ciego guarda el esperado y **no** calcula la diferencia hasta que alguien cuente. Si la
   * pantalla lo mostrara como "cuadra", estaría afirmando que la caja está bien sin haberla contado:
   * es la misma regla de "si el backend no tiene el dato, el copy no miente".
   */
  it("un turno sin contar no se muestra como cuadrado", () => {
    const shift = { closingAmount: null, difference: null };

    expect(getCashDifferenceTone(shift)).toBe("sin-contar");
    expect(CASH_DIFFERENCE_LABEL["sin-contar"]).toBe("Sin contar");
    expect(formatCashDifference(shift, formatAmount)).toBe("Sin contar");
  });

  it("marca falta y sobra con su signo, y cero como cuadra", () => {
    expect(getCashDifferenceTone({ closingAmount: 900, difference: -100 })).toBe("falta");
    expect(formatCashDifference({ closingAmount: 900, difference: -100 }, formatAmount)).toBe(
      "-C$100.00",
    );

    expect(getCashDifferenceTone({ closingAmount: 1100, difference: 100 })).toBe("sobra");
    expect(formatCashDifference({ closingAmount: 1100, difference: 100 }, formatAmount)).toBe(
      "+C$100.00",
    );

    expect(getCashDifferenceTone({ closingAmount: 1000, difference: 0 })).toBe("cuadra");
    expect(formatCashDifference({ closingAmount: 1000, difference: 0 }, formatAmount)).toBe(
      "C$0.00",
    );
  });

  /**
   * El día de caja es el del **negocio**, no el del navegador. Un cierre de las 23:40 en Managua no
   * puede verse como del día siguiente porque quien abre la pantalla está en otro huso.
   */
  it("formatea la fecha y la hora en la zona del negocio", () => {
    const options = { timezone: "America/Managua", locale: "es-NI" };
    // 2026-09-18T05:40:00Z = 2026-09-17 23:40 en Managua (UTC-6). El `es-NI` lo escribe en 12 h.
    const iso = "2026-09-18T05:40:00.000Z";

    expect(formatShiftDateTime(iso, options)).toContain("11:40");
    expect(formatShiftDateTime(iso, options)).toContain("17");
  });

  it("una fecha ausente o inválida se muestra como guion, no como «Invalid Date»", () => {
    const options = { timezone: "America/Managua", locale: "es-NI" };

    expect(formatShiftDateTime(null, options)).toBe("—");
    expect(formatShiftDateTime("no-es-fecha", options)).toBe("—");
  });

  /**
   * Bloque 1.1 del roadmap del POS (Fase 2) — comparar el esperado por moneda contra lo que se contó.
   *
   * Un lado del turno **sin conteo** (cierre ciego, o un turno viejo sin billetes cargados) devuelve
   * `null` y no `0`: cero afirmaría que se contó y no había nada.
   */
  it("suma lo contado por moneda y lado, y devuelve null si ese lado no tiene conteo", () => {
    const counts = [
      { kind: "opening" as const, currency: "NIO", denomination: 100, quantity: 5 },
      { kind: "opening" as const, currency: "USD", denomination: 20, quantity: 1 },
      { kind: "closing" as const, currency: "NIO", denomination: 100, quantity: 6 },
      { kind: "closing" as const, currency: "USD", denomination: 10, quantity: 2 },
    ];

    expect(countsTotalOf(counts, "NIO", "opening")).toBe(500);
    expect(countsTotalOf(counts, "USD", "opening")).toBe(20);
    expect(countsTotalOf(counts, "NIO", "closing")).toBe(600);
    expect(countsTotalOf(counts, "USD", "closing")).toBe(20);
    // No se contó en euros: no es 0, es que no hay dato.
    expect(countsTotalOf(counts, "EUR", "closing")).toBeNull();
    expect(countsTotalOf([], "NIO", "closing")).toBeNull();
  });

  /**
   * Bloque 11.5/11.6 del roadmap del POS (Fase 2) — el signo de los totales del día.
   *
   * El cierre del día consolidado y la comparación entre sucursales muestran diferencias sumadas, no un
   * turno: un cero se muestra como `C$0.00` (cuadra) y no como `+C$0.00`, que se lee como una sobra.
   */
  it("formatea un monto con su signo y deja el cero sin signo", () => {
    const format = (value: number) => `C$${value.toFixed(2)}`;

    expect(formatSignedAmount(-100, format)).toBe("-C$100.00");
    expect(formatSignedAmount(25, format)).toBe("+C$25.00");
    expect(formatSignedAmount(0, format)).toBe("C$0.00");
  });
});
