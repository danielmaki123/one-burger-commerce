import { z } from "zod";

import { BusinessSettingsError } from "@/modules/business-settings/domain/business-settings-errors";
import {
  CURRENCY_CODE_PATTERN,
  E164_DIGITS_PATTERN,
  E164_PHONE_PATTERN,
  FONT_CHOICES,
  HEX_COLOR_PATTERN,
  LOCALE_PATTERN,
  TIME_OF_DAY_PATTERN,
  WEEKDAY_KEYS,
  type BusinessSettingsInput,
} from "@/modules/business-settings/domain/business-settings.types";

const SOCIAL_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,60}$/;
const SOCIAL_URL_PREFIX_PATTERN =
  /^https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com)\//i;

/** Texto opcional: se recorta, la cadena vacía se guarda como `null`. */
function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `Máximo ${maxLength} caracteres`)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable();
}

/** Teléfono en E.164; admite vacío para borrar el dato. */
function e164Schema(pattern: RegExp, message: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .refine((value) => value === null || pattern.test(value), message);
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Acepta una URL https o una ruta servida por el propio sitio (`/brand/...`). */
function assetUrlSchema() {
  return z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .refine(
      (value) => value === null || value.startsWith("/") || isHttpsUrl(value),
      "Tiene que ser una URL https o una ruta del sitio que empiece con /",
    );
}

function socialHandleSchema() {
  return z
    .string()
    .trim()
    .transform((value) => {
      const handle = value
        .replace(SOCIAL_URL_PREFIX_PATTERN, "")
        .replace(/^@/, "")
        .replace(/\/+$/, "");

      return handle.length > 0 ? handle : null;
    })
    .nullable()
    .refine(
      (value) => value === null || SOCIAL_HANDLE_PATTERN.test(value),
      "Usá solo letras, números, punto y guion bajo",
    );
}

const colorSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => HEX_COLOR_PATTERN.test(value), "Usá un hex de 6 dígitos, por ejemplo #2b6c96");

const timeOfDaySchema = z
  .string()
  .trim()
  .refine((value) => TIME_OF_DAY_PATTERN.test(value), "Usá el formato HH:mm, por ejemplo 09:30");

const businessHoursDaySchema = z
  .object({
    closed: z.boolean(),
    open: timeOfDaySchema,
    close: timeOfDaySchema,
  })
  .superRefine((day, ctx) => {
    if (!day.closed && day.open >= day.close) {
      ctx.addIssue({
        code: "custom",
        path: ["close"],
        message: "La hora de cierre tiene que ser posterior a la de apertura",
      });
    }
  });

/** Parche de horarios: se puede mandar un solo día; la semana se fusiona al guardar. */
const businessHoursPatchSchema = z
  .object({
    mon: businessHoursDaySchema.optional(),
    tue: businessHoursDaySchema.optional(),
    wed: businessHoursDaySchema.optional(),
    thu: businessHoursDaySchema.optional(),
    fri: businessHoursDaySchema.optional(),
    sat: businessHoursDaySchema.optional(),
    sun: businessHoursDaySchema.optional(),
  })
  .refine(
    (value) => WEEKDAY_KEYS.some((weekday) => value[weekday] !== undefined),
    "Elegí al menos un día",
  );

/**
 * Esquema compartido cliente/servidor. `z.object` descarta claves desconocidas,
 * así que `id`, `updatedAt` y `updatedByUserId` no se pueden inyectar desde el
 * formulario: los maneja el repositorio.
 */
