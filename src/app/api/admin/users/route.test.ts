import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const listAdminUsersMock = vi.fn();
const createAdminUserMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: vi.fn(function () {
    return {};
  }),
}));

vi.mock("@/modules/auth/features/list-admin-users/list-admin-users", () => ({
  listAdminUsers: listAdminUsersMock,
}));

vi.mock("@/modules/auth/features/create-admin-user/create-admin-user", () => ({
  createAdminUser: createAdminUserMock,
}));

describe("admin users route", () => {
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
  }, 10000);

  it("GET delegates listing with actor role", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "owner_1", role: "owner" },
    });
    listAdminUsersMock.mockResolvedValueOnce({ data: [] });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(listAdminUsersMock).toHaveBeenCalledWith({
      repository: expect.any(Object),
      actorRole: "owner",
    });
  });

  it("POST creates a user with role", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "owner_1", role: "owner" },
    });
    createAdminUserMock.mockResolvedValueOnce({
      data: {
        id: "user_2",
        name: "Cocina",
        email: "cocina@oneburger.local",
        role: "kitchen",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Cocina",
          email: "cocina@oneburger.local",
          password: "Admin1234!",
          role: "kitchen",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createAdminUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "kitchen" }),
      {
        repository: expect.any(Object),
        locationRepository: expect.any(Object),
        actorRole: "owner",
      },
    );
  });

  it("POST pasa las sucursales asignadas al caso de uso (A)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "owner_1", role: "owner" },
    });
    createAdminUserMock.mockResolvedValueOnce({
      data: {
        id: "user_3",
        name: "Cocina Norte",
        email: "norte@oneburger.local",
        role: "kitchen",
        locationIds: ["loc_norte"],
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Cocina Norte",
          email: "norte@oneburger.local",
          password: "Admin1234!",
          role: "kitchen",
          locationIds: ["loc_norte"],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createAdminUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationIds: ["loc_norte"] }),
      expect.objectContaining({ locationRepository: expect.any(Object) }),
    );
  });
});
