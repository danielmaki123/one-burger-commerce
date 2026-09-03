import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageMenuMock = vi.fn();
const listAdminMarketingBlocksMock = vi.fn();
const createMarketingBlockMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageMenu: canManageMenuMock,
}));

vi.mock("@/modules/menu/features/list-admin-marketing-blocks/list-admin-marketing-blocks", () => ({
  listAdminMarketingBlocks: listAdminMarketingBlocksMock,
}));

vi.mock("@/modules/menu/features/create-marketing-block/create-marketing-block", () => ({
  createMarketingBlock: createMarketingBlockMock,
}));

vi.mock("@/modules/menu/adapters/prisma-menu-repository", () => ({
  PrismaMenuRepository: class {},
}));

describe("admin menu marketing blocks route", () => {
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

  it("POST returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "kitchen" },
    });
    canManageMenuMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/marketing-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "promo",
          title: "Promo",
          ctaType: "none",
          isActive: true,
          sortOrder: 0,
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("POST returns 400 for invalid payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageMenuMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/menu/marketing-blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "promo",
          title: "",
          ctaType: "none",
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
