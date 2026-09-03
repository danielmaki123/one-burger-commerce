import { describe, expect, it } from "vitest";

import {
  readDeviceReservations,
  upsertDeviceReservation,
} from "./device-reservations";
import { syncTrackedReservationToDeviceReservations } from "./reservation-tracking-sync";

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

describe("reservation-tracking sync", () => {
  it("refreshes reservation with token and keeps createdAt", () => {
    const storage = new MemoryStorage();
    upsertDeviceReservation(
      {
        status: "requested",
        reservationNumber: "RSV-ABC123",
        reservationLookupToken: "token_old",
        date: "2026-06-01",
        time: "19:00",
        partySize: 4,
        tableLabel: "Mesa 1",
        createdAt: "2026-06-01T18:00:00.000Z",
        updatedAt: "2026-06-01T18:00:00.000Z",
      },
      storage,
    );

    syncTrackedReservationToDeviceReservations(
      {
        reservationNumber: "RSV-ABC123",
        status: "approved",
        statusLabel: "Confirmada",
        date: "2026-06-01",
        time: "19:00",
        partySize: 4,
        tableLabel: "Mesa 4",
        updatedAt: "2026-06-01T18:30:00.000Z",
      },
      {
        reservationLookupToken: "token_new",
        checkedAt: "2026-06-01T18:31:00.000Z",
        storage,
      },
    );

    const stored = readDeviceReservations(storage).reservations[0];
    expect(stored.status).toBe("approved");
    expect(stored.reservationLookupToken).toBe("token_new");
    expect(stored.createdAt).toBe("2026-06-01T18:00:00.000Z");
    expect(stored.lastCheckedAt).toBe("2026-06-01T18:31:00.000Z");
    expect(stored.stale).toBe(false);
  });

  it("inserts tracked reservation when it does not exist locally", () => {
    const storage = new MemoryStorage();
    syncTrackedReservationToDeviceReservations(
      {
        reservationNumber: "RSV-NEW001",
        status: "requested",
        statusLabel: "Solicitada",
        date: "2026-06-02",
        time: "20:00",
        partySize: 2,
        updatedAt: "2026-06-02T19:10:00.000Z",
      },
      {
        reservationLookupToken: "token_new_001",
        checkedAt: "2026-06-02T19:11:00.000Z",
        storage,
      },
    );

    const stored = readDeviceReservations(storage).reservations[0];
    expect(stored.reservationNumber).toBe("RSV-NEW001");
    expect(stored.reservationLookupToken).toBe("token_new_001");
    expect(stored.status).toBe("requested");
  });
});
