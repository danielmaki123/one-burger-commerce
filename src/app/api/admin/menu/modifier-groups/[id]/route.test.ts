import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const getAdminModifierGroupMock = vi.fn();
const updateModifierGroupMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/get-admin-modifier-group/get-admin-modifier-group", () => ({
  getAdminModifierGroup: getAdminModifierGroupMock,
}));

vi.mock("@/modules/menu/features/update-modifier-group/update-modifier-group", () => ({
  updateModifierGroup: updateModifierGroupMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu modifier group by id route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/menu/modifier-groups/mg_1"), {
      params: Promise.resolve({ id: "mg_1" }),
    });
    expect(response.status).toBe(401);
  });

  it("GET returns 200 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1" } });
    getAdminModifierGroupMock.mockResolvedValueOnce({
      data: { id: "mg_1", name: "Size", isRequired: true, minSelections: 1, maxSelections: 1, sortOrder: 0, options: [] },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/menu/modifier-groups/mg_1"), {
      params: Promise.resolve({ id: "mg_1" }),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe("mg_1");
  });

  it("PATCH returns 200 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageMenuMock.mockReturnValueOnce(true);
    updateModifierGroupMock.mockResolvedValueOnce({
      data: { id: "mg_1", name: "Updated", isRequired: true, minSelections: 1, maxSelections: 1, sortOrder: 0, options: [] },
      meta: { updatedAt: "2026-06-07T00:00:00.000Z" },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/modifier-groups/mg_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "mg_1" }) },
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.name).toBe("Updated");
  });

  it("PATCH returns 400 on invalid payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageMenuMock.mockReturnValueOnce(true);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/modifier-groups/mg_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sortOrder: "not-a-number" }),
      }),
      { params: Promise.resolve({ id: "mg_1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("PATCH returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/modifier-groups/mg_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ id: "mg_1" }) },
    );
    expect(response.status).toBe(403);
  });
});
