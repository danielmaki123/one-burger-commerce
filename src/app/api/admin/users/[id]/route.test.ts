import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const updateAdminUserRoleMock = vi.fn();
const updateAdminUserLocationsMock = vi.fn();
const deleteAdminUserMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: class {},
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: class {},
}));

vi.mock("@/modules/auth/features/update-admin-user-role/update-admin-user-role", () => ({
  updateAdminUserRole: updateAdminUserRoleMock,
}));

vi.mock(
  "@/modules/auth/features/update-admin-user-locations/update-admin-user-locations",
  () => ({
    updateAdminUserLocations: updateAdminUserLocationsMock,
  }),
);

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

  it("asigna sucursales al usuario (A)", async () => {
    updateAdminUserLocationsMock.mockResolvedValueOnce({
      data: { id: "user_2", role: "kitchen", locationIds: ["loc_norte", "loc_sur"] },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationIds: ["loc_norte", "loc_sur"] }),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.locationIds).toEqual(["loc_norte", "loc_sur"]);
    expect(updateAdminUserLocationsMock).toHaveBeenCalledWith(
      { userId: "user_2", locationIds: ["loc_norte", "loc_sur"] },
      expect.objectContaining({
        actorRole: "owner",
        repository: expect.anything(),
        locationRepository: expect.anything(),
      }),
    );
    // El rol no se toca cuando no vino en el payload: nada de escrituras decorativas.
    expect(updateAdminUserRoleMock).not.toHaveBeenCalled();
  });

  it("cambia el rol y las sucursales en el mismo pedido", async () => {
    updateAdminUserRoleMock.mockResolvedValueOnce({
      data: { id: "user_2", role: "manager", locationIds: [] },
    });
    updateAdminUserLocationsMock.mockResolvedValueOnce({
      data: { id: "user_2", role: "manager", locationIds: ["loc_norte"] },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "manager", locationIds: ["loc_norte"] }),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.locationIds).toEqual(["loc_norte"]);
    expect(updateAdminUserRoleMock).toHaveBeenCalledTimes(1);
    expect(updateAdminUserLocationsMock).toHaveBeenCalledTimes(1);
  });

  it("un PATCH sin rol ni sucursales responde 400 sin llamar a ningún caso de uso", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "user_2" }) },
    );

    expect(response.status).toBe(400);
    expect(updateAdminUserRoleMock).not.toHaveBeenCalled();
    expect(updateAdminUserLocationsMock).not.toHaveBeenCalled();
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
