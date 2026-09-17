import { z } from "zod";

import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { CashMovementInput } from "@/modules/orders/features/cash-movement/register-cash-movement/register-cash-movement";

/**
 * Bloque 2.2/2.4 del roadmap del POS (Fase 2) — el payload de un movimiento de caja.
 *
 * Valida **forma** (tipo, categoría, monto positivo, moneda y motivo). La regla de negocio (la caja
 * tiene que estar abierta) vive en el caso de uso; acá solo se traduce el cuerpo del request.
 */
const movementSchema = z.object({
  kind: z.enum(["withdrawal", "deposit"], { message: "Elegí retiro o ingreso" }),
  category: z.enum(["supplier", "change_fund", "vault", "expense", "other"], {
    message: "Elegí para qué fue el movimiento",
  }),
  amount: z.number().positive("El monto tiene que ser mayor que cero"),
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  reason: z.string().trim().min(1, "Escribí por qué se mueve la plata").max(300),
});

export type CashMovementPayload = Omit<CashMovementInput, "shiftId" | "userId">;

export function parseCashMovementPayload(body: unknown): CashMovementPayload {
  const parsed = movementSchema.safeParse(body);

  if (!parsed.success) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Revisá el movimiento.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0] ?? "movement"), issue.message]),
      ),
    });
  }

  return parsed.data;
}
