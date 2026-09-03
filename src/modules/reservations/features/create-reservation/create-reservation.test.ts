import { describe, expect, it, vi } from "vitest";

import { InMemoryReservationRepository } from "@/modules/reservations/adapters/in-memory-reservation-repository";
import { hashReservationLookupToken } from "@/modules/reservations/domain/reservation-tracking";

import { createReservation } from "./create-reservation";

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

describe("createReservation", () => {
  it("creates a reservation with requested status", async () => {
    const repository = createRepository();
    seedTable(repository);

    const result = await createReservation(
      {
        customerName: "Maria Lopez",
        customerWhatsapp: "+50588887777",
        date: "2026-05-14",
        time: "19:00",
        partySize: 4,
        tableId: "table_01",
        notes: "silla para bebe",
      },
      { repository },
    );

    expect(result.data.status).toBe("requested");
    expect(result.data.customerName).toBe("Maria Lopez");
    expect(result.data.customerWhatsapp).toBe("+50588887777");
    expect(result.data.tableLabel).toBe("Mesa 1");
    expect(result.data.partySize).toBe(4);
    expect(result.meta.sourceOfTruth).toBe("backend");
  });

  it("sets customerId when auto-link resolver returns customer id", async () => {
    const repository = createRepository();
    seedTable(repository);
    const resolveCustomerId = vi.fn().mockResolvedValue("customer_01");

    const result = await createReservation(
      {
        customerName: "Maria Lopez",
        customerWhatsapp: "+50588887777",
        date: "2026-05-14",
        time: "19:00",
        partySize: 2,
        tableId: "table_01",
      },
      { repository, resolveCustomerId },
    );

    expect(resolveCustomerId).toHaveBeenCalledWith({
      fullName: "Maria Lopez",
      whatsappNormalized: "+50588887777",
    });
    expect(result.data.customerId).toBe("customer_01");
  });

  it("continues reservation creation without customerId when auto-link fails", async () => {
    const repository = createRepository();
    seedTable(repository);
    const resolveCustomerId = vi
      .fn()
      .mockRejectedValue(new Error("auto_link_failed"));

    const result = await createReservation(
      {
        customerName: "Maria Lopez",
        customerWhatsapp: "+50588887777",
        date: "2026-05-14",
        time: "19:00",
        partySize: 2,
        tableId: "table_01",
      },
      { repository, resolveCustomerId },
    );

    expect(result.data.id).toBeTruthy();
    expect(result.data.customerId).toBeNull();
    expect(result.data.customerWhatsapp).toBe("+50588887777");
  });

  it("normalizes local Nicaragua whatsapp before saving", async () => {
    const repository = createRepository();
    seedTable(repository);

    const result = await createReservation(
      {
        customerName: "Maria Lopez",
        customerWhatsapp: "8888-7777",
        date: "2026-05-14",
        time: "19:00",
        partySize: 4,
        tableId: "table_01",
      },
      { repository },
    );

    expect(result.data.customerWhatsapp).toBe("+50588887777");
  });

  it("generates reservationNumber, stores token hash and returns public token once", async () => {
    const repository = createRepository();
    seedTable(repository);

    const result = await createReservation(
      {
        customerName: "Maria Lopez",
        customerWhatsapp: "8888-7777",
        date: "2026-05-14",
        time: "19:00",
        partySize: 4,
        tableId: "table_01",
      },
      {
        repository,
        reservationNumberGenerator: () => "RSV-ABC123",
        reservationLookupTokenGenerator: () => "token_reservation_123",
      },
    );

    expect(result.data.reservationNumber).toBe("RSV-ABC123");
    expect(result.data.reservationLookupToken).toBe("token_reservation_123");
    expect((result.data as Record<string, unknown>).reservationLookupTokenHash).toBeUndefined();
    expect(repository.reservations[0]?.reservationLookupTokenHash).toBe(
      hashReservationLookupToken("token_reservation_123"),
    );
  });

  it("retries reservation number generation when unique conflict happens", async () => {
    const repository = createRepository();
    seedTable(repository);
    const createReservationSpy = vi.spyOn(repository, "createReservation");

    createReservationSpy
      .mockRejectedValueOnce({
        code: "P2002",
        meta: { target: ["reservationNumber"] },
      })
      .mockImplementationOnce(async (input) => {
        return {
          id: "res_retry_ok",
          status: "requested",
          customerName: input.customerName,
          customerWhatsapp: input.customerWhatsapp,
          customerId: input.customerId ?? null,
          reservationNumber: input.reservationNumber ?? null,
          reservationLookupTokenHash: input.reservationLookupTokenHash ?? null,
          date: input.date,
          time: input.time,
          partySize: input.partySize,
          tableId: input.tableId,
          tableLabel: input.tableLabel,
          notes: input.notes ?? null,
          createdAt: "2026-05-14T19:00:00.000Z",
          updatedAt: "2026-05-14T19:00:00.000Z",
        };
      });

    const numberGenerator = vi
      .fn()
      .mockReturnValueOnce("RSV-COLLID")
      .mockReturnValueOnce("RSV-UNIQUE");

    const result = await createReservation(
      {
        customerName: "Maria Lopez",
        customerWhatsapp: "8888-7777",
        date: "2026-05-14",
        time: "19:00",
        partySize: 4,
        tableId: "table_01",
      },
      {
        repository,
        reservationNumberGenerator: numberGenerator,
        reservationLookupTokenGenerator: () => "token_retry",
      },
    );

    expect(numberGenerator).toHaveBeenCalledTimes(2);
    expect(result.data.reservationNumber).toBe("RSV-UNIQUE");
  });

  it("rejects invalid whatsapp format", async () => {
    const repository = createRepository();
    seedTable(repository);

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "1234567",
          date: "2026-05-14",
          time: "19:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
      fields: { customerWhatsapp: "Invalid format" },
    });
  });

  it("rejects missing customerName", async () => {
    const repository = createRepository();
    seedTable(repository);

    await expect(
      createReservation(
        {
          customerName: "",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "19:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects invalid date format", async () => {
    const repository = createRepository();
    seedTable(repository);

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "14-05-2026",
          time: "19:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects invalid time format", async () => {
    const repository = createRepository();
    seedTable(repository);

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "7 PM",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("allows reservation at 20:00", async () => {
    const repository = createRepository();
    seedTable(repository);

    const result = await createReservation(
      {
        customerName: "Maria",
        customerWhatsapp: "+50588887777",
        date: "2026-05-14",
        time: "20:00",
        partySize: 2,
        tableId: "table_01",
      },
      { repository },
    );

    expect(result.data.status).toBe("requested");
  });

  it("rejects reservation before business hours (09:00)", async () => {
    const repository = createRepository();
    seedTable(repository);

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "09:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects reservation after last allowed hour (22:00)", async () => {
    const repository = createRepository();
    seedTable(repository);

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "22:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects party size exceeding capacity", async () => {
    const repository = createRepository();
    seedTable(repository, { capacity: 2 });

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "19:00",
          partySize: 4,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects inactive table", async () => {
    const repository = createRepository();
    seedTable(repository, { isActive: false });

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "19:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("rejects non-existent table", async () => {
    const repository = createRepository();

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "19:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("rejects table with conflicting reservation", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_01",
      status: "requested",
      customerName: "Juan",
      customerWhatsapp: "+50588886666",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      createReservation(
        {
          customerName: "Maria",
          customerWhatsapp: "+50588887777",
          date: "2026-05-14",
          time: "20:00",
          partySize: 2,
          tableId: "table_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("allows reservation when existing is cancelled", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_01",
      status: "cancelled",
      customerName: "Juan",
      customerWhatsapp: "+50588886666",
      date: "2026-05-14",
      time: "19:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await createReservation(
      {
        customerName: "Maria",
        customerWhatsapp: "+50588887777",
        date: "2026-05-14",
        time: "20:00",
        partySize: 2,
        tableId: "table_01",
      },
      { repository },
    );

    expect(result.data.status).toBe("requested");
  });

  it("allows reservation when same table/date has non-overlapping blocking reservation", async () => {
    const repository = createRepository();
    seedTable(repository);
    repository.reservations.push({
      id: "res_01",
      status: "approved",
      customerName: "Juan",
      customerWhatsapp: "+50588886666",
      date: "2026-05-14",
      time: "12:00",
      partySize: 2,
      tableId: "table_01",
      tableLabel: "Mesa 1",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await createReservation(
      {
        customerName: "Maria",
        customerWhatsapp: "+50588887777",
        date: "2026-05-14",
        time: "15:00",
        partySize: 2,
        tableId: "table_01",
      },
      { repository },
    );

    expect(result.data.status).toBe("requested");
  });
});
