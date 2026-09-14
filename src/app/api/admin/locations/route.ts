import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { createLocation } from "@/modules/locations/features/create-location/create-location";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Locales del negocio (T8).
 *
 * Leer la lista lo puede hacer cualquier admin con sesión (la usan la pantalla de locales y
 * la de pedidos). Escribir es **configuración del negocio**: solo el owner, igual que
 * `/admin/settings`, porque de acá salen la dirección, el horario y si se aceptan pedidos.
 */
const timeOfDaySchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Usá el formato HH:mm, por ejemplo 09:30");

const businessHoursDaySchema = z.object({
  closed: z.boolean(),
  open: timeOfDaySchema,
  close: timeOfDaySchema,
});

const locationSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().min(1).max(40),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  addressLine: z.string().max(160).nullable().default(null),
  city: z.string().max(80).nullable().default(null),
  addressReference: z.string().max(200).nullable().default(null),
  mapsUrl: z.string().max(300).nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  phone: z.string().max(30).nullable().default(null),
  whatsapp: z.string().max(30).nullable().default(null),
  businessHours: z.object({
    mon: businessHoursDaySchema,
    tue: businessHoursDaySchema,
    wed: businessHoursDaySchema,
    thu: businessHoursDaySchema,
    fri: businessHoursDaySchema,
    sat: businessHoursDaySchema,
    sun: businessHoursDaySchema,
  }),
  pickupLeadMinutes: z.number().int().min(0).max(180),
  pickupMaxMinutes: z.number().int().min(0).max(240).nullable().default(null),
  // B5: umbrales de aviso del tablero de comandas (por local).
  acceptAlertMinutes: z.number().int().min(1).max(120).default(10),
  prepAlertMinutes: z.number().int().min(1).max(120).default(15),
  isAcceptingOrders: z.boolean().default(true),
  closedMessage: z.string().max(300).nullable().default(null),
});

/** Primer error por campo, que es lo que el formulario muestra debajo del input. */
function firstFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)]),
  );
}

export async function GET() {
  try {
    await requireAdminSession();

    const repository = new PrismaLocationRepository();
    const locations = await repository.listLocations();

    return NextResponse.json({ data: locations });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = locationSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: firstFieldErrors(parsed.error.flatten().fieldErrors),
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaLocationRepository();
    const result = await createLocation(parsed.data, { repository });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

