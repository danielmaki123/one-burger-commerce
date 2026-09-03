import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageCriticalConfigMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageCriticalConfig: canManageCriticalConfigMock,
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    table: {
      update: updateMock,
    },
  }),
}));

describe("PATCH /api/admin/tables/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/tables/table_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa VIP 1" }),
      }),
      { params: Promise.resolve({ id: "table_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(false);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/tables/table_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa VIP 1" }),
      }),
      { params: Promise.resolve({ id: "table_1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for empty label", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/tables/table_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "" }),
      }),
      { params: Promise.resolve({ id: "table_1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 for valid label update", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);
    updateMock.mockResolvedValueOnce({
      id: "table_1",
      label: "Mesa 1",
      isActive: true,
      capacity: 4,
      locationId: "main",
      qrToken: "qr_1",
      updatedAt: new Date().toISOString(),
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/tables/table_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa 1" }),
      }),
      { params: Promise.resolve({ id: "table_1" }) },
    );

    expect(response.status).toBe(200);
  });
});

