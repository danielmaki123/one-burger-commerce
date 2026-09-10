import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const getAdminOverviewPerformanceMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock(
  "@/modules/dashboard/features/get-admin-overview-performance/get-admin-overview-performance",
  () => ({
    getAdminOverviewPerformance: getAdminOverviewPerformanceMock,
  }),
);

const responsePayload = {
  data: {
    metrics: {
      completedOrderValue: { current: 100, previous: 50, changePercent: 100 },
      completedOrderCount: { current: 1, previous: 1, changePercent: 0 },
      averageTicket: { current: 100, previous: 50, changePercent: 100 },
    },
    series: [
      {
        key: "2026-07-22",
        label: "07-22",
        completedOrderValue: 100,
        completedOrderCount: 1,
      },
    ],
    topProducts: [
      {
        productId: "product-1",
        productName: "Tostada",
        units: 2,
        completedOrderValue: 100,
      },
    ],
  },
  meta: {
    generatedAt: "2026-07-22T18:30:00.000Z",
    timeZone: "America/Managua",
    period: "7d",
    channel: "all",
    ranges: {
      current: {
        localStartDate: "2026-07-16",
        localEndDate: "2026-07-22",
        utcStart: "2026-07-16T06:00:00.000Z",
        utcEnd: "2026-07-23T06:00:00.000Z",
      },
      previous: {
        localStartDate: "2026-07-09",
        localEndDate: "2026-07-15",
        utcStart: "2026-07-09T06:00:00.000Z",
        utcEnd: "2026-07-16T06:00:00.000Z",
      },
    },
  },
};

describe("GET /api/admin/overview/performance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when the admin session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/overview/performance"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Missing session" },
    });
  }, 10000);

  it("returns 403 for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "manager" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/overview/performance"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Insufficient permissions" },
    });
  });

  it("uses 7d/all defaults and returns the exact data/meta payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "owner" },
    });
    getAdminOverviewPerformanceMock.mockResolvedValueOnce(responsePayload);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/overview/performance"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(responsePayload);
    expect(getAdminOverviewPerformanceMock).toHaveBeenCalledWith("7d", "all");
  });

  it("returns BAD_REQUEST for an invalid period", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "owner" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/overview/performance?period=year&channel=all",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid query params",
        fields: { period: expect.any(String) },
      },
    });
  });

  it("returns BAD_REQUEST for an invalid channel", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "owner" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/overview/performance?period=7d&channel=table",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid query params",
        fields: { channel: expect.any(String) },
      },
    });
  });

  it("returns a safe error when the feature fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "owner" },
    });
    getAdminOverviewPerformanceMock.mockRejectedValueOnce(
      new Error("database password leaked"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/overview/performance"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      },
    });
  });
});
