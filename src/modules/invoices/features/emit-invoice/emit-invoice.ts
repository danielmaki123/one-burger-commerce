import { canEmitInvoiceFor, nextInvoiceNumber, type InvoiceRecord } from "../../domain/invoice";
import { InvoiceError } from "../../domain/invoice-errors";
import type { InvoiceRepository } from "../../ports/invoice-repository";

/**
 * Factura simple (2026-09-18) — emitir el documento de un pedido.
 *
 * **No es una factura fiscal**: no hay autorización de la DGI ni rango oficial. Es el papel que el cliente
 * se lleva, y por eso:
 *
 * 1. **Se factura lo que se cobró.** Un pedido sin ningún cobro no se factura (primero se cobra) y uno
 *    cancelado tampoco: la factura no es una promesa de pago, es el comprobante de uno.
 * 2. **Una sola factura por pedido.** Volver a pedirla devuelve la misma (y la pantalla la vuelve a
 *    imprimir): emitir otra sería dos documentos del mismo cobro.
 * 3. **Todo queda congelado.** Los datos del negocio y del cliente se copian al emitir, igual que el arqueo
 *    de un turno: cambiar el RUC mañana no puede reescribir un papel que ya está en la mano del cliente.
 */

export type EmitInvoiceInput = {
  orderId: string;
  /** Quién entrega el documento (queda asentado en la factura). */
  actorUserId: string;
  /** Datos fiscales del cliente **tal como los dio**. Sin ellos, la factura va a nombre del cliente. */
  customer?: { legalName?: string | null; taxId?: string | null } | null;
};

/** Lo que el caso de uso necesita del pedido: sus montos y su estado. */
export type InvoiceOrderLookup = {
  id: string;
  status: string;
  customerName: string;
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  total: number;
};

export type EmitInvoiceDependencies = {
  invoiceRepository: InvoiceRepository;
  findOrder: (orderId: string) => Promise<InvoiceOrderLookup | null>;
  countPayments: (orderId: string) => Promise<number>;
  /** Los datos del negocio que van al documento (de la configuración, no hardcodeados). */
  business: {
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    addressLine?: string | null;
    city?: string | null;
    phone?: string | null;
    currencyCode: string;
  };
};

export type EmitInvoiceResult = {
  invoice: InvoiceRecord;
  /** `true` cuando el pedido ya tenía factura: no se emitió otra. */
  reused: boolean;
};

/** La dirección del documento: la línea y la ciudad, sin repetir el separador si falta una. */
function businessAddressOf(business: EmitInvoiceDependencies["business"]): string | null {
  const parts = [business.addressLine?.trim(), business.city?.trim()].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

export async function emitInvoice(
  input: EmitInvoiceInput,
  deps: EmitInvoiceDependencies,
): Promise<EmitInvoiceResult> {
  const existing = await deps.invoiceRepository.findByOrderId(input.orderId);
  if (existing) {
    return { invoice: existing, reused: true };
  }

  const order = await deps.findOrder(input.orderId);
  if (!order) {
    throw new InvoiceError(404, "NOT_FOUND", "Ese pedido no existe.", {
      order: "Ese pedido no existe.",
    });
  }

  const check = canEmitInvoiceFor({
    status: order.status,
    hasPayments: (await deps.countPayments(input.orderId)) > 0,
  });
  if (!check.ok) {
    throw new InvoiceError(409, "CONFLICT", check.message, { invoice: check.message });
  }

  const invoice = await deps.invoiceRepository.create({
    number: nextInvoiceNumber(await deps.invoiceRepository.findLatestNumber()),
    orderId: order.id,
    customerName: order.customerName,
    customerLegalName: input.customer?.legalName?.trim() || null,
    customerTaxId: input.customer?.taxId?.trim() || null,
    businessName: deps.business.name,
    businessLegalName: deps.business.legalName?.trim() || null,
    businessTaxId: deps.business.taxId?.trim() || null,
    businessAddress: businessAddressOf(deps.business),
    businessPhone: deps.business.phone?.trim() || null,
    currencyCode: deps.business.currencyCode,
    subtotal: order.subtotal,
    discount: order.discount,
    packagingAmount: order.packagingAmount,
    deliveryFeeAmount: order.deliveryFeeAmount,
    tipAmount: order.tipAmount,
    total: order.total,
    issuedByUserId: input.actorUserId,
  });

  return { invoice, reused: false };
}
