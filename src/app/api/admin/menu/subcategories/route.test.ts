import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const listAdminSubcategoriesMock = vi.fn();
const createSubcategoryMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/list-admin-subcategories/list-admin-subcategories", () => ({
  listAdminSubcategories: listAdminSubcategoriesMock,
}));

vi.mock("@/modules/menu/features/create-subcategory/create-subcategory", () => ({
  createSubcategory: createSubcategoryMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu subcategories route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/menu/subcategories"));
    expect(response.status).toBe(401);
  });

  it("POST returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/subcategories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId: "cat_1",
          name: "Sub",
          slug: "sub",
          sortOrder: 0,
          isActive: true,
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

