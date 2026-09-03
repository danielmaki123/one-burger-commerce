import { NextResponse } from "next/server";
import { z } from "zod";

import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { createOrder } from "@/modules/orders/features/create-order/create-order";
import { createErrorResponse } from "@/shared/lib/http/error-response";

registerOutboxEventBusHandlers();

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
    const result = await createOrder(parsed.data, { repository });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
