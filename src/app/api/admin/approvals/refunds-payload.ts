import { z } from "zod";

import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — los payloads de devoluciones.
 *
 * Acá se valida **forma** (ids, enums, montos positivos y textos no vacíos). Las reglas de plata —no
 * devolver más de lo cobrado, parcial contra total, quién puede firmar— viven en los casos de uso, que
 * son los que tienen el cobro y las devoluciones anteriores delante.
 */

const requestSchema = z.object({
  paymentId: z.string().trim().min(1, "Falta el cobro"),
  kind: z.enum(["full", "partial"], { message: "Elegí devolución total o parcial" }),
  amount: z.number().positive("El monto tiene que ser mayor que cero"),
  reason: z.string().trim().min(1, "Escribí por qué devolvés la plata").max(300),
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"], { message: "Elegí aprobar o rechazar" }),
  note: z.string().trim().max(300).nullable().optional(),
});

export type RefundRequestPayload = z.infer<typeof requestSchema>;
export type RefundReviewPayload = { decision: "approved" | "rejected"; note: string | null };

function fail(error: z.ZodError, message: string): never {
  throw new OrderError(422, "VALIDATION_ERROR", message, {
    ...Object.fromEntries(
      error.issues.map((issue) => [String(issue.path[0] ?? "refund"), issue.message]),
    ),
  });
}

export function parseRefundRequestPayload(body: unknown): RefundRequestPayload {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) fail(parsed.error, "Revisá la devolución.");

  return parsed.data;
}

export function parseRefundReviewPayload(body: unknown): RefundReviewPayload {
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) fail(parsed.error, "Revisá la decisión.");

  const note = parsed.data.note?.trim() ?? null;
  if (parsed.data.decision === "rejected" && !note) {
    throw new OrderError(422, "VALIDATION_ERROR", "Escribí por qué rechazás la devolución.", {
      note: "El motivo del rechazo es obligatorio.",
    });
  }

  return { decision: parsed.data.decision, note };
}
