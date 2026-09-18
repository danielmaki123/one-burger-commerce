// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

import InvoicePrintSheet from "./invoice-print-sheet";

/**
 * Factura simple (2026-09-18) — la hoja A4 del documento (rediseño).
 *
 * Lo que se fija acá es lo que el cliente ve en el papel: el logo del negocio, su razón social y su RUC, la
 * sucursal de retiro (congelada en la factura), el detalle, el total destacado, **cómo pagó** (efectivo con
 * su vuelto, o el detalle de un cobro partido) y el pie que aclara que no es un documento fiscal. Y lo que
 * **no** sale: una línea que no tiene dato no se imprime ni se inventa.
 */

afterEach(cleanup);

const invoice: InvoiceRecord = {
  id: "inv_01",
  number: "F-000003",
  orderId: "ord_01",
  status: "emitted",
  customerName: "Ana",
  customerLegalName: null,
  customerTaxId: null,
  businessName: "One Burger",
  businessLegalName: "One Burger S.A.",
  businessTaxId: "J0310000123456",
  businessAddress: "Camino de Oriente, Managua",
  businessPhone: "+50588770888",
  branchName: "Camino de Oriente",
  branchAddressLine: "Km 8 Carretera Sur",
  branchCity: "Managua",
  branchPhone: "+50522223333",
  branchWhatsapp: "50588887777",
  branchMapsUrl: "https://maps.google.com/?q=camino",
  currencyCode: "NIO",
  subtotal: 70,
  discount: 0,
  packagingAmount: 0,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  total: 70,
  issuedAt: "2026-09-18T12:35:00.000Z",
  issuedByUserId: "admin_1",
};

const items = [
  { name: "Taco de birria", quantity: 2, unitPrice: 35, lineTotal: 70, modifiers: [], notes: null },
];

const currency = {
  symbol: DEFAULT_BUSINESS_SETTINGS.currencySymbol,
  locale: DEFAULT_BUSINESS_SETTINGS.locale,
};

function renderSheet(props: Partial<Parameters<typeof InvoicePrintSheet>[0]> = {}) {
  return render(
    <InvoicePrintSheet
      invoice={invoice}
      orderNumber="P-ABC123"
      items={items}
      payments={[
        { method: "cash", amount: 100, currency: "NIO", changeAmount: 30, tip: 0 },
      ]}
      logoUrl="/brand/one-burger-logo.svg"
      businessCurrencyCode="NIO"
      currency={currency}
      {...props}
    />,
  );
}

describe("InvoicePrintSheet", () => {
  it("lleva el logo del negocio, su razón social y su RUC", () => {
    renderSheet();

    expect(document.querySelector("img")?.getAttribute("src")).toBe("/brand/one-burger-logo.svg");
    expect(screen.getByText("One Burger S.A.")).toBeTruthy();
    expect(screen.getByText("RUC J0310000123456")).toBeTruthy();
    expect(screen.getByText("Camino de Oriente, Managua")).toBeTruthy();
  });

  it("sin logo ni isotipo queda el nombre del negocio (no un hueco)", () => {
    renderSheet({ logoUrl: null });

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByText("One Burger").length).toBeGreaterThan(0);
  });

  it("dice el número, la fecha y a quién le factura", () => {
    renderSheet();

    expect(screen.getByText(/No\. F-000003/)).toBeTruthy();
    expect(screen.getByText("Cliente")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("muestra la sucursal de retiro congelada, con su dirección y su teléfono", () => {
    renderSheet();

    expect(screen.getByText("Sucursal de retiro")).toBeTruthy();
    expect(screen.getByText("Camino de Oriente")).toBeTruthy();
    expect(screen.getByText("Km 8 Carretera Sur")).toBeTruthy();
    expect(screen.getByText("Managua")).toBeTruthy();
    expect(screen.getByText("Tel. +50522223333")).toBeTruthy();
    expect(screen.getByText("https://maps.google.com/?q=camino")).toBeTruthy();
  });

  it("una factura vieja (sin sucursal) sale sin el bloque, no con un bloque vacío", () => {
    renderSheet({
      invoice: {
        ...invoice,
        branchName: null,
        branchAddressLine: null,
        branchCity: null,
        branchPhone: null,
        branchWhatsapp: null,
        branchMapsUrl: null,
      },
    });

    expect(screen.queryByText("Sucursal de retiro")).toBeNull();
  });

  it("detalla los productos y destaca el total", () => {
    renderSheet();

    expect(screen.getByText("Taco de birria")).toBeTruthy();
    expect(screen.getByText("Producto")).toBeTruthy();
    expect(screen.getByText("Importe")).toBeTruthy();
    expect(screen.getByText("TOTAL")).toBeTruthy();
    // El total de la factura, formateado con la moneda del negocio.
    expect(screen.getAllByText(/C\$70\.00/).length).toBeGreaterThanOrEqual(2);
  });

  it("en efectivo dice con cuánto pagó y el vuelto", () => {
    renderSheet();

    expect(screen.getByText(/Pagó con/)).toBeTruthy();
    expect(screen.getByText(/Vuelto/)).toBeTruthy();
  });

  it("un cobro partido lista cada medio con su monto (y no inventa un vuelto)", () => {
    renderSheet({
      payments: [
        { method: "cash", amount: 40, currency: "NIO", changeAmount: 0, tip: 0 },
        { method: "transfer", amount: 30, currency: "NIO", changeAmount: 0, tip: 0 },
      ],
    });

    expect(screen.getByText(/Efectivo/)).toBeTruthy();
    expect(screen.getByText(/Transferencia/)).toBeTruthy();
    expect(screen.queryByText(/Vuelto/)).toBeNull();
  });

  it("una propina se imprime como línea aparte", () => {
    renderSheet({ invoice: { ...invoice, tipAmount: 10, total: 80 } });

    expect(screen.getAllByText("Propina").length).toBeGreaterThanOrEqual(1);
  });

  it("el pie aclara que no es un documento fiscal y lleva el número de pedido", () => {
    renderSheet();

    expect(screen.getByText("Documento no fiscal.")).toBeTruthy();
    expect(screen.getByText(/P-ABC123/)).toBeTruthy();
  });
});
