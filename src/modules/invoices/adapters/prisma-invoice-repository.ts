import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";

import { nextInvoiceNumber, type InvoiceRecord } from "../domain/invoice";
import type {
  CreateInvoiceInput,
  InvoiceRepository,
  ListInvoicesFilters,
  VoidInvoiceInput,
} from "../ports/invoice-repository";

/** `true` cuando la base rechazó la escritura por un índice único (`P2002`). */
function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Los campos del índice único que rechazó la escritura (`["number"]`, `["orderId"]`). */
function uniqueFields(error: unknown): string[] {
  const target = (error as { meta?: { target?: unknown } }).meta?.target;

  return Array.isArray(target) ? target.map(String) : [];
}

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

  /**
   * TASK-AUD-006 — el correlativo y el alta, como una operación que **sabe perder una carrera**.
   *
   * El número sale de leer el último y sumar uno: dos emisiones simultáneas calculan el mismo, y el índice
   * único `Invoice.number` deja pasar una sola. Antes, la que perdía devolvía un error al cajero y el pedido
   * quedaba sin factura (aunque el reintento manual funcionaba). Acá se **vuelve a intentar** con el número
   * siguiente —leyendo otra vez el último, que ya cambió— y el choque del `orderId` (la misma factura pedida
   * dos veces) se resuelve devolviendo la que ya existe, que es lo que hace el camino secuencial.
   *
   * El tope de intentos es explícito: con más de cinco emisiones simultáneas sobre el mismo correlativo, el
   * error sale tal cual en vez de reintentar para siempre (y queda anotado en el backlog que la salida
   * siguiente es una secuencia o un lock de asesoría).
   */
  async createNextForOrder(
    input: Omit<CreateInvoiceInput, "number">,
  ): Promise<{ invoice: InvoiceRecord; reused: boolean }> {
    const intentosMaximos = 5;
    let ultimoError: unknown = null;

    for (let intento = 0; intento < intentosMaximos; intento += 1) {
      try {
        const invoice = await this.create({
          ...input,
          number: nextInvoiceNumber(await this.findLatestNumber()),
        });

        return { invoice, reused: false };
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;

        ultimoError = error;

        // El choque es de la **factura de este pedido** (dos emisiones del mismo documento): la que ya
        // existe es la respuesta, igual que en el camino secuencial.
        if (uniqueFields(error).includes("orderId")) {
          const existing = await this.findByOrderId(input.orderId);
          if (existing) return { invoice: existing, reused: true };
        }
      }
    }

    throw ultimoError;
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
