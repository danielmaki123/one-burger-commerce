import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { buildPromotionFields, validatePromotionInput } from "@/modules/orders/domain/promotion-rules";
import type { PromotionInput } from "@/modules/orders/domain/promotion-rules";
import type { CouponRecord } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * T9c — el owner crea una promo desde el admin.
 *
 * Las reglas son las mismas que muestra el formulario: si algo entra por la API sin
 * pasar por la pantalla, se rechaza igual y los errores vuelven por campo.
 */
type CreatePromotionDependencies = {
  repository: OrderRepository;
  /** Zona horaria del negocio, para resolver una fecha de vencimiento sin hora. */
  timeZone?: string;
};

export async function createPromotion(
  input: PromotionInput,
  { repository, timeZone = DEFAULT_BUSINESS_SETTINGS.timezone }: CreatePromotionDependencies,
): Promise<{ data: CouponRecord; meta: { updatedAt: string } }> {
  const errors = validatePromotionInput(input);
  if (Object.keys(errors).length > 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", errors);
  }

  const fields = buildPromotionFields(input, timeZone);

  const existing = await repository.findCouponByCode(fields.code);
  if (existing) {
    throw new OrderError(409, "CONFLICT", "Coupon code already exists", {
      code: `Ya hay una promo con el código ${fields.code}`,
    });
  }

  const coupon = await repository.createCoupon(fields);

  return { data: coupon, meta: { updatedAt: new Date().toISOString() } };
}
