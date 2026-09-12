import { z } from "zod";

/**
 * Forma del payload de una promo (T9c).
 *
 * Zod valida tipos y rangos obvios; las reglas de negocio (qué combinación de campos
 * tiene sentido, qué código se acepta) viven en `promotion-rules`, que es la misma que
 * usa el formulario del admin. Está acá y no en cada ruta para que el POST y el PATCH
 * no puedan aceptar cosas distintas.
 */
export const promotionSchema = z.object({
  code: z.string().min(3).max(24),
  type: z.enum(["percentage", "fixed_amount", "bogo"]),
  value: z.number().default(0),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().min(0).default(0),
  /** Fecha (`2026-12-31`) o instante ISO. `null` = no vence. */
  expiresAt: z.string().nullable().default(null),
  buyQuantity: z.number().int().nullable().default(null),
  freeQuantity: z.number().int().nullable().default(null),
  scopeType: z.string().default("all"),
  scopeId: z.string().nullable().default(null),
});

/** Primer error por campo, que es lo que el formulario muestra debajo del input. */
export function firstFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : String(value),
    ]),
  );
}
