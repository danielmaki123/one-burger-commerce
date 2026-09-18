import { describe, expect, it, vi } from "vitest";

import { InvoiceError } from "../../domain/invoice-errors";
import type { InvoiceRecord } from "../../domain/invoice";
import type { CreateInvoiceInput, InvoiceRepository } from "../../ports/invoice-repository";
import { emitInvoice } from "./emit-invoice";

/**
 * Factura simple (2026-09-18) — emitir el documento de un pedido.
 *
 * Lo que se fija acá: se factura lo que **se cobró** (un pedido sin cobros o cancelado no se factura), una
 * sola factura por pedido (volver a pedirla devuelve la misma, no emite otra), el número es correlativo y
 * los datos del negocio y del cliente quedan **congelados** en el documento.
 */

const emitted: InvoiceRecord = {
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
  businessAddress: "Camino de Oriente",
  businessPhone: "+50588887777",
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

function repository(overrides: Partial<InvoiceRepository> = {}): {
  repository: InvoiceRepository;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async (input: CreateInvoiceInput) => ({ ...emitted, ...input }));

  return {
    create,
    repository: {
      findByOrderId: async () => null,
      findLatestNumber: async () => null,
      create,
      ...overrides,
    },
  };
}

const order = {
  id: "ord_01",
  orderNumber: "P-ABC123",
  status: "picked_up",
  customerName: "Ana",
  subtotal: 100,
  discount: 0,
  packagingAmount: 10,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  total: 110,
};

const business = {
  name: "One Burger",
  legalName: "One Burger S.A.",
  taxId: "J0310000000",
  addressLine: "Camino de Oriente",
  city: "Managua",
  phone: "+50588887777",
  currencyCode: "NIO",
};

describe("emitInvoice", () => {
  it("emite la factura de un pedido cobrado con los datos del negocio congelados", async () => {
    const { repository: invoiceRepository, create } = repository();

    const result = await emitInvoice(
      { orderId: "ord_01", actorUserId: "admin_1", customer: { legalName: "Ana S.A.", taxId: "J0310000001" } },
      { invoiceRepository, findOrder: async () => order, countPayments: async () => 1, business },
    );

    expect(result.reused).toBe(false);
    expect(result.invoice.number).toBe("F-000001");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        number: "F-000001",
        orderId: "ord_01",
        customerName: "Ana",
        customerLegalName: "Ana S.A.",
        customerTaxId: "J0310000001",
        businessLegalName: "One Burger S.A.",
        businessTaxId: "J0310000000",
        businessAddress: "Camino de Oriente, Managua",
        businessPhone: "+50588887777",
        currencyCode: "NIO",
        total: 110,
        issuedByUserId: "admin_1",
      }),
    );
  });

  it("sigue el correlativo de la última factura emitida", async () => {
    const { repository: invoiceRepository, create } = repository({
      findLatestNumber: async () => "F-000041",
    });

    await emitInvoice(
      { orderId: "ord_01", actorUserId: "admin_1" },
      { invoiceRepository, findOrder: async () => order, countPayments: async () => 1, business },
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ number: "F-000042" }));
  });

  it("si el pedido ya tiene factura, devuelve esa y no emite otra", async () => {
    const { repository: invoiceRepository, create } = repository({
      findByOrderId: async () => emitted,
    });

    const result = await emitInvoice(
      { orderId: "ord_01", actorUserId: "admin_1" },
      { invoiceRepository, findOrder: async () => order, countPayments: async () => 1, business },
    );

    expect(result.reused).toBe(true);
    expect(result.invoice.number).toBe("F-000001");
    expect(create).not.toHaveBeenCalled();
  });

  it("un pedido que no existe no se factura", async () => {
    const { repository: invoiceRepository } = repository();

    await expect(
      emitInvoice(
        { orderId: "ord_99", actorUserId: "admin_1" },
        { invoiceRepository, findOrder: async () => null, countPayments: async () => 0, business },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("un pedido sin cobros no se factura: primero se cobra", async () => {
    const { repository: invoiceRepository, create } = repository();

    await expect(
      emitInvoice(
        { orderId: "ord_01", actorUserId: "admin_1" },
        { invoiceRepository, findOrder: async () => order, countPayments: async () => 0, business },
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("cobro") });

    expect(create).not.toHaveBeenCalled();
  });

  it("un pedido cancelado no se factura", async () => {
    const { repository: invoiceRepository, create } = repository();

    await expect(
      emitInvoice(
        { orderId: "ord_01", actorUserId: "admin_1" },
        {
          invoiceRepository,
          findOrder: async () => ({ ...order, status: "cancelled" }),
          countPayments: async () => 1,
          business,
        },
      ),
    ).rejects.toBeInstanceOf(InvoiceError);

    expect(create).not.toHaveBeenCalled();
  });

  it("sin datos del negocio cargados el documento sale con lo que hay, sin inventar", async () => {
    const { repository: invoiceRepository, create } = repository();

    await emitInvoice(
      { orderId: "ord_01", actorUserId: "admin_1" },
      {
        invoiceRepository,
        findOrder: async () => order,
        countPayments: async () => 1,
        business: { ...business, legalName: null, taxId: null, addressLine: null, city: null },
      },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessLegalName: null,
        businessTaxId: null,
        businessAddress: null,
      }),
    );
  });
});
