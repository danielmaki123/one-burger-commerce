import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const listInventoryMovementsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/inventory/adapters/prisma-inventory-repository", () => ({
  PrismaInventoryRepository: class {},
}));

vi.mock("@/modules/inventory/features/list-inventory-movements/list-inventory-movements", () => ({
  listInventoryMovements: listInventoryMovementsMock,
}));

describe("GET /api/admin/inventory/movements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/admin/inventory/movements");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid query params", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/admin/inventory/movements?limit=0");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
