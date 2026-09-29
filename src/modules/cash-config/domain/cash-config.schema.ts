import { z } from "zod";

import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import type { CashConfigPatch } from "@/modules/cash-config/domain/cash-config.types";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) + `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-88`) — el
 * esquema del payload de configuración.
 *
 * Es una sola puerta de entrada, compartida por la ruta y el formulario (mismo criterio que
 * `business-settings.schema.ts`): lo que el navegador no puede mandar, el servidor tampoco lo acepta.
 *
 * Dos reglas de fondo:
 *
 * - Las **monedas contables** de la sucursal son una **lista** de códigos, no un booleano del dólar:
 *   agregar una tercera moneda es agregarla a la lista, sin tocar código (`A-88`). La moneda base la
 *   agrega el dominio, no el payload.
 * - Los **billetes** son filas con su valor y su estado. El valor tiene que ser positivo y no se repite
 *   dentro de una moneda (un billete dos veces es un error de carga, no un dato).
 */

const currencySchema = z
  .string()
  .trim()
  .min(2, "La moneda son 2 o 3 letras")
  .max(12, "Ese código de moneda es muy largo")
  .transform((value) => value.toUpperCase());

const denominationSchema = z.object({
  currency: currencySchema,
  value: z
    .number()
    .positive("El valor tiene que ser mayor que cero")
    .max(100000, "Ese valor es demasiado grande"),
  isActive: z.boolean(),
});

const cashConfigSchema = z.object({
  locationId: z.string().trim().min(1, "Elegí la sucursal"),
  /** `A-88` — las monedas contables de la sucursal, además de la base. Se normalizan y se deduplican. */
  countedCurrencyCodes: z.array(currencySchema).max(20, "Demasiadas monedas").optional(),
  blindCount: z.boolean().optional(),
  denominations: z.array(denominationSchema).max(60, "Demasiadas denominaciones").optional(),
});

export type CashConfigPayload = {
  locationId: string;
  patch: CashConfigPatch;
};

/**
 * Valida el payload y devuelve el **parche** (solo lo que vino) más la sucursal pedida.
 *
 * Los valores repetidos se detectan acá y no en zod: el mensaje tiene que decir **qué** denominación está
 * repetida, y eso se sabe recién con la lista completa.
 */
export function parseCashConfigPayload(body: unknown): CashConfigPayload {
  const parsed = cashConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new CashConfigError(
      422,
      "VALIDATION_ERROR",
      "Revisá la configuración de la caja.",
      Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    );
  }

  const { locationId, denominations, countedCurrencyCodes, ...rest } = parsed.data;

  if (denominations) {
    const seen = new Set<string>();

    for (const row of denominations) {
      const key = `${row.currency}-${row.value}`;

      if (seen.has(key)) {
        throw new CashConfigError(422, "VALIDATION_ERROR", "Revisá la configuración de la caja.", {
          denominations: `${row.currency} ${row.value} está repetido`,
        });
      }

      seen.add(key);
    }
  }

  return {
    locationId,
    patch: {
      ...rest,
      ...(countedCurrencyCodes ? { countedCurrencyCodes: [...new Set(countedCurrencyCodes)] } : {}),
      ...(denominations
        ? {
            // El orden lo fija el valor, de mayor a menor: el cajero cuenta de arriba hacia abajo.
            denominations: [...denominations]
              .sort((a, b) => b.value - a.value)
              .map((row, index) => ({ ...row, sortOrder: index })),
          }
        : {}),
    },
  };
}
