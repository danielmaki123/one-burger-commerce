import type { CouponRecord } from "@/modules/orders/domain/order.types";
import type { PromotionInput } from "@/modules/orders/domain/promotion-rules";
import type { AdminPromotion, PromotionStatus } from "@/modules/orders/features/list-promotions/list-promotions";
import type { BogoScopeType } from "@/modules/orders/domain/promo-bogo";
import { dateOnlyInTimeZone } from "@/modules/business-settings/domain/end-of-day";
import type { CurrencyFormat } from "@/shared/lib/format-currency";
import { formatCurrency } from "@/shared/lib/format-currency";

/**
 * T9c — lo que el admin muestra y lo que manda.
 *
 * Dos reglas que se ven en todo el archivo:
 *  - el texto de la ficha sale de los datos guardados (nada escrito a mano);
 *  - el payload se arma **antes** de validar, así una promo por porcentaje no manda
 *    un alcance que su tipo no usa.
 */

export const PROMOTION_TYPE_LABELS: Record<CouponRecord["type"], string> = {
  percentage: "Porcentaje",
  fixed_amount: "Monto fijo",
  bogo: "Por cantidad",
};

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  active: "Activa",
  inactive: "Inactiva",
  expired: "Vencida",
  exhausted: "Agotada",
};

export const SCOPE_TYPE_LABELS: Record<BogoScopeType, string> = {
  all: "Todo el menú",
  category: "Categoría",
  subcategory: "Subcategoría",
  product: "Plato",
};

/** El formulario trabaja con strings: es lo que devuelve un `<input>`. */
export type PromotionFormState = {
  code: string;
  type: CouponRecord["type"];
  value: string;
  isActive: boolean;
  usageLimit: string;
  /** `YYYY-MM-DD`, lo que da un `<input type="date">`. */
  expiresAt: string;
  buyQuantity: string;
  freeQuantity: string;
  scopeType: BogoScopeType;
  scopeId: string;
};

export function createEmptyPromotionForm(): PromotionFormState {
  return {
    code: "",
    type: "percentage",
    value: "10",
    isActive: true,
    usageLimit: "0",
    expiresAt: "",
    buyQuantity: "",
    freeQuantity: "",
    scopeType: "all",
    scopeId: "",
  };
}

function toIntegerOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toIntegerOrZero(value: string): number {
  return toIntegerOrNull(value) ?? 0;
}

function toNumberOrZero(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return 0;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Lo que se manda al servidor. Campos que el tipo no usa viajan vacíos, no "como estaban". */
export function promotionFormToInput(form: PromotionFormState): PromotionInput {
  const isBogo = form.type === "bogo";

  return {
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: isBogo ? 0 : toNumberOrZero(form.value),
    isActive: form.isActive,
    usageLimit: toIntegerOrZero(form.usageLimit),
    expiresAt: form.expiresAt.trim() === "" ? null : form.expiresAt.trim(),
    buyQuantity: isBogo ? toIntegerOrNull(form.buyQuantity) : null,
    freeQuantity: isBogo ? toIntegerOrNull(form.freeQuantity) : null,
    scopeType: isBogo ? form.scopeType : "all",
    scopeId: isBogo && form.scopeType !== "all" ? form.scopeId || null : null,
  };
}

export function promotionToForm(promotion: CouponRecord, timeZone: string): PromotionFormState {
  return {
    code: promotion.code,
    type: promotion.type,
    value: String(promotion.value),
    isActive: promotion.isActive,
    usageLimit: String(promotion.usageLimit),
    expiresAt: promotion.expiresAt ? (dateOnlyInTimeZone(promotion.expiresAt, timeZone) ?? "") : "",
    buyQuantity: promotion.buyQuantity === null ? "" : String(promotion.buyQuantity),
    freeQuantity: promotion.freeQuantity === null ? "" : String(promotion.freeQuantity),
    scopeType: (promotion.scopeType as BogoScopeType | null) ?? "all",
    scopeId: promotion.scopeId ?? "",
  };
}

export function describePromotionRule(promotion: CouponRecord, currency: CurrencyFormat): string {
  if (promotion.type === "percentage") {
    return `${promotion.value} % de descuento`;
  }

  if (promotion.type === "fixed_amount") {
    return `${formatCurrency(promotion.value, currency)} de descuento`;
  }

  // buy 2 + free 1 = "llevá 3 y pagá 2".
  const buy = promotion.buyQuantity ?? 0;
  const free = promotion.freeQuantity ?? 0;

  return `Llevá ${buy + free} y pagá ${buy}`;
}

export function describePromotionScope(
  promotion: CouponRecord,
  resolveName: (id: string) => string | null,
): string {
  const scopeType = (promotion.scopeType as BogoScopeType | null) ?? "all";
  if (scopeType === "all") return SCOPE_TYPE_LABELS.all;

  const name = promotion.scopeId ? resolveName(promotion.scopeId) : null;

  return `${SCOPE_TYPE_LABELS[scopeType]}: ${name ?? "sin nombre"}`;
}

export function describePromotionUsage(promotion: CouponRecord): string {
  if (promotion.usageLimit <= 0) {
    const used =
      promotion.usedCount === 0
        ? "Sin usos todavía"
        : promotion.usedCount === 1
          ? "1 uso"
          : `${promotion.usedCount} usos`;

    return `${used} · sin límite`;
  }

  return `${promotion.usedCount} de ${promotion.usageLimit} usos`;
}

export function describePromotionExpiry(promotion: CouponRecord, timeZone: string): string {
  if (!promotion.expiresAt) return "Sin vencimiento";

  const dateOnly = dateOnlyInTimeZone(promotion.expiresAt, timeZone);
  if (!dateOnly) return "Sin vencimiento";

  const [year, month, day] = dateOnly.split("-");

  return `Vence el ${day}/${month}/${year}`;
}

/** Una promo vencida o agotada nunca se ofrece: el admin la marca para que se note. */
export function isPromotionOffered(promotion: AdminPromotion): boolean {
  return promotion.status === "active";
}
