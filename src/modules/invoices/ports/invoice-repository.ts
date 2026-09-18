import type { InvoiceRecord } from "../domain/invoice";

/**
 * Factura simple (2026-09-18) — lo que el módulo necesita guardar y leer.
 *
 * Tres operaciones y ninguna más: buscar la del pedido (para no emitir dos), leer la **última** emitida
 * (para el correlativo) y crear. El puerto no sabe de pedidos ni de configuración: eso lo resuelve el caso
 * de uso con sus otras dependencias.
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
  currencyCode: string;
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  total: number;
  issuedByUserId: string | null;
};

export interface InvoiceRepository {
  findByOrderId(orderId: string): Promise<InvoiceRecord | null>;
  /** El número de la factura más nueva (el correlativo se arma con él). */
  findLatestNumber(): Promise<string | null>;
  create(input: CreateInvoiceInput): Promise<InvoiceRecord>;
}
