import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const updateSubcategoryMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/update-subcategory/update-subcategory", () => ({
  updateSubcategory: updateSubcategoryMock,
}));

vi.mock("@/modules/menu/features/delete-subcategory/delete-subcategory", () => ({
  deleteSubcategory: vi.fn(),
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu subcategory by id route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("PATCH returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/subcategories/sub_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "sub_1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("PATCH returns 401 when there is no admin session", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/subcategories/sub_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId: "cat_2" }),
      }),
      { params: Promise.resolve({ id: "sub_1" }) },
    );

    expect(response.status).toBe(401);
    expect(updateSubcategoryMock).not.toHaveBeenCalled();
  });

  it("PATCH accepts categoryId to move a subcategory", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageMenuMock.mockReturnValueOnce(true);
    updateSubcategoryMock.mockResolvedValueOnce({
      data: { id: "sub_1", categoryId: "cat_2" },
      meta: { updatedAt: "2026-07-22T00:00:00.000Z", movedProducts: 2 },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/subcategories/sub_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId: "cat_2" }),
      }),
      { params: Promise.resolve({ id: "sub_1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateSubcategoryMock).toHaveBeenCalledWith(
      "sub_1",
      { categoryId: "cat_2" },
      expect.anything(),
    );
  });

  it("PATCH rejects an empty categoryId", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageMenuMock.mockReturnValueOnce(true);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/subcategories/sub_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId: "" }),
      }),
      { params: Promise.resolve({ id: "sub_1" }) },
    );

    expect(response.status).toBe(400);
    expect(updateSubcategoryMock).not.toHaveBeenCalled();
  });

  it("DELETE returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/admin/menu/subcategories/sub_1"), {
      params: Promise.resolve({ id: "sub_1" }),
    });

    expect(response.status).toBe(403);
  });
});

