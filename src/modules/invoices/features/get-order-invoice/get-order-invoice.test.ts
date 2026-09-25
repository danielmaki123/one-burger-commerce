import { describe, expect, it, vi } from "vitest";

import { getOrderInvoice } from "./get-order-invoice";
import type { InvoiceRepository } from "../../ports/invoice-repository";

/**
 * Factura simple (2026-09-18) — leer la factura de un pedido (o saber que todavía no hay).
 *
 * La pantalla del pedido necesita las dos cosas: la factura emitida (para mostrarla e imprimirla) y
 * saber que **todavía no hay ninguna** (para ofrecer emitirla). Un pedido que no existe sigue siendo 404.
 */

const invoiceRepository = (overrides: Partial<InvoiceRepository> = {}): InvoiceRepository => ({
  findByOrderId: async () => null,
  findLatestNumber: async () => null,
  // TASK-AUD-006: el puerto asigna el correlativo y crea en una sola operación; acá no se emite.
  createNextForOrder: async () => {
    throw new Error("este test no emite facturas");
  },
  create: vi.fn(),
  // El puerto se implementa completo: consultar una factura no lista ni anula.
  findById: async () => null,
  list: async () => [],
  void: async () => {
    throw new Error("consultar no anula");
  },
  ...overrides,
});

describe("getOrderInvoice", () => {
  it("sin factura devuelve null (todavía no se emitió)", async () => {
    const result = await getOrderInvoice(
      { orderId: "ord_01" },
      { invoiceRepository: invoiceRepository(), findOrder: async () => ({ id: "ord_01" }) },
    );

    expect(result).toBeNull();
  });

  it("con factura devuelve el documento emitido", async () => {
    const result = await getOrderInvoice(
      { orderId: "ord_01" },
      {
        invoiceRepository: invoiceRepository({
          findByOrderId: async () => ({
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
            packagingAmount: 0,
            deliveryFeeAmount: 0,
            tipAmount: 0,
            total: 100,
            issuedAt: "2026-09-18T15:00:00.000Z",
            issuedByUserId: "admin_1",
            voidedAt: null,
            voidedByUserId: null,
            voidReason: null,
          }),
        }),
        findOrder: async () => ({ id: "ord_01" }),
      },
    );

    expect(result?.number).toBe("F-000001");
  });

  it("un pedido que no existe es 404 (no se inventa una factura vacía)", async () => {
    await expect(
      getOrderInvoice(
        { orderId: "ord_99" },
        { invoiceRepository: invoiceRepository(), findOrder: async () => null },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
