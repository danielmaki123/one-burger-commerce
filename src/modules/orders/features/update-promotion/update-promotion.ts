import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { buildPromotionFields, validatePromotionInput } from "@/modules/orders/domain/promotion-rules";
import type { PromotionInput } from "@/modules/orders/domain/promotion-rules";
import type { CouponRecord } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * T9c — el owner edita una promo.
 *
 * El formulario manda todos los campos, así que el guardado es un reemplazo completo:
 * no quedan restos del tipo anterior. Lo único que **no** se toca es el uso acumulado,
 * que es historia del negocio y no configuración.
 */
type UpdatePromotionDependencies = {
  repository: OrderRepository;
  timeZone?: string;
};

export async function updatePromotion(
  id: string,
  input: PromotionInput,
  { repository, timeZone = DEFAULT_BUSINESS_SETTINGS.timezone }: UpdatePromotionDependencies,
): Promise<{ data: CouponRecord; meta: { updatedAt: string } }> {
  const current = await repository.findCouponById(id);
  if (!current) {
    throw new OrderError(404, "NOT_FOUND", "Coupon not found");
  }

  const errors = validatePromotionInput(input);
  if (Object.keys(errors).length > 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", errors);
  }

  const fields = buildPromotionFields(input, timeZone);

  const withSameCode = await repository.findCouponByCode(fields.code);
  if (withSameCode && withSameCode.id !== id) {
    throw new OrderError(409, "CONFLICT", "Coupon code already exists", {
      code: `Ya hay una promo con el código ${fields.code}`,
    });
  }

  const coupon = await repository.updateCoupon(id, fields);

  return { data: coupon, meta: { updatedAt: new Date().toISOString() } };
}
