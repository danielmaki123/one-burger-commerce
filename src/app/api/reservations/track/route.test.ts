import { beforeEach, describe, expect, it, vi } from "vitest";

const trackReservationMock = vi.fn();

vi.mock("@/modules/reservations/adapters/prisma-reservation-repository", () => ({
  PrismaReservationRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/modules/reservations/features/track-reservation/track-reservation", () => ({
  trackReservation: trackReservationMock,
}));

describe("POST /api/reservations/track", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/reservations/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reservationNumber: "", reservationLookupToken: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 with public-safe tracking payload", async () => {
    trackReservationMock.mockResolvedValueOnce({
      data: {
        reservationNumber: "RSV-ABC123",
        status: "approved",
        statusLabel: "Confirmada",
        date: "2026-06-01",
        time: "19:00",
        partySize: 4,
        tableLabel: "Mesa 1",
        updatedAt: "2026-06-01T18:30:00.000Z",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/reservations/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationNumber: "RSV-ABC123",
          reservationLookupToken: "token_ok",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.reservationNumber).toBe("RSV-ABC123");
    expect(body.data.statusLabel).toBe("Confirmada");
    expect(body.data.id).toBeUndefined();
    expect(body.data.tableId).toBeUndefined();
    expect(body.data.notes).toBeUndefined();
    expect(body.data.customerWhatsapp).toBeUndefined();
  });
});
