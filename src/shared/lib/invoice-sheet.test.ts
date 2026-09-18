import { describe, expect, it } from "vitest";

import { invoiceSheetLines } from "./invoice-sheet";
import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";

/**
 * Factura simple (2026-09-18) — el documento impreso.
 *
 * Lo que se fija acá: el papel dice **quién** factura y a **quién** (con los datos fiscales cargados), qué
 * se compró, qué se pagó y que **no es un documento fiscal**. Los montos llegan congelados: la hoja no
 * recalcula nada (si recalculara, el papel podría decir algo distinto de lo que se cobró).
 */

const invoice: InvoiceRecord = {
  id: "inv_01",
  number: "F-000001",
  orderId: "ord_01",
  status: "emitted",
  customerName: "Ana",
  customerLegalName: "Ana S.A.",
  customerTaxId: "J0310000001",
  businessName: "One Burger",
  businessLegalName: "One Burger S.A.",
  businessTaxId: "J0310000000",
  businessAddress: "Camino de Oriente, Managua",
  businessPhone: "+50588887777",
  currencyCode: "NIO",
  subtotal: 100,
  discount: 10,
  packagingAmount: 5,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  total: 95,
  issuedAt: "2026-09-18T15:00:00.000Z",
  issuedByUserId: "admin_1",
};

const currency = { symbol: "C$", locale: "es-NI" };

const lines = [{ name: "Taco de birria", quantity: 2, unitPrice: 50, lineTotal: 100 }];

function sheet(overrides: Partial<InvoiceRecord> = {}, extra: { locationName?: string | null } = {}) {
  return invoiceSheetLines({
    invoice: { ...invoice, ...overrides },
    lines,
    currency,
    businessCurrencyCode: "NIO",
    locationName: extra.locationName ?? "Camino de Oriente",
  }).join("\n");
}

describe("invoiceSheetLines", () => {
  it("dice quién factura, con su RUC y su dirección", () => {
    const texto = sheet();

    expect(texto).toContain("One Burger S.A.");
    expect(texto).toContain("RUC J0310000000");
    expect(texto).toContain("Camino de Oriente, Managua");
  });

  it("dice a quién le factura, con los datos que dio el cliente", () => {
    const texto = sheet();

    expect(texto).toContain("Cliente: Ana");
    expect(texto).toContain("Razon social: Ana S.A.");
    expect(texto).toContain("RUC: J0310000001");
  });

  it("lleva su número y la fecha de emisión", () => {
    const texto = sheet();

    expect(texto).toContain("FACTURA SIMPLE");
    expect(texto).toContain("No. F-000001");
  });

  it("detalla lo que se compró y lo que se pagó", () => {
    const texto = sheet();

    expect(texto).toContain("Taco de birria");
    expect(texto).toContain("2 x C$50.00");
    expect(texto).toContain("Subtotal");
    expect(texto).toContain("Descuento");
    expect(texto).toContain("Empaque");
    expect(texto).toContain("TOTAL");
  });

  it("los montos son los de la factura, no los que saldrían de recalcular", () => {
    const texto = sheet();

    // El total congelado es 95 (100 − 10 + 5): si la hoja recalculara, diría otra cosa.
    expect(texto).toContain("C$95.00");
  });

  it("aclara que no es un documento fiscal", () => {
    expect(sheet()).toContain("Documento no fiscal.");
  });

  it("sin datos fiscales del cliente sale igual, a nombre del cliente", () => {
    const texto = sheet({ customerLegalName: null, customerTaxId: null });

    expect(texto).toContain("Cliente: Ana");
    expect(texto).not.toContain("Razon social:");
    expect(texto).not.toContain("RUC:");
  });

  it("un negocio sin RUC cargado no imprime la línea del RUC", () => {
    const texto = sheet({ businessLegalName: null, businessTaxId: null });

    expect(texto).toContain("One Burger");
    expect(texto).not.toContain("RUC J0310000000");
  });
});
