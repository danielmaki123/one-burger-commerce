import { z } from "zod";

import type { ShiftBankCloseInput } from "@/modules/orders/domain/shift-bank-close";
import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * TASK-305b — la forma del payload de la caja.
 *
 * El conteo llega como **filas de billetes** (`currency`, `denomination`, `quantity`), que es lo que
 * el cajero realmente hace: contar. El total no viaja: lo calcula el servidor con el dominio
 * (`cashCountsTotal`), así la pantalla no puede declarar un total que no coincida con los billetes.
 *
 * Fase 3 del rediseño de Caja (2026-09-23) — `bankCloses` es el **cuadre por banco**: una fila por banco
 * y moneda con el monto declarado y el lote de la terminal. Tampoco viaja ningún total: el consolidado y
 * la diferencia los calcula el servidor contra los cobros del turno.
 */

const countSchema = z.object({
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  denomination: z.number().positive("El billete tiene que ser mayor que cero"),
  quantity: z.number().int("La cantidad tiene que ser un entero").min(0, "No puede ser negativa"),
});

const bankCloseSchema = z.object({
  bankId: z.string().trim().min(1, "Elegí el banco"),
  declaredAmount: z.number().min(0, "No puede ser negativo"),
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  lote: z.string().trim().max(40, "Máximo 40 caracteres").nullable().optional(),
  terminalLabel: z.string().trim().max(40, "Máximo 40 caracteres").nullable().optional(),
  notes: z.string().trim().max(200, "Máximo 200 caracteres").nullable().optional(),
});

const shiftPayloadSchema = z.object({
  locationId: z.string().trim().min(1, "Elegí el local"),
  counts: z.array(countSchema).default([]),
  bankCloses: z.array(bankCloseSchema).default([]),
  notes: z.string().trim().max(300).nullable().optional(),
});

export type ShiftCashPayload = z.infer<typeof shiftPayloadSchema>;

export function parseShiftCashPayload(body: unknown): {
  locationId: string;
  counts: ShiftCashCountInput[];
  bankCloses: ShiftBankCloseInput[];
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
    // Un bloque de banco **vacío** (cero declarado y sin lote ni terminal ni nota) es un formulario sin
    // llenar, no un cuadre de cero: se descarta igual que la fila de billetes en cero.
    bankCloses: parsed.data.bankCloses
      .filter((close) => !isEmptyBankClose(close))
      .map((close) => ({
        bankId: close.bankId,
        declaredAmount: close.declaredAmount,
        currency: close.currency.toUpperCase(),
        lote: close.lote ?? null,
        terminalLabel: close.terminalLabel ?? null,
        notes: close.notes ?? null,
      })),
    notes: parsed.data.notes ?? null,
  };
}

function isEmptyBankClose(close: {
  declaredAmount: number;
  lote?: string | null;
  terminalLabel?: string | null;
  notes?: string | null;
}): boolean {
  return (
    close.declaredAmount === 0 &&
    !close.lote?.trim() &&
    !close.terminalLabel?.trim() &&
    !close.notes?.trim()
  );
}
