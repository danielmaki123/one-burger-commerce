import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * Respaldo del porcentaje de propina. Sale del módulo de defaults del negocio,
 * que es la única fuente de verdad: el valor real lo inyecta el caso de uso
 * desde la configuración guardada.
 */
export const DEFAULT_TIP_RATE = DEFAULT_BUSINESS_SETTINGS.tipRate;

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **el redondeo de dinero dejó de vivir acá**.
 *
 * El algoritmo es el mismo y la firma también; lo que cambió es el dueño: el redondeo es una regla de
 * dinero y vive en `money` (`@/modules/money/domain/round-currency`), junto a la conversión y al formato.
 * Este archivo lo **re-exporta** para no romper los ~109 usos que ya lo importaban de acá: una segunda
 * copia de la multiplicación por 100 es exactamente lo que la auditoría midió (`A-69`).
 */
export { roundCurrency };

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

/**
 * La suma del total, con los componentes ya calculados.
 *
 * Es la **única** puerta para la fórmula. Existe además de `calculateOrderTotals` porque hay
 * lugares que tienen los montos pero no las líneas del pedido: el agregado de ítems de mesa, la
 * corrección del envío en el adaptador y la tarjeta de resumen. Antes cada uno la reescribía con su
 * propia variante (uno omitía el descuento, otro el empaque), así que agregar un componente nuevo
 * obligaba a encontrarlos todos.
 */
export function calculateOrderTotal(params: {
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
}): number {
  return roundCurrency(
    params.subtotal -
      params.discount +
      params.packagingAmount +
      params.deliveryFeeAmount +
      params.tipAmount,
  );
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
    // La fórmula no se repite acá: se delega en la única puerta.
    total: calculateOrderTotal({
      subtotal: params.subtotal,
      discount: params.discount,
      packagingAmount,
      deliveryFeeAmount: params.deliveryFeeAmount,
      tipAmount,
    }),
  };
}
