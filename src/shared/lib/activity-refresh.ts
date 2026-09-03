import type { DeviceOrderRef } from "./device-orders";
import type { DeviceReservationRef } from "./device-reservations";

export const ACTIVITY_MANUAL_ORDER_LABEL = "Consultar pedido manualmente";
export const LEGACY_RESERVATION_BADGE = "Sin refresh automatico";
export const TRACKABLE_RESERVATION_BADGE = "Seguimiento disponible";

export const ACTIVE_ORDER_STATUS = new Set([
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
]);

export const ACTIVE_RESERVATION_STATUS = new Set([
  "requested",
  "approved",
]);

export type TrackedOrder = {
  orderNumber: string;
  type: "delivery" | "pickup" | "table";
  status: string;
  statusLabel: string;
  updatedAt: string;
  total: number;
};

export type TrackedReservation = {
  reservationNumber: string;
  status: string;
  statusLabel: string;
  date: string;
  time: string;
  partySize: number;
  tableLabel?: string;
  updatedAt: string;
};

type RefreshActivityParams = {
  orders: DeviceOrderRef[];
  reservations: DeviceReservationRef[];
  trackingWhatsapp: string;
};

type RefreshActivityDependencies = {
  getCheckedAt: () => string;
  trackOrder: (
    order: DeviceOrderRef,
    whatsapp?: string,
  ) => Promise<TrackedOrder>;
  trackReservation: (
    reservation: DeviceReservationRef,
  ) => Promise<TrackedReservation>;
  syncOrder: (tracked: TrackedOrder, checkedAt: string) => void;
  syncReservation: (
    tracked: TrackedReservation,
    reservationLookupToken: string,
    checkedAt: string,
  ) => void;
  markOrderStale: (orderNumber: string, stale: boolean) => void;
  markReservationStale: (
    reservation: DeviceReservationRef,
    stale: boolean,
  ) => void;
};

export type RefreshActivityResult = {
  changedCount: number;
  failedCount: number;
  needsWhatsappPrompt: boolean;
  attemptedOrderCount: number;
  attemptedReservationCount: number;
  feedback: string;
  unchangedCount: number;
};

export type ActivitySummary = {
  activeOrderCount: number;
  activeReservationCount: number;
  legacyReservationCount: number;
};

export function getLatestActivityUpdateText(
  orders: DeviceOrderRef[],
  reservations: DeviceReservationRef[],
): string | null {
  const timestamps = [
    ...orders.map((order) => order.lastCheckedAt ?? order.updatedAt),
    ...reservations.map(
      (reservation) => reservation.lastCheckedAt ?? reservation.updatedAt,
    ),
  ]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return `Ultima sincronizacion: ${new Date(
    Math.max(...timestamps),
  ).toLocaleString()}`;
}

export function getActivitySummary(
  orders: DeviceOrderRef[],
  reservations: DeviceReservationRef[],
): ActivitySummary {
  const activeOrderCount = orders.filter((order) =>
    ACTIVE_ORDER_STATUS.has(order.status),
  ).length;
  const activeReservations = reservations.filter((reservation) =>
    ACTIVE_RESERVATION_STATUS.has(reservation.status),
  );

  return {
    activeOrderCount,
    activeReservationCount: activeReservations.length,
    legacyReservationCount: activeReservations.filter(
      (reservation) =>
        !reservation.reservationNumber || !reservation.reservationLookupToken,
    ).length,
  };
}

export function getActivityContextCopy(input: {
  activeOrderCount: number;
  activeReservationCount: number;
  activeTab: "orders" | "reservations";
}) {
  if (
    input.activeTab === "orders" &&
    input.activeOrderCount === 0 &&
    input.activeReservationCount > 0
  ) {
    return "No hay pedidos guardados. Tambien podes actualizar tus reservas desde aqui.";
  }

  return "Actualiza pedidos y reservas guardados en este dispositivo.";
}

