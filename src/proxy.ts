import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { ADMIN_SESSION_COOKIE_NAME } from "@/modules/auth/domain/session-cookie";
import { getAdminSession } from "@/modules/auth/features/get-admin-session/get-admin-session";

const ADMIN_HOSTS = new Set(["admin.casaantiguanic.com"]);

function redirectToAdminLogin(request: NextRequest) {
  const loginUrl = new URL("/admin/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME);
  return response;
}

function redirectToAdminHome(request: NextRequest) {
  const adminUrl = new URL("/admin", request.url);
  return NextResponse.redirect(adminUrl);
}

function normalizeHost(host: string | null): string | null {
  if (!host) {
    return null;
  }

  return host.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? null;
}

function getRequestHost(request: NextRequest): string {
  return (
    normalizeHost(request.headers.get("x-forwarded-host")) ??
    normalizeHost(request.headers.get("host")) ??
    request.nextUrl.hostname.toLowerCase()
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname === "/" && ADMIN_HOSTS.has(getRequestHost(request))) {
    return redirectToAdminHome(request);
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

export const config = {
  matcher: ["/", "/admin/:path*", "/admin"],
};
