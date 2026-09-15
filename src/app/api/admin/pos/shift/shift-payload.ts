import { z } from "zod";

import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * TASK-305b — la forma del payload de la caja.
 *
 * El conteo llega como **filas de billetes** (`currency`, `denomination`, `quantity`), que es lo que
 * el cajero realmente hace: contar. El total no viaja: lo calcula el servidor con el dominio
 * (`cashCountsTotal`), así la pantalla no puede declarar un total que no coincida con los billetes.
 */

const countSchema = z.object({
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  denomination: z.number().positive("El billete tiene que ser mayor que cero"),
  quantity: z.number().int("La cantidad tiene que ser un entero").min(0, "No puede ser negativa"),
});

const shiftPayloadSchema = z.object({
  locationId: z.string().trim().min(1, "Elegí el local"),
  counts: z.array(countSchema).default([]),
  notes: z.string().trim().max(300).nullable().optional(),
});

export type ShiftCashPayload = z.infer<typeof shiftPayloadSchema>;

export function parseShiftCashPayload(body: unknown): {
  locationId: string;
  counts: ShiftCashCountInput[];
  notes: string | null;
} {
  const parsed = shiftPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw new PosError(422, "VALIDATION_ERROR", "Revisá el conteo de la caja.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  return {
    locationId: parsed.data.locationId,
    // Un billete con cantidad 0 no se guarda: no es un conteo, es una fila vacía del formulario.
    counts: parsed.data.counts
      .filter((count) => count.quantity > 0)
      .map((count) => ({
        currency: count.currency.toUpperCase(),
        denomination: count.denomination,
        quantity: count.quantity,
      })),
    notes: parsed.data.notes ?? null,
  };
}
