import type { PaymentMethodType } from "@/modules/orders/domain/order.types";
import {
  listAvailablePaymentMethods,
  type PaymentMethodConfigRecord,
} from "@/modules/payments/domain/payment-method-availability";
import type { PaymentMethodKind } from "@/modules/payments/domain/payment-method-kind";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §38, §39, §40) — **los medios que el POS ofrece**.
 *
 * El dueño configura los medios en `/admin/finance` (`PaymentMethodConfig` + `PaymentMethodLocation`): su
 * **nombre** («Tarjeta BAC», «Zelle»), su tipo canónico, si piden **referencia** y qué **monedas** admiten.
 * Hasta esta TASK el POS dibujaba una lista fija (`POS_PAYMENT_METHODS`) y decidía la referencia con
 * `method === "transfer"`: el catálogo no llegaba al mostrador —la divergencia de `A-85`, que estaba
 * marcada `cerrado` porque sólo el backend lo consumía—.
 *
 * Esta función es la traducción del catálogo a lo que la pantalla necesita, y **no** decide nada por su
 * cuenta: la disponibilidad y el estado los aplica el dominio de `payments` (`listAvailablePaymentMethods`),
 * que es el dueño de la regla. El POS no reimplementa «¿este medio se puede cobrar acá?».
 *
 * El `method` histórico que viaja en la opción es una **derivación** del tipo canónico, no una decisión: el
 * servidor resuelve el `kind` real desde el `paymentMethodId` y no confía en lo que mande React (brief §38).
 * Existe porque el contrato del payload del POS lo pide, y se deriva con el mapeo inverso al que ya aplica
 * `paymentMethodKindFor` —una sola correspondencia, sin una segunda tabla de verdad—.
 */

export type PosPaymentMethodOption = {
  id: string;
  /** El nombre que el dueño le puso en Finanzas. Es el texto del botón. */
  label: string;
  /** El tipo canónico configurado. La pantalla lo usa sólo para agrupar o mostrar; no lo manda como verdad. */
  kind: PaymentMethodKind;
  /** El valor que espera el contrato histórico del payload del POS. Derivado de `kind`. */
  method: PaymentMethodType;
  /** Si el cobro con este medio **exige** referencia externa (brief §39). */
  requiresReference: boolean;
  /** Las monedas que admite. **Vacío = todas.** */
  currencyCodes: string[];
};

/**
 * El mapeo inverso de `paymentMethodKindFor`. Está escrito acá —y no importado del módulo de `payments`—
 * porque `payments` exporta la dirección contraria; los dos sentidos se fijan con test (`pos-sale.test.ts` y
 * `payment-method-kind`), así que una correspondencia nueva tiene que aparecer en los dos.
 */
const METHOD_BY_KIND: Record<PaymentMethodKind, PaymentMethodType> = {
  cash: "cash",
  card: "card",
  bank_transfer: "transfer",
  wallet: "other",
  other: "other",
};

export function derivePosPaymentMethod(kind: PaymentMethodKind): PaymentMethodType {
  return METHOD_BY_KIND[kind] ?? "other";
}

/**
 * Los medios que el POS tiene que dibujar para esta sucursal, en el orden del catálogo.
 *
 * Sin catálogo devuelve una lista vacía: la pantalla dice que no hay medios configurados en vez de inventar
 * cuatro botones genéricos. Cobrar con un medio que el negocio no ofrece es peor que no poder cobrar.
 */
export function listPosPaymentMethodOptions(input: {
  locationId: string;
  catalog: readonly PaymentMethodConfigRecord[];
}): PosPaymentMethodOption[] {
  return listAvailablePaymentMethods(input.catalog, input.locationId).map((method) => ({
    id: method.id,
    label: method.name,
    kind: method.kind,
    method: derivePosPaymentMethod(method.kind),
    requiresReference: method.requiresReference,
    currencyCodes: [...method.currencyCodes],
  }));
}
