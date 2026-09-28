/**
 * Factura simple (2026-09-18) — las reglas del documento, sin base ni HTTP.
 *
 * **No es una factura fiscal**: no hay autorización de la DGI, ni rango oficial de numeración, ni
 * impuestos discriminados. Es el papel que el cliente se lleva con lo que compró, lo que pagó y los datos
 * del negocio, y los datos fiscales del cliente (razón social y RUC) se guardan **tal como los dio**.
 *
 * Tres reglas que sí importan:
 *
 * 1. **Se factura lo que se cobró**: un pedido sin ningún cobro no se factura (primero se cobra) y uno
 *    cancelado tampoco. La factura no es una promesa de pago, es el comprobante de uno.
 * 2. **Una sola factura por pedido** (`orderId` es único): si el cliente la pide de nuevo, se le vuelve a
 *    imprimir la misma, no se emite otra.
 * 3. **El número es correlativo y legible** (`F-000001`): es lo que el cliente cita si reclama, así que no
 *    puede ser un UUID ni un número que se repita.
 */

export type InvoiceStatus = "emitted" | "voided";

/** El documento tal como quedó emitido: todo lo que se imprime, congelado. */
export type InvoiceRecord = {
  id: string;
  number: string;
  orderId: string;
  status: InvoiceStatus;
  customerName: string;
  customerLegalName: string | null;
  customerTaxId: string | null;
  businessName: string;
  businessLegalName: string | null;
  businessTaxId: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  /**
   * Sucursal de retiro **al emitir** (2026-09-18). Se congela como el resto del documento: si mañana se
   * edita la dirección del local, una factura ya entregada tiene que seguir mostrando la que existía.
   * `null` en las facturas emitidas antes de este bloque (salen sin bloque de sucursal).
   */
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
  issuedAt: string;
  issuedByUserId: string | null;
  /**
   * Anulación (Punto 2 del roadmap, 2026-09-18): **soft delete**. El documento no se borra —puede estar
   * en la mano del cliente—, se marca como anulado con cuándo, quién y el motivo de la lista cerrada.
   */
  voidedAt: string | null;
  voidedByUserId: string | null;
  voidReason: string | null;
};

/** Prefijo del número: `F` de factura simple. */
export const INVOICE_NUMBER_PREFIX = "F";

/** Ancho del correlativo: seis dígitos, para que los números se lean y se ordenen igual. */
const INVOICE_NUMBER_WIDTH = 6;

function parseInvoiceSequence(previous: string | null): number {
  const match = /^F-(\d+)$/.exec((previous ?? "").trim());

  return match ? Number(match[1]) : 0;
}

/** El número de la factura que sigue: correlativo y con el mismo ancho siempre. */
export function nextInvoiceNumber(previous: string | null): string {
  const sequence = parseInvoiceSequence(previous) + 1;

  return `${INVOICE_NUMBER_PREFIX}-${String(sequence).padStart(INVOICE_NUMBER_WIDTH, "0")}`;
}

export type InvoiceEmissionCheck =
  | { ok: true }
  | { ok: false; reason: "not-paid" | "cancelled"; message: string };

/** El estado financiero canónico del pedido, tal como lo proyecta `payments` (`D-016`). */
export type InvoicePaymentStatus = "pending" | "partial" | "paid";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-021`) — **la factura exige `paid` estricto**.
 *
 * Antes la puerta era `hasPayments` (`countPayments(...) > 0`, un **conteo de filas**): un pedido de C$365
 * con un solo cobro de C$100 **facturaba**, y el documento congelaba `total: 365` como si estuviera pagado.
 * Contar cobros no es saber si el pedido está cobrado.
 *
 * La definición de «pagado» es de `payments`, no de este módulo: acá se **consume** el estado canónico y se
 * exige el valor exacto. Tres consecuencias, y las tres son deliberadas:
 *
 * 1. **`pending` y `partial` no facturan.** Un abono, si algún día hay que documentarlo, es **otro tipo de
 *    documento**, no una factura parcial.
 * 2. **No hay excepción por autorización.** El `owner` que emite sigue pasando por acá: ningún rol convierte
 *    un saldo pendiente en un documento. Es la regla que `D-021` congeló.
 * 3. **Un saldo que no se puede demostrar no factura.** Un cobro legacy sin snapshot deja
 *    `unresolvedAmount > 0`, el pedido **nunca** alcanza `paid`, y por lo tanto no hay factura: no es una
 *    excepción, es un dato que falta (`D-020`).
 *
 * Rige **hacia adelante**: las facturas ya emitidas bajo la regla vieja no se re-emiten ni se anulan.
 */
export function canEmitInvoiceFor(input: {
  status: string;
  paymentStatus: InvoicePaymentStatus;
}): InvoiceEmissionCheck {
  if (input.status === "cancelled") {
    return {
      ok: false,
      reason: "cancelled",
      message: "Ese pedido está cancelado: no se le puede emitir una factura.",
    };
  }

  if (input.paymentStatus === "pending") {
    return {
      ok: false,
      reason: "not-paid",
      message: "Ese pedido todavía no tiene ningún cobro: cobralo y volvé a intentar.",
    };
  }

  if (input.paymentStatus === "partial") {
    return {
      ok: false,
      reason: "not-paid",
      message: "Ese pedido tiene un cobro parcial: la factura sale cuando el saldo esté en cero.",
    };
  }

  return { ok: true };
}
