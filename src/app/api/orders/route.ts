import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { resolveOrderAcceptance } from "@/modules/business-settings/domain/order-acceptance";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { resolveLocation } from "@/modules/locations/domain/location-rules";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { createOrder } from "@/modules/orders/features/create-order/create-order";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import {
  enforceRateLimit,
  FixedWindowRateLimiter,
} from "@/shared/lib/rate-limit/rate-limit";

registerOutboxEventBusHandlers();

/**
 * Límite de pedidos por minuto y por IP.
 *
 * Es configurable por entorno por el mismo motivo que el del login del admin: la
 * suite E2E crea varios pedidos reales seguidos desde la misma IP y, con el
 * límite de producción, termina midiendo el limitador en vez del checkout. En
 * producción queda el default.
 */
function resolveCreateOrderRateLimit(): number {
  const raw = Number(process.env.ORDER_CREATE_RATE_LIMIT ?? "");
  return Number.isInteger(raw) && raw > 0 ? raw : 10;
}

const createOrderRateLimiter = new FixedWindowRateLimiter({
  prefix: "public-create-order",
  limit: resolveCreateOrderRateLimit(),
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
  // Local de retiro (T8): sin dato el servidor usa el primario, así el negocio de un solo
  // local no cambia nada y el selector del checkout es opcional.
  locationId: z.string().nullable().optional(),
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
  // Forma de pago declarada (T11): informativa, se cobra en el local.
  paymentMethod: z.enum(["cash", "card"]).nullable().optional(),
  // Con cuánto paga el cliente, cuando es efectivo (T12).
  paidWithAmount: z.number().nullable().optional(),
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
    // Locales del negocio (T8): el pedido va al local elegido o al primario.
    const locationRepository = new PrismaLocationRepository();
    // La propina es fuente de verdad del servidor: sale de la configuración del
    // negocio, nunca del monto que manda el cliente. Si la configuración no se
    // puede leer se usan los defaults en vez de tumbar el pedido.
    const settings = await loadBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    // El estado operativo también es fuente de verdad del servidor: si el local no está
    // aceptando pedidos, o está cerrado a la hora pedida, el pedido se rechaza aunque el
    // cliente insista. Desde T8 el estado es **del local**: cada sucursal tiene su horario,
    // su preparación y su interruptor. Sin locales cargados se usan los de la configuración,
    // que es como funcionaba antes.
    const requestedPickupTime = parsed.data.pickupTime
      ? new Date(parsed.data.pickupTime)
      : null;
    // Una fecha inválida ya la rechaza `createOrder` con 400; acá se evalúa como "sin
    // hora" para que el gate operativo se aplique igual y no haya forma de saltearlo.
    const pickupTime =
      requestedPickupTime && !Number.isNaN(requestedPickupTime.getTime())
        ? requestedPickupTime
        : null;

    const locationResolution = resolveLocation({
      requestedLocationId: parsed.data.locationId,
      locations: await locationRepository.listLocations(),
    });
    const operationalSource = locationResolution.ok
      ? {
          isAcceptingOrders: locationResolution.location.isAcceptingOrders,
          closedMessage: locationResolution.location.closedMessage,
          businessHours: locationResolution.location.businessHours,
          pickupLeadMinutes: locationResolution.location.pickupLeadMinutes,
        }
      : {
          isAcceptingOrders: settings.isAcceptingOrders,
          closedMessage: settings.closedMessage,
          businessHours: settings.businessHours,
          pickupLeadMinutes: settings.pickupLeadMinutes,
        };

    const acceptance = resolveOrderAcceptance({
      ...operationalSource,
      timezone: settings.timezone,
      now: new Date(),
      pickupTime,
    });

    if (!acceptance.accepted) {
      throw new OrderError(409, "CONFLICT", acceptance.message, {
        acceptance: acceptance.reason,
      });
    }

    const result = await createOrder(
      {
        ...parsed.data,
        // El servidor guarda siempre una hora concreta: la que eligió el cliente o
        // "ahora + preparación" con el reloj del servidor. `pickupScheduled` lo deriva
        // el servidor de si vino una hora, así el cliente no puede declararse programado
        // sin haber elegido nada.
        pickupTime: acceptance.pickupTime.toISOString(),
        pickupScheduled: pickupTime !== null,
      },
      {
        repository,
        locationRepository,
        tipPolicy: { enabled: settings.tipEnabled, rate: settings.tipRate },
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
