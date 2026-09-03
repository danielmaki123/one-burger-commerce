import { beforeEach, describe, expect, it, vi } from "vitest";

const orderCountMock = vi.fn();
const reservationCountMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    order: {
      count: orderCountMock,
    },
    reservation: {
      count: reservationCountMock,
    },
  }),
}));

import { getAdminOverviewOperations } from "./get-admin-overview-operations";

describe("getAdminOverviewOperations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports current operational counts using the Managua agenda date", async () => {
    orderCountMock.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    reservationCountMock.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    const now = new Date("2026-07-22T02:30:00.000Z");

    const result = await getAdminOverviewOperations(now);

    expect(result).toEqual({
      data: {
        openOrders: 4,
        ordersPendingAction: 2,
        reservationsToday: 3,
        reservationsPendingAction: 1,
      },
      meta: {
        generatedAt: "2026-07-22T02:30:00.000Z",
        timeZone: "America/Managua",
        localDate: "2026-07-21",
      },
    });
    expect(orderCountMock).toHaveBeenNthCalledWith(1, {
      where: {
        status: {
          notIn: ["delivered", "picked_up", "served", "closed", "cancelled"],
        },
      },
    });
    expect(orderCountMock).toHaveBeenNthCalledWith(2, {
      where: { status: { in: ["new", "confirmed", "preparing"] } },
    });
    expect(reservationCountMock).toHaveBeenNthCalledWith(1, {
      where: {
        date: "2026-07-21",
        status: { notIn: ["rejected", "cancelled"] },
      },
    });
    expect(reservationCountMock).toHaveBeenNthCalledWith(2, {
      where: { date: "2026-07-21", status: "requested" },
    });
  });
});
