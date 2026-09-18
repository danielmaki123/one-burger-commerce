import type { InvoiceRecord, InvoiceStatus } from "../domain/invoice";

/**
 * Factura simple (2026-09-18) — lo que el módulo necesita guardar y leer.
 *
 * Emitir necesita tres operaciones: buscar la del pedido (para no emitir dos), leer la **última**
 * emitida (para el correlativo) y crear. El Historial (Punto 2) sumó las tres de consulta: la lista
 * filtrada, una factura por id y la anulación —que **no borra**: marca.
 */
export type CreateInvoiceInput = {
  number: string;
  orderId: string;
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
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  total: number;
  issuedByUserId: string | null;
};

/**
 * Los filtros del Historial › Facturas (Punto 2, 2026-09-18).
 *
 * `locationIds` es el **alcance** de quien mira (`null` = todas las sucursales): un manager solo ve las
 * facturas de las suyas. Los datos de fecha llegan ya normalizados por el caso de uso.
 */
export type ListInvoicesFilters = {
  status?: InvoiceStatus | null;
  locationIds?: readonly string[] | null;
  /** Busca en el número y en el nombre del cliente a la vez (el buscador de la pantalla). */
  search?: string | null;
  /** Número correlativo puntual (`F-000012`). */
  number?: string | null;
  customer?: string | null;
  issuedFrom?: Date | null;
  issuedTo?: Date | null;
  limit?: number;
};

export type VoidInvoiceInput = {
  reason: string;
  actorUserId: string;
  voidedAt: Date;
};

export interface InvoiceRepository {
  findByOrderId(orderId: string): Promise<InvoiceRecord | null>;
  /** El número de la factura más nueva (el correlativo se arma con él). */
  findLatestNumber(): Promise<string | null>;
  create(input: CreateInvoiceInput): Promise<InvoiceRecord>;
  findById(id: string): Promise<InvoiceRecord | null>;
  /** Las facturas del Historial, de la más nueva a la más vieja. */
  list(filters: ListInvoicesFilters): Promise<InvoiceRecord[]>;
  /** Anular **no borra**: marca la factura con cuándo, quién y por qué. */
  void(id: string, input: VoidInvoiceInput): Promise<InvoiceRecord>;
}