export async function refreshActivity(
  params: RefreshActivityParams,
  deps: RefreshActivityDependencies,
): Promise<RefreshActivityResult> {
  const activeOrders = params.orders.filter((order) =>
    ACTIVE_ORDER_STATUS.has(order.status),
  );
  const activeTrackableReservations = params.reservations.filter(
    (reservation) =>
      ACTIVE_RESERVATION_STATUS.has(reservation.status) &&
      Boolean(
        reservation.reservationNumber && reservation.reservationLookupToken,
      ),
  );

  const checkedAt = deps.getCheckedAt();
  const trimmedWhatsapp = params.trackingWhatsapp.trim();
  const ordersNeedingWhatsapp = activeOrders.filter(
    (order) => !order.orderLookupToken,
  );
  const needsWhatsappPrompt =
    ordersNeedingWhatsapp.length > 0 && trimmedWhatsapp.length === 0;

  let changedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;
  let attemptedOrderCount = 0;
  let attemptedReservationCount = 0;

  for (const reservation of activeTrackableReservations) {
    const reservationNumber = reservation.reservationNumber;
    const reservationLookupToken = reservation.reservationLookupToken;
    if (!reservationNumber || !reservationLookupToken) continue;

    attemptedReservationCount += 1;

    try {
      const tracked = await deps.trackReservation(reservation);
      if (didReservationChange(reservation, tracked)) {
        changedCount += 1;
      } else {
        unchangedCount += 1;
      }
      deps.syncReservation(tracked, reservationLookupToken, checkedAt);
    } catch {
      failedCount += 1;
      deps.markReservationStale(reservation, true);
    }
  }

  for (const order of activeOrders) {
    if (!order.orderLookupToken && needsWhatsappPrompt) {
      continue;
    }

    attemptedOrderCount += 1;

    try {
      const tracked = await deps.trackOrder(order, trimmedWhatsapp);
      if (didOrderChange(order, tracked)) {
        changedCount += 1;
      } else {
        unchangedCount += 1;
      }
      deps.syncOrder(tracked, checkedAt);
    } catch {
      failedCount += 1;
      deps.markOrderStale(order.orderNumber, true);
    }
  }

  return {
    changedCount,
    failedCount,
    needsWhatsappPrompt,
    attemptedOrderCount,
    attemptedReservationCount,
    feedback: buildRefreshFeedback({
      changedCount,
      failedCount,
      needsWhatsappPrompt,
      attemptedOrderCount,
      attemptedReservationCount,
      unchangedCount,
    }),
    unchangedCount,
  };
}

function buildRefreshFeedback(result: Omit<RefreshActivityResult, "feedback">) {
  const attemptedCount =
    result.attemptedOrderCount + result.attemptedReservationCount;

  if (
    attemptedCount === 0 &&
    result.needsWhatsappPrompt
  ) {
    return "Para actualizar pedidos necesitamos el WhatsApp usado al ordenar.";
  }

  if (attemptedCount === 0) {
    return "No hay actividades activas para actualizar.";
  }

  if (result.failedCount > 0) {
    if (result.needsWhatsappPrompt) {
      return "Algunas actividades no pudieron actualizarse. Para actualizar pedidos necesitamos el WhatsApp usado al ordenar.";
    }
    return "Algunas actividades no pudieron actualizarse.";
  }

  if (result.changedCount > 0) {
    if (result.needsWhatsappPrompt) {
      return "Actualizamos reservas. Para pedidos necesitamos tu WhatsApp.";
    }
    return "Estados actualizados.";
  }

  if (result.needsWhatsappPrompt) {
    return "No encontramos cambios en tus actividades guardadas. Para actualizar pedidos necesitamos el WhatsApp usado al ordenar.";
  }

  return "No encontramos cambios en tus actividades guardadas.";
}

function didOrderChange(current: DeviceOrderRef, tracked: TrackedOrder) {
  return (
    current.type !== tracked.type ||
    current.status !== tracked.status ||
    current.statusLabel !== tracked.statusLabel ||
    current.updatedAt !== tracked.updatedAt ||
    current.total !== tracked.total
  );
}

function didReservationChange(
  current: DeviceReservationRef,
  tracked: TrackedReservation,
) {
  return (
    current.status !== tracked.status ||
    current.date !== tracked.date ||
    current.time !== tracked.time ||
    current.partySize !== tracked.partySize ||
    current.tableLabel !== tracked.tableLabel ||
    current.updatedAt !== tracked.updatedAt
  );
}
