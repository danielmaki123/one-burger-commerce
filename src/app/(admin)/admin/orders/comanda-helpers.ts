import {
  COMANDA_LANES,
  comandaCounters,
  groupComandasByLane,
  resolveOrderLane,
  type OrderLane,
} from "@/modules/orders/domain/order-lanes";

/**
 * El tablero de comandas: de dónde salen los carriles y la urgencia de una comanda.
 *
 * **Dónde vive cada regla** (A-64, cerrado por `TASK-ORDERS-KITCHEN-RUNTIME-002`):
 *
 * - **El carril de un estado** vive en `orders/domain/order-lanes.ts`, **una sola vez**, y lo consumen
 *   Cocina y Pedidos. Antes vivía acá y en otras cuatro copias, y no todas decían lo mismo: `confirmed`
 *   caía «en preparación» en dos de ellas. `COMANDA_LANES`, `comandaLane`, `groupComandasByLane` y
 *   `comandaCounters` se reexportan desde el dominio para no romper a quien ya los importaba de acá.
 * - **La urgencia y los umbrales** siguen acá: son **presentación** del local (cuántos minutos avisan),
 *   no una regla de negocio del pedido. Los umbrales entran por parámetro porque salen de la
 *   configuración de cada local (`Location.acceptAlertMinutes` / `prepAlertMinutes`).
 */

export type { OrderLane };
export type ComandaLane = OrderLane;
export { COMANDA_LANES, comandaCounters, groupComandasByLane };
export type ComandaLaneMeta = (typeof COMANDA_LANES)[number];

/** El carril de un estado, o `null` si el pedido ya salió del tablero. Delegado al dominio. */
export const comandaLane = resolveOrderLane;

/** "hace 6 min" · "hace 1 h 5 min". Negativo (reloj que va para atrás) se lee "recién". */
export function formatStageElapsed(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));

  if (safe < 1) return "recién";
  if (safe < 60) return `hace ${safe} min`;

  const hours = Math.floor(safe / 60);
  const rest = safe % 60;

  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest} min`;
}

/**
 * B5 — los umbrales del local, por familia de etapas.
 *
 * La **regla** (cuántos minutos avisa y cuántos considera atraso, con sus valores por defecto y el
 * respaldo de un valor inservible) vive en `orders/domain/order-location-thresholds.ts`: es del pedido y
 * la consumen también la proyección de Cocina y, a futuro, Pedidos. Acá sólo se reexporta para quien ya
 * la importaba de este archivo.
 */
import {
  DEFAULT_LATE_MINUTES,
  DEFAULT_WARNING_MINUTES,
} from "@/modules/orders/domain/order-location-thresholds";
import type {
  LocationThresholds as ComandaThresholds,
  LocationThresholdsByFamily as ComandaThresholdsByLane,
} from "@/modules/orders/domain/order-location-thresholds";

export {
  DEFAULT_LATE_MINUTES,
  DEFAULT_WARNING_MINUTES,
  LATE_EXTRA_MINUTES,
  resolveLocationThresholds as comandaThresholds,
} from "@/modules/orders/domain/order-location-thresholds";
export type {
  LocationThresholds as ComandaThresholds,
  LocationThresholdsByFamily as ComandaThresholdsByLane,
} from "@/modules/orders/domain/order-location-thresholds";

/**
 * Los umbrales que le tocan a un carril.
 *
 * El carril de **entrada** incluye `confirmed` (A-64): un pedido aceptado espera que alguien empiece a
 * cocinarlo, así que sigue midiéndose con el umbral de aceptación y no con el de cocina.
 */
export function thresholdsForLane(
  thresholds: ComandaThresholdsByLane,
  lane: OrderLane,
): ComandaThresholds {
  return lane === "entry" ? thresholds.entry : thresholds.kitchen;
}

export type ComandaUrgencyLevel = "normal" | "warning" | "late";

export type ComandaUrgency = {
  level: ComandaUrgencyLevel;
  minutes: number;
  /** Lo que se muestra en el chip: el color nunca va solo. */
  label: string;
  /**
   * El texto del cronómetro de **cocina** (`PREP 8m`): lo que la referencia aprobada muestra mientras
   * el pedido está en el fuego. `null` en los otros carriles, donde el chip dice `hace N min`.
   */
  kitchenTimer: string | null;
};

/**
 * Cuánto hace que la comanda está en su etapa actual y con qué urgencia.
 *
 * Una fecha ilegible no inventa un atraso: devuelve el nivel normal en vez de mandar una comanda al
 * rojo por un dato raro.
 */
export function resolveComandaUrgency({
  stageChangedAt,
  nowMs,
  warningMinutes = DEFAULT_WARNING_MINUTES,
  lateMinutes = DEFAULT_LATE_MINUTES,
  lane,
}: {
  stageChangedAt: string;
  nowMs: number;
  warningMinutes?: number;
  lateMinutes?: number;
  /** En **preparando**, el chip se rotula `PREP N m` como en la referencia aprobada. */
  lane?: OrderLane;
}): ComandaUrgency {
  const startedAt = Date.parse(stageChangedAt);

  if (Number.isNaN(startedAt)) {
    return { level: "normal", minutes: 0, label: formatStageElapsed(0), kitchenTimer: null };
  }

  const minutes = Math.max(0, Math.floor((nowMs - startedAt) / 60_000));
  const level: ComandaUrgencyLevel =
    minutes >= lateMinutes ? "late" : minutes >= warningMinutes ? "warning" : "normal";
  const elapsed = formatStageElapsed(minutes);

  return {
    level,
    minutes,
    label: level === "late" ? `Atrasado ${elapsed}` : elapsed,
    kitchenTimer: lane === "preparing" ? `PREP ${String(minutes).padStart(2, "0")}m` : null,
  };
}
