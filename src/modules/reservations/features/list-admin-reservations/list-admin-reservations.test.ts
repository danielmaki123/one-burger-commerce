import { describe, expect, it } from "vitest";

import { InMemoryReservationRepository } from "@/modules/reservations/adapters/in-memory-reservation-repository";

import { listAdminReservations } from "./list-admin-reservations";

function createRepository(): InMemoryReservationRepository {
  return new InMemoryReservationRepository();
}

describe("listAdminReservations", () => {
  it("lists all reservations", async () => {
    const repository = createRepository();
    repository.reservations.push({
      id: "res_01",
      status: "requested",
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
    });

    const result = await listAdminReservations({}, { repository });

    expect(result.data).toHaveLength(1);
    expect(result.meta.count).toBe(1);
  });

  it("filters by status", async () => {
    const repository = createRepository();
    repository.reservations.push(
      {
        id: "res_01",
        status: "requested",
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
      },
      {
        id: "res_02",
        status: "approved",
        customerName: "Juan",
        customerWhatsapp: "+50588886666",
        date: "2026-05-14",
        time: "20:00",
        partySize: 2,
        tableId: "table_02",
        tableLabel: "Mesa 2",
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    const result = await listAdminReservations(
      { status: "approved" },
      { repository },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe("approved");
  });

  it("filters by date", async () => {
    const repository = createRepository();
    repository.reservations.push(
      {
        id: "res_01",
        status: "requested",
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
      },
      {
        id: "res_02",
        status: "requested",
        customerName: "Juan",
        customerWhatsapp: "+50588886666",
        date: "2026-05-15",
        time: "20:00",
        partySize: 2,
        tableId: "table_02",
        tableLabel: "Mesa 2",
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    const result = await listAdminReservations(
      { date: "2026-05-15" },
      { repository },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].date).toBe("2026-05-15");
  });
});
