type OperationalOrder = {
  status: string;
  createdAt: string;
};

type OperationalReservation = {
  status: string;
  time: string;
};

const TERMINAL_ORDER_STATUSES = new Set([
  "cancelled",
  "closed",
  "delivered",
  "picked_up",
  "served",
]);

const ACTIVE_RESERVATION_STATUSES = new Set([
  "requested",
  "approved",
  "seated",
]);

const orderPriority: Record<string, number> = {
  new: 0,
  confirmed: 1,
  accepted: 1,
  preparing: 2,
  ready: 3,
  ready_for_pickup: 3,
  out_for_delivery: 4,
};

const reservationPriority: Record<string, number> = {
  requested: 0,
  approved: 1,
  seated: 2,
  rejected: 3,
  cancelled: 3,
  no_show: 3,
};

function compareByPriority<T extends { status: string }>(
  left: T,
  right: T,
  priorities: Record<string, number>,
) {
  return (priorities[left.status] ?? 99) - (priorities[right.status] ?? 99);
}

export function buildOperationalOrderQueue<T extends OperationalOrder>(orders: T[]): T[] {
  return [...orders]
    .filter((order) => !TERMINAL_ORDER_STATUSES.has(order.status))
    .sort((left, right) => {
      const priority = compareByPriority(left, right, orderPriority);
      if (priority !== 0) return priority;
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    });
}

export function sortReservationsByPriority<T extends OperationalReservation>(
  reservations: T[],
): T[] {
  return [...reservations].sort((left, right) => {
    const priority = compareByPriority(left, right, reservationPriority);
    if (priority !== 0) return priority;
    return left.time.localeCompare(right.time);
  });
}

export function buildOperationalReservationQueue<T extends OperationalReservation>(
  reservations: T[],
): T[] {
  return sortReservationsByPriority(
    reservations.filter((reservation) => ACTIVE_RESERVATION_STATUSES.has(reservation.status)),
  );
}
