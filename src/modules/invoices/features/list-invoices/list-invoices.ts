import type { InvoiceRecord, InvoiceStatus } from "../../domain/invoice";
import type { InvoiceRepository, ListInvoicesFilters } from "../../ports/invoice-repository";

/**
 * Punto 2 del roadmap (2026-09-18) — la lista de facturas del Historial.
 *
 * Es el caso de uso más delgado del módulo y aun así hace falta: deja los filtros en la forma que el
 * puerto espera (texto recortado, fechas como `Date`, estado que exista) **antes** de consultar. Un
 * filtro mal formado que viaja a la base vuelve como error, y esa pantalla ya se cayó una vez por eso.
 *
 * El alcance por sucursal (`locationIds`) lo resuelve la ruta con `resolveOrderLocationScope`: acá solo
 * viaja, incluido el `null` que significa «todas».
 */

export const INVOICE_LIST_DEFAULT_LIMIT = 100;
export const INVOICE_LIST_MAX_LIMIT = 200;

const INVOICE_STATUSES: readonly InvoiceStatus[] = ["emitted", "voided"];

export type ListInvoicesInput = {
  status?: unknown;
  search?: unknown;
  number?: unknown;
  customer?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  locationIds?: readonly string[] | null;
  limit?: unknown;
};

export type ListInvoicesDependencies = {
  invoiceRepository: Pick<InvoiceRepository, "list">;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function cleanStatus(value: unknown): InvoiceStatus | null {
  return INVOICE_STATUSES.includes(value as InvoiceStatus) ? (value as InvoiceStatus) : null;
}

function cleanDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) return INVOICE_LIST_DEFAULT_LIMIT;

  return Math.min(Math.floor(parsed), INVOICE_LIST_MAX_LIMIT);
}

export async function listInvoices(
  input: ListInvoicesInput,
  dependencies: ListInvoicesDependencies,
): Promise<InvoiceRecord[]> {
  const filters: ListInvoicesFilters = {
    status: cleanStatus(input.status),
    locationIds: input.locationIds ?? null,
    search: cleanText(input.search),
    number: cleanText(input.number),
    customer: cleanText(input.customer),
    issuedFrom: cleanDate(input.dateFrom),
    issuedTo: cleanDate(input.dateTo),
    limit: cleanLimit(input.limit),
  };

  return dependencies.invoiceRepository.list(filters);
}
