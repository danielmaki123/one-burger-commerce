import { resolveCouponEligibility } from "@/modules/orders/domain/coupon-eligibility";
import type { CouponRecord } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * T9c — la lista de promos del admin.
 *
 * Cada promo viaja con su estado ya resuelto (`active`, `inactive`, `expired`,
 * `exhausted`) usando **las mismas reglas** que aplican el checkout y la creación del
 * pedido. Si el admin mostrara su propio cálculo, podría decir "activa" de una promo
 * que el cliente no puede usar.
 */
export type PromotionStatus = "active" | "inactive" | "expired" | "exhausted";

export type AdminPromotion = CouponRecord & { status: PromotionStatus };

type ListPromotionsDependencies = {
  repository: OrderRepository;
  /** Inyectable para poder probar vencimientos sin depender del reloj real. */
  now?: Date;
};

export async function listPromotions({
  repository,
  now = new Date(),
}: ListPromotionsDependencies): Promise<{ data: AdminPromotion[] }> {
  const coupons = await repository.listCoupons();

  const data = coupons.map((coupon): AdminPromotion => {
    const eligibility = resolveCouponEligibility(coupon, now);

    return { ...coupon, status: eligibility.usable ? "active" : eligibility.reason };
  });

  return { data };
}
