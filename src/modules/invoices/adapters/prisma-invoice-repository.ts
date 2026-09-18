import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";

import type { InvoiceRecord } from "../domain/invoice";
import type { CreateInvoiceInput, InvoiceRepository } from "../ports/invoice-repository";

/**
 * Factura simple (2026-09-18) — el adaptador Prisma del documento.
 *
 * Los `Decimal` de la base se convierten a número al salir, como en el resto de los adaptadores de dinero.
 * El correlativo se lee de la factura **más nueva** (`orderBy: issuedAt desc`) y el `@unique` del número es
 * la red que evita dos documentos con el mismo número si dos emisiones coinciden.
 */
function toNumber(value: Decimal | null): number {
  return value === null ? 0 : Number(value.toString());
}

type InvoiceRow = {
  id: string;
  number: string;
  orderId: string;
  status: string;
  customerName: string;
  customerLegalName: string | null;
  customerTaxId: string | null;
  businessName: string;
  businessLegalName: string | null;
  businessTaxId: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  currencyCode: string;
  subtotal: Decimal;
  discount: Decimal;
  packagingAmount: Decimal;
  deliveryFeeAmount: Decimal;
  tipAmount: Decimal;
  total: Decimal;
  issuedAt: Date;
  issuedByUserId: string | null;
};

function mapInvoice(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    number: row.number,
    orderId: row.orderId,
    status: row.status === "voided" ? "voided" : "emitted",
    customerName: row.customerName,
    customerLegalName: row.customerLegalName,
    customerTaxId: row.customerTaxId,
    businessName: row.businessName,
    businessLegalName: row.businessLegalName,
    businessTaxId: row.businessTaxId,
    businessAddress: row.businessAddress,
    businessPhone: row.businessPhone,
    currencyCode: row.currencyCode,
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    packagingAmount: toNumber(row.packagingAmount),
    deliveryFeeAmount: toNumber(row.deliveryFeeAmount),
    tipAmount: toNumber(row.tipAmount),
    total: toNumber(row.total),
    issuedAt: row.issuedAt.toISOString(),
    issuedByUserId: row.issuedByUserId,
  };
}

export class PrismaInvoiceRepository implements InvoiceRepository {
  async findByOrderId(orderId: string): Promise<InvoiceRecord | null> {
    const row = await getPrismaClient().invoice.findUnique({ where: { orderId } });

    return row ? mapInvoice(row) : null;
  }

  async findLatestNumber(): Promise<string | null> {
    const row = await getPrismaClient().invoice.findFirst({
      orderBy: { issuedAt: "desc" },
      select: { number: true },
    });

    return row?.number ?? null;
  }

  async create(input: CreateInvoiceInput): Promise<InvoiceRecord> {
    const row = await getPrismaClient().invoice.create({
      data: {
        number: input.number,
        orderId: input.orderId,
        customerName: input.customerName,
        customerLegalName: input.customerLegalName,
        customerTaxId: input.customerTaxId,
        businessName: input.businessName,
        businessLegalName: input.businessLegalName,
        businessTaxId: input.businessTaxId,
        businessAddress: input.businessAddress,
        businessPhone: input.businessPhone,
        currencyCode: input.currencyCode,
        subtotal: input.subtotal,
        discount: input.discount,
        packagingAmount: input.packagingAmount,
        deliveryFeeAmount: input.deliveryFeeAmount,
        tipAmount: input.tipAmount,
        total: input.total,
        issuedByUserId: input.issuedByUserId,
      },
    });

    return mapInvoice(row);
  }
}
