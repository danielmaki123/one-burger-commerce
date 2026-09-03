import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageInventoryOperationsMock = vi.fn();
const createInventoryCountMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageInventoryOperations: canManageInventoryOperationsMock,
}));

vi.mock("@/modules/inventory/adapters/prisma-inventory-repository", () => ({
  PrismaInventoryRepository: class {},
}));

vi.mock("@/modules/inventory/features/create-inventory-count/create-inventory-count", () => ({
  createInventoryCount: createInventoryCountMock,
}));

describe("POST /api/admin/inventory/counts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 when role cannot manage inventory operations", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "manager" },
    });
    canManageInventoryOperationsMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/admin/inventory/counts", {
      method: "POST",
      body: JSON.stringify({ inventoryItemId: "item_1", countedQuantity: 2 }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 for invalid payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    canManageInventoryOperationsMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/admin/inventory/counts", {
      method: "POST",
      body: JSON.stringify({ inventoryItemId: "", countedQuantity: -1 }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/admin/inventory/counts", {
      method: "POST",
      body: JSON.stringify({ inventoryItemId: "item_1", countedQuantity: 2 }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
