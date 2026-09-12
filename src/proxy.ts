import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { ADMIN_SESSION_COOKIE_NAME } from "@/modules/auth/domain/session-cookie";
import { getAdminSession } from "@/modules/auth/features/get-admin-session/get-admin-session";
import {
  CONTENT_SECURITY_POLICY_HEADER,
  CSP_NONCE_REQUEST_HEADER,
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/shared/config/content-security-policy";
import {
  normalizeHost,
  resolveHostRoute,
} from "@/shared/config/host-routing";

/**
 * El producto vive en tres hosts del mismo build: el apex muestra el landing,
 * `menu.*` la app de pedidos y `admin.*` el panel. Toda la decisión está en
 * `resolveHostRoute` (puro y con tests); acá solo se traduce a Next.
 *
 * Además, esta es la única capa que ve **todas** las respuestas de página: por eso la
 * CSP con nonce se arma acá (ver `content-security-policy.ts`). El nonce viaja en el
 * request para que Next lo ponga en sus propios `<script>`.
 */

type SecurityContext = {
  nonce: string;
  policy: string;
};

function createSecurityContext(): SecurityContext {
  const nonce = createCspNonce();

  return { nonce, policy: buildContentSecurityPolicy(nonce) };
}

/** Headers del request con el nonce, para que el render los vea. */
function withNonceRequestHeaders(request: NextRequest, security: SecurityContext) {
  const headers = new Headers(request.headers);
  headers.set(CSP_NONCE_REQUEST_HEADER, security.nonce);
  headers.set(CONTENT_SECURITY_POLICY_HEADER, security.policy);

  return headers;
}

/** Toda respuesta —incluso redirecciones— sale con la política puesta. */
function withPolicy<T extends NextResponse>(response: T, security: SecurityContext): T {
  response.headers.set(CONTENT_SECURITY_POLICY_HEADER, security.policy);
  return response;
}

function nextWithSecurity(request: NextRequest, security: SecurityContext) {
  return withPolicy(
    NextResponse.next({ request: { headers: withNonceRequestHeaders(request, security) } }),
    security,
  );
}

function redirectToAdminLogin(request: NextRequest, security: SecurityContext) {
  const loginUrl = new URL("/admin/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME);
  return withPolicy(response, security);
}

function getRequestHost(request: NextRequest): string | null {
  return (
    normalizeHost(request.headers.get("x-forwarded-host")) ??
    normalizeHost(request.headers.get("host")) ??
    normalizeHost(request.nextUrl.hostname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const security = createSecurityContext();

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const host = getRequestHost(request);

  // Cada host sirve una parte del producto; la decisión vive en
  // `resolveHostRoute` (puro y con tests) y acá solo se traduce a Next.
  const hostRoute = resolveHostRoute({ host, pathname, search });

  if (hostRoute.action === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = hostRoute.pathname;
    return withPolicy(
      NextResponse.rewrite(url, {
        request: { headers: withNonceRequestHeaders(request, security) },
      }),
      security,
    );
  }

  if (hostRoute.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = hostRoute.pathname;
    return withPolicy(NextResponse.redirect(url), security);
  }

  if (hostRoute.action === "redirectAbsolute") {
    return withPolicy(NextResponse.redirect(hostRoute.url), security);
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return nextWithSecurity(request, security);
    }

    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return redirectToAdminLogin(request, security);
    }

    try {
      const repository = new PrismaAdminAuthRepository();
      await getAdminSession(sessionToken, repository);
    } catch (error) {
      if (error instanceof AuthError && error.code === "UNAUTHORIZED") {
        return redirectToAdminLogin(request, security);
      }

      throw error;
    }
  }

  return nextWithSecurity(request, security);
}

/** Se exporta para poder clasificar hosts desde otros puntos del build. */
export { classifyHost, isAdminHost } from "@/shared/config/host-routing";

export const config = {
  // Todo lo que sea una página. Los assets (incluido `manifest.webmanifest`,
  // `sw.js`, `robots.txt` y los frames del landing) no pasan por acá.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
