/**
 * TASK-AUD-059 — **anular un cobro** (alcance remanente de A-15).
 *
 * Anular no es devolver. Una devolución (`Refund`) mueve plata que **salió** del cajón: tiene cupo, medio
 * original, moneda y un turno donde se descuenta. Anular un cobro es otra cosa: decide que ese cobro
 * **nunca contó** —se registró mal— y lo saca del arqueo, del saldo del pedido y de la conciliación. El
 * cobro no se borra ni se edita: se marca con cuándo, quién y **por qué** (`Payment.voidedAt`,
 * `voidedByUserId`, `voidReason`), y el registro original queda entero.
 *
 * El motivo es obligatorio y de **texto libre**. La anulación de una factura usa una lista cerrada porque
 * esos motivos los definió el negocio; acá no existe tal lista, e inventar categorías de cobro mal cargado
 * sería inventar producto. Lo que sí se exige es que el motivo sea una explicación legible: sin eso, seis
 * meses después el asiento no dice nada y la anulación es indistinguible de un descuadre.
 */

/** Un motivo de una o dos letras no explica nada; una frase corta sí. */
export const PAYMENT_VOID_REASON_MIN_LENGTH = 3;

/** El motivo se guarda en la fila y viaja en el asiento: es una frase, no un párrafo. */
export const PAYMENT_VOID_REASON_MAX_LENGTH = 200;

export type PaymentVoidCheck = { ok: true; reason: string } | { ok: false; message: string };

/** El motivo tal como se va a guardar (recortado) o el problema que impide anular. */
export function validatePaymentVoidReason(input: { reason?: unknown }): PaymentVoidCheck {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (reason.length === 0) {
    return { ok: false, message: "Escribí por qué anulás el cobro." };
  }

  if (reason.length < PAYMENT_VOID_REASON_MIN_LENGTH) {
    return {
      ok: false,
      message: "El motivo es muy corto: contá qué pasó con el cobro.",
    };
  }

  if (reason.length > PAYMENT_VOID_REASON_MAX_LENGTH) {
    return {
      ok: false,
      message: `El motivo no puede pasar de ${PAYMENT_VOID_REASON_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, reason };
}
