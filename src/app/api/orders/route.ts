import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { createOrder } from "@/modules/orders/features/create-order/create-order";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import {
  enforceRateLimit,
  FixedWindowRateLimiter,
} from "@/shared/lib/rate-limit/rate-limit";

registerOutboxEventBusHandlers();

const createOrderRateLimiter = new FixedWindowRateLimiter({
  prefix: "public-create-order",
  limit: 10,
  windowMs: 60_000,
});

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  modifierOptionIds: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

const orderSchema = z.object({
  type: z.enum(["pickup"]),
  customerName: z.string().min(1),
  customerWhatsapp: z.string().min(1),
  items: z.array(itemSchema).min(1),
  couponCode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  deliveryNotes: z.string().nullable().optional(),
  deliveryFeeStatus: z.enum(["pending_manual_validation", "confirmed"]).nullable().optional(),
  tipOptIn: z.boolean().optional(),
  pickupTime: z.string().nullable().optional(),
  pickupNotes: z.string().nullable().optional(),
  tableId: z.string().nullable().optional(),
  qrToken: z.string().nullable().optional(),
  deliveryZoneId: z.string().nullable().optional(),
  customerLat: z.number().nullable().optional(),
  customerLng: z.number().nullable().optional(),
  geoAccuracy: z.number().nullable().optional(),
  geoCapturedAt: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const rateLimited = enforceRateLimit({
      limiter: createOrderRateLimiter,
      request,
      message: "Demasiados pedidos seguidos. Esperá un momento antes de reintentar.",
    });

    if (rateLimited) {
      return rateLimited;
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = orderSchema.safeParse(payload);

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
    // La propina es fuente de verdad del servidor: sale de la configuración del
    // negocio, nunca del monto que manda el cliente. Si la configuración no se
    // puede leer se usan los defaults en vez de tumbar el pedido.
    const settings = await loadBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });
    const result = await createOrder(parsed.data, {
      repository,
      tipPolicy: { enabled: settings.tipEnabled, rate: settings.tipRate },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
