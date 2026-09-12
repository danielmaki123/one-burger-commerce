import { endOfDayInTimeZone } from "@/modules/business-settings/domain/end-of-day";
import { BOGO_SCOPE_TYPES, validateBogoCouponConfig } from "@/modules/orders/domain/promo-bogo";
import type { CouponRecord } from "@/modules/orders/domain/order.types";

/**
 * Reglas de una promo (T9c).
 *
 * Las usan el admin —para avisar antes de guardar— y los casos de uso —para
 * rechazar de verdad—. Devuelven un mapa de errores por campo, vacío si está bien,
 * con mensajes para el owner.
 */
export type PromotionInput = {
  code: string;
  type: CouponRecord["type"];
  value: number;
  isActive: boolean;
  /** 0 = sin límite de uso. */
  usageLimit: number;
  expiresAt: string | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
  scopeType: string;
  scopeId: string | null;
};

/** Letras, números, guiones y guión bajo: se dicta por teléfono sin errores. */
export const PROMOTION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;

export function normalizePromotionCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function validatePromotionInput(input: PromotionInput): Record<string, string> {
  const errors: Record<string, string> = {};

  const code = normalizePromotionCode(input.code);
  if (!code) {
    errors.code = "Escribí el código que va a usar el cliente";
  } else if (!PROMOTION_CODE_PATTERN.test(code)) {
    errors.code = "Entre 3 y 24 caracteres: letras, números, guiones o guión bajo";
  }

  if (input.type === "percentage") {
    if (!Number.isInteger(input.value) || input.value < 1 || input.value > 100) {
      errors.value = "Un porcentaje entero entre 1 y 100";
    }
  } else if (input.type === "fixed_amount") {
    if (!Number.isFinite(input.value) || input.value <= 0) {
      errors.value = "Un monto mayor que cero";
    }
  } else if (input.type === "bogo") {
    const bogoError = validateBogoCouponConfig(input);
    if (bogoError) {
      errors[bogoError.field] = bogoError.message;
    }
  } else {
    errors.type = "Elegí un tipo de promo";
  }

  if (!Number.isInteger(input.usageLimit) || input.usageLimit < 0) {
    errors.usageLimit = "Un número entero de usos (0 = sin límite)";
  }

  if (input.expiresAt !== null && Number.isNaN(new Date(input.expiresAt).getTime())) {
    errors.expiresAt = "Elegí una fecha válida";
  }

  if (!BOGO_SCOPE_TYPES.includes(input.scopeType as never)) {
    errors.scopeType = "El alcance no es válido";
  } else if (input.type !== "bogo" && input.scopeType !== "all") {
    // Un porcentaje con alcance mentiría: el descuento no mira las categorías.
    errors.scopeType = "El alcance solo se puede elegir en una promo por cantidad";
  } else if (input.scopeType !== "all" && !input.scopeId) {
    errors.scopeId = "Elegí a qué alcanza la promo";
  }

  return errors;
}

/** Campos ya limpios y coherentes con el tipo, listos para guardar. */
export type PromotionFields = {
  code: string;
  type: CouponRecord["type"];
  value: number;
  isActive: boolean;
  usageLimit: number;
  expiresAt: string | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
  scopeType: string;
  scopeId: string | null;
};

/** Una fecha sin hora (`2026-12-31`) vence al final de ese día en la zona del negocio. */
function normalizeExpiresAt(value: string | null, timeZone: string): string | null {
  if (value === null || value.trim() === "") return null;

  const endOfDay = endOfDayInTimeZone(value.trim(), timeZone);
  if (endOfDay) return endOfDay;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Traduce lo que cargó el owner al registro que se guarda.
 *
 * Dos cosas que evitan promos mentirosas: un porcentaje no arrastra unidades ni
 * alcance (no los usa para calcular), y una promo por cantidad no arrastra un monto
 * (el descuento lo decide el motor a partir de las unidades).
 */
export function buildPromotionFields(input: PromotionInput, timeZone: string): PromotionFields {
  const common = {
    code: normalizePromotionCode(input.code),
    isActive: input.isActive,
    usageLimit: input.usageLimit,
    expiresAt: normalizeExpiresAt(input.expiresAt, timeZone),
  };

  if (input.type === "bogo") {
    return {
      ...common,
      type: "bogo",
      value: 0,
      buyQuantity: input.buyQuantity,
      freeQuantity: input.freeQuantity,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
    };
  }

  return {
    ...common,
    type: input.type,
    value: input.value,
    buyQuantity: null,
    freeQuantity: null,
    scopeType: "all",
    scopeId: null,
  };
}
