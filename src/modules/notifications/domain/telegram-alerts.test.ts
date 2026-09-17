import { describe, expect, it } from "vitest";

import {
  buildShiftClosedText,
  buildShiftOpenTooLongText,
  buildRefundOverThresholdText,
} from "./telegram-alerts";

/**
 * Parte 3 del brief (alertas Telegram) — los textos que salen al grupo del negocio.
 *
 * Son funciones puras: el texto de una alerta es lo único que el dueño va a leer en el teléfono, así que
 * se prueba sin red ni bot. Tres reglas: **plata con su moneda** (nunca un número pelado), el aviso dice
 * **qué hacer** (no solo qué pasó) y no se inventan datos que el payload no trae.
 *
 * Decisión del owner (2026-09-17): el grupo es **uno solo para todas las sucursales**, así que cada
 * mensaje tiene que decir de cuál viene. Y el cierre de cada turno avisa **siempre** (un mensaje por
 * cierre, sin hora fija): eso reemplaza al «resumen diario a las 22:00», que nunca se disparó solo.
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

describe("buildShiftClosedText", () => {
  const cierre = {
    locationName: "Camino de Oriente",
    openedAt: "2026-09-18T14:00:00.000Z",
    closedAt: "2026-09-19T02:30:00.000Z",
    closedByName: "María Pérez",
    ordersCount: 12,
    cash: 4000,
    card: 1500,
    transfer: 500,
    total: 6000,
    tips: 120,
    difference: 0,
    reason: null,
  };

  it("arma el mensaje con el formato del owner: sucursal, quién cerró, turno, pedidos y desglose", () => {
    const text = buildShiftClosedText(cierre, options);

    expect(text).toContain("<b>Cierre de caja — Camino de Oriente</b>");
    expect(text).toContain("👤 Cerrado por: María Pérez");
    // 14:00Z son las 08:00 en Managua y 02:30Z del 19 son las 20:30 del 18: horas del negocio.
    expect(text).toContain("🕐 Turno: 08:00 a. m. → 08:30 p. m. (12 h 30 min)");
    expect(text).toContain("📊 12 pedidos");
    expect(text).toContain("💵 Efectivo: C$4,000.00");
    expect(text).toContain("💳 Tarjeta: C$1,500.00");
    expect(text).toContain("🏦 Transferencia: C$500.00");
    expect(text).toContain("📈 Total: C$6,000.00");
    expect(text).toContain("💰 Propinas: C$120.00");
    // Diferencia 0: mensaje normal, sin la marca de problema.
    expect(text).toContain("✅ Diferencia: C$0.00 (cuadra)");
    expect(text).not.toContain("⚠️");
    expect(text.split("\n").filter((line) => line.startsWith("━")).length).toBe(3);
  });

  it("con diferencia la destaca con su signo y el motivo del cajero", () => {
    const text = buildShiftClosedText(
      { ...cierre, difference: -100, reason: "Faltó vuelto de un pedido" },
      options,
    );

    expect(text).toContain("⚠️ DIFERENCIA: -C$100.00");
    expect(text).toContain('📝 Motivo: "Faltó vuelto de un pedido"');
    expect(text).not.toContain("(cuadra)");
  });

  it("una sobra también se destaca, con signo +", () => {
    const text = buildShiftClosedText({ ...cierre, difference: 250 }, options);

    expect(text).toContain("⚠️ DIFERENCIA: +C$250.00");
  });

  it("sin motivo no deja una línea vacía, y sin nombre no inventa el firmante", () => {
    const text = buildShiftClosedText(
      { ...cierre, difference: -50, closedByName: null },
      options,
    );

    expect(text).toContain("👤 Cerrado por: —");
    expect(text).not.toContain("📝 Motivo:");
  });

  it("un solo pedido se dice en singular, y un turno corto en minutos", () => {
    const text = buildShiftClosedText(
      {
        ...cierre,
        ordersCount: 1,
        openedAt: "2026-09-18T14:00:00.000Z",
        closedAt: "2026-09-18T14:45:00.000Z",
      },
      options,
    );

    expect(text).toContain("📊 1 pedido");
    expect(text).toContain("(45 min)");
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