export const businessSettingsPatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre no puede quedar vacío")
    .max(80, "Máximo 80 caracteres")
    .optional(),
  tagline: optionalText(160).optional(),
  description: optionalText(300).optional(),
  logoUrl: assetUrlSchema().optional(),
  logoMarkUrl: assetUrlSchema().optional(),
  faviconUrl: assetUrlSchema().optional(),
  ogImageUrl: assetUrlSchema().optional(),
  primaryColor: colorSchema.optional(),
  accentColor: colorSchema.optional(),
  backgroundColor: colorSchema.optional(),
  foregroundColor: colorSchema.optional(),
  surfaceColor: colorSchema.optional(),
  headingFont: z.enum(FONT_CHOICES).optional(),
  bodyFont: z.enum(FONT_CHOICES).optional(),
  phone: e164Schema(E164_PHONE_PATTERN, "Usá formato E.164, por ejemplo +12025550123").optional(),
  whatsapp: e164Schema(
    E164_DIGITS_PATTERN,
    "Usá formato E.164 sin +, por ejemplo 12025550123",
  ).optional(),
  email: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .refine(
      (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Escribí un correo válido",
    )
    .optional(),
  instagram: socialHandleSchema().optional(),
  facebook: socialHandleSchema().optional(),
  tiktok: socialHandleSchema().optional(),
  addressLine: optionalText(200).optional(),
  city: optionalText(120).optional(),
  addressReference: optionalText(200).optional(),
  mapsUrl: assetUrlSchema().optional(),
  latitude: z.number().min(-90, "Tiene que estar entre -90 y 90").max(90, "Tiene que estar entre -90 y 90").nullable().optional(),
  longitude: z.number().min(-180, "Tiene que estar entre -180 y 180").max(180, "Tiene que estar entre -180 y 180").nullable().optional(),
  timezone: z.string().trim().min(1, "Elegí una zona horaria").max(64).optional(),
  businessHours: businessHoursPatchSchema.optional(),
  currencyCode: z
    .string()
    .trim()
    .refine(
      (value) => CURRENCY_CODE_PATTERN.test(value),
      "Usá el código ISO de 3 letras en mayúsculas, por ejemplo NIO",
    )
    .optional(),
  currencySymbol: z
    .string()
    .trim()
    .min(1, "Escribí el símbolo de la moneda")
    .max(8, "Máximo 8 caracteres")
    .optional(),
  /**
   * TASK-303a — tipo de cambio del dólar, en moneda del negocio. `null` = sin tasa cargada (un cobro
   * en dólares se rechaza hasta que se cargue). El tope de 100000 ataja un dedazo, no un mercado.
   */
  usdExchangeRate: z
    .number()
    .positive("Tiene que ser mayor que cero")
    .max(100000, "Ese número es demasiado grande para un tipo de cambio")
    .nullable()
    .optional(),
  locale: z
    .string()
    .trim()
    .refine((value) => LOCALE_PATTERN.test(value), "Usá el formato es-NI")
    .optional(),
  pickupLeadMinutes: z
    .number()
    .int("Tiene que ser un número entero de minutos")
    .min(0, "No puede ser negativo")
    .max(180, "Como máximo 180 minutos")
    .optional(),
  /**
   * Hasta cuántos minutos puede esperar el cliente (T5). Vacío o `null` = sin
   * rango: el checkout sigue prometiendo un instante, como antes.
   */
  pickupMaxMinutes: z
    .number()
    .int("Tiene que ser un número entero de minutos")
    .min(0, "No puede ser negativo")
    .max(240, "Como máximo 240 minutos")
    .nullable()
    .optional(),
  paymentInstructions: optionalText(400).optional(),
  tipEnabled: z.boolean().optional(),
  tipRate: z
    .number()
    .int("El porcentaje tiene que ser un número entero")
    .min(0, "No puede ser negativo")
    .max(100, "Como máximo 100 %")
    .optional(),
  /**
   * Tarea 2 del brief (2026-09-17) — el retiro de caja que se considera grande, en moneda del negocio.
   * Vacío o `null` = sin límite: nada se marca. No hay aprobación: el límite solo deja el movimiento a
   * la vista.
   */
  withdrawalLimit: z
    .number()
    .min(0, "No puede ser negativo")
    .max(1_000_000, "Como máximo 1.000.000")
    .nullable()
    .optional(),
  isAcceptingOrders: z.boolean().optional(),
  closedMessage: optionalText(300).optional(),
}).superRefine((patch, ctx) => {
  // El rango de preparación no puede terminar antes de empezar. Solo se puede
  // comprobar acá si el payload trae los dos números: cuando llega uno solo, el
  // caso de uso lo compara contra lo guardado.
  if (
    typeof patch.pickupMaxMinutes === "number" &&
    typeof patch.pickupLeadMinutes === "number" &&
    patch.pickupMaxMinutes < patch.pickupLeadMinutes
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["pickupMaxMinutes"],
      message: "Tiene que ser mayor o igual que los minutos de preparación",
    });
  }
});

/**
 * Valida el payload del admin. Lanza `BusinessSettingsError` con el detalle por
 * campo para que la UI pueda señalar el input que falló.
 */
export function parseBusinessSettingsPatch(input: unknown): BusinessSettingsInput {
  const result = businessSettingsPatchSchema.safeParse(input);

  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "form";
      if (fields[key] === undefined) fields[key] = issue.message;
    }

    throw new BusinessSettingsError(
      422,
      "VALIDATION_ERROR",
      "La configuración del negocio tiene errores de validación",
      fields,
    );
  }

  return result.data;
}
