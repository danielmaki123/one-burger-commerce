import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const listAdminModifierGroupsMock = vi.fn();
const createModifierGroupMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/list-admin-modifier-groups/list-admin-modifier-groups", () => ({
  listAdminModifierGroups: listAdminModifierGroupsMock,
}));

vi.mock("@/modules/menu/features/create-modifier-group/create-modifier-group", () => ({
  createModifierGroup: createModifierGroupMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu modifier groups route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("POST returns 201 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageMenuMock.mockReturnValueOnce(true);
    createModifierGroupMock.mockResolvedValueOnce({
      data: { id: "mg_1", name: "Size", isRequired: true, minSelections: 1, maxSelections: 1, sortOrder: 0, options: [] },
      meta: { updatedAt: "2026-06-07T00:00:00.000Z" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/modifier-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Size",
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          sortOrder: 0,
          options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
        }),
      }),
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).toBe("mg_1");
  });

  it("POST returns 400 on invalid payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageMenuMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/modifier-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("POST returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/modifier-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Size",
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          sortOrder: 0,
          options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
