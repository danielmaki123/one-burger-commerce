import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import {
  createOrder,
  type CreateOrderRequest,
} from "@/modules/orders/features/create-order/create-order";

import type { RegisterPosSaleDependencies } from "../features/register-pos-sale/register-pos-sale";

/**
 * TASK-303b — el cobro del POS en producción.
 *
 * Vive acá y no en la ruta porque instancia Prisma y conoce el grafo del alta (regla de `AGENTS.md`;
 * el contrato de rutas lo mide). El POS **no** reimplementa el alta: usa `createOrder`, la única
 * puerta que resuelve precios, empaque y totales.
 *
 * El **gate operativo** (`isAcceptingOrders`, horario) no se aplica: ese interruptor es del canal
 * público y el mostrador es la caja del local, que vende cuando está abierta de verdad.
 */
export async function createProductionPosSaleDependencies(): Promise<RegisterPosSaleDependencies> {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const repository = new PrismaOrderRepository();
  const locationRepository = new PrismaLocationRepository();
  const shiftRepository = new PrismaShiftRepository();

  return {
    // `createOrder` devuelve `{ data, meta }`: acá se desempaqueta para que el POS trabaje con el
    // pedido, que es lo único que le importa.
    createPosOrder: async (input: CreateOrderRequest) =>
      (
        await createOrder(input, {
          repository,
          locationRepository,
          tipPolicy: { enabled: settings.tipEnabled, rate: settings.tipRate },
        })
      ).data,
    paymentRepository: new PrismaPaymentRepository(),
    businessCurrencyCode: settings.currencyCode,
    usdExchangeRate: settings.usdExchangeRate,
    // Bloque 9.2: sin caja abierta no se cobra (`registerPosSale` corta con 409).
    findOpenShift: async (locationId) =>
      (await getCurrentShift({ locationId }, { shiftRepository })).data,
  };
}
