import { describe, expect, it } from "vitest";

import { buildReceiptTextLines, type ReceiptData } from "./receipt-image";

/**
 * TASK-307 — el texto del recibo.
 *
 * Es lo que el cliente se lleva: el número de pedido, qué se llevó, cuánto pagó y con qué. Se prueba
 * sin canvas (el dibujo se mide en el navegador) y con un formateador inyectado, porque el símbolo de
 * la moneda sale de la configuración del negocio y no del código.
 */

const money = (value: number) => `C$${value.toFixed(2)}`;

function receipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    businessName: "One Burger",
    businessCurrencyCode: "NIO",
    addressLine: "Camino de Oriente",
    phone: "+505 8781 0800",
    orderNumber: "P-ABC123",
    createdAtLabel: "14/9/2026 20:15",
    locationName: "Casa Antigua",
    customerName: "Cliente Mostrador",
    lines: [
      { name: "Taco de birria", quantity: 2, unitPrice: 35, lineTotal: 70 },
      { name: "Cola", quantity: 1, unitPrice: 25, lineTotal: 25 },
    ],
    subtotal: 95,
    packagingAmount: 10,
    discount: 0,
    deliveryFeeAmount: 0,
    tipAmount: 0,
    total: 105,
    payments: [{ methodLabel: "Efectivo", amount: 200, currency: "NIO" }],
    change: 95,
    ...overrides,
  };
}

describe("texto del recibo", () => {
  it("lleva el negocio, el pedido y el cliente", () => {
    const lines = buildReceiptTextLines(receipt(), money);

    expect(lines[0]).toBe("One Burger");
    expect(lines).toContain("Camino de Oriente");
    expect(lines).toContain("Tel. +505 8781 0800");
    expect(lines).toContain("Pedido P-ABC123");
    expect(lines).toContain("Retiro en Casa Antigua");
    expect(lines).toContain("Cliente: Cliente Mostrador");
  });

  it("detalla cada línea con su precio y su importe", () => {
    const lines = buildReceiptTextLines(receipt(), money);

    expect(lines).toContain("2 x Taco de birria");
    expect(lines).toContain("    C$35.00  C$70.00");
    expect(lines).toContain("1 x Cola");
    expect(lines).toContain("Subtotal C$95.00");
    expect(lines).toContain("Empaque C$10.00");
    expect(lines).toContain("TOTAL C$105.00");
  });

  it("muestra con qué pagó y el cambio", () => {
    const lines = buildReceiptTextLines(receipt(), money);

    expect(lines).toContain("Cobrado Efectivo C$200.00");
    expect(lines).toContain("Cambio C$95.00");
  });

  it("no imprime renglones vacíos de lo que no se usó", () => {
    const lines = buildReceiptTextLines(receipt({ tipAmount: 0, discount: 0 }), money);

    expect(lines.some((line) => line.startsWith("Propina"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Descuento"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Envio"))).toBe(false);
    // Sin cambio declarado no hay renglón de cambio.
    expect(buildReceiptTextLines(receipt({ change: null }), money).some((l) => l.startsWith("Cambio"))).toBe(false);
  });

  it("un cobro en otra moneda dice su código, no el símbolo del negocio", () => {
    const lines = buildReceiptTextLines(
      receipt({ payments: [{ methodLabel: "Efectivo", amount: 3, currency: "USD" }] }),
      money,
    );

    expect(lines).toContain("Cobrado Efectivo USD 3.00");
  });
});
