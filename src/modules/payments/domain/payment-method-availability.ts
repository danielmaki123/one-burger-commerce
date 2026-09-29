import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import type { PaymentMethodKind } from "@/modules/payments/domain/payment-method-kind";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`, `A-86`, `D-017`) — **el medio de pago configurado
 * y dónde se ofrece**.
 *
 * El POS ofrecía una lista fija (`POS_PAYMENT_METHODS`) y un selector de moneda con exactamente dos entradas
 * (la base y el dólar): el medio comercial que el dueño configura en Finanzas no llegaba al mostrador. Estas
 * dos funciones son la regla que el **servidor** aplica —la misma que el cliente usa para dibujar—, y viven
 * en el dominio de `payments` porque es el módulo dueño del catálogo de medios (`D-017`).
 *
 * El hecho histórico no depende de esta tabla: `Payment` congela `paymentMethodId` y `methodKind`, así que
 * apagar o renombrar un medio no reescribe ningún cobro.
 */

export type PaymentMethodLocationRecord = {
  locationId: string;
  isActive: boolean;
};

export type PaymentMethodConfigRecord = {
  id: string;
  name: string;
  kind: PaymentMethodKind;
  /** Entidad de cobro (banco, adquirente). `null` = no aplica (efectivo). */
  entityId: string | null;
  /** Monedas que admite. **Vacío = todas.** */
  currencyCodes: readonly string[];
  requiresReference: boolean;
  isActive: boolean;
  /** Las filas de disponibilidad. **Vacío = todas las sucursales.** */
  locations: readonly PaymentMethodLocationRecord[];
};

/**
 * ¿Este medio se ofrece en esta sucursal?
 *
 * 1. **apagado** globalmente: no, en ninguna;
 * 2. **sin filas** de disponibilidad: sí, en todas (es el default de la tabla);
 * 3. **con filas**: sólo donde la fila está activa. Un local que **no** aparece en la lista no lo ofrece: la
 *    lista dice *dónde sí*, no *dónde no*.
 */
export function isPaymentMethodAvailableAt(
  method: PaymentMethodConfigRecord,
  locationId: string,
): boolean {
  if (!method.isActive) return false;
  if (method.locations.length === 0) return true;

  return method.locations.some((row) => row.locationId === locationId && row.isActive);
}

/**
 * `A-85` — **el medio que el cliente nombró, resuelto por el servidor**.
 *
 * El payload del POS sólo trae el `paymentMethodId`; el **tipo canónico**, la **entidad** y si **pide
 * referencia** salen de acá. Confiar en un `kind` o un `entityId` mandados por React dejaría que la pantalla
 * eligiera la semántica contable del hecho, que es justo lo que `D-017` separa.
 *
 * Devuelve `null` cuando el medio no se puede cobrar —apagado, fuera de la sucursal, moneda no admitida o
 * identificador inexistente— y el llamador decide el error. No lanza: la traducción a error de negocio es de
 * la superficie, y así la misma regla sirve para filtrar el catálogo que se le ofrece al cajero.
 */
export function resolveConfiguredPaymentMethod(
  input: { paymentMethodId: string; currency: string; locationId: string },
  catalog: readonly PaymentMethodConfigRecord[],
): PaymentMethodConfigRecord | null {
  const method = catalog.find((candidate) => candidate.id === input.paymentMethodId);

  if (!method) return null;
  if (!isPaymentMethodAvailableAt(method, input.locationId)) return null;
  if (!admitsCurrency(method, input.currency)) return null;

  return method;
}

/** Una lista de monedas **vacía** significa «todas»: es el default de la configuración. */
export function admitsCurrency(
  method: PaymentMethodConfigRecord,
  currency: string,
): boolean {
  if (method.currencyCodes.length === 0) return true;

  const key = currencyKey(currency);

  return method.currencyCodes.some((code) => currencyKey(code) === key);
}

/** Por qué un medio no se puede cobrar, para que el mensaje diga **qué** arreglar. `null` = se puede. */
export function paymentMethodUnavailability(
  method: PaymentMethodConfigRecord,
  input: { currency: string; locationId: string },
): "inactive" | "not-offered-here" | "currency-not-admitted" | null {
  if (!method.isActive) return "inactive";
  if (!isPaymentMethodAvailableAt(method, input.locationId)) return "not-offered-here";
  if (!admitsCurrency(method, input.currency)) return "currency-not-admitted";

  return null;
}

/**
 * Los medios que **esta** sucursal ofrece, en el orden del catálogo.
 *
 * Es lo que la pantalla del POS tiene que dibujar: los medios configurados y habilitados para el local, no
 * una lista escrita en el código. El filtro por moneda queda para el cliente (depende del cobro que se está
 * cargando), pero el de disponibilidad y el de estado se aplican acá.
 */
export function listAvailablePaymentMethods(
  catalog: readonly PaymentMethodConfigRecord[],
  locationId: string,
): PaymentMethodConfigRecord[] {
  return catalog.filter((method) => isPaymentMethodAvailableAt(method, locationId));
}
