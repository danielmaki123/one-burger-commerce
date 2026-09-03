import {
  readDeviceReservations,
  type DeviceReservationsStore,
  upsertDeviceReservation,
} from "./device-reservations";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PublicTrackedReservation = {
  reservationNumber: string;
  status: string;
  statusLabel: string;
  date: string;
  time: string;
  partySize: number;
  tableLabel?: string;
  updatedAt: string;
};

type SyncTrackedReservationOptions = {
  reservationLookupToken: string;
  checkedAt?: string;
  storage?: StorageLike;
};

export function syncTrackedReservationToDeviceReservations(
  tracked: PublicTrackedReservation,
  options: SyncTrackedReservationOptions,
): DeviceReservationsStore {
  const storage = options.storage;
  const existing = readDeviceReservations(storage).reservations.find(
    (reservation) => reservation.reservationNumber === tracked.reservationNumber,
  );

  return upsertDeviceReservation(
    {
      status: tracked.status,
      reservationNumber: tracked.reservationNumber,
      reservationLookupToken: options.reservationLookupToken,
      date: tracked.date,
      time: tracked.time,
      partySize: tracked.partySize,
      tableLabel: tracked.tableLabel,
      createdAt: existing?.createdAt,
      updatedAt: tracked.updatedAt,
      lastCheckedAt: options.checkedAt ?? new Date().toISOString(),
      stale: false,
    },
    storage,
  );
}
