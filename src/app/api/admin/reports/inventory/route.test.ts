import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const getInventoryReportMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/dashboard/features/get-inventory-report/get-inventory-report", () => ({
  getInventoryReport: getInventoryReportMock,
}));

describe("GET /api/admin/reports/inventory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/inventory?dateFrom=2026-05-01&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns data/meta payload for owner", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getInventoryReportMock.mockResolvedValueOnce({
      data: {
        movements: { counts: 2, receives: 3, wastes: 1, total: 6 },
        items: [{ itemId: "item_1", itemName: "Harina", netChange: 5 }],
      },
      meta: { dateFrom: "2026-05-01", dateTo: "2026-05-21" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/inventory?dateFrom=2026-05-01&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.movements.total).toBe(6);
    expect(body.data.items[0].netChange).toBe(5);
  });

  it("returns data/meta payload for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "manager" },
    });
    getInventoryReportMock.mockResolvedValueOnce({
      data: {
        movements: { counts: 1, receives: 2, wastes: 0, total: 3 },
        items: [],
      },
      meta: { dateFrom: "2026-05-01", dateTo: "2026-05-21" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/inventory?dateFrom=2026-05-01&dateTo=2026-05-21"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.movements.total).toBe(3);
  });

  it("returns empty report when no data", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getInventoryReportMock.mockResolvedValueOnce({
      data: {
        movements: { counts: 0, receives: 0, wastes: 0, total: 0 },
        items: [],
      },
      meta: { dateFrom: "2026-05-01", dateTo: "2026-05-01" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/inventory?dateFrom=2026-05-01&dateTo=2026-05-01"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.movements.total).toBe(0);
    expect(body.data.items).toEqual([]);
  });

  it("returns BAD_REQUEST when dateFrom is invalid", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/reports/inventory?dateFrom=invalid&dateTo=2026-05-21"),
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
      new Request("http://localhost/api/admin/reports/inventory?dateFrom=2026-05-01"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
