import { defaultLocationCashConfig, toCashCountConfig } from "@/modules/cash-config/domain/cash-count-config";
import type { CashCountConfig } from "@/modules/cash-config/domain/cash-config.types";
import type { CashConfigRepository } from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — **la config del conteo de cada sucursal del alcance**.
 *
 * Es lo que la pantalla de Caja necesita para dibujar la grilla: qué monedas se cuentan y con qué
 * billetes. Se resuelve **en el servidor** y baja como dato, por dos motivos:
 *
 * 1. El cajero no tiene por qué llamar a la API de configuración (que es del dueño): la pantalla ya sabe
 *    qué mostrar.
 * 2. Cuando cambia la sucursal elegida, la grilla cambia con ella sin un ida y vuelta a la API.
 *
 * Una moneda sin filas activas cae a los defaults del módulo (`toCashCountConfig`): la Caja nunca se
 * queda sin poder contar.
 */
export async function getCashCountConfigs(
  input: { locationIds: readonly string[]; businessCurrencyCode: string },
  { repository }: { repository: CashConfigRepository },
): Promise<Record<string, CashCountConfig>> {
  const [denominations, configs] = await Promise.all([
    repository.listDenominations(),
    Promise.all(input.locationIds.map((locationId) => repository.getLocationConfig(locationId))),
  ]);

  const byLocation: Record<string, CashCountConfig> = {};

  input.locationIds.forEach((locationId, index) => {
    const config = configs[index] ?? defaultLocationCashConfig(locationId);

    byLocation[locationId] = toCashCountConfig({
      businessCurrencyCode: input.businessCurrencyCode,
      usdEnabled: config.usdEnabled,
      denominations,
    });
  });

  return byLocation;
}
