/**
 * Los **umbrales de urgencia de un local**, en un solo lugar.
 *
 * La regla no es de presentación: dice cuánto puede esperar una comanda en cada familia de etapas antes
 * de que el sistema avise y antes de considerarla atrasada. La configura cada sucursal en
 * `/admin/locations` (`Location.acceptAlertMinutes` y `Location.prepAlertMinutes`) porque cada local
 * cocina a su ritmo, y de acá la consumen la pantalla de Cocina, la de Pedidos y la proyección de la API
 * (el «objetivo» de la cabecera). Antes vivía dentro del helper de la pantalla de Órdenes.
 */

/** A los 10 minutos de espera en la entrada avisa, y a los 15 ya está atrasada. */
export const DEFAULT_WARNING_MINUTES = 10;
export const DEFAULT_LATE_MINUTES = 15;

/**
 * Cuánto después del aviso se considera atrasada. Es la regla de producto que separa «se está
 * demorando» de «ya está tarde», y es igual para las dos familias.
 */
export const LATE_EXTRA_MINUTES = 5;

export type LocationThresholds = { warningMinutes: number; lateMinutes: number };

/** Las dos familias de etapas del tablero: la entrada (sin empezar) y la cocina (en el fuego o listo). */
export type LocationThresholdsByFamily = {
  entry: LocationThresholds;
  kitchen: LocationThresholds;
};

/**
 * Un valor inservible cae al respaldo: un local mal configurado no puede dejar la cocina **sin** umbral
 * (una comanda atrasada que nunca avisa es peor que una que avisa con el default).
 */
function usableMinutes(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.trunc(value)
    : fallback;
}

export function resolveLocationThresholds(input: {
  acceptAlertMinutes?: number | null;
  prepAlertMinutes?: number | null;
}): LocationThresholdsByFamily {
  const accept = usableMinutes(input.acceptAlertMinutes, DEFAULT_WARNING_MINUTES);
  const prep = usableMinutes(input.prepAlertMinutes, DEFAULT_LATE_MINUTES);

  return {
    entry: { warningMinutes: accept, lateMinutes: accept + LATE_EXTRA_MINUTES },
    kitchen: { warningMinutes: prep, lateMinutes: prep + LATE_EXTRA_MINUTES },
  };
}

/**
 * El «objetivo» de la cabecera de Cocina: el umbral de cocina del local que se está mirando.
 *
 * No existe un objetivo de negocio separado del umbral: el de la referencia aprobada (`Objetivo 18 min`)
 * **es** `prepAlertMinutes`. Sin un local resoluble no se inventa uno: rige el default del sistema.
 */
export function resolvePrepTargetMinutes(
  location?: { prepAlertMinutes?: number | null } | null,
): number {
  return usableMinutes(location?.prepAlertMinutes, DEFAULT_LATE_MINUTES);
}

/**
 * El umbral de la **entrada** del local: cuánto puede esperar una comanda que nadie tomó.
 *
 * El carril de entrada incluye `confirmed` (A-64), así que este umbral mide también lo aceptado y sin
 * empezar. Misma regla de respaldo que el de cocina: sin local resoluble, el default del sistema.
 */
export function resolveAcceptTargetMinutes(
  location?: { acceptAlertMinutes?: number | null } | null,
): number {
  return usableMinutes(location?.acceptAlertMinutes, DEFAULT_WARNING_MINUTES);
}
