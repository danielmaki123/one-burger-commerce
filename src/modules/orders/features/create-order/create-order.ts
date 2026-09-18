import { publish } from "@/infrastructure/events/event-bus";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import { findOrCreateCustomer } from "@/modules/customers/features/find-or-create-customer/find-or-create-customer";
import { OrderError } from "@/modules/orders/domain/order-errors";
import {
  COUPON_REJECTION_MESSAGES,
  normalizeCouponCode,
  resolveCouponEligibility,
} from "@/modules/orders/domain/coupon-eligibility";
import { resolveCouponDiscount } from "@/modules/orders/domain/coupon-discount";
import {
  composeSaleDiscount,
  manualDiscountAmount,
} from "@/modules/orders/domain/sale-discount";
import {
  isOrderPaymentMethod,
  type DeliveryFeeStatus,
  type DeliveryZoneRecord,
  type OrderPaymentMethod,
} from "@/modules/orders/domain/order.types";
import { getInitialStatus } from "@/modules/orders/domain/order-workflows";
import { resolveLocation } from "@/modules/locations/domain/location-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { validatePaidWithAmount } from "@/modules/orders/domain/payment-change";
import {
  generateOrderLookupToken,
  hashOrderLookupToken,
} from "@/modules/orders/domain/order-tracking";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import { generatePickupPin } from "@/modules/orders/domain/pickup-pin";
import { randomInt } from "node:crypto";
import { calculateOrderTotals, roundCurrency } from "@/shared/lib/order-totals";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

/** PIN de retiro por defecto: cuatro dígitos con azar del sistema (T13). */
function defaultPickupPinGenerator(): string {
  return generatePickupPin((max) => randomInt(max));
}

/** Mensaje para el cliente cuando el local pedido no sirve (T8). */
const LOCATION_REJECTION_MESSAGES: Record<
  "not-found" | "inactive" | "none-active",
  string
> = {
  "not-found": "Ese local de retiro no existe.",
  inactive: "Ese local no está disponible por ahora.",
  "none-active": "Por ahora no estamos recibiendo pedidos.",
};

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
  /** TASK-303b — correo opcional (la venta de mostrador lo pide y el cliente puede dejarlo vacío). */
  customerEmail?: string | null;
  items: OrderItemRequest[];
  couponCode?: string | null;
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** que autoriza quien administra la caja.
   *
   * Viaja como **forma** (porcentaje o monto) y con su motivo, nunca como monto calculado: el número sale del
   * subtotal que resuelve el servidor. El POS lo permite solo con `canDiscountPosSale`; el alta lo valida
   * igual, porque la puerta de la plata es una sola.
   */
  manualDiscount?: { kind: "percentage" | "amount"; value: number; reason: string } | null;
  address?: string | null;
  deliveryNotes?: string | null;
  deliveryFeeStatus?: DeliveryFeeStatus | null;
  tipOptIn?: boolean;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; `false` = lo antes posible. */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  /** Forma de pago declarada por el cliente (T11); sin dato se asume efectivo. */
  paymentMethod?: OrderPaymentMethod | null;
  /** Con cuánto paga, cuando es efectivo (T12): el vuelto se calcula en la caja. */
  paidWithAmount?: number | null;
  /**
   * Local al que va el pedido (T8). Sin dato se usa el primario (el primero activo por
   * orden), así el negocio de un solo local sigue funcionando sin que nadie elija nada.
   */
  locationId?: string | null;
  tableId?: string | null;
  qrToken?: string | null;
  deliveryZoneId?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: string | null;
  /**
   * TASK-101 — clave de operación del cliente para esta alta. Repetirla devuelve el pedido que ya
   * existe en vez de crear otro. Sin clave (o en blanco) el alta se comporta como antes.
   */
  idempotencyKey?: string | null;
};

