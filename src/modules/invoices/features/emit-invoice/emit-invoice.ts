import { canEmitInvoiceFor, type InvoiceRecord } from "../../domain/invoice";
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

/** Lo que el caso de uso necesita del pedido: sus montos, su estado y de qué sucursal salió. */
export type InvoiceOrderLookup = {
  id: string;
  status: string;
  customerName: string;
  /**
   * Punto 4 del roadmap (2026-09-18) — el cliente vinculado al pedido, si lo hay. La factura se emite
   * desde el detalle, donde el RUC que el cajero cargó en el POS no viaja en el body: se lee del cliente.
   */
  customerId?: string | null;
  locationId: string;
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  total: number;
};

/** La sucursal que va al documento, tal como está al emitir. */
export type InvoiceBranchSnapshot = {
  name: string;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
};

export type EmitInvoiceDependencies = {
  invoiceRepository: InvoiceRepository;
  findOrder: (orderId: string) => Promise<InvoiceOrderLookup | null>;
  countPayments: (orderId: string) => Promise<number>;
  /**
   * La sucursal del pedido. Se **congela** en el documento: una factura es un papel entregado y no puede
   * cambiar porque mañana se edite la dirección del local. Sin sucursal (o sin datos) el bloque no se
   * imprime; no se inventa.
   */
  findBranch?: (locationId: string) => Promise<InvoiceBranchSnapshot | null>;
  /**
   * Punto 4 del roadmap (2026-09-18) — **el respaldo de los datos fiscales del cliente**.
   *
   * La factura se emite desde el detalle del pedido, donde el RUC que el cajero cargó en el POS no viaja en
   * el body: lo que se conoce es el `customerId`. Sin esta lectura, la factura del POS saldría sin RUC
   * aunque el dato esté guardado en el cliente. Lo que la emisión manda explícito siempre gana.
   */
  findCustomer?: (customerId: string) => Promise<InvoiceCustomerLookup | null>;
  /** Los datos del negocio que van al documento (de la configuración, no hardcodeados). */
  business: {
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    /** Dirección fiscal: si está cargada, manda sobre la del negocio (son datos distintos). */
    taxAddress?: string | null;
    taxPhone?: string | null;
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

/** El cliente del pedido, reducido a lo que la factura necesita (Punto 4). */
export type InvoiceCustomerLookup = {
  legalName?: string | null;
  taxId?: string | null;
};

/**
 * Los datos fiscales que van al documento: lo que mandó la emisión y, si no vino, lo que el cliente tiene
 * guardado. **Sin combinar campos**: media factura de un lado y media del otro armaría un documento que
 * nadie pidió. Si la emisión no trae nada, se usan los dos del cliente; si trae algo, se respetan los suyos.
 */
function fiscalDataFor(input: {
  emitted?: { legalName?: string | null; taxId?: string | null } | null;
  stored?: InvoiceCustomerLookup | null;
}): { legalName: string | null; taxId: string | null } {
  const emittedLegalName = input.emitted?.legalName?.trim() ?? "";
  const emittedTaxId = input.emitted?.taxId?.trim() ?? "";

  if (emittedLegalName || emittedTaxId) {
    return {
      legalName: emittedLegalName || null,
      taxId: emittedTaxId || null,
    };
  }

  return {
    legalName: input.stored?.legalName?.trim() || null,
    taxId: input.stored?.taxId?.trim() || null,
  };
}

/** La dirección del documento: la línea y la ciudad, sin repetir el separador si falta una. */
function businessAddressOf(business: EmitInvoiceDependencies["business"]): string | null {
  const parts = [business.addressLine?.trim(), business.city?.trim()].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * La dirección que va al documento: la **fiscal** si está cargada (es la que el cliente espera ver en su
 * factura) y, si no, la del negocio. No se mezclan: una dirección fiscal a medias no es la del local.
 */
function documentAddressOf(business: EmitInvoiceDependencies["business"]): string | null {
  const taxAddress = business.taxAddress?.trim();

  return taxAddress ? taxAddress : businessAddressOf(business);
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

  const branch = deps.findBranch ? await deps.findBranch(order.locationId) : null;

  /**
   * Punto 4 — el RUC del cliente. Se lee del cliente vinculado **solo si la emisión no lo mandó**: el
   * detalle del pedido no tiene por qué saber que el POS ya lo cargó al cobrar.
   */
  const storedCustomer =
    order.customerId && deps.findCustomer ? await deps.findCustomer(order.customerId) : null;
  const fiscal = fiscalDataFor({ emitted: input.customer, stored: storedCustomer });

  /**
   * TASK-AUD-006 — el correlativo y el alta son **una** operación del repositorio: leer el último número y
   * después insertar no es atómico, y la emisión que perdía la carrera le fallaba al cajero. El repositorio
   * reintenta con el número siguiente y, si la carrera es por la factura de este mismo pedido, devuelve la
   * que ya existe (`reused`), igual que el camino secuencial de arriba.
   */
  const created = await deps.invoiceRepository.createNextForOrder({
    orderId: order.id,
    customerName: order.customerName,
    customerLegalName: fiscal.legalName,
    customerTaxId: fiscal.taxId,
    businessName: deps.business.name,
    businessLegalName: deps.business.legalName?.trim() || null,
    businessTaxId: deps.business.taxId?.trim() || null,
    businessAddress: documentAddressOf(deps.business),
    businessPhone: deps.business.taxPhone?.trim() || deps.business.phone?.trim() || null,
    // La sucursal, congelada: los datos del local al momento de entregar el documento.
    branchName: branch?.name ?? null,
    branchAddressLine: branch?.addressLine ?? null,
    branchCity: branch?.city ?? null,
    branchPhone: branch?.phone ?? null,
    branchWhatsapp: branch?.whatsapp ?? null,
    branchMapsUrl: branch?.mapsUrl ?? null,
    currencyCode: deps.business.currencyCode,
    subtotal: order.subtotal,
    discount: order.discount,
    packagingAmount: order.packagingAmount,
    deliveryFeeAmount: order.deliveryFeeAmount,
    tipAmount: order.tipAmount,
    total: order.total,
    issuedByUserId: input.actorUserId,
  });

  return created;
}
