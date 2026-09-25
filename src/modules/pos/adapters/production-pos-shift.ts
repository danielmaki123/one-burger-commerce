import { PrismaBankRepository } from "@/modules/banks/adapters/prisma-bank-repository";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { getCashCountConfigs } from "@/modules/cash-config/features/get-cash-count-configs/get-cash-count-configs";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import {
  lockShiftRow,
  PrismaShiftRepository,
} from "@/modules/orders/adapters/prisma-shift-repository";

/**
 * TASK-305b — la caja del POS en producción.
 *
 * Vive en `adapters/` y no en las rutas porque instancia Prisma (`AGENTS.md`: la ruta solo orquesta,
 * y el contrato de rutas lo mide). Devuelve las dependencias de abrir y de cerrar: abrir necesita los
 * locales, cerrar necesita además los cobros para calcular el esperado.
 *
 * Fase 2 del rediseño de Caja (2026-09-22) — con `locationId` además carga la **config del conteo** de ese
 * local (monedas y billetes), que es con lo que el servidor valida el payload: es la misma config que la
 * pantalla usa para dibujar la grilla, así que apagar los dólares en una sucursal los rechaza de verdad.
 *
 * TASK-AUD-005 — el cierre del turno corre en **una sola transacción** y con la fila del turno
 * **bloqueada** (`FOR UPDATE`): el arqueo se lee después del bloqueo, así que una venta que entra en el
 * medio, o ya commiteó y su cobro entra al arqueo, o llega después y la rechaza el propio cobro. Sin el
 * bloqueo la ventana existía y la plata quedaba fuera de todo arqueo.
 */
export async function createProductionPosShiftDependencies(input: { locationId?: string } = {}) {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });

  const cashCountConfig = input.locationId
    ? (
        await getCashCountConfigs(
          { locationIds: [input.locationId], businessCurrencyCode: settings.currencyCode },
          { repository: new PrismaCashConfigRepository() },
        )
      )[input.locationId]
    : undefined;

  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — las terminales **activas** de la sucursal: es contra esta
   * lista que `openShift` valida (y exige) la terminal cuando el local tiene alguna cargada.
   */
  const cashTerminalIds = input.locationId
    ? (await new PrismaCashConfigRepository().listPosTerminals([input.locationId]))
        .filter((terminal) => terminal.isActive)
        .map((terminal) => terminal.id)
    : undefined;

  return {
    shiftRepository: new PrismaShiftRepository(),
    locationRepository: new PrismaLocationRepository(),
    paymentRepository: new PrismaPaymentRepository(),
    // Fase 3 del rediseño de Caja (2026-09-23) — el cuadre por banco necesita el catálogo de la sucursal
    // para rechazar un banco que no liquida ahí.
    bankRepository: new PrismaBankRepository(),
    /**
     * El **límite atómico** del cierre: el turno bloqueado, su arqueo y su documento firmado, o nada.
     * `lockShift` bloquea la fila del turno dentro de la transacción (el mismo lock que pide el cobro
     * antes de firmarle el turno a un `Payment`).
     */
    runInShiftTransaction: <T,>(work: (scope: {
      lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
      shiftRepository: PrismaShiftRepository;
      paymentRepository: PrismaPaymentRepository;
      cashMovementRepository: PrismaCashMovementRepository;
      refundRepository: PrismaRefundRepository;
    }) => Promise<T>) =>
      getPrismaClient().$transaction(
        async (tx) =>
          work({
            lockShift: (shiftId) => lockShiftRow(tx, shiftId),
            shiftRepository: new PrismaShiftRepository(tx),
            paymentRepository: new PrismaPaymentRepository(tx),
            /**
             * Los movimientos y las devoluciones también se leen **dentro** de la transacción: son parte del
             * esperado (restan) y el corte X ya los cableaba. Faltaban acá, así que el cierre de producción
             * firmaba un esperado sin retiros ni devoluciones: la diferencia del mismo turno no coincidía
             * con la del corte X.
             */
            cashMovementRepository: new PrismaCashMovementRepository(tx),
            refundRepository: new PrismaRefundRepository(tx),
          }),
        { timeout: 15_000, maxWait: 10_000 },
      ),
    businessCurrencyCode: settings.currencyCode,
    usdExchangeRate: settings.usdExchangeRate,
    cashCountConfig,
    cashTerminalIds,
  };
}
