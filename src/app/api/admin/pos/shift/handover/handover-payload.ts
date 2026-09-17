import { z } from "zod";

import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * Tarea 7 del brief (2026-09-17) — la forma del payload del **traspaso de caja** (1.13).
 *
 * La ruta solo pide dos cosas: de qué local es la caja y quién recibe. El **esperado no viaja** —lo
 * calcula el servidor con la misma cuenta que el cierre—: si lo mandara la pantalla, el número firmado
 * sería el que alguien escribió, no el que hay en el sistema.
 */

const handoverSchema = z.object({
  locationId: z.string().trim().min(1, "Elegí el local"),
  receivedByName: z
    .string()
    .trim()
    .min(1, "Escribí quién recibe la caja")
    .max(80, "El nombre no puede pasar de 80 caracteres"),
  notes: z.string().trim().max(300).nullable().optional(),
});

export function parseShiftHandoverPayload(body: unknown): {
  locationId: string;
  receivedByName: string;
  notes: string | null;
} {
  const parsed = handoverSchema.safeParse(body);

  if (!parsed.success) {
    throw new PosError(422, "VALIDATION_ERROR", "Revisá el traspaso de caja.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  return {
    locationId: parsed.data.locationId,
    receivedByName: parsed.data.receivedByName,
    notes: parsed.data.notes ?? null,
  };
}
