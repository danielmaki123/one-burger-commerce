import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const listInventoryAlertsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/inventory/adapters/prisma-inventory-repository", () => ({
  PrismaInventoryRepository: class {},
}));

vi.mock("@/modules/inventory/features/list-inventory-alerts/list-inventory-alerts", () => ({
  listInventoryAlerts: listInventoryAlertsMock,
}));

describe("GET /api/admin/inventory/alerts", () => {
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

  it("returns data/meta payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    listInventoryAlertsMock.mockResolvedValueOnce({
      data: [{ inventoryItemId: "item_1", currentEstimatedStock: 0, lowStockThreshold: 2, severity: "critical" }],
      meta: { total: 1 },
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].severity).toBe("critical");
  });
});
