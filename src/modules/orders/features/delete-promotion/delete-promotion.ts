import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * T9c — el owner borra una promo.
 *
 * Borra de verdad: borrar es lo que el owner espera del tacho. Para sacarla de
 * circulación un tiempo está el interruptor de activa, que además conserva el
 * historial de uso.
 */
type DeletePromotionDependencies = {
  repository: OrderRepository;
};

export async function deletePromotion(
  id: string,
  { repository }: DeletePromotionDependencies,
): Promise<{ data: { id: string }; meta: { updatedAt: string } }> {
  const current = await repository.findCouponById(id);
  if (!current) {
    throw new OrderError(404, "NOT_FOUND", "Coupon not found");
  }

  await repository.deleteCoupon(id);

  return { data: { id }, meta: { updatedAt: new Date().toISOString() } };
}
