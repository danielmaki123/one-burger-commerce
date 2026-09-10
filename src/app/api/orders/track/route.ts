import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { trackOrder } from "@/modules/orders/features/track-order/track-order";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import {
  enforceRateLimit,
  FixedWindowRateLimiter,
} from "@/shared/lib/rate-limit/rate-limit";

const trackOrderRateLimiter = new FixedWindowRateLimiter({
  prefix: "public-track-order",
  limit: 20,
  windowMs: 60_000,
});

const trackOrderSchema = z
  .object({
    orderNumber: z.string().min(1),
    customerWhatsapp: z.string().optional(),
    orderLookupToken: z.string().optional(),
  })
  .refine((data) => data.customerWhatsapp || data.orderLookupToken, {
    message: "Either customerWhatsapp or orderLookupToken is required",
  });

export async function POST(request: Request) {
  try {
    const rateLimited = enforceRateLimit({
      limiter: trackOrderRateLimiter,
      request,
      message: "Demasiadas consultas seguidas. Esperá un momento antes de reintentar.",
    });

    if (rateLimited) {
      return rateLimited;
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = trackOrderSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
                k,
                Array.isArray(v) ? v[0] : String(v),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaOrderRepository();
    const result = await trackOrder(parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
