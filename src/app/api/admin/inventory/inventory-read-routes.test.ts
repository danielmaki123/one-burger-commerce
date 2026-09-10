import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const listInventoryMovementsMock = vi.fn();
const listInventoryAlertsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/inventory/adapters/prisma-inventory-repository", () => ({
  PrismaInventoryRepository: class {},
}));

vi.mock("@/modules/inventory/features/list-inventory-movements/list-inventory-movements", () => ({
  listInventoryMovements: listInventoryMovementsMock,
}));

vi.mock("@/modules/inventory/features/list-inventory-alerts/list-inventory-alerts", () => ({
  listInventoryAlerts: listInventoryAlertsMock,
}));

describe("admin inventory read routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 for kitchen on movements", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_kitchen", role: "kitchen" },
    });

    const { GET } = await import("./movements/route");
    const response = await GET(
      new Request("http://localhost/api/admin/inventory/movements"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listInventoryMovementsMock).not.toHaveBeenCalled();
  });

  it("returns movements for manager", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_manager", role: "manager" },
    });
    listInventoryMovementsMock.mockResolvedValueOnce({
      data: [{ id: "mov_01" }],
      meta: { count: 1 },
    });

    const { GET } = await import("./movements/route");
    const response = await GET(
      new Request("http://localhost/api/admin/inventory/movements"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.count).toBe(1);
  });

  it("returns 403 for kitchen on alerts", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_kitchen", role: "kitchen" },
    });

    const { GET } = await import("./alerts/route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(listInventoryAlertsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./alerts/route");
    const response = await GET();

    expect(response.status).toBe(401);
  });
});
