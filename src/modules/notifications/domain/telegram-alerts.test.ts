import { describe, expect, it } from "vitest";

import {
  buildDayCloseSummaryText,
  buildShiftCloseDifferenceText,
  buildShiftOpenTooLongText,
  buildRefundOverThresholdText,
} from "./telegram-alerts";

/**
 * Parte 3 del brief (alertas Telegram) — los textos que salen al grupo del negocio.
 *
 * Son funciones puras: el texto de una alerta es lo único que el dueño va a leer en el teléfono, así que
 * se prueba sin red ni bot. Tres reglas: **plata con su moneda** (nunca un número pelado), el aviso dice
 * **qué hacer** (no solo qué pasó) y no se inventan datos que el payload no trae.
 */

const options = { businessName: "One Burger", currencySymbol: "C$", timezone: "America/Managua", locale: "es-NI" };

describe("buildRefundOverThresholdText", () => {
  it("dice el monto, el pedido y el umbral con el símbolo del negocio", () => {
    const text = buildRefundOverThresholdText(
      { orderNumber: "P-1042", amount: 750, threshold: 500, reason: "Faltó una bebida" },
      options,
    );

    expect(text).toContain("One Burger");
    expect(text).toContain("P-1042");
    expect(text).toContain("C$750.00");
    expect(text).toContain("C$500.00");
    expect(text).toContain("Faltó una bebida");
  });

  it("sin motivo no deja la línea vacía", () => {
    const text = buildRefundOverThresholdText(
      { orderNumber: "P-1042", amount: 750, threshold: 500, reason: null },
      options,
    );

    expect(text).not.toContain("Motivo:");
  });
});

describe("buildShiftCloseDifferenceText", () => {
  it("avisa la diferencia con su signo y de qué turno es", () => {
    const text = buildShiftCloseDifferenceText(
      {
        locationName: "Camino de Oriente",
        closedAt: "2026-09-19T02:30:00.000Z",
        counted: 1400,
        expected: 1500,
        difference: -100,
        threshold: 50,
      },
      options,
    );

    expect(text).toContain("Camino de Oriente");
    expect(text).toContain("-C$100.00");
    expect(text).toContain("C$1,400.00");
    expect(text).toContain("C$1,500.00");
    // La hora es la del negocio (02:30Z son las 20:30 del día anterior en Managua).
    expect(text).toContain("18/09/2026");
  });

  it("una sobra también se avisa, con signo +", () => {
    const text = buildShiftCloseDifferenceText(
      {
        locationName: "Camino de Oriente",
        closedAt: "2026-09-19T02:30:00.000Z",
        counted: 1550,
        expected: 1500,
        difference: 50,
        threshold: 50,
      },
      options,
    );

    expect(text).toContain("+C$50.00");
  });
});

describe("buildShiftOpenTooLongText", () => {
  it("dice cuántas horas lleva abierta y en qué sucursal", () => {
    const text = buildShiftOpenTooLongText(
      { locationName: "Camino de Oriente", openedAt: "2026-09-18T04:00:00.000Z", hoursOpen: 27.4 },
      options,
    );

    expect(text).toContain("Camino de Oriente");
    expect(text).toContain("27 h");
    // 04:00Z del 18 son las 22:00 del 17 en Managua: la fecha que sale es la del negocio.
    expect(text).toContain("17/09/2026");
  });
});

describe("buildDayCloseSummaryText", () => {
  it("resume el día con la plata y los turnos", () => {
    const text = buildDayCloseSummaryText(
      { businessDate: "2026-09-18", cashSales: 4100, movements: -500, refunds: -750, difference: -100, shifts: 3, open: 0 },
      options,
    );

    expect(text).toContain("Cierre del día");
    expect(text).toContain("C$4,100.00");
    expect(text).toContain("-C$500.00");
    expect(text).toContain("-C$750.00");
    expect(text).toContain("-C$100.00");
    expect(text).toContain("3");
  });
});
