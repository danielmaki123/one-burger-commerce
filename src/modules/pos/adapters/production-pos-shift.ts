import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";

/**
 * TASK-305b — la caja del POS en producción.
 *
 * Vive en `adapters/` y no en las rutas porque instancia Prisma (`AGENTS.md`: la ruta solo orquesta,
 * y el contrato de rutas lo mide). Devuelve las dependencias de abrir y de cerrar: abrir necesita los
 * locales, cerrar necesita además los cobros para calcular el esperado.
 */
export async function createProductionPosShiftDependencies() {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });

  return {
    shiftRepository: new PrismaShiftRepository(),
    locationRepository: new PrismaLocationRepository(),
    paymentRepository: new PrismaPaymentRepository(),
    businessCurrencyCode: settings.currencyCode,
    usdExchangeRate: settings.usdExchangeRate,
  };
}
