import { describe, expect, it } from "vitest";

import {
  clearDeviceReservations,
  getDeviceReservationsKey,
  readDeviceReservations,
  upsertDeviceReservation,
  type DeviceReservationRef,
} from "./device-reservations";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function makeReservation(overrides?: Partial<DeviceReservationRef>): DeviceReservationRef {
  return {
    status: "requested",
    date: "2026-05-28",
    time: "19:00",
    partySize: 4,
    tableLabel: "Mesa 1",
    createdAt: "2026-05-27T20:00:00.000Z",
    updatedAt: "2026-05-27T20:00:00.000Z",
    ...overrides,
  };
}

describe("device-reservations storage", () => {
  it("returns empty store when key does not exist", () => {
    const storage = new MemoryStorage();
    const store = readDeviceReservations(storage);
    expect(store.version).toBe(1);
    expect(store.reservations).toEqual([]);
  });

  it("repairs invalid store payload to empty", () => {
    const storage = new MemoryStorage();
    storage.setItem(getDeviceReservationsKey(), "not-json");
    const store = readDeviceReservations(storage);
    expect(store.reservations).toEqual([]);
  });

  it("upserts without duplication for the same local reservation", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(makeReservation(), storage);
    upsertDeviceReservation(makeReservation({ status: "approved" }), storage);
    const store = readDeviceReservations(storage);
    expect(store.reservations).toHaveLength(1);
    expect(store.reservations[0].status).toBe("approved");
  });

  it("upserts by reservationNumber when present", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(
      makeReservation({
        reservationNumber: "RSV-ABC123",
        reservationLookupToken: "token_1",
      }),
      storage,
    );
    upsertDeviceReservation(
      makeReservation({
        reservationNumber: "RSV-ABC123",
        reservationLookupToken: "token_2",
        status: "approved",
      }),
      storage,
    );

    const store = readDeviceReservations(storage);
    expect(store.reservations).toHaveLength(1);
    expect(store.reservations[0].reservationLookupToken).toBe("token_2");
    expect(store.reservations[0].status).toBe("approved");
  });

  it("orders active reservations first and then by updatedAt desc", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(
      makeReservation({
        status: "cancelled",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z",
      }),
      storage,
    );
    upsertDeviceReservation(
      makeReservation({
        status: "requested",
        date: "2026-05-29",
        createdAt: "2026-05-27T07:00:00.000Z",
        updatedAt: "2026-05-27T07:00:00.000Z",
      }),
      storage,
    );
    upsertDeviceReservation(
      makeReservation({
        status: "approved",
        date: "2026-05-30",
        createdAt: "2026-05-27T09:00:00.000Z",
        updatedAt: "2026-05-27T09:00:00.000Z",
      }),
      storage,
    );

    const store = readDeviceReservations(storage);
    expect(store.reservations.map((reservation) => reservation.date)).toEqual([
      "2026-05-30",
      "2026-05-29",
      "2026-05-28",
    ]);
  });

  it("strips PII and internal fields before persisting", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(
      {
        ...makeReservation(),
        customerName: "Maria",
        customerWhatsapp: "+50588887777",
        notes: "cumpleanos",
        tableId: "table_01",
        id: "internal_reservation_id",
      } as DeviceReservationRef,
      storage,
    );

    const raw = storage.getItem(getDeviceReservationsKey());
    expect(raw).not.toContain("Maria");
    expect(raw).not.toContain("+50588887777");
    expect(raw).not.toContain("cumpleanos");
    expect(raw).not.toContain("table_01");
    expect(raw).not.toContain("internal_reservation_id");
  });

  it("preserves legacy reservations without tracking token", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(
      makeReservation({
        reservationNumber: undefined,
        reservationLookupToken: undefined,
      }),
      storage,
    );

    const store = readDeviceReservations(storage);
    expect(store.reservations[0].reservationNumber).toBeUndefined();
    expect(store.reservations[0].reservationLookupToken).toBeUndefined();
  });

  it("limits to 30 records", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 35; i++) {
      upsertDeviceReservation(
        makeReservation({
          date: `2026-05-${String(i + 1).padStart(2, "0")}`,
          createdAt: new Date(2026, 4, 1, 0, i, 0).toISOString(),
          updatedAt: new Date(2026, 4, 1, 0, i, 0).toISOString(),
        }),
        storage,
      );
    }
    const store = readDeviceReservations(storage);
    expect(store.reservations).toHaveLength(30);
  });

  it("clears the store", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(makeReservation(), storage);
    clearDeviceReservations(storage);
    const store = readDeviceReservations(storage);
    expect(store.reservations).toHaveLength(0);
  });
});
