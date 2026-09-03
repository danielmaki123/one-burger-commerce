import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const getDailyReportMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/dashboard/features/get-daily-report/get-daily-report", () => ({
  getDailyReport: getDailyReportMock,
}));

describe("GET /api/admin/reports/daily", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/daily?dateFrom=2026-05-01&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "manager" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/daily?dateFrom=2026-05-01&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns data/meta payload for owner", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getDailyReportMock.mockResolvedValueOnce({
      data: {
        orders: { totalCount: 5, totalRevenue: 2500, byStatus: { new: 2, confirmed: 3 } },
        reservations: { totalCount: 3, byStatus: { requested: 1, approved: 2 } },
      },
      meta: { dateFrom: "2026-05-01", dateTo: "2026-05-21" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/daily?dateFrom=2026-05-01&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.orders.totalCount).toBe(5);
    expect(body.data.reservations.byStatus.approved).toBe(2);
    expect(body.meta.dateFrom).toBe("2026-05-01");
  });

  it("returns empty report when no data", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getDailyReportMock.mockResolvedValueOnce({
      data: {
        orders: { totalCount: 0, totalRevenue: 0, byStatus: {} },
        reservations: { totalCount: 0, byStatus: {} },
      },
      meta: { dateFrom: "2026-05-01", dateTo: "2026-05-01" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/daily?dateFrom=2026-05-01&dateTo=2026-05-01"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.orders.totalCount).toBe(0);
    expect(body.data.reservations.totalCount).toBe(0);
  });

  it("returns BAD_REQUEST when dateFrom is invalid", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/daily?dateFrom=invalid&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns BAD_REQUEST when dateTo is missing", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/daily?dateFrom=2026-05-01"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
