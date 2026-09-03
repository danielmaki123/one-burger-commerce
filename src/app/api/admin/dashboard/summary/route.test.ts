import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const getDashboardSummaryMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/dashboard/features/get-dashboard-summary/get-dashboard-summary", () => ({
  getDashboardSummary: getDashboardSummaryMock,
}));

describe("GET /api/admin/dashboard/summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "manager" },
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns data/meta payload for owner", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getDashboardSummaryMock.mockResolvedValueOnce({
      data: {
        ordersToday: 2,
        ordersPending: 1,
        reservationsToday: 3,
        reservationsPendingAction: 0,
        inventoryCriticalAlerts: 1,
        recentActivityCount: 5,
      },
      meta: { generatedAt: "2026-05-21T00:00:00.000Z" },
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.ordersToday).toBe(2);
    expect(body.data.inventoryCriticalAlerts).toBe(1);
    expect(body.meta.generatedAt).toBeDefined();
  });

  it("returns empty summary when no data", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getDashboardSummaryMock.mockResolvedValueOnce({
      data: {
        ordersToday: 0,
        ordersPending: 0,
        reservationsToday: 0,
        reservationsPendingAction: 0,
        inventoryCriticalAlerts: 0,
        recentActivityCount: 0,
      },
      meta: { generatedAt: "2026-05-21T00:00:00.000Z" },
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.ordersToday).toBe(0);
    expect(body.data.recentActivityCount).toBe(0);
  });
});
