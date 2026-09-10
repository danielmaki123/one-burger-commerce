import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const updateAdminUserRoleMock = vi.fn();
const deleteAdminUserMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: class {},
}));

vi.mock("@/modules/auth/features/update-admin-user-role/update-admin-user-role", () => ({
  updateAdminUserRole: updateAdminUserRoleMock,
}));

vi.mock("@/modules/auth/features/delete-admin-user/delete-admin-user", () => ({
  deleteAdminUser: deleteAdminUserMock,
}));

describe("admin user lifecycle routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_owner", role: "owner" },
    });
  });

  it("returns 401 for PATCH when the session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "manager" }),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );

    expect(response.status).toBe(401);
    expect(updateAdminUserRoleMock).not.toHaveBeenCalled();
  });

  it("returns 400 for PATCH with an invalid role before calling the use case", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "superadmin" }),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(updateAdminUserRoleMock).not.toHaveBeenCalled();
  });

  it("updates the role passing the actor identity", async () => {
    updateAdminUserRoleMock.mockResolvedValueOnce({
      data: { id: "user_2", role: "manager" },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "manager" }),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.role).toBe("manager");
    expect(updateAdminUserRoleMock).toHaveBeenCalledWith(
      { userId: "user_2", role: "manager" },
      expect.objectContaining({
        actorRole: "owner",
        actorUserId: "admin_owner",
        repository: expect.anything(),
      }),
    );
  });

  it("returns 403 when the role cannot manage users", async () => {
    updateAdminUserRoleMock.mockRejectedValueOnce(
      new AuthError(403, "FORBIDDEN", "Insufficient permissions"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "manager" }),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("deletes a user and returns the revoked id", async () => {
    deleteAdminUserMock.mockResolvedValueOnce({ data: { id: "user_2" } });

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("user_2");
    expect(deleteAdminUserMock).toHaveBeenCalledWith(
      { userId: "user_2" },
      expect.objectContaining({
        actorRole: "owner",
        actorUserId: "admin_owner",
      }),
    );
  });

  it("returns 401 for DELETE when the session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );

    expect(response.status).toBe(401);
    expect(deleteAdminUserMock).not.toHaveBeenCalled();
  });
});
