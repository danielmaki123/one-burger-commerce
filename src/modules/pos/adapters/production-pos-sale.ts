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
import { quotePosCoupon } from "../features/quote-pos-coupon/quote-pos-coupon";
import { createProductionPosCouponDependencies } from "./production-pos-coupon";

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
    /**
     * `createOrder` devuelve `{ data, meta }`: acá se traduce a lo que el POS necesita —el pedido y si el
     * alta **reusó** uno ya creado con la misma clave de intento (tarea 11)—. En un reintento los cobros
     * no se registran otra vez, así que la pantalla tiene que poder decirlo.
     */
    createPosOrder: async (input: CreateOrderRequest) => {
      const result = await createOrder(input, {
        repository,
        locationRepository,
        tipPolicy: { enabled: settings.tipEnabled, rate: settings.tipRate },
      });

      return { order: result.data, reused: result.meta.reused === true };
    },
    paymentRepository: new PrismaPaymentRepository(),
    businessCurrencyCode: settings.currencyCode,
    usdExchangeRate: settings.usdExchangeRate,
    // Bloque 9.2: sin caja abierta no se cobra (`registerPosSale` corta con 409).
    //
    // Fase 6 del rediseño de Caja (2026-09-23) — la terminal viaja desde el POS: el turno que se resuelve
    // (y que se le firma a cada cobro, `Payment.shiftId`) es el de **esa** terminal. Sin terminal es la caja
    // sin terminal, que es la de una sucursal con una sola caja.
    findOpenShift: async (locationId, terminalId) =>
      (await getCurrentShift({ locationId, terminalId }, { shiftRepository })).data,
    /**
     * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón se cotiza con el **mismo** caso de uso que usa la
     * pantalla antes de comparar el cobro contra el total: sin esto, una venta con descuento «no alcanzaba»
     * aunque el cliente hubiera pagado bien.
     */
    quoteCoupon: (input) => quotePosCoupon(input, createProductionPosCouponDependencies()),
  };
}
