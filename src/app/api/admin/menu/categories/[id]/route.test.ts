import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const updateCategoryMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/update-category/update-category", () => ({
  updateCategory: updateCategoryMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu categories by id route", () => {
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
      new Request("http://localhost/api/admin/menu/categories/cat_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "cat_1" }) },
    );

    expect(response.status).toBe(403);
  });
});

