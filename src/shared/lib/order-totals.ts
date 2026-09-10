import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

/**
 * Respaldo del porcentaje de propina. Sale del módulo de defaults del negocio,
 * que es la única fuente de verdad: el valor real lo inyecta el caso de uso
 * desde la configuración guardada.
 */
export const DEFAULT_TIP_RATE = DEFAULT_BUSINESS_SETTINGS.tipRate;

export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculatePackagingAmount(
  items: Array<{ packagingTotalAmount: number }>,
  orderType: "delivery" | "pickup" | "table",
): number {
  if (orderType === "table") {
    return 0;
  }

  return roundCurrency(
    items.reduce((sum, item) => sum + item.packagingTotalAmount, 0),
  );
}

export function calculateTipAmount(params: {
  subtotal: number;
  discount: number;
  tipOptIn: boolean;
  orderType: "delivery" | "pickup" | "table";
  tipRate?: number;
}): { tipBase: number; tipAmount: number; tipRate: number | null } {
  const tipBase = roundCurrency(Math.max(params.subtotal - params.discount, 0));

  if (!params.tipOptIn || params.orderType === "table") {
    return { tipBase, tipAmount: 0, tipRate: null };
  }

  const tipRate = params.tipRate ?? DEFAULT_TIP_RATE;
  return {
    tipBase,
    tipAmount: roundCurrency((tipBase * tipRate) / 100),
    tipRate,
  };
}

export function calculateOrderTotals(params: {
  subtotal: number;
  discount: number;
  deliveryFeeAmount: number;
  items: Array<{ packagingTotalAmount: number }>;
  tipOptIn: boolean;
  orderType: "delivery" | "pickup" | "table";
  tipRate?: number;
}) {
  const packagingAmount = calculatePackagingAmount(params.items, params.orderType);
  const { tipBase, tipAmount, tipRate } = calculateTipAmount({
    subtotal: params.subtotal,
    discount: params.discount,
    tipOptIn: params.tipOptIn,
    orderType: params.orderType,
    tipRate: params.tipRate,
  });

  return {
    packagingAmount,
    tipBase,
    tipAmount,
    tipRate,
    total: roundCurrency(
      params.subtotal -
        params.discount +
        packagingAmount +
        params.deliveryFeeAmount +
        tipAmount,
    ),
  };
}
