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

  it("PATCH acepta el color de la categoría y lo pasa al caso de uso", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageMenuMock.mockReturnValueOnce(true);
    updateCategoryMock.mockResolvedValueOnce({ data: { id: "cat_1" }, meta: {} });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/categories/cat_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color: "#d32f2f" }),
      }),
      { params: Promise.resolve({ id: "cat_1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateCategoryMock).toHaveBeenCalledWith(
      "cat_1",
      { color: "#d32f2f" },
      expect.anything(),
    );
  });

  it("PATCH rechaza un color que no es #rrggbb", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageMenuMock.mockReturnValueOnce(true);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/categories/cat_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color: "rojo" }),
      }),
      { params: Promise.resolve({ id: "cat_1" }) },
    );

    expect(response.status).toBe(400);
    expect(updateCategoryMock).not.toHaveBeenCalled();
    const payload = (await response.json()) as { error: { fields: Record<string, string> } };
    expect(payload.error.fields.color).toContain("#rrggbb");
  });

  it("PATCH acepta null para sacar el color", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManageMenuMock.mockReturnValueOnce(true);
    updateCategoryMock.mockResolvedValueOnce({ data: { id: "cat_1" }, meta: {} });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/menu/categories/cat_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color: null }),
      }),
      { params: Promise.resolve({ id: "cat_1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateCategoryMock).toHaveBeenCalledWith(
      "cat_1",
      { color: null },
      expect.anything(),
    );
  });
});

