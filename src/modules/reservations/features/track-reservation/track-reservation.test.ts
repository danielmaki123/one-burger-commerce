import { describe, expect, it } from "vitest";

import { InMemoryReservationRepository } from "@/modules/reservations/adapters/in-memory-reservation-repository";
import { hashReservationLookupToken } from "@/modules/reservations/domain/reservation-tracking";

import { trackReservation } from "./track-reservation";

function createRepository() {
  const repository = new InMemoryReservationRepository();
  repository.reservations.push({
    id: "res_01",
    status: "approved",
    customerName: "Maria Lopez",
    customerWhatsapp: "+50588887777",
    customerId: "customer_01",
    reservationNumber: "RSV-ABC123",
    reservationLookupTokenHash: hashReservationLookupToken("token_ok"),
    date: "2026-06-01",
    time: "19:00",
    partySize: 4,
    tableId: "table_01",
    tableLabel: "Mesa 1",
    notes: "cumpleanos",
    createdAt: "2026-06-01T18:00:00.000Z",
    updatedAt: "2026-06-01T18:30:00.000Z",
  });
  return repository;
}

describe("trackReservation", () => {
  it("returns public-safe payload for valid number + token", async () => {
    const repository = createRepository();

    const result = await trackReservation(
      {
        reservationNumber: "rsv-abc123",
        reservationLookupToken: "token_ok",
      },
      { repository },
    );

    expect(result.data).toMatchObject({
      reservationNumber: "RSV-ABC123",
      status: "approved",
      statusLabel: "Confirmada",
      date: "2026-06-01",
      time: "19:00",
      partySize: 4,
      tableLabel: "Mesa 1",
      updatedAt: "2026-06-01T18:30:00.000Z",
    });
    expect((result.data as Record<string, unknown>).id).toBeUndefined();
    expect((result.data as Record<string, unknown>).tableId).toBeUndefined();
    expect((result.data as Record<string, unknown>).notes).toBeUndefined();
    expect((result.data as Record<string, unknown>).customerWhatsapp).toBeUndefined();
  });

  it("returns 404 when token is invalid", async () => {
    const repository = createRepository();

    await expect(
      trackReservation(
        {
          reservationNumber: "RSV-ABC123",
          reservationLookupToken: "token_bad",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("returns 400 for invalid payload", async () => {
    const repository = createRepository();

    await expect(
      trackReservation(
        { reservationNumber: "", reservationLookupToken: "" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });
});
