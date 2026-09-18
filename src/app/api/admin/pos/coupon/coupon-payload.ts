import { z } from "zod";

import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — la forma del payload de la cotización de un cupón.
 *
 * Valida **forma** (que haya código, que la venta tenga productos y que las cantidades sean reales) y trae
 * el local aparte porque la ruta lo necesita para el alcance por sucursal. El precio **no** viaja: lo
 * resuelve el servidor, que es el que sabe a qué alcanza la promo.
 */

const couponSchema = z.object({
  locationId: z.string().trim().min(1, "Elegí el local"),
  code: z.string().trim().min(1, "Escribí el código de la promo").max(40, "El código es muy largo"),
  lines: z
    .array(
      z.object({
        productId: z.string().trim().min(1, "Falta el producto"),
        quantity: z.number().int("La cantidad tiene que ser un entero").min(1, "La cantidad mínima es 1"),
      }),
    )
    .min(1, "Agregá al menos un producto"),
});

export function parsePosCouponPayload(body: unknown): {
  locationId: string;
  couponCode: string;
  lines: { productId: string; quantity: number }[];
} {
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    throw new PosError(422, "VALIDATION_ERROR", "Revisá los datos del cupón.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  return {
    locationId: parsed.data.locationId,
    couponCode: parsed.data.code,
    lines: parsed.data.lines,
  };
}
