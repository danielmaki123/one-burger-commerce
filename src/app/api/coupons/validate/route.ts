import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { validateCoupon } from "@/modules/orders/features/validate-coupon/validate-coupon";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import {
  enforceRateLimit,
  FixedWindowRateLimiter,
} from "@/shared/lib/rate-limit/rate-limit";

/**
 * Validación de un código de promo desde el checkout (T9b).
 *
 * Es informativa: el descuento definitivo lo aplica `POST /api/orders`. Tiene su
 * propio límite porque es una ruta pública que adivina códigos.
 */
function resolveCouponRateLimit(): number {
  const raw = Number(process.env.COUPON_VALIDATE_RATE_LIMIT ?? "");
  return Number.isInteger(raw) && raw > 0 ? raw : 20;
}

const couponRateLimiter = new FixedWindowRateLimiter({
  prefix: "public-coupon-validate",
  limit: resolveCouponRateLimit(),
  windowMs: 60_000,
});

const payloadSchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const rateLimited = enforceRateLimit({
      limiter: couponRateLimiter,
      request,
      message: "Demasiados intentos seguidos. Esperá un momento.",
    });

    if (rateLimited) {
      return rateLimited;
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Escribí un código." } },
        { status: 400 },
      );
    }

    const repository = new PrismaOrderRepository();
    const result = await validateCoupon({ code: parsed.data.code }, { repository });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
