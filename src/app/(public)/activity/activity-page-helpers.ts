import { ORDER_PROGRESS_STEPS, getOrderStatusProgress } from "@/shared/lib/activity-status";
import type { DeviceOrderItemRef, DeviceOrderRef } from "@/shared/lib/device-orders";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";

/**
 * Helpers del historial y del seguimiento (T7).
 *
 * El mock tiene un historial con buscador inerte, un timeline de 4 pasos y un
 * resumen con el nombre del plato. Acá el resumen sale del pedido guardado (antes
 * estaba escrito a mano: "Sangría · ½ Litro") y el buscador filtra de verdad.
 */

/** Resumen corto de las líneas: `2 × Taco de Birria · 1 × Agua de Jamaica`. */
export function summarizeOrderItems(items: DeviceOrderItemRef[] | undefined): string | null {
  if (!items || items.length === 0) return null;

  return items.map((item) => `${item.quantity} × ${item.productName}`).join(" · ");
}

/**
 * Estimado de retiro del pedido guardado.
 *
 * Sin hora no hay estimado. Si el cliente no programó, se muestra con `~` para
 * que se lea como aproximado y no como una hora reservada.
 */
export function formatOrderPickupEstimate(
  order: Pick<DeviceOrderRef, "pickupTime" | "pickupScheduled">,
  timeZone: string,
): string | null {
  if (!order.pickupTime) return null;

  const time = formatTimeInTimeZone(order.pickupTime, timeZone);
  if (!time) return null;

  return order.pickupScheduled ? `Listo ${time}` : `Listo ~${time}`;
}

function normalize(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-NI");
}

/**
 * Buscador del historial: por número de pedido o por plato.
 *
 * Con la búsqueda vacía devuelve todo: es un filtro, no un requisito.
 */
export function filterDeviceOrders<T extends Pick<DeviceOrderRef, "orderNumber" | "items">>(
  orders: T[],
  rawQuery: string,
): T[] {
  const query = normalize(rawQuery);
  if (!query) return orders;

  return orders.filter((order) => {
    if (normalize(order.orderNumber).includes(query)) return true;

    return (order.items ?? []).some((item) => normalize(item.productName).includes(query));
  });
}

export type OrderTimelineStep = {
  label: string;
  isDone: boolean;
  isCurrent: boolean;
  isPending: boolean;
};

/**
 * Pasos del timeline del pedido, con el estado de cada uno.
 *
 * Los pasos son los reales del pedido (incluye "Completada": el pedido de retiro
 * termina cuando se retira), no los 4 del mock. Un pedido cancelado no se dibuja
 * como progreso: no está "por llegar" a ningún lado.
 */
export function buildOrderTimeline(status: string): OrderTimelineStep[] {
  const progress = getOrderStatusProgress(status);

  if (progress.isTerminalNegative) {
    return ORDER_PROGRESS_STEPS.map((label, index) => ({
      label,
      isDone: false,
      isCurrent: index === 0,
      isPending: index > 0,
    }));
  }

  // Un pedido retirado ya terminó: todos los pasos hechos y ninguno "en curso".
  if (progress.stepIndex >= ORDER_PROGRESS_STEPS.length - 1) {
    return ORDER_PROGRESS_STEPS.map((label) => ({
      label,
      isDone: true,
      isCurrent: false,
      isPending: false,
    }));
  }

  return ORDER_PROGRESS_STEPS.map((label, index) => ({
    label,
    isDone: index < progress.stepIndex,
    isCurrent: index === progress.stepIndex,
    isPending: index > progress.stepIndex,
  }));
}

/** Texto de progreso: `Paso 3 de 5`. */
export function formatTimelineProgress(status: string): string {
  const progress = getOrderStatusProgress(status);
  const position = Math.min(progress.stepIndex + 1, ORDER_PROGRESS_STEPS.length);

  return `Paso ${position} de ${ORDER_PROGRESS_STEPS.length}`;
}
