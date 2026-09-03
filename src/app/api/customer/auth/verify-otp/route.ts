import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildCustomerSessionCookieOptions,
  CUSTOMER_SESSION_COOKIE_NAME,
} from "@/modules/customers/adapters/customer-session-cookie";
import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { verifyOtp } from "@/modules/customers/features/verify-otp/verify-otp";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const verifyOtpSchema = z.object({
  whatsapp: z.string().min(1),
  code: z.string().min(1),
  fullName: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => {
      throw new CustomerAuthError(400, "BAD_REQUEST", "Invalid payload");
    });
    const parsedPayload = verifyOtpSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new CustomerAuthError(400, "BAD_REQUEST", "Invalid payload", {
        whatsapp: "WhatsApp is required",
        code: "Verification code is required",
      });
    }

    const repository = new PrismaCustomerAuthRepository();
    const result = await verifyOtp(parsedPayload.data, { repository });
    const cookieStore = await cookies();

    cookieStore.set(
      CUSTOMER_SESSION_COOKIE_NAME,
      result.sessionToken,
      buildCustomerSessionCookieOptions(result.expiresAt),
    );

    return NextResponse.json({
      data: {
        customer: {
          id: result.customer.id,
          fullName: result.customer.fullName,
          whatsappNormalized: result.customer.whatsappNormalized,
        },
        session: {
          isAuthenticated: true,
        },
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
