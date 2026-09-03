import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const getRecentActivityMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/dashboard/features/get-recent-activity/get-recent-activity", () => ({
  getRecentActivity: getRecentActivityMock,
}));

describe("GET /api/admin/activity/recent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/activity/recent"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "manager" },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/activity/recent"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns data/meta payload for owner", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getRecentActivityMock.mockResolvedValueOnce({
      data: [
        { type: "order", id: "ord_1", description: "Orden A-1", occurredAt: "2026-05-21T10:00:00.000Z" },
      ],
      meta: { limit: 20, count: 1 },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/activity/recent"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].type).toBe("order");
    expect(body.meta.limit).toBe(20);
  });

  it("returns empty array when no activity", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    getRecentActivityMock.mockResolvedValueOnce({
      data: [],
      meta: { limit: 20, count: 0 },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/activity/recent"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta.count).toBe(0);
  });

  it("validates limit query param", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/activity/recent?limit=invalid"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
