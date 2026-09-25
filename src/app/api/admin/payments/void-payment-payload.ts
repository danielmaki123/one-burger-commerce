import { z } from "zod";

import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * TASK-AUD-059 — el payload de la **anulación de un cobro**.
 *
 * Es deliberadamente laxo: exige que el motivo exista y tenga forma de texto, y deja el resto en el
 * dominio (`validatePaymentVoidReason`), que es el único lugar donde viven las reglas del motivo. Así el
 * error que ve la persona es el mismo lo mande la pantalla o cualquiera que llame a la API.
 */
const voidSchema = z.object({
  reason: z
    .string({ message: "Escribí por qué anulás el cobro." })
    .trim()
    .min(1, "Escribí por qué anulás el cobro."),
});

export function parseVoidPaymentPayload(body: unknown): { reason: string } {
  const parsed = voidSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Escribí por qué anulás el cobro.";

    throw new OrderError(422, "VALIDATION_ERROR", message, { reason: message });
  }

  return parsed.data;
}
