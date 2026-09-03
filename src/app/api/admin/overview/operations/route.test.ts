import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const getAdminOverviewOperationsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock(
  "@/modules/dashboard/features/get-admin-overview-operations/get-admin-overview-operations",
  () => ({
    getAdminOverviewOperations: getAdminOverviewOperationsMock,
  }),
);

describe("GET /api/admin/overview/operations", () => {
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
    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Missing session" },
    });
  });

  it("returns 403 for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "manager" },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Insufficient permissions" },
    });
  });

  it("returns the exact data/meta payload for owner", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "owner" },
    });
    getAdminOverviewOperationsMock.mockResolvedValueOnce({
      data: {
        openOrders: 4,
        ordersPendingAction: 2,
        reservationsToday: 3,
        reservationsPendingAction: 1,
      },
      meta: {
        generatedAt: "2026-07-22T18:30:00.000Z",
        timeZone: "America/Managua",
        localDate: "2026-07-22",
      },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        openOrders: 4,
        ordersPendingAction: 2,
        reservationsToday: 3,
        reservationsPendingAction: 1,
      },
      meta: {
        generatedAt: "2026-07-22T18:30:00.000Z",
        timeZone: "America/Managua",
        localDate: "2026-07-22",
      },
    });
  });

  it("returns a safe error when the feature fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "owner" },
    });
    getAdminOverviewOperationsMock.mockRejectedValueOnce(
      new Error("database password leaked"),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      },
    });
  });
});
