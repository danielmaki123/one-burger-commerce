import { publish } from "@/infrastructure/events/event-bus";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import { findOrCreateCustomer } from "@/modules/customers/features/find-or-create-customer/find-or-create-customer";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { DeliveryFeeStatus, DeliveryZoneRecord } from "@/modules/orders/domain/order.types";
import { getInitialStatus } from "@/modules/orders/domain/order-workflows";
import {
  generateOrderLookupToken,
  hashOrderLookupToken,
} from "@/modules/orders/domain/order-tracking";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import { calculateOrderTotals, roundCurrency } from "@/shared/lib/order-totals";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

export type OrderItemRequest = {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
  notes?: string | null;
};

export type CreateOrderRequest = {
  type: "delivery" | "pickup" | "table";
  customerName: string;
  customerWhatsapp: string;
  items: OrderItemRequest[];
  couponCode?: string | null;
  address?: string | null;
  deliveryNotes?: string | null;
  deliveryFeeStatus?: DeliveryFeeStatus | null;
  tipOptIn?: boolean;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; `false` = lo antes posible. */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  tableId?: string | null;
  qrToken?: string | null;
  deliveryZoneId?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: string | null;
};

export async function createOrder(
  input: CreateOrderRequest,
  {
    repository,
    resolveCustomerId = findOrCreateCustomer,
    orderLookupTokenGenerator = generateOrderLookupToken,
    tipPolicy = {
      enabled: DEFAULT_BUSINESS_SETTINGS.tipEnabled,
      rate: DEFAULT_BUSINESS_SETTINGS.tipRate,
    },
  }: {
    repository: OrderRepository;
    resolveCustomerId?: (input: {
      fullName: string;
      whatsappNormalized: string;
    }) => Promise<string | null>;
    orderLookupTokenGenerator?: () => string;
    /**
     * Propina configurada en `/admin/settings`. El servidor es la fuente de
     * verdad: el porcentaje del cliente nunca se acepta, y con la propina
     * apagada no se aplica aunque el checkout la pida.
     */
    tipPolicy?: { enabled: boolean; rate: number };
  },
) {
  // Basic validation
  if (!input.type || !["delivery", "pickup", "table"].includes(input.type)) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { type: "Required and must be delivery, pickup, or table" });
  }

  if (!input.customerName || input.customerName.trim().length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { customerName: "Required" });
  }

  if (!input.customerWhatsapp || input.customerWhatsapp.trim().length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { customerWhatsapp: "Required" });
  }

  const normalizedWhatsapp = normalizeWhatsapp(input.customerWhatsapp);
  if (!normalizedWhatsapp) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { customerWhatsapp: "Invalid format" });
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { items: "Required and must not be empty" });
  }

  // Type-specific validation
  let selectedZone: DeliveryZoneRecord | null = null;
  if (input.type === "delivery") {
    if (!input.address || input.address.trim().length === 0) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { address: "Required for delivery" });
    }
    if (!input.deliveryNotes || input.deliveryNotes.trim().length === 0) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { deliveryNotes: "Required for delivery" });
    }
    if (!input.deliveryZoneId || input.deliveryZoneId.trim().length === 0) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { deliveryZoneId: "Required for delivery" });
    }
    selectedZone = await repository.findDeliveryZoneById(input.deliveryZoneId.trim());
    if (!selectedZone) {
      throw new OrderError(404, "NOT_FOUND", "Delivery zone not found");
    }
    if (!selectedZone.isActive) {
      throw new OrderError(409, "CONFLICT", "Delivery zone is not active");
    }
  }

  if (input.type === "pickup") {
    if (input.pickupTime) {
      const date = new Date(input.pickupTime);
      if (isNaN(date.getTime())) {
        throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { pickupTime: "Invalid date" });
      }
    }
  }

  if (input.type === "table") {
    if (!input.tableId || input.tableId.trim().length === 0) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { tableId: "Required for table orders" });
    }
    const table = await repository.findTableById(input.tableId);
    if (!table) {
      throw new OrderError(404, "NOT_FOUND", "Table not found");
    }
    if (!table.isActive) {
      throw new OrderError(409, "CONFLICT", "Table is not active");
    }
  }

  // Validate items and calculate line totals
  const itemDetails: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    packagingUnitAmount: number;
    packagingQuantity: number;
    packagingTotalAmount: number;
    notes: string | null;
    lineTotal: number;
    modifiers: Array<{
      modifierOptionId: string;
      name: string;
      priceDelta: number;
    }>;
  }> = [];

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const prefix = `items[${i}]`;

    if (!item.productId) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { [`${prefix}.productId`]: "Required" });
    }
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { [`${prefix}.quantity`]: "Must be >= 1" });
    }

    const product = await repository.getProductWithModifiers(item.productId);
    if (!product) {
      throw new OrderError(404, "NOT_FOUND", `Product not found: ${item.productId}`);
    }
    if (!product.isActive || !product.isAvailable) {
      throw new OrderError(409, "CONFLICT", `Product not available: ${product.name}`);
    }

    const selectedModifierIds = item.modifierOptionIds ?? [];
    const modifiers: Array<{ modifierOptionId: string; name: string; priceDelta: number }> = [];

    for (const group of product.modifierGroups) {
      const selectedInGroup = selectedModifierIds.filter((id) =>
        group.options.some((opt) => opt.id === id),
      );

      if (group.isRequired && selectedInGroup.length === 0) {
        throw new OrderError(422, "VALIDATION_ERROR", "Required modifier missing", {
          [`${prefix}.modifierOptionIds`]: `Required modifier missing for group: ${group.name}`,
        });
      }

      if (selectedInGroup.length < group.minSelections) {
        throw new OrderError(422, "VALIDATION_ERROR", "Minimum selections not met", {
          [`${prefix}.modifierOptionIds`]: `Minimum ${group.minSelections} selections required for ${group.name}`,
        });
      }

      if (selectedInGroup.length > group.maxSelections) {
        throw new OrderError(422, "VALIDATION_ERROR", "Maximum selections exceeded", {
          [`${prefix}.modifierOptionIds`]: `Maximum ${group.maxSelections} selections allowed for ${group.name}`,
        });
      }
    }

    for (const modId of selectedModifierIds) {
      const option = product.modifierGroups
        .flatMap((g) => g.options)
        .find((o) => o.id === modId);
      if (!option) {
        throw new OrderError(422, "VALIDATION_ERROR", "Invalid modifier option", {
          [`${prefix}.modifierOptionIds`]: `Invalid modifier option: ${modId}`,
        });
      }
      if (!option.isActive) {
        throw new OrderError(409, "CONFLICT", `Modifier option not available: ${option.name}`);
      }
      modifiers.push({
        modifierOptionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }

    const modifiersPrice = modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    const unitPrice = roundCurrency(product.basePrice + modifiersPrice);
    const lineTotal = roundCurrency(unitPrice * item.quantity);
    const packagingUnitAmount =
      input.type === "table" ? 0 : product.packagingFeeAmount ?? 0;
    const packagingQuantity = packagingUnitAmount > 0 ? item.quantity : 0;
    const packagingTotalAmount = roundCurrency(packagingUnitAmount * packagingQuantity);

    itemDetails.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      packagingUnitAmount,
      packagingQuantity,
      packagingTotalAmount,
      notes: item.notes ?? null,
      lineTotal,
      modifiers,
    });
  }

  // Calculate totals
  const subtotal = itemDetails.reduce((sum, item) => sum + item.lineTotal, 0);

  // Apply coupon if provided
  let discount = 0;
  let appliedCouponCode: string | null = null;
  let consumedCouponId: string | null = null;

  if (input.couponCode) {
    const coupon = await repository.findCouponByCode(input.couponCode);
    if (!coupon) {
      throw new OrderError(404, "NOT_FOUND", "Coupon not found");
    }
    if (!coupon.isActive) {
      throw new OrderError(409, "CONFLICT", "Coupon is not active");
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new OrderError(409, "CONFLICT", "Coupon has expired");
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new OrderError(409, "CONFLICT", "Coupon usage limit reached");
    }

    // Reserve the use atomically before persisting the order: two concurrent
    // orders can no longer both pass the limit check.
    const reserved = await repository.consumeCouponUsage(
      coupon.id,
      coupon.usageLimit,
    );

    if (!reserved) {
      throw new OrderError(409, "CONFLICT", "Coupon usage limit reached");
    }

    consumedCouponId = coupon.id;

    if (coupon.type === "percentage") {
      discount = roundCurrency((subtotal * coupon.value) / 100);
    } else {
      discount = Math.min(coupon.value, subtotal);
    }

    appliedCouponCode = coupon.code;
  }

  const deliveryFeeAmount = input.type === "delivery" && selectedZone ? selectedZone.baseFee : 0;
  const { packagingAmount, tipAmount, tipRate, total } = calculateOrderTotals({
    subtotal,
    discount,
    deliveryFeeAmount,
    items: itemDetails,
    tipOptIn: (input.tipOptIn ?? false) && tipPolicy.enabled,
    orderType: input.type,
    tipRate: tipPolicy.rate,
  });

  // Generate order number
  const prefix = input.type === "delivery" ? "D" : input.type === "pickup" ? "P" : "T";
  const orderNumber = `${prefix}-${Date.now().toString(36).toUpperCase()}`;

  const status = getInitialStatus(input.type);
  const customerName = input.customerName.trim();

  let customerId: string | null = null;
  try {
    customerId = await resolveCustomerId({
      fullName: customerName,
      whatsappNormalized: normalizedWhatsapp,
    });
  } catch {
    console.warn(
      `[customer-auto-link] resolve_customer_failed whatsapp=${maskWhatsapp(normalizedWhatsapp)}`,
    );
  }

  // Public creation must not allow pre-confirmed delivery fees
  if (input.deliveryFeeStatus && input.deliveryFeeStatus !== "pending_manual_validation") {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", {
      deliveryFeeStatus: "Must be pending_manual_validation for public order creation",
    });
  }

  const deliveryFeeStatus: DeliveryFeeStatus | null =
    input.type === "delivery" ? "pending_manual_validation" : null;

  const orderLookupToken = orderLookupTokenGenerator();
  const orderLookupTokenHash = hashOrderLookupToken(orderLookupToken);

  let order: Awaited<ReturnType<typeof repository.createOrder>>;

  try {
    order = await repository.createOrder(
      {
        type: input.type,
        customerName,
        customerWhatsapp: normalizedWhatsapp,
        customerId,
        items: input.items,
        couponCode: appliedCouponCode,
        address: input.address ?? null,
        deliveryNotes: input.deliveryNotes ?? null,
        deliveryFeeStatus,
        pickupTime: input.pickupTime ? new Date(input.pickupTime) : null,
        pickupScheduled: input.pickupScheduled ?? false,
        pickupNotes: input.pickupNotes ?? null,
        tableId: input.tableId ?? null,
        orderNumber,
        subtotal,
        discount,
        packagingAmount,
        deliveryFeeAmount,
        tipAmount,
        tipRate,
        total,
        status,
        deliveryZoneId: input.deliveryZoneId ?? null,
        customerLat: input.customerLat ?? null,
        customerLng: input.customerLng ?? null,
        geoAccuracy: input.geoAccuracy ?? null,
        geoCapturedAt: input.geoCapturedAt ? new Date(input.geoCapturedAt) : null,
        orderLookupTokenHash,
      },
      itemDetails,
    );
  } catch (error) {
    // Give the coupon slot back: the customer never got an order for it.
    if (consumedCouponId) {
      await repository
        .releaseCouponUsage(consumedCouponId)
        .catch(() => undefined);
    }

    throw error;
  }

  await publish("OrderCreated", { order });

  return {
    data: {
      ...order,
      orderLookupToken,
    },
    meta: { sourceOfTruth: "backend" as const },
  };
}
