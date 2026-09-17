import { describe, expect, it } from "vitest";

import { buildKitchenTicketLines, buildKitchenTicketTitle } from "./kitchen-ticket";

/**
 * Bloque 10 del roadmap del POS (Fase 2) — el ticket de cocina.
 *
 * Es la **misma fuente** que la comanda del KDS: número, hora prometida de retiro, líneas con cantidad
 * y **modificadores**, y las notas del cliente y del pedido. Lo que se fija acá es que el ticket salga
 * en texto plano con los datos reales (`C$`/la moneda configurada nunca se inventan) y que un pedido
 * sin notas no imprima un renglón vacío.
 */
const pedido = {
  orderNumber: "P-ABC123",
  pickupTime: "2026-09-17T20:00:00.000Z",
  pickupScheduled: true,
  pickupNotes: "Sin cebolla",
  notes: "Cliente apurado",
  items: [
    {
      name: "Taco de birria",
      quantity: 2,
      notes: "Sin picante",
      modifiers: [{ name: "Queso extra" }],
    },
    { name: "Cola", quantity: 1, notes: null, modifiers: [] },
  ],
};

const options = {
  businessName: "One Burger",
  timezone: "America/Managua",
  locale: "es-NI",
  label: "COCINA",
};

describe("ticket de cocina", () => {
  it("arma el encabezado con el negocio, el número y la hora prometida", () => {
    const titulo = buildKitchenTicketTitle(pedido, options);

    expect(titulo[0]).toBe("One Burger");
    expect(titulo).toContain("COCINA");
    expect(titulo.some((line) => line.includes("P-ABC123"))).toBe(true);
    // La hora se muestra en la zona del negocio: 20:00 UTC son las 14:00 en Managua (UTC-6).
    expect(titulo.some((line) => line.includes("2:00"))).toBe(true);
    expect(titulo.some((line) => line.includes("RETIRO"))).toBe(true);
  });

  it("una línea por ítem con su cantidad, sus modificadores y sus notas", () => {
    const lineas = buildKitchenTicketLines(pedido, options).join("\n");

    expect(lineas).toContain("2 x Taco de birria");
    expect(lineas).toContain("Queso extra");
    expect(lineas).toContain("Sin picante");
    expect(lineas).toContain("1 x Cola");
    // Las notas del cliente y del pedido van al final, no repetidas por ítem.
    expect(lineas).toContain("Cliente apurado");
  });

  it("un pedido sin notas ni modificadores no agrega el bloque de aclaraciones", () => {
    const simple = {
      ...pedido,
      pickupNotes: null,
      notes: null,
      items: [{ name: "Cola", quantity: 1, notes: null, modifiers: [] }],
    };

    const lineas = buildKitchenTicketLines(simple, options);

    expect(lineas.some((line) => line.startsWith("INFO:"))).toBe(false);
    expect(lineas.some((line) => line.startsWith("NOTA:"))).toBe(false);
    expect(lineas.filter((line) => line.includes("Cola")).length).toBe(1);
    // El último renglón es el ítem: no queda un separador colgando al final.
    expect(lineas[lineas.length - 1]).toBe("1 x Cola");
  });

  it("lo antes posible se distingue de lo programado", () => {
    const asap = buildKitchenTicketTitle(
      { ...pedido, pickupScheduled: false },
      options,
    ).join("\n");

    expect(asap.toLowerCase()).toContain("lo antes posible");
  });
});
