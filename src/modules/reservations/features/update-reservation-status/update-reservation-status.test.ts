import { describe, expect, it } from "vitest";

import { InMemoryReservationRepository } from "@/modules/reservations/adapters/in-memory-reservation-repository";

import { updateReservationStatus } from "./update-reservation-status";

function createRepository(): InMemoryReservationRepository {
  return new InMemoryReservationRepository();
}

function seedReservation(repository: InMemoryReservationRepository, overrides?: Partial<typeof repository.reservations[0]>) {
  const reservation = {
    id: "res_01",
    status: "requested" as const,
    customerName: "Maria",
    customerWhatsapp: "+50588887777",
    date: "2026-05-14",
    time: "19:00",
    partySize: 4,
    tableId: "table_01",
    tableLabel: "Mesa 1",
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  repository.reservations.push(reservation);
  return reservation;
}

describe("updateReservationStatus", () => {
  it("approves a requested reservation as owner", async () => {
    const repository = createRepository();
    seedReservation(repository);

    const result = await updateReservationStatus(
      "res_01",
      { status: "approved" },
      { repository, admin: { role: "owner" } },
    );

    expect(result.data.status).toBe("approved");
  });

  it("rejects a requested reservation as owner", async () => {
    const repository = createRepository();
    seedReservation(repository);

    const result = await updateReservationStatus(
      "res_01",
      { status: "rejected" },
      { repository, admin: { role: "owner" } },
    );

    expect(result.data.status).toBe("rejected");
  });

  it("forbids manager from updating status", async () => {
    const repository = createRepository();
    seedReservation(repository);

    await expect(
      updateReservationStatus(
        "res_01",
        { status: "approved" },
        { repository, admin: { role: "manager" } },
      ),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects invalid transition", async () => {
    const repository = createRepository();
    seedReservation(repository, { status: "rejected" });

    await expect(
      updateReservationStatus(
        "res_01",
        { status: "approved" },
        { repository, admin: { role: "owner" } },
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("rejects transition to non-existent status", async () => {
    const repository = createRepository();
    seedReservation(repository);

    await expect(
      updateReservationStatus(
        "res_01",
        { status: "nonexistent" as never },
        { repository, admin: { role: "owner" } },
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("returns 404 for non-existent reservation", async () => {
    const repository = createRepository();

    await expect(
      updateReservationStatus(
        "res_unknown",
        { status: "approved" },
        { repository, admin: { role: "owner" } },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("allows approved -> seated transition", async () => {
    const repository = createRepository();
    seedReservation(repository, { status: "approved" });

    const result = await updateReservationStatus(
      "res_01",
      { status: "seated" },
      { repository, admin: { role: "owner" } },
    );

    expect(result.data.status).toBe("seated");
  });

  it("allows approved -> cancelled transition", async () => {
    const repository = createRepository();
    seedReservation(repository, { status: "approved" });

    const result = await updateReservationStatus(
      "res_01",
      { status: "cancelled" },
      { repository, admin: { role: "owner" } },
    );

    expect(result.data.status).toBe("cancelled");
  });

  it("allows approved -> no_show transition", async () => {
    const repository = createRepository();
    seedReservation(repository, { status: "approved" });

    const result = await updateReservationStatus(
      "res_01",
      { status: "no_show" },
      { repository, admin: { role: "owner" } },
    );

    expect(result.data.status).toBe("no_show");
  });

  it("returns reason in meta when provided", async () => {
    const repository = createRepository();
    seedReservation(repository);

    const result = await updateReservationStatus(
      "res_01",
      { status: "approved", reason: "Cliente frecuente" },
      { repository, admin: { role: "owner" } },
    );

    expect(result.meta.reason).toBe("Cliente frecuente");
  });
});
