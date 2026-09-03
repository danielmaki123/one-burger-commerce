import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const { getAdminSessionMock } = vi.hoisted(() => ({
  getAdminSessionMock: vi.fn(),
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: vi.fn(
    function PrismaAdminAuthRepositoryMock(this: Record<string, never>) {
      return this;
    },
  ),
}));

vi.mock("@/modules/auth/features/get-admin-session/get-admin-session", () => ({
  getAdminSession: getAdminSessionMock,
}));

import { proxy } from "@/proxy";

describe("proxy admin auth guard", () => {
  beforeEach(() => {
    getAdminSessionMock.mockReset();
  });

  it("redirige a login si falta la cookie admin", async () => {
    const request = new NextRequest("http://localhost:3000/admin/orders");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
  });

  it("redirige a login si la sesion no existe o expiro", async () => {
    const request = new NextRequest("http://localhost:3000/admin/orders", {
      headers: {
        cookie: "ca_admin_session=invalid_token",
      },
    });

    getAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Admin session expired"),
    );

    const response = await proxy(request);

    expect(getAdminSessionMock).toHaveBeenCalledWith("invalid_token", expect.any(Object));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
    expect(response.cookies.get("ca_admin_session")?.value).toBe("");
  });

  it("permite acceso admin cuando la sesion es valida", async () => {
    const request = new NextRequest("http://localhost:3000/admin/orders", {
      headers: {
        cookie: "ca_admin_session=valid_token",
      },
    });

    getAdminSessionMock.mockResolvedValueOnce({
      isAuthenticated: true,
      user: {
        id: "admin_1",
        name: "Daniel",
        email: "admin@example.com",
        role: "owner",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(getAdminSessionMock).toHaveBeenCalledWith("valid_token", expect.any(Object));
  });

  it("no afecta rutas publicas", async () => {
    const request = new NextRequest("http://localhost:3000/menu");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(getAdminSessionMock).not.toHaveBeenCalled();
  });

  it("redirige la raiz del host admin a /admin", async () => {
    const request = new NextRequest("https://admin.casaantiguanic.com/", {
      headers: {
        host: "admin.casaantiguanic.com",
        "x-forwarded-host": "admin.casaantiguanic.com",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://admin.casaantiguanic.com/admin");
    expect(getAdminSessionMock).not.toHaveBeenCalled();
  });

  it("mantiene publica la raiz en el host de menu", async () => {
    const request = new NextRequest("https://menu.casaantiguanic.com/", {
      headers: {
        host: "menu.casaantiguanic.com",
        "x-forwarded-host": "menu.casaantiguanic.com",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(getAdminSessionMock).not.toHaveBeenCalled();
  });

  it("permite /admin/login sin validar sesion", async () => {
    const request = new NextRequest("http://localhost:3000/admin/login");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(getAdminSessionMock).not.toHaveBeenCalled();
  });
});
