import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";

import type { InvoiceRecord } from "../domain/invoice";
import type {
  CreateInvoiceInput,
  InvoiceRepository,
  ListInvoicesFilters,
  VoidInvoiceInput,
} from "../ports/invoice-repository";

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
  branchName: string | null;
  branchAddressLine: string | null;
  branchCity: string | null;
  branchPhone: string | null;
  branchWhatsapp: string | null;
  branchMapsUrl: string | null;
  currencyCode: string;
  subtotal: Decimal;
  discount: Decimal;
  packagingAmount: Decimal;
  deliveryFeeAmount: Decimal;
  tipAmount: Decimal;
  total: Decimal;
  issuedAt: Date;
  issuedByUserId: string | null;
  voidedAt: Date | null;
  voidedByUserId: string | null;
  voidReason: string | null;
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
    branchName: row.branchName,
    branchAddressLine: row.branchAddressLine,
    branchCity: row.branchCity,
    branchPhone: row.branchPhone,
    branchWhatsapp: row.branchWhatsapp,
    branchMapsUrl: row.branchMapsUrl,
    currencyCode: row.currencyCode,
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    packagingAmount: toNumber(row.packagingAmount),
    deliveryFeeAmount: toNumber(row.deliveryFeeAmount),
    tipAmount: toNumber(row.tipAmount),
    total: toNumber(row.total),
    issuedAt: row.issuedAt.toISOString(),
    issuedByUserId: row.issuedByUserId,
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    voidedByUserId: row.voidedByUserId,
    voidReason: row.voidReason,
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
        branchName: input.branchName,
        branchAddressLine: input.branchAddressLine,
        branchCity: input.branchCity,
        branchPhone: input.branchPhone,
        branchWhatsapp: input.branchWhatsapp,
        branchMapsUrl: input.branchMapsUrl,
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

  async findById(id: string): Promise<InvoiceRecord | null> {
    const row = await getPrismaClient().invoice.findUnique({ where: { id } });

    return row ? mapInvoice(row) : null;
  }

  /**
   * La lista del Historial. El alcance por sucursal se resuelve **en la consulta** (la factura cuelga del
   * pedido, que es el que tiene local): así un manager no puede traer las de otra sucursal ni pidiéndolas.
   */
  async list(filters: ListInvoicesFilters): Promise<InvoiceRecord[]> {
    const search = filters.search?.trim();

    const rows = await getPrismaClient().invoice.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.number ? { number: filters.number } : {}),
        ...(filters.customer
          ? { customerName: { contains: filters.customer, mode: "insensitive" as const } }
          : {}),
        ...(filters.issuedFrom || filters.issuedTo
          ? {
              issuedAt: {
                ...(filters.issuedFrom ? { gte: filters.issuedFrom } : {}),
                ...(filters.issuedTo ? { lte: filters.issuedTo } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { number: { contains: search, mode: "insensitive" as const } },
                { customerName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(filters.locationIds
          ? { order: { locationId: { in: [...filters.locationIds] } } }
          : {}),
      },
      orderBy: { issuedAt: "desc" },
      take: filters.limit ?? 100,
    });

    return rows.map(mapInvoice);
  }

  async void(id: string, input: VoidInvoiceInput): Promise<InvoiceRecord> {
    const row = await getPrismaClient().invoice.update({
      where: { id },
      data: {
        status: "voided",
        voidedAt: input.voidedAt,
        voidedByUserId: input.actorUserId,
        voidReason: input.reason,
      },
    });

    return mapInvoice(row);
  }
}
