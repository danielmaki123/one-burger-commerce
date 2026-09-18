import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** de una venta de mostrador.
 *
 * Es plata que el cliente deja de pagar porque alguien lo decidió en el momento (una cortesía, un error de
 * la cocina, un cliente de siempre). Se pide de dos formas —un porcentaje o un monto— y siempre con un
 * **motivo escrito**: un descuento sin motivo es plata que desaparece del arqueo sin explicación.
 *
 * Acá vive solo la cuenta y sus límites. Quién puede aplicarlo es un permiso (`canDiscountPosSale`) y el
 * asiento del log lo firma la ruta. El monto lo calcula **siempre** el servidor: la pantalla manda la forma
 * del descuento, nunca el número.
 *
 * Tres reglas que no son obvias:
 *
 * 1. **Un descuento nunca pasa de la venta.** Un monto más grande que el subtotal descuenta el subtotal (el
 *    empaque se sigue pagando): un total negativo sería plata que el local le debe al cliente.
 * 2. **Un porcentaje de más del 100 % no existe.** No es un descuento, es un error de tipeo, y se rechaza
 *    en vez de recortarlo en silencio.
 * 3. **El motivo es obligatorio** (`reason`, no vacío). Es lo único que seis meses después explica por qué
 *    esa venta entró con menos plata.
 */

/** La forma del descuento manual: cómo se pidió, cuánto y **por qué**. */
export type ManualDiscountInput = {
  kind: "percentage" | "amount";
  value: number;
  reason: string;
};

export type ManualDiscountResult =
  | { ok: true; amount: number }
  | { ok: false; reason: "invalid-value" | "missing-reason" };

/** Cuánto descuenta un descuento manual sobre un subtotal, o por qué no se puede aplicar. */
export function manualDiscountAmount(input: {
  discount: ManualDiscountInput;
  subtotal: number;
}): ManualDiscountResult {
  const { discount, subtotal } = input;
  const value = discount.value;

  if (discount.reason.trim() === "") {
    return { ok: false, reason: "missing-reason" };
  }

  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, reason: "invalid-value" };
  }

  if (discount.kind === "percentage") {
    if (value > 100) {
      return { ok: false, reason: "invalid-value" };
    }

    return { ok: true, amount: roundCurrency((subtotal * value) / 100) };
  }

  return { ok: true, amount: roundCurrency(Math.min(value, subtotal)) };
}

/**
 * El descuento total de una venta: el cupón (que ya viene limitado al subtotal por `coupon-discount`) más el
 * descuento manual, sin pasar nunca del subtotal.
 */
export function composeSaleDiscount(input: {
  couponDiscount: number;
  manualDiscount: number;
  subtotal: number;
}): number {
  const coupon = Math.max(input.couponDiscount, 0);
  const manual = Math.max(input.manualDiscount, 0);

  return roundCurrency(Math.min(coupon + manual, Math.max(input.subtotal, 0)));
}
