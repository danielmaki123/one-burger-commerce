import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { deleteLocation } from "@/modules/locations/features/delete-location/delete-location";
import { updateLocation } from "@/modules/locations/features/update-location/update-location";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Un local (T8).
 *
 * El PATCH recibe el local **completo**, que es lo que manda el formulario: un campo que
 * falta es un error de la pantalla, no un borrado silencioso de lo que el owner ya cargó.
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
  isAcceptingOrders: z.boolean().default(true),
  closedMessage: z.string().max(300).nullable().default(null),
});

function firstFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)]),
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
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
    const result = await updateLocation(id, parsed.data, { repository });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const repository = new PrismaLocationRepository();
    const result = await deleteLocation(id, { repository });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
