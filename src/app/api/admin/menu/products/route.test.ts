import { describe, expect, it, vi, beforeEach } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const listAdminProductsMock = vi.fn();
const createProductMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/list-admin-products/list-admin-products", () => ({
  listAdminProducts: listAdminProductsMock,
}));

vi.mock("@/modules/menu/features/create-product/create-product", () => ({
  createProduct: createProductMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu products route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/menu/products"));
    expect(response.status).toBe(401);
  });

  it("POST returns 403 for role without critical config permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId: "cat_1",
          name: "Producto",
          basePrice: 10,
        }),
      }),
    );

    expect(response.status).toBe(403);
  });
});

