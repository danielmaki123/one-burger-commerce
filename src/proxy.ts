import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { ADMIN_SESSION_COOKIE_NAME } from "@/modules/auth/domain/session-cookie";
import { getAdminSession } from "@/modules/auth/features/get-admin-session/get-admin-session";
import {
  normalizeHost,
  resolveHostRoute,
} from "@/shared/config/host-routing";

/**
 * El producto vive en tres hosts del mismo build: el apex muestra el landing,
 * `menu.*` la app de pedidos y `admin.*` el panel. Toda la decisión está en
 * `resolveHostRoute` (puro y con tests); acá solo se traduce a Next.
 */

function redirectToAdminLogin(request: NextRequest) {
  const loginUrl = new URL("/admin/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME);
  return response;
}

function getRequestHost(request: NextRequest): string | null {
  return (
    normalizeHost(request.headers.get("x-forwarded-host")) ??
    normalizeHost(request.headers.get("host")) ??
    normalizeHost(request.nextUrl.hostname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const host = getRequestHost(request);

  // El apex sirve el landing; el host admin lleva su raíz a /admin.
  const hostRoute = resolveHostRoute({ host, pathname });
  if (hostRoute.action === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = hostRoute.pathname;
    return NextResponse.rewrite(url);
  }

  if (hostRoute.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = hostRoute.pathname;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return redirectToAdminLogin(request);
    }

    try {
      const repository = new PrismaAdminAuthRepository();
      await getAdminSession(sessionToken, repository);
    } catch (error) {
      if (error instanceof AuthError && error.code === "UNAUTHORIZED") {
        return redirectToAdminLogin(request);
      }

      throw error;
    }
  }

  return NextResponse.next();
}

/** Se exporta para poder clasificar hosts desde otros puntos del build. */
export { classifyHost, isAdminHost } from "@/shared/config/host-routing";

export const config = {
  matcher: ["/", "/landing", "/admin/:path*", "/admin"],
};
