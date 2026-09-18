import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";

import type { QuotePosCouponDependencies } from "../features/quote-pos-coupon/quote-pos-coupon";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — la cotización del cupón en producción.
 *
 * Usa el **mismo** repositorio de pedidos que el alta (`createOrder`): el precio base del producto, su
 * categoría y su subcategoría —que es a lo que alcanzan las promos por cantidad— salen de la misma lectura,
 * así que la cotización del mostrador y el total del pedido no pueden discrepar.
 *
 * Vive acá y no en la ruta porque instancia Prisma (regla de `AGENTS.md`; el contrato de rutas lo mide).
 */
export function createProductionPosCouponDependencies(): QuotePosCouponDependencies {
  const repository = new PrismaOrderRepository();

  return {
    findCouponByCode: (code) => repository.findCouponByCode(code),
    getProduct: (productId) => repository.getProductWithModifiers(productId),
  };
}
