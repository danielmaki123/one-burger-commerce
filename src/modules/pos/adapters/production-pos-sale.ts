import { publish } from "@/infrastructure/events/event-bus";
import { getPrismaClient } from "@/infrastructure/database/prisma";
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
 *
 * TASK-AUD-004 — la venta entera (el pedido con su cupón y **todos** sus cobros) corre en **una sola
 * transacción** de PostgreSQL. Antes el alta se guardaba y después cada cobro se escribía por su cuenta:
 * una falla en el segundo dejaba el pedido cobrado a medias, y el reintento con la misma clave devolvía
 * esa venta incompleta como si estuviera paga.
 *
 * Dos cosas quedan **afuera** a propósito y por eso están escritas acá:
 *
 * - el **aviso** de pedido creado (`publish` → outbox): se junta durante la transacción y se publica
 *   **después del commit**. Adentro, un rollback dejaría el aviso vivo y cocina recibiría un pedido que no
 *   existe. Es el efecto posterior a la persistencia que pide la skill de dinero;
 * - el **cliente** (`findOrCreateCustomer`): por diseño no hace fallar la venta y usa el cliente normal de
 *   la base, así que no participa de la transacción.
 */
/**
 * `true` cuando la base rechazó la escritura por un índice único (`P2002`).
 *
 * En esta operación el único `P2002` posible es el de la clave de intento del pedido: dos cobros de la
 * misma venta entrando juntos. El conflicto **aborta la transacción entera**, así que la recuperación del
 * alta (leer el pedido que ya existe) no puede correr adentro: hay que rehacer la transacción.
 */
function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createProductionPosSaleDependencies(): Promise<RegisterPosSaleDependencies> {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const locationRepository = new PrismaLocationRepository();
  const shiftRepository = new PrismaShiftRepository();

  return {
    /**
     * El **límite atómico**: el `$transaction` de Prisma con el pedido y sus cobros adentro. Si algo falla
     * —el segundo cobro, el total que cambió— no queda ni el pedido ni el primer cobro.
     *
     * `timeout`/`maxWait` explícitos: el trabajo de adentro son unas pocas consultas al mismo Postgres (sin
     * red, sin impresión, sin notificaciones), pero el `maxWait` por defecto (2 s) es corto para un local
     * con la caja ocupada y una espera de pool haría fallar una venta que estaba bien.
     */
    runInSaleTransaction: (work) => {
      /** Un intento completo: transacción nueva y avisos nuevos (un intento abortado no publica nada). */
      const attempt = async () => {
        const deferredPublishes: Array<() => Promise<void>> = [];

        const result = await getPrismaClient().$transaction(
          async (tx) => {
            const orderRepository = new PrismaOrderRepository(tx);
            const paymentRepository = new PrismaPaymentRepository(tx);

            return work({
              /**
               * `createOrder` devuelve `{ data, meta }`: acá se traduce a lo que el POS necesita —el pedido
               * y si el alta **reusó** uno ya creado con la misma clave de intento (tarea 11)—. En un
               * reintento los cobros no se registran otra vez, así que la pantalla tiene que poder decirlo.
               */
              createPosOrder: async (input: CreateOrderRequest) => {
                const result = await createOrder(input, {
                  repository: orderRepository,
                  locationRepository,
                  tipPolicy: { enabled: settings.tipEnabled, rate: settings.tipRate },
                  // El aviso de pedido creado no sale acá adentro: se junta y se publica después del commit.
                  publishOrderCreated: (order) => {
                    deferredPublishes.push(() => publish("OrderCreated", { order }));
                  },
                });

                return { order: result.data, reused: result.meta.reused === true };
              },
              paymentRepository,
            });
          },
          { timeout: 15_000, maxWait: 10_000 },
        );

        // Recién acá el pedido está confirmado en la base: el aviso ya no puede quedar huérfano.
        for (const deferred of deferredPublishes) {
          await deferred();
        }

        return result;
      };

      return attempt().catch((error: unknown) => {
        /**
         * Dos cobros de la misma venta entrando juntos: uno gana y el otro choca con el índice único de la
         * clave de intento. Ese choque deja la transacción abortada, así que **se rehace una vez**: en el
         * intento nuevo el alta encuentra el pedido ya guardado **antes** de escribir nada, lo devuelve
         * reusado y no cobra dos veces. Si el segundo intento también choca, el error sale tal cual.
         */
        if (!isUniqueConflict(error)) throw error;

        return attempt();
      });
    },
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
