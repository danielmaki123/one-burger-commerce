/**
 * Anulación de una factura (Punto 2 del roadmap, 2026-09-18) — el motivo, que es la mitad del dato.
 *
 * Un documento entregado **no se borra**: se marca como anulado (`voidedAt` / `voidedByUserId` /
 * `voidReason`) y queda el asiento en el log de acciones sensibles. El motivo sale de una lista cerrada
 * porque «cualquier cosa que explique por qué» no se puede agrupar seis meses después; solo `otro` pide
 * que alguien lo escriba con sus palabras, y ese texto viaja en el detalle del asiento.
 */

export const INVOICE_VOID_REASONS = [
  "error_emision",
  "devolucion_cliente",
  "cancelacion_pedido",
  "correccion_datos",
  "otro",
] as const;

export type InvoiceVoidReason = (typeof INVOICE_VOID_REASONS)[number];

const VOID_REASON_LABELS: Record<InvoiceVoidReason, string> = {
  error_emision: "Error de emisión",
  devolucion_cliente: "Devolución al cliente",
  cancelacion_pedido: "Cancelación del pedido",
  correccion_datos: "Corrección de datos",
  otro: "Otro",
};

/** Lo que se lee en pantalla (y en el registro) para un motivo guardado. */
export function describeInvoiceVoidReason(reason: InvoiceVoidReason): string {
  return VOID_REASON_LABELS[reason];
}

/** La nota de «Otro» es una frase, no un párrafo: 200 caracteres alcanzan y se leen. */
export const INVOICE_VOID_NOTE_MAX_LENGTH = 200;

const MIN_NOTE_LENGTH = 3;

export type InvoiceVoidCheck =
  | { ok: true; reason: InvoiceVoidReason; note: string | null }
  | { ok: false; message: string };

function isVoidReason(value: unknown): value is InvoiceVoidReason {
  return INVOICE_VOID_REASONS.includes(value as InvoiceVoidReason);
}

/**
 * El motivo tal como se va a guardar: la lista manda y `otro` necesita su texto. Los motivos de la
 * lista descartan la nota a propósito —el motivo ya dice qué pasó—, así nadie guarda dos versiones de
 * lo mismo.
 */
export function validateInvoiceVoidReason(input: {
  reason?: unknown;
  note?: unknown;
}): InvoiceVoidCheck {
  if (!isVoidReason(input.reason)) {
    return { ok: false, message: "Elegí un motivo de la lista para anular la factura." };
  }

  if (input.reason !== "otro") {
    return { ok: true, reason: input.reason, note: null };
  }

  const note = typeof input.note === "string" ? input.note.trim() : "";

  if (note.length < MIN_NOTE_LENGTH) {
    return { ok: false, message: "Escribí el motivo de la anulación (con «Otro» hay que contarlo)." };
  }

  if (note.length > INVOICE_VOID_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      message: `El motivo no puede pasar de ${INVOICE_VOID_NOTE_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, reason: "otro", note };
}
