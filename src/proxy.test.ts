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
        cookie: "ob_admin_session=invalid_token",
      },
    });

    getAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Admin session expired"),
    );

    const response = await proxy(request);

    expect(getAdminSessionMock).toHaveBeenCalledWith("invalid_token", expect.any(Object));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
    expect(response.cookies.get("ob_admin_session")?.value).toBe("");
  });

  it("permite acceso admin cuando la sesion es valida", async () => {
    const request = new NextRequest("http://localhost:3000/admin/orders", {
      headers: {
        cookie: "ob_admin_session=valid_token",
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

  it("reconoce cualquier host admin sin dominio de marca hardcodeado", async () => {
    const request = new NextRequest("https://admin.oneburger.example/", {
      headers: {
        host: "admin.oneburger.example",
        "x-forwarded-host": "admin.oneburger.example",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://admin.oneburger.example/admin",
    );
  });

  it("acepta hosts admin extra por variable de entorno", async () => {
    process.env.ADMIN_HOSTS = "panel.oneburger.example";

    try {
      const request = new NextRequest("https://panel.oneburger.example/", {
        headers: {
          host: "panel.oneburger.example",
          "x-forwarded-host": "panel.oneburger.example",
        },
      });

      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://panel.oneburger.example/admin",
      );
    } finally {
      delete process.env.ADMIN_HOSTS;
    }
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

  it("sirve el landing en la raiz del dominio de marca sin redirigir", async () => {
    const request = new NextRequest("https://oneburgernic.com/", {
      headers: {
        host: "oneburgernic.com",
        "x-forwarded-host": "oneburgernic.com",
      },
    });

    const response = await proxy(request);

    // Rewrite, no redirect: la URL que ve el cliente sigue siendo la raiz.
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://oneburgernic.com/landing",
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("tambien sirve el landing en www", async () => {
    const request = new NextRequest("https://www.oneburgernic.com/", {
      headers: {
        host: "www.oneburgernic.com",
        "x-forwarded-host": "www.oneburgernic.com",
      },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://www.oneburgernic.com/landing",
    );
  });

  it("deja la app de pedidos tal cual en local y en el host de menu", async () => {
    for (const host of ["localhost:3210", "menu.oneburgernic.com"]) {
      const request = new NextRequest(`http://${host}/`, { headers: { host } });

      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("no reescribe otras rutas del dominio de marca", async () => {
    const request = new NextRequest("https://oneburgernic.com/menu", {
      headers: {
        host: "oneburgernic.com",
        "x-forwarded-host": "oneburgernic.com",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("permite entrar al landing por su ruta directa en cualquier host", async () => {
    const request = new NextRequest("http://localhost:3210/landing");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