export async function createOrder(
  input: CreateOrderRequest,
  {
    repository,
    locationRepository,
    resolveCustomerId = findOrCreateCustomer,
    orderLookupTokenGenerator = generateOrderLookupToken,
    pickupPinGenerator = defaultPickupPinGenerator,
    tipPolicy = {
      enabled: DEFAULT_BUSINESS_SETTINGS.tipEnabled,
      rate: DEFAULT_BUSINESS_SETTINGS.tipRate,
    },
  }: {
    repository: OrderRepository;
    /** Locales del negocio (T8): sin esto no hay a dónde mandar el pedido. */
    locationRepository: LocationRepository;
    resolveCustomerId?: (input: {
      fullName: string;
      whatsappNormalized: string;
    }) => Promise<string | null>;
    orderLookupTokenGenerator?: () => string;
    /**
     * PIN de retiro (T13). Se inyecta por el mismo motivo que el token: los tests
     * necesitan un valor determinista.
     */
    pickupPinGenerator?: () => string;
    /**
     * Propina configurada en `/admin/settings`. El servidor es la fuente de
     * verdad: el porcentaje del cliente nunca se acepta, y con la propina
     * apagada no se aplica aunque el checkout la pida.
     */
    tipPolicy?: { enabled: boolean; rate: number };
  },
) {
  // Idempotencia (TASK-101). Va **antes** de todo lo demás: un reintento del mismo request no tiene
  // que resolver local, ni gate operativo, ni cupón otra vez. Si el pedido ya existe, se devuelve
  // tal cual y la ruta contesta 200 en vez de 201.
  //
  // El `orderLookupToken` en claro solo se conoce al crear (en la base queda su hash), así que en un
  // reintento viaja `null` en vez de inventar un token que no serviría para consultar el pedido.
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = await repository.findOrderByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        data: { ...existing, orderLookupToken: null },
        meta: { sourceOfTruth: "backend" as const, reused: true },
      };
    }
  }

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

  // TASK-303b — el correo es opcional (lo pide el POS): vacío es `null`, y con algo adentro tiene
  // que parecer un correo. No se guarda un dato a medio escribir que después nadie puede usar.
  const rawEmail = input.customerEmail?.trim() ?? "";
  const normalizedCustomerEmail = rawEmail === "" ? null : rawEmail;
  if (normalizedCustomerEmail !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedCustomerEmail)) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", {
      customerEmail: "Revisá el correo",
    });
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { items: "Required and must not be empty" });
  }

  // Forma de pago (T11): informativa para la caja. Se acepta solo lo que existe y
  // sin dato se asume efectivo, porque el cobro es en el local.
  if (input.paymentMethod !== undefined && input.paymentMethod !== null && !isOrderPaymentMethod(input.paymentMethod)) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", {
      paymentMethod: "Must be cash or card",
    });
  }
  const paymentMethod: OrderPaymentMethod = isOrderPaymentMethod(input.paymentMethod)
    ? input.paymentMethod
    : "cash";

  // Local del pedido (T8). Se resuelve **antes** de tocar el cupón o el stock: un local
  // que no sirve no puede quemar el uso de una promo.
  const locationResolution = resolveLocation({
    requestedLocationId: input.locationId,
    locations: await locationRepository.listLocations(),
  });

  if (!locationResolution.ok) {
    throw new OrderError(409, "CONFLICT", "Location is not available", {
      locationId: LOCATION_REJECTION_MESSAGES[locationResolution.reason],
    });
  }

  const locationId = locationResolution.location.id;

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

  /**
   * Unidades del pedido para las promos por cantidad (T9): producto, categoría y
   * precio unitario ya calculado por el servidor.
   */
  const promoUnits: Array<{
    productId: string;
    categoryId: string;
    subcategoryId: string | null;
    unitPrice: number;
    quantity: number;
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

    promoUnits.push({
      productId: product.id,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId ?? null,
      unitPrice,
      quantity: item.quantity,
    });
  }

  // Calculate totals
  const subtotal = itemDetails.reduce((sum, item) => sum + item.lineTotal, 0);

  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el descuento manual autorizado. Se valida acá (motivo, monto,
   * porcentaje) y se compone con el del cupón: entre los dos nunca descuentan más que la venta.
   */
  let manualDiscount = 0;
  if (input.manualDiscount) {
    const resolvedManual = manualDiscountAmount({
      discount: input.manualDiscount,
      subtotal,
    });

    if (!resolvedManual.ok) {
      const message =
        resolvedManual.reason === "missing-reason"
          ? "Escribí por qué se hace el descuento."
          : "El descuento tiene que ser un monto mayor que cero o un porcentaje de hasta 100 %.";

      throw new OrderError(422, "VALIDATION_ERROR", message, { discount: message });
    }

    manualDiscount = resolvedManual.amount;
  }

  // Apply coupon if provided
  let couponDiscount = 0;
  let appliedCouponCode: string | null = null;
  let consumedCouponId: string | null = null;

  if (input.couponCode) {
    // El código se normaliza igual que en la validación del checkout (T9b): si no,
    // el cliente vería "sirve" y el pedido fallaría después.
    const coupon = await repository.findCouponByCode(normalizeCouponCode(input.couponCode));
    if (!coupon) {
      throw new OrderError(404, "NOT_FOUND", "Coupon not found");
    }

    // Una sola fuente de verdad para "¿se puede usar?": la comparte el checkout
    // (T9b), así que no pueden desincronizarse.
    const eligibility = resolveCouponEligibility(coupon, new Date());
    if (!eligibility.usable) {
      throw new OrderError(409, "CONFLICT", COUPON_REJECTION_MESSAGES[eligibility.reason]);
    }

    // El descuento se calcula **antes** de consumir el uso: un código de promo que
    // no aplica al pedido se rechaza sin quemar un uso (T9). La cuenta vive en el
    // dominio (`coupon-discount.ts`) porque el POS la **cotiza** antes de cobrar
    // (tarea 9.6): una sola fórmula para los dos caminos.
    const resolved = resolveCouponDiscount({ coupon, items: promoUnits, subtotal });
    if (!resolved.ok) {
      throw new OrderError(
        409,
        "CONFLICT",
        resolved.reason === "misconfigured"
          ? `Coupon is misconfigured: ${resolved.detail}`
          : "Coupon does not apply to this order",
      );
    }

    couponDiscount = resolved.discount;

    // Reserve the use atomically before persisting the order: two concurrent    // orders can no longer both pass the limit check.
    const reserved = await repository.consumeCouponUsage(
      coupon.id,
      coupon.usageLimit,
    );

    if (!reserved) {
      throw new OrderError(409, "CONFLICT", "Coupon usage limit reached");
    }

    consumedCouponId = coupon.id;
    appliedCouponCode = coupon.code;
  }

  /**
   * El descuento final: el cupón (ya limitado al subtotal) más el descuento manual autorizado, sin pasar
   * nunca del subtotal (tarea 9.7). El empaque y el envío se pagan igual.
   */
  const discount = composeSaleDiscount({ couponDiscount, manualDiscount, subtotal });

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

  // Vuelto (T12): se valida contra el total ya calculado. Se guarda el monto, no el
  // cambio: así el número que ve la caja sale siempre del total vigente.
  const paidWithValidation = validatePaidWithAmount({
    paidWithAmount: input.paidWithAmount ?? null,
    total,
    paymentMethod,
  });
  if (paidWithValidation) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", {
      paidWithAmount: paidWithValidation,
    });
  }
  const paidWithAmount =
    input.paidWithAmount === undefined || input.paidWithAmount === null
      ? null
      : roundCurrency(input.paidWithAmount);

  const orderLookupToken = orderLookupTokenGenerator();
  const orderLookupTokenHash = hashOrderLookupToken(orderLookupToken);
  // PIN corto para dictar en caja (T13). No autoriza nada: el acceso al pedido
  // sigue siendo el token o el WhatsApp.
  const pickupPin = pickupPinGenerator();

  let order: Awaited<ReturnType<typeof repository.createOrder>>;

  try {
    order = await repository.createOrder(
      {
        type: input.type,
        locationId,
        customerName,
        customerWhatsapp: normalizedWhatsapp,
        customerEmail: normalizedCustomerEmail,
        customerId,
        items: input.items,
        couponCode: appliedCouponCode,
        address: input.address ?? null,
        deliveryNotes: input.deliveryNotes ?? null,
        deliveryFeeStatus,
        pickupTime: input.pickupTime ? new Date(input.pickupTime) : null,
        pickupScheduled: input.pickupScheduled ?? false,
        pickupNotes: input.pickupNotes ?? null,
        paymentMethod,
        paidWithAmount,
        pickupPin,
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
        idempotencyKey,
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
    meta: { sourceOfTruth: "backend" as const, reused: false },
  };
}
