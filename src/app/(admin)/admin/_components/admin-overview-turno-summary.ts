import {
  comandaThresholds,
  resolveComandaUrgency,
} from "../orders/comanda-helpers";

/** Lo mínimo que necesita el turno de una orden del listado del admin. */
export type TurnoOrderSummary = { status: string; createdAt: string };

export type TurnoSummary = {
  /** Órdenes todavía en el flujo de retiro (sin contar entregadas ni canceladas). */
  abiertas: number;
  /** Nadie las tomó todavía: es la cola «Por aceptar» del KDS. */
  nuevas: number;
  /** Confirmadas, aceptadas o en preparación. */
  enPreparacion: number;
  /** Listas para retirar: la comida ya está hecha y también se enfría. */
  listas: number;
  /** Abiertas que pasaron el umbral de atraso de su carril. */
  tardadas: number;
};

/**
 * Los umbrales del turno salen del **mismo** lugar que los del KDS (`comanda-helpers`). Antes acá
 * había un `20` escrito a mano: dos semáforos para la misma operación, y el día que el local cambie su
 * `acceptAlertMinutes` el Resumen hubiera seguido mintiendo.
 */
export const TURNO_THRESHOLDS = comandaThresholds({});

const PENDING_STATUSES = new Set(["new"]);
const PREPARING_STATUSES = new Set([
  "confirmed",
  "accepted",
  "preparing",
  "out_for_delivery",
]);
const READY_STATUSES = new Set(["ready", "ready_for_pickup"]);

/**
 * Resumen del turno para el hero del Resumen: cuántas órdenes hay en cada carril y cuántas ya
 * pasaron su umbral de atraso.
 *
 * Es una lectura de pantalla, no una transición de estado: los estados abiertos y los umbrales salen
 * de las fuentes únicas (`TURNO_OPEN_STATUSES` implícito en los tres carriles y `comanda-helpers`).
 */
export function summarizeTurno(
  orders: TurnoOrderSummary[],
  nowMs: number,
): TurnoSummary {
  const resumen: TurnoSummary = {
    abiertas: 0,
    nuevas: 0,
    enPreparacion: 0,
    listas: 0,
    tardadas: 0,
  };

  for (const order of orders) {
    const isPending = PENDING_STATUSES.has(order.status);
    const isPreparing = PREPARING_STATUSES.has(order.status);
    const isReady = READY_STATUSES.has(order.status);

    if (!isPending && !isPreparing && !isReady) continue;

    resumen.abiertas += 1;
    if (isPending) resumen.nuevas += 1;
    if (isPreparing) resumen.enPreparacion += 1;
    if (isReady) resumen.listas += 1;

    const thresholds = isPending ? TURNO_THRESHOLDS.pending : TURNO_THRESHOLDS.kitchen;
    const urgency = resolveComandaUrgency({
      stageChangedAt: order.createdAt,
      nowMs,
      ...thresholds,
    });

    if (urgency.level === "late") resumen.tardadas += 1;
  }

  return resumen;
}
