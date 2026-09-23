import type { PosTerminalRecord } from "@/modules/cash-config/domain/cash-config.types";
import type { CashConfigRepository } from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — **las terminales del POS de las sucursales del alcance**.
 *
 * Es lo que necesitan dos pantallas: Caja (para elegir en qué estación se abre la caja) y Config de Caja
 * (para administrarlas). Se resuelve en el servidor y baja como dato, igual que la config del conteo: el
 * cajero no tiene por qué llamar a la API de configuración, que es del dueño.
 *
 * Devuelve también las **apagadas** (`isActive: false`): la pantalla de configuración las muestra para poder
 * volver a prenderlas, y el selector de Caja filtra las activas.
 */
export async function getCashTerminals(
  input: { locationIds: readonly string[] },
  { repository }: { repository: CashConfigRepository },
): Promise<{ terminals: PosTerminalRecord[] }> {
  return { terminals: await repository.listPosTerminals(input.locationIds) };
}
