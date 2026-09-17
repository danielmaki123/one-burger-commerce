import { z } from "zod";

import type { LocationInput } from "@/modules/locations/domain/location-rules";

/**
 * T8 — la forma del payload de un local.
 *
 * El alta (`/api/admin/locations`) y la edición (`/api/admin/locations/[id]`) reciben **el local
 * completo**: el PATCH no es parcial a propósito, porque un campo que falta es un error de la
 * pantalla y no un borrado silencioso de lo que el owner ya cargó. Tener el esquema una sola vez evita
 * que las dos puertas acepten cosas distintas (antes estaba duplicado, y cada archivo de ruta tiene su
 * propio tope de líneas que ese duplicado ya gastaba).
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
  // TASK-308: el mostrador del local. Un payload viejo sin el campo deja el POS prendido, que es como
  // venía funcionando el negocio antes de que existiera el interruptor.
  posEnabled: z.boolean().default(true),
  // Tarea 3 del brief (2026-09-17): cierre obligatorio de caja en este local. Nace apagado (el negocio
  // de un solo local sigue funcionando como antes) y se prende desde la ficha de la sucursal.
  requireShiftClose: z.boolean().default(false),
  closedMessage: z.string().max(300).nullable().default(null),
});

/** Primer error por campo, que es lo que el formulario muestra debajo del input. */
function firstFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : String(value),
    ]),
  );
}

export type LocationPayloadResult =
  | { ok: true; input: LocationInput }
  | { ok: false; fields: Record<string, string> };

export function parseLocationPayload(body: unknown): LocationPayloadResult {
  const parsed = locationSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, fields: firstFieldErrors(parsed.error.flatten().fieldErrors) };
  }

  return { ok: true, input: parsed.data };
}
