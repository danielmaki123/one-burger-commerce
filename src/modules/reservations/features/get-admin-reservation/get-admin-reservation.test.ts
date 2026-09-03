import { describe, expect, it } from "vitest";

import { InMemoryReservationRepository } from "@/modules/reservations/adapters/in-memory-reservation-repository";
import { getAdminReservation } from "@/modules/reservations/features/get-admin-reservation/get-admin-reservation";

describe("getAdminReservation", () => {
  it("returns reservation detail", async () => {
    const repository = new InMemoryReservationRepository();
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

    const result = await getAdminReservation("res_01", { repository });

    expect(result.data.id).toBe("res_01");
  });

  it("returns 404 when reservation does not exist", async () => {
    const repository = new InMemoryReservationRepository();

    await expect(
      getAdminReservation("res_missing", { repository }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
