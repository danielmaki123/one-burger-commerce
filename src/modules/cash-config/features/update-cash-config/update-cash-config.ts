import { defaultLocationCashConfig } from "@/modules/cash-config/domain/cash-count-config";
import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import { parseCashConfigPayload } from "@/modules/cash-config/domain/cash-config.schema";
import type { CashConfigRecord } from "@/modules/cash-config/domain/cash-config.types";
import type {
  CashConfigRepository,
  UpdateCashConfigMeta,
} from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — guarda la configuración de una sucursal.
 *
 * Recibe el payload **crudo**: la validación vive en el esquema compartido
 * (`cash-config.schema.ts`), que es la misma puerta para la ruta y para el formulario.
 *
 * Qué toca y qué no:
 *
 * - Los **flags** de la sucursal (`usdEnabled`, `blindCount`) se guardan con quién los cambió: son la
 *   auditoría visible de la config (decisión del owner, 2026-09-22).
 * - Las **denominaciones** son del negocio, no de la sucursal: se reemplazan enteras y el adaptador
 *   desactiva las que ya no están en la lista en vez de borrarlas (los cierres viejos conservan con qué
 *   billetes se contó).
 * - Un solo guardado puede traer las dos cosas o una: lo que no vino, no se toca.
 */
export async function updateCashConfig(
  input: unknown,
  {
    repository,
    updatedByUserId = null,
  }: { repository: CashConfigRepository } & UpdateCashConfigMeta,
): Promise<CashConfigRecord> {
  const { locationId, patch } = parseCashConfigPayload(input);
  const meta = { updatedByUserId };

  let config = await repository.getLocationConfig(locationId);
  const hasFlags = patch.usdEnabled !== undefined || patch.blindCount !== undefined;

  if (hasFlags) {
    config = await repository.saveLocationConfig(
      locationId,
      { usdEnabled: patch.usdEnabled, blindCount: patch.blindCount },
      meta,
    );
  }

  if (patch.denominations) {
    /**
     * Una caja **sin ningún billete activo** no se puede contar: el cajero llegaría a la pantalla con la
     * grilla caída a los defaults del módulo y guardaría una config que no refleja lo que ve. Es un
     * rechazo explícito, con el motivo escrito, en vez de dejar el estado roto.
     */
    if (!patch.denominations.some((row) => row.isActive)) {
      throw new CashConfigError(422, "VALIDATION_ERROR", "Revisá la configuración de la caja.", {
        denominations: "Dejá al menos un billete activo",
      });
    }

    await repository.replaceDenominations(patch.denominations, meta);
  }

  const denominations = await repository.listDenominations();

  return { ...(config ?? defaultLocationCashConfig(locationId)), denominations };
}
