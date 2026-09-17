import { describe, expect, it } from "vitest";

import { buildCustomerTicketLines, type CustomerTicketOrder } from "./customer-ticket";

/**
 * Bloque 10.2/10.4 del roadmap del POS (Fase 2) — el **ticket de cliente**.
 *
 * Es el papel que se lleva el cliente: a diferencia del ticket de cocina (Bloque 10.1, sin importes),
 * este es el comprobante —lleva precios, total y con qué se pagó— y se imprime al cobrar en el
 * mostrador (10.2) o se reimprime después desde el detalle del pedido (10.4). Por eso el texto sale de
 * una función pura: la misma hoja sirve para los dos caminos y se prueba sin navegador.
 *
 * Reglas que fija este archivo: los números **no se recalculan** (llegan resueltos por la pantalla), no
 * se imprime una línea de descuento o propina en cero (ruido en un papel de 8 cm), una moneda distinta
 * a la del negocio se muestra con su código y un pedido sin cobros dice que se paga al retirar.
 */

const order: CustomerTicketOrder = {
  orderNumber: "P-1042",
  customerName: "Ana López",
  createdAt: "2026-09-18T14:05:00.000Z",
  items: [
    {
      name: "Taco de Birria",
      quantity: 3,
      unitPrice: 35,
      lineTotal: 105,
      notes: null,
      modifiers: [{ name: "Sin cebolla", priceDelta: 0 }],
    },
    {
      name: "Agua de Jamaica",
      quantity: 1,
      unitPrice: 25,
      lineTotal: 25,
      notes: "Sin hielo",
      modifiers: [],
    },
  ],
  subtotal: 130,
  discount: 0,
  packagingAmount: 10,
  tipAmount: 0,
  total: 140,
  payments: [{ methodLabel: "Efectivo", amount: 200, currency: "NIO" }],
  change: 60,
  pickupLocationName: "Camino de Oriente",
  pickupAddress: "Km 8 Carretera Masaya",
  pickupTime: "2026-09-18T14:35:00.000Z",
  pickupScheduled: true,
  notes: null,
};

const options = {
  businessName: "One Burger",
  timezone: "America/Managua",
  locale: "es-NI",
  currencyCode: "NIO",
  currencySymbol: "C$",
};

function text(overrides: Partial<typeof order> = {}): string {
  return buildCustomerTicketLines({ ...order, ...overrides }, options).join("\n");
}

describe("buildCustomerTicketLines", () => {
  it("encabeza con el negocio, el número de pedido y la fecha del local", () => {
    const lines = buildCustomerTicketLines(order, options);

    expect(lines[0]).toBe("ONE BURGER");
    expect(lines[1]).toBe("TICKET DE CLIENTE");
    expect(lines.join("\n")).toContain("Pedido P-1042");
    // 14:05 UTC son las 08:05 en Managua: la hora del papel es la del local.
    expect(lines.join("\n")).toContain("08:05");
  });

  it("imprime cada ítem con su cantidad, su precio y sus modificadores y notas", () => {
    const body = text();

    expect(body).toContain("3 x Taco de Birria");
    expect(body).toContain("C$105.00");
    expect(body).toContain("+ Sin cebolla");
    expect(body).toContain("1 x Agua de Jamaica");
    expect(body).toContain("! Sin hielo");
  });

  it("no imprime líneas de descuento o propina en cero", () => {
    const body = text();

    expect(body).toContain("Subtotal C$130.00");
    expect(body).toContain("Empaque C$10.00");
    expect(body).toContain("Total C$140.00");
    expect(body).not.toContain("Descuento");
    expect(body).not.toContain("Propina");
  });

  it("cuando hay descuento y propina, los imprime", () => {
    const body = text({ discount: 15, tipAmount: 20, total: 145 });

    expect(body).toContain("Descuento -C$15.00");
    expect(body).toContain("Propina C$20.00");
  });

  it("muestra con qué se pagó y el vuelto entregado", () => {
    const body = text();

    expect(body).toContain("Efectivo C$200.00");
    expect(body).toContain("Cambio C$60.00");
  });

  it("un cobro en otra moneda se imprime con su código, no con el símbolo local", () => {
    const body = text({
      payments: [{ methodLabel: "Tarjeta", amount: 4, currency: "USD" }],
      change: null,
    });

    expect(body).toContain("Tarjeta USD 4.00");
    expect(body).not.toContain("US$");
  });

  it("sin vuelto no imprime la línea de cambio", () => {
    expect(text({ change: 0 })).not.toContain("Cambio");
    expect(text({ change: null })).not.toContain("Cambio");
  });

  it("un pedido del checkout (sin cobros) dice que se paga al retirar", () => {
    const body = text({ payments: [], change: null });

    expect(body).toContain("Se paga al retirar");
    expect(body).not.toContain("Efectivo");
  });

  it("dice dónde y cuándo se retira, en la zona del negocio", () => {
    const body = text();

    expect(body).toContain("Retiro en Camino de Oriente");
    expect(body).toContain("Km 8 Carretera Masaya");
    expect(body).toContain("08:35");
  });

  it("sin hora elegida el retiro es lo antes posible", () => {
    expect(text({ pickupScheduled: false })).toContain("lo antes posible");
  });

  it("sin local resuelto no inventa el punto de retiro", () => {
    const body = text({ pickupLocationName: null, pickupAddress: null });

    expect(body).not.toContain("Retiro en");
    // La hora prometida sí va: es dato del pedido, no del local.
    expect(body).toContain("Retiro:");
  });

  it("el cliente del pedido aparece en el papel", () => {
    expect(text()).toContain("Ana López");
    expect(text({ customerName: "  " })).not.toContain("Cliente:");
  });

  it("usa el símbolo de la moneda configurada, no un `C$` escrito a mano", () => {
    const body = buildCustomerTicketLines(order, { ...options, currencySymbol: "US$" }).join("\n");

    expect(body).toContain("US$140.00");
    expect(body).not.toContain("C$");
  });

  it("sin precio unitario no inventa el `c/u` (la reimpresión no lo tiene)", () => {
    const body = text({
      items: [
        {
          name: "Taco de Birria",
          quantity: 3,
          unitPrice: null,
          lineTotal: 105,
          notes: null,
          modifiers: [],
        },
      ],
    });

    expect(body).toContain("3 x Taco de Birria");
    expect(body).not.toContain("c/u");
  });

  it("la nota del pedido viaja al papel cuando existe", () => {
    expect(text({ notes: "Sin servilletas" })).toContain("NOTA: Sin servilletas");
    expect(text()).not.toContain("NOTA:");
  });
});
