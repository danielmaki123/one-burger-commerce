export type DeviceReservationRef = {
  status: string;
  reservationNumber?: string;
  reservationLookupToken?: string;
  date: string;
  time: string;
  partySize: number;
  tableLabel?: string;
  createdAt?: string;
  updatedAt?: string;
  lastCheckedAt?: string;
  stale?: boolean;
};

export type DeviceReservationsStore = {
  version: 1;
  reservations: DeviceReservationRef[];
  updatedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEVICE_RESERVATIONS_KEY = "ca_device_reservations_v1";
const STORE_VERSION = 1;
const MAX_DEVICE_RESERVATIONS = 30;

const ACTIVE_STATUSES = new Set(["requested", "approved", "seated"]);

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isValidDeviceReservationRef(value: unknown): value is DeviceReservationRef {
  if (!value || typeof value !== "object") return false;
  const reservation = value as Record<string, unknown>;
  if (typeof reservation.status !== "string" || reservation.status.trim().length === 0) return false;
  if (
    reservation.reservationNumber !== undefined &&
    typeof reservation.reservationNumber !== "string"
  ) {
    return false;
  }
  if (
    reservation.reservationLookupToken !== undefined &&
    typeof reservation.reservationLookupToken !== "string"
  ) {
    return false;
  }
  if (typeof reservation.date !== "string" || reservation.date.trim().length === 0) return false;
  if (typeof reservation.time !== "string" || reservation.time.trim().length === 0) return false;
  if (typeof reservation.partySize !== "number" || Number.isNaN(reservation.partySize)) return false;
  if (reservation.tableLabel !== undefined && typeof reservation.tableLabel !== "string") return false;
  if (reservation.createdAt !== undefined && typeof reservation.createdAt !== "string") return false;
  if (reservation.updatedAt !== undefined && typeof reservation.updatedAt !== "string") return false;
  if (reservation.lastCheckedAt !== undefined && typeof reservation.lastCheckedAt !== "string") return false;
  if (reservation.stale !== undefined && typeof reservation.stale !== "boolean") return false;
  return true;
}

function emptyStore(): DeviceReservationsStore {
  return {
    version: STORE_VERSION,
    reservations: [],
    updatedAt: new Date().toISOString(),
  };
}

function rankReservationStatus(status: string): number {
  return ACTIVE_STATUSES.has(status) ? 0 : 1;
}

function reservationTimestamp(reservation: DeviceReservationRef): string {
  return reservation.updatedAt ?? reservation.createdAt ?? `${reservation.date}T${reservation.time}:00.000Z`;
}

function reservationKey(reservation: DeviceReservationRef): string {
  if (reservation.reservationNumber) {
    return reservation.reservationNumber;
  }
  return [
    reservation.createdAt ?? "",
    reservation.date,
    reservation.time,
    reservation.partySize,
    reservation.tableLabel ?? "",
  ].join("|");
}

function sortReservations(reservations: DeviceReservationRef[]): DeviceReservationRef[] {
  return [...reservations].sort((a, b) => {
    const statusRank = rankReservationStatus(a.status) - rankReservationStatus(b.status);
    if (statusRank !== 0) return statusRank;
    return new Date(reservationTimestamp(b)).getTime() - new Date(reservationTimestamp(a)).getTime();
  });
}

function sanitizeReservation(reservation: DeviceReservationRef): DeviceReservationRef {
  return {
    status: reservation.status,
    reservationNumber: reservation.reservationNumber,
    reservationLookupToken: reservation.reservationLookupToken,
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.partySize,
    tableLabel: reservation.tableLabel,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    lastCheckedAt: reservation.lastCheckedAt,
    stale: reservation.stale,
  };
}

function persistStore(store: DeviceReservationsStore, storage?: StorageLike): DeviceReservationsStore {
  const driver = getStorage(storage);
  const normalized: DeviceReservationsStore = {
    version: STORE_VERSION,
    reservations: sortReservations(store.reservations.map(sanitizeReservation)).slice(
      0,
      MAX_DEVICE_RESERVATIONS,
    ),
    updatedAt: new Date().toISOString(),
  };
  if (driver) {
    driver.setItem(DEVICE_RESERVATIONS_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function readDeviceReservations(storage?: StorageLike): DeviceReservationsStore {
  const driver = getStorage(storage);
  if (!driver) return emptyStore();

  const raw = driver.getItem(DEVICE_RESERVATIONS_KEY);
  if (!raw) return emptyStore();

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.reservations)) {
      return persistStore(emptyStore(), storage);
    }

    const validReservations = parsed.reservations.filter(
      isValidDeviceReservationRef,
    ) as DeviceReservationRef[];
    return persistStore(
      {
        version: STORE_VERSION,
        reservations: validReservations,
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      },
      storage,
    );
  } catch {
    return persistStore(emptyStore(), storage);
  }
}

export function upsertDeviceReservation(
  reservation: DeviceReservationRef,
  storage?: StorageLike,
): DeviceReservationsStore {
  const current = readDeviceReservations(storage);
  const nextReservation = sanitizeReservation(reservation);
  const nextKey = reservationKey(nextReservation);
  const rest = current.reservations.filter((existing) => reservationKey(existing) !== nextKey);
  return persistStore({ ...current, reservations: [nextReservation, ...rest] }, storage);
}

export function markDeviceReservationStale(
  reservation: DeviceReservationRef,
  stale: boolean,
  storage?: StorageLike,
): DeviceReservationsStore {
  const current = readDeviceReservations(storage);
  const targetKey = reservationKey(reservation);
  const updated = current.reservations.map((existing) =>
    reservationKey(existing) === targetKey ? { ...existing, stale } : existing,
  );
  return persistStore({ ...current, reservations: updated }, storage);
}

export function clearDeviceReservations(storage?: StorageLike): void {
  const driver = getStorage(storage);
  if (!driver) return;
  driver.removeItem(DEVICE_RESERVATIONS_KEY);
}

export function getDeviceReservationsKey(): string {
  return DEVICE_RESERVATIONS_KEY;
}
