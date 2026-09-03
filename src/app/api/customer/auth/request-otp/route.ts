import { NextResponse } from "next/server";
import { z } from "zod";

import { DevOtpSender } from "@/modules/customers/adapters/dev-otp-sender";
import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { requestOtp } from "@/modules/customers/features/request-otp/request-otp";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import {
  createRateLimitResponse,
  FixedWindowRateLimiter,
  getClientIp,
} from "@/shared/lib/rate-limit/rate-limit";

const requestOtpSchema = z.object({
  whatsapp: z.string().min(1),
});

const requestOtpRateLimiter = new FixedWindowRateLimiter({
  prefix: "customer-request-otp",
  limit: 5,
  windowMs: 60_000,
});

export async function POST(request: Request) {
  try {
    const rateLimit = requestOtpRateLimiter.consume(getClientIp(request));
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        "Too many OTP requests. Please wait before trying again.",
        rateLimit.retryAfterSeconds,
      );
    }

    const payload = await request.json().catch(() => {
      throw new CustomerAuthError(400, "BAD_REQUEST", "Invalid payload");
    });
    const parsedPayload = requestOtpSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new CustomerAuthError(400, "BAD_REQUEST", "Invalid payload", {
        whatsapp: "WhatsApp is required",
      });
    }

    const repository = new PrismaCustomerAuthRepository();
    const result = await requestOtp(parsedPayload.data, {
      repository,
      otpSender: new DevOtpSender(),
    });

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
