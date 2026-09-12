import { OrderError } from "@/modules/orders/domain/order-errors";
import {
  COUPON_REJECTION_MESSAGES,
  normalizeCouponCode,
  resolveCouponEligibility,
} from "@/modules/orders/domain/coupon-eligibility";
import type { CouponRecord } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * Validación pública de un código (T9b).
 *
 * El checkout le pregunta al servidor si el código sirve **antes** de confirmar el
 * pedido, y le muestra el mismo mensaje que vería si el código fallara al
 * confirmar. Devuelve la forma pública del cupón, nunca el descuento en dinero:
 * el monto lo calcula el servidor al crear el pedido.
 */
export type PublicCoupon = {
  code: string;
  type: CouponRecord["type"];
  value: number;
  buyQuantity: number | null;
  freeQuantity: number | null;
  scopeType: string;
  scopeId: string | null;
};

export async function validateCoupon(
  input: { code: string },
  {
    repository,
    now = new Date(),
  }: { repository: OrderRepository; now?: Date },
): Promise<{ data: PublicCoupon }> {
  const code = normalizeCouponCode(input.code);
  if (!code) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { code: "Required" });
  }

  const coupon = await repository.findCouponByCode(code);
  if (!coupon) {
    throw new OrderError(404, "NOT_FOUND", "No encontramos ese código.");
  }

  const eligibility = resolveCouponEligibility(coupon, now);
  if (!eligibility.usable) {
    throw new OrderError(409, "CONFLICT", COUPON_REJECTION_MESSAGES[eligibility.reason]);
  }

  return {
    data: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      buyQuantity: coupon.buyQuantity ?? null,
      freeQuantity: coupon.freeQuantity ?? null,
      scopeType: coupon.scopeType ?? "all",
      scopeId: coupon.scopeId ?? null,
    },
  };
}
