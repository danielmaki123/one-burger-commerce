import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const listOutboxEventsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/notifications/adapters/prisma-outbox-repository", () => ({
  PrismaOutboxRepository: class {},
}));

vi.mock("@/modules/notifications/features/list-outbox-events/list-outbox-events", () => ({
  listOutboxEvents: listOutboxEventsMock,
}));

describe("GET /api/admin/outbox/events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/outbox/events"),
    );

    expect(response.status).toBe(401);
    expect(listOutboxEventsMock).not.toHaveBeenCalled();
  });

  it("returns 403 for kitchen because outbox payloads carry customer PII", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_kitchen", role: "kitchen" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/outbox/events"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listOutboxEventsMock).not.toHaveBeenCalled();
  });

  it("returns 403 for manager because outbox payloads carry customer PII", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_manager", role: "manager" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/outbox/events"),
    );

    expect(response.status).toBe(403);
    expect(listOutboxEventsMock).not.toHaveBeenCalled();
  });

  it("returns the event list for owner", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_owner", role: "owner" },
    });
    listOutboxEventsMock.mockResolvedValueOnce({
      data: [{ id: "evt_01" }],
      meta: { count: 1 },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/outbox/events?status=pending"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.count).toBe(1);
  });
});
