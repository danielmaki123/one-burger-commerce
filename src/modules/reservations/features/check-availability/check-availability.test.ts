import { describe, expect, it } from "vitest";

import { InMemoryReservationRepository } from "@/modules/reservations/adapters/in-memory-reservation-repository";

import { checkAvailability } from "./check-availability";

function createRepository(): InMemoryReservationRepository {
  return new InMemoryReservationRepository();
}

function seedTable(repository: InMemoryReservationRepository, overrides?: Partial<typeof repository.tables[0]>) {
  const table = {
    id: "table_01",
    label: "Mesa 1",
    capacity: 4,
    isActive: true,
    ...overrides,
  };
  repository.tables.push(table);
  return table;
}

describe("checkAvailability", () => {
  it("returns tables with availability for date and party size", async () => {
    const repository = createRepository();
    seedTable(repository);

    const result = await checkAvailability(
      { date: "2026-05-14", partySize: 2 },
      { repository },
    );

    expect(result.data.tables).toHaveLength(1);
    expect(result.data.tables[0].isAvailable).toBe(true);
    expect(result.meta.date).toBe("2026-05-14");
    expect(result.meta.durationMinutes).toBe(120);
  });

  it("marks table unavailable when capacity is insufficient", async () => {
    const repository = createRepository();
    seedTable(repository, { capacity: 2 });

    const result = await checkAvailability(
      { date: "2026-05-14", partySize: 4 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(false);
  });

  it("marks table unavailable when inactive", async () => {
    const repository = createRepository();
    seedTable(repository, { isActive: false });

    const result = await checkAvailability(
      { date: "2026-05-14", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(false);
  });

  it("marks table unavailable when blocked reservation overlaps requested time", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_01",
      status: "requested",
      customerName: "Maria",
      customerWhatsapp: "+50588887777",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await checkAvailability(
      { date: "2026-05-14", time: "20:00", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(false);
  });

  it("marks table unavailable when blocked reservation has approved status", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_approved",
      status: "approved",
      customerName: "Maria",
      customerWhatsapp: "+50588887777",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await checkAvailability(
      { date: "2026-05-14", time: "19:00", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(false);
  });

  it("marks table available when blocked reservation does not overlap requested time", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_01",
      status: "approved",
      customerName: "Maria",
      customerWhatsapp: "+50588887777",
      date: "2026-05-14",
      time: "12:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await checkAvailability(
      { date: "2026-05-14", time: "15:00", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(true);
  });

  it("marks table unavailable when blocked reservation has seated status", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_seated",
      status: "seated",
      customerName: "Maria",
      customerWhatsapp: "+50588887777",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await checkAvailability(
      { date: "2026-05-14", time: "19:00", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(false);
  });

  it("marks table available when reservation is rejected on the date", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_01",
      status: "rejected",
      customerName: "Maria",
      customerWhatsapp: "+50588887777",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await checkAvailability(
      { date: "2026-05-14", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(true);
  });

  it("rejects invalid date format", async () => {
    const repository = createRepository();
    await expect(
      checkAvailability({ date: "14-05-2026", partySize: 2 }, { repository }),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects invalid partySize", async () => {
    const repository = createRepository();
    await expect(
      checkAvailability({ date: "2026-05-14", partySize: 0 }, { repository }),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects invalid optional time format", async () => {
    const repository = createRepository();
    await expect(
      checkAvailability({ date: "2026-05-14", time: "7 PM", partySize: 2 }, { repository }),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("allows availability check at 20:00", async () => {
    const repository = createRepository();
    seedTable(repository);

    const result = await checkAvailability(
      { date: "2026-05-14", time: "20:00", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(true);
  });

  it("marks table available when reservation is cancelled on the date", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_cancelled",
      status: "cancelled",
      customerName: "Maria",
      customerWhatsapp: "+50588887777",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await checkAvailability(
      { date: "2026-05-14", time: "19:00", partySize: 2 },
      { repository },
    );

    expect(result.data.tables[0].isAvailable).toBe(true);
  });

  it("rejects availability check before business hours (09:00)", async () => {
    const repository = createRepository();
    await expect(
      checkAvailability({ date: "2026-05-14", time: "09:00", partySize: 2 }, { repository }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects availability check after last allowed hour (22:00)", async () => {
    const repository = createRepository();
    await expect(
      checkAvailability({ date: "2026-05-14", time: "22:00", partySize: 2 }, { repository }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });
});
