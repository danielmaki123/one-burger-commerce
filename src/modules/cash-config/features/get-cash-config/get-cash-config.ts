import { defaultLocationCashConfig } from "@/modules/cash-config/domain/cash-count-config";
import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import type { CashConfigRecord } from "@/modules/cash-config/domain/cash-config.types";
import type { CashConfigRepository } from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — lee la configuración de una sucursal.
 *
 * Una sucursal **nunca queda sin config**: si todavía no tiene fila, devuelve los valores de fábrica
 * (sin dólares y con arqueo ciego). Así la pantalla de config se puede abrir en un local recién creado sin
 * que el formulario aparezca vacío, y la Caja tiene con qué dibujar el conteo desde el primer día.
 */
export async function getCashConfig(
  input: { locationId: string },
  { repository }: { repository: CashConfigRepository },
): Promise<CashConfigRecord> {
  const locationId = input.locationId?.trim();

  if (!locationId) {
    throw new CashConfigError(422, "VALIDATION_ERROR", "Elegí la sucursal", {
      locationId: "Requerido",
    });
  }

  const [config, denominations] = await Promise.all([
    repository.getLocationConfig(locationId),
    repository.listDenominations(),
  ]);

  return { ...(config ?? defaultLocationCashConfig(locationId)), denominations };
}
