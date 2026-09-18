import { resolveCouponDiscount } from "@/modules/orders/domain/coupon-discount";
import {
  COUPON_REJECTION_MESSAGES,
  normalizeCouponCode,
  resolveCouponEligibility,
} from "@/modules/orders/domain/coupon-eligibility";
import type { CouponRecord } from "@/modules/orders/domain/order.types";
import type { BogoEligibleItem } from "@/modules/orders/domain/promo-bogo";
import { roundCurrency } from "@/shared/lib/order-totals";

import { PosError } from "../../domain/pos-errors";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — **cotizar un cupón antes de cobrar**.
 *
 * En el mostrador el cajero tiene que decirle al cliente cuánto paga **antes** de que la plata cambie de
 * mano. Si el descuento recién apareciera al crear el pedido, el cajero cobraría de más (o de menos) y el
 * error se vería con el cliente adelante. La cotización usa el **mismo** cálculo que el alta
 * (`resolveCouponDiscount`) sobre los **mismos** precios que resuelve el servidor (`getProduct` es el
 * producto tal como lo lee el alta: precio base, categoría y subcategoría), así que el número que se
 * muestra es el que se cobra. Si entre la cotización y el cobro el menú cambia, el alta lo vuelve a
 * comparar y lo dice con el número de pedido (el POS ya lo hacía).
 *
 * Tres reglas que no son obvias:
 *
 * 1. **Cotizar no consume el cupón.** Los usos se reservan recién cuando el pedido se crea: si no, mirar
 *    el descuento quemaría una promo.
 * 2. **La elegibilidad es la del checkout** (`coupon-eligibility.ts`): activo, sin vencer y con usos
 *    disponibles. Un cupón que el cliente ya no puede usar se rechaza con el mismo texto.
 * 3. **La venta se cotiza contra el catálogo del servidor**, no contra lo que la pantalla tenía cargado:
 *    un producto que se quedó sin stock (o se archivó) se dice **antes** de cobrar, no al crear el pedido.
 */

export type QuotePosCouponInput = {
  couponCode: string;
  /** Las líneas del borrador: qué producto y cuántas unidades. El precio lo resuelve el servidor. */
  lines: { productId: string; quantity: number }[];
};

/** Lo que la cotización necesita de un producto: el mismo dato que lee el alta del pedido. */
export type PosCouponProduct = {
  id: string;
  name: string;
  basePrice: number;
  categoryId: string;
  subcategoryId?: string | null;
  isActive: boolean;
  isAvailable: boolean;
};

export type QuotePosCouponDependencies = {
  findCouponByCode: (code: string) => Promise<CouponRecord | null>;
  getProduct: (productId: string) => Promise<PosCouponProduct | null>;
};

export type QuotePosCouponResult = {
  /** El cupón tal como quedó guardado (código normalizado incluido) para que la pantalla lo describa. */
  coupon: {
    code: string;
    type: CouponRecord["type"];
    value: number;
    buyQuantity: number | null;
    freeQuantity: number | null;
    scopeType: string | null;
    scopeId: string | null;
  };
  subtotal: number;
  discount: number;
};

function couponRejection(message: string): PosError {
  return new PosError(409, "CONFLICT", message, { coupon: message });
}

export async function quotePosCoupon(
  input: QuotePosCouponInput,
  deps: QuotePosCouponDependencies,
): Promise<QuotePosCouponResult> {
  if (input.lines.length === 0) {
    throw new PosError(422, "VALIDATION_ERROR", "Agregá al menos un producto.", {
      lines: "Agregá al menos un producto.",
    });
  }

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new PosError(422, "VALIDATION_ERROR", "La cantidad tiene que ser un entero de 1 o más.", {
        lines: "La cantidad tiene que ser un entero de 1 o más.",
      });
    }
  }

  const coupon = await deps.findCouponByCode(normalizeCouponCode(input.couponCode));
  if (!coupon) {
    throw new PosError(404, "NOT_FOUND", "Ese código no existe.", {
      coupon: "Ese código no existe.",
    });
  }

  const eligibility = resolveCouponEligibility(coupon, new Date());
  if (!eligibility.usable) {
    throw couponRejection(COUPON_REJECTION_MESSAGES[eligibility.reason]);
  }

  const items: BogoEligibleItem[] = [];
  for (const line of input.lines) {
    const product = await deps.getProduct(line.productId);
    if (!product) {
      throw new PosError(409, "CONFLICT", "Un producto de la venta ya no existe: quitálo y volvé a intentar.", {
        lines: "Un producto de la venta ya no existe.",
      });
    }
    if (!product.isActive || !product.isAvailable) {
      throw new PosError(
        409,
        "CONFLICT",
        `${product.name} ya no está disponible: quitálo de la venta y volvé a intentar.`,
        { lines: `${product.name} ya no está disponible.` },
      );
    }

    items.push({
      productId: product.id,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId ?? null,
      unitPrice: product.basePrice,
      quantity: line.quantity,
    });
  }

  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );

  const resolved = resolveCouponDiscount({ coupon, items, subtotal });
  if (!resolved.ok) {
    if (resolved.reason === "misconfigured") {
      throw couponRejection("Esa promo está mal armada: avisale al dueño antes de usarla.");
    }

    throw couponRejection("Esa promo no alcanza a esta venta.");
  }

  return {
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      buyQuantity: coupon.buyQuantity ?? null,
      freeQuantity: coupon.freeQuantity ?? null,
      scopeType: coupon.scopeType ?? null,
      scopeId: coupon.scopeId ?? null,
    },
    subtotal,
    discount: resolved.discount,
  };
}
