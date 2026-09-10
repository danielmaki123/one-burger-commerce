import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { ADMIN_SESSION_COOKIE_NAME } from "@/modules/auth/domain/session-cookie";
import { loginAdmin } from "@/modules/auth/features/login-admin/login-admin";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import {
  createRateLimitResponse,
  FixedWindowRateLimiter,
  getClientIp,
  resolveRateLimit,
} from "@/shared/lib/rate-limit/rate-limit";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Restaurant staff often share one public IP, so the default leaves room for a
// shift change while still braking brute force (scrypt makes each attempt costly).
const adminLoginRateLimiter = new FixedWindowRateLimiter({
  prefix: "admin-login",
  limit: resolveRateLimit(process.env.ADMIN_LOGIN_RATE_LIMIT, 10),
  windowMs: 60_000,
});

export async function POST(request: Request) {
  try {
    const rateLimit = adminLoginRateLimiter.consume(getClientIp(request));
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        "Too many login attempts. Please wait before trying again.",
        rateLimit.retryAfterSeconds,
      );
    }

    const payload = await request.json().catch(() => {
      throw new AuthError(400, "BAD_REQUEST", "Invalid payload");
    });
    const parsedPayload = loginSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new AuthError(400, "BAD_REQUEST", "Invalid payload", {
        email: "Valid email required",
      });
    }

    const repository = new PrismaAdminAuthRepository();
    const result = await loginAdmin(parsedPayload.data, { repository });
    const cookieStore = await cookies();

    cookieStore.set(ADMIN_SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: result.expiresAt,
      path: "/",
    });

    return NextResponse.json({
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

