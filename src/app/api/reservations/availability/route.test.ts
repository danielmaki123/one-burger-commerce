import { beforeEach, describe, expect, it, vi } from "vitest";

const checkAvailabilityMock = vi.fn();

vi.mock("@/modules/reservations/adapters/prisma-reservation-repository", () => ({
  PrismaReservationRepository: vi.fn().mockImplementation(function Repository() {
    return {};
  }),
}));

vi.mock(
  "@/modules/reservations/features/check-availability/check-availability",
  () => ({
    checkAvailability: checkAvailabilityMock,
  }),
);

describe("GET /api/reservations/availability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("forces dynamic no-store responses", async () => {
    checkAvailabilityMock.mockResolvedValueOnce({
      data: {
        tables: [
          {
            id: "table_01",
            label: "Mesa 1",
            capacity: 4,
            isAvailable: false,
          },
        ],
      },
      meta: {
        date: "2026-05-14",
        time: "19:00",
        partySize: 2,
        durationMinutes: 120,
      },
    });

    const route = await import("./route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/reservations/availability?date=2026-05-14&time=19:00&partySize=2",
      ),
    );

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
