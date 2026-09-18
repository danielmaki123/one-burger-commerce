import { describe, expect, it } from "vitest";

import {
  canEmitInvoiceFor,
  nextInvoiceNumber,
  type InvoiceRecord,
} from "./invoice";

/**
 * Factura simple (2026-09-18) — las reglas del documento, sin base ni HTTP.
 *
 * **No es una factura fiscal**: es el papel que el cliente se lleva con lo que compró, lo que pagó y los
 * datos del negocio. Tres reglas que sí importan: se factura lo que **se cobró** (no un pedido sin pagar ni
 * uno cancelado), hay **una sola** factura por pedido y el número es correlativo y legible —es lo que el
 * cliente cita si reclama—.
 */

const invoice: InvoiceRecord = {
  id: "inv_01",
  number: "F-000001",
  orderId: "ord_01",
  status: "emitted",
  customerName: "Ana",
  customerLegalName: null,
  customerTaxId: null,
  businessName: "One Burger",
  businessLegalName: null,
  businessTaxId: null,
  businessAddress: null,
  businessPhone: null,
  branchName: null,
  branchAddressLine: null,
  branchCity: null,
  branchPhone: null,
  branchWhatsapp: null,
  branchMapsUrl: null,
  currencyCode: "NIO",
  subtotal: 100,
  discount: 0,
  packagingAmount: 10,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  total: 110,
  issuedAt: "2026-09-18T15:00:00.000Z",
  issuedByUserId: "admin_1",
};

describe("nextInvoiceNumber", () => {
  it("la primera factura arranca en F-000001", () => {
    expect(nextInvoiceNumber(null)).toBe("F-000001");
  });

  it("sigue el correlativo de la última", () => {
    expect(nextInvoiceNumber("F-000001")).toBe("F-000002");
    expect(nextInvoiceNumber("F-000041")).toBe("F-000042");
  });

  it("un número ilegible no rompe la numeración: se sigue desde el que se pueda leer", () => {
    expect(nextInvoiceNumber("borrador")).toBe("F-000001");
    expect(nextInvoiceNumber("F-abc")).toBe("F-000001");
  });

  it("no pierde el ancho al pasar de 999", () => {
    expect(nextInvoiceNumber("F-000999")).toBe("F-001000");
  });
});

describe("canEmitInvoiceFor", () => {
  it("un pedido cobrado se factura", () => {
    expect(canEmitInvoiceFor({ status: "picked_up", hasPayments: true })).toEqual({ ok: true });
  });

  it("un pedido sin cobros no se factura: primero se cobra", () => {
    const result = canEmitInvoiceFor({ status: "new", hasPayments: false });

    expect(result).toEqual({
      ok: false,
      reason: "not-paid",
      message: "Ese pedido todavía no tiene ningún cobro: cobralo y volvé a intentar.",
    });
  });

  it("un pedido cancelado no se factura", () => {
    const result = canEmitInvoiceFor({ status: "cancelled", hasPayments: true });

    expect(result).toEqual({
      ok: false,
      reason: "cancelled",
      message: "Ese pedido está cancelado: no se le puede emitir una factura.",
    });
  });

  it("la factura emitida no se edita: los datos quedan congelados", () => {
    expect(invoice.status).toBe("emitted");
  });
});
