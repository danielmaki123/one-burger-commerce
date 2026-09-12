import type {
  CouponRecord,
  DeliveryFeeStatus,
  DeliveryZoneRecord,
  OrderRecord,
  OrderStatusHistoryRecord,
  TableRecord,
} from "@/modules/orders/domain/order.types";
import type {
  CouponInput,
  CreateOrderInput,
  ListOrdersFilter,
  OrderRepository,
} from "@/modules/orders/ports/order-repository";

export class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];
  statusHistory: OrderStatusHistoryRecord[] = [];
  coupons: CouponRecord[] = [];
  tables: TableRecord[] = [];
  zones: DeliveryZoneRecord[] = [];
  products: Array<{
    id: string;
    name: string;
    basePrice: number;
    packagingFeeAmount?: number | null;
    /** Categoría y subcategoría: las necesitan las promos por alcance (T9). */
    categoryId: string;
    subcategoryId?: string | null;
    isActive: boolean;
    isAvailable: boolean;
    modifierGroups: {
      id: string;
      name: string;
      isRequired: boolean;
      minSelections: number;
      maxSelections: number;
      options: {
        id: string;
        name: string;
        priceDelta: number;
        isActive: boolean;
      }[];
    }[];
  }> = [];

  private nextId(prefix: string) {
    return `${prefix}_${this.orders.length + 1}`;
  }

  async createOrder(
    input: CreateOrderInput & {
      orderNumber: string;
      subtotal: number;
      discount: number;
      packagingAmount: number;
      deliveryFeeAmount: number;
      tipAmount: number;
      tipRate?: number | null;
      total: number;
      status: string;
    },
    itemDetails: Array<{
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
    }>,
  ): Promise<OrderRecord> {
    const id = this.nextId("ord");
    const now = new Date().toISOString();
    const order: OrderRecord = {
      id,
      orderNumber: input.orderNumber,
      type: input.type,
      status: input.status as OrderRecord["status"],
      customerName: input.customerName,
      customerWhatsapp: input.customerWhatsapp,
      customerId: input.customerId ?? null,
      address: input.address ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      deliveryFeeStatus: input.deliveryFeeStatus ?? null,
      packagingAmount: input.packagingAmount,
      deliveryFeeAmount: input.deliveryFeeAmount,
      tipAmount: input.tipAmount,
      tipRate: input.tipRate ?? null,
      pickupTime: input.pickupTime ? input.pickupTime.toISOString() : null,
      pickupScheduled: input.pickupScheduled ?? false,
      pickupNotes: input.pickupNotes ?? null,
      paymentMethod: input.paymentMethod ?? "cash",
      paidWithAmount: input.paidWithAmount ?? null,
      pickupPin: input.pickupPin ?? null,
      tableId: input.tableId ?? null,
      couponCode: input.couponCode ?? null,
      subtotal: input.subtotal,
      discount: input.discount,
      total: input.total,
      deliveryZoneId: input.deliveryZoneId ?? null,
      customerLat: input.customerLat ?? null,
      customerLng: input.customerLng ?? null,
      geoAccuracy: input.geoAccuracy ?? null,
      geoCapturedAt: input.geoCapturedAt ? input.geoCapturedAt.toISOString() : null,
      orderLookupTokenHash: input.orderLookupTokenHash ?? null,
      createdAt: now,
      updatedAt: now,
      items: itemDetails.map((item, idx) => ({
        id: `item_${id}_${idx}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        packagingUnitAmount: item.packagingUnitAmount,
        packagingQuantity: item.packagingQuantity,
        packagingTotalAmount: item.packagingTotalAmount,
        notes: item.notes,
        lineTotal: item.lineTotal,
        modifiers: item.modifiers.map((mod, mIdx) => ({
          id: `mod_${id}_${idx}_${mIdx}`,
          modifierOptionId: mod.modifierOptionId,
          name: mod.name,
          priceDelta: mod.priceDelta,
        })),
      })),
    };
    this.orders.push(order);
    this.statusHistory.push({
      id: `hist_${id}_0`,
      orderId: id,
      status: input.status as OrderStatusHistoryRecord["status"],
      note: null,
      createdAt: now,
    });
    return order;
  }

  async findOrderById(id: string): Promise<OrderRecord | null> {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  async findOrderByOrderNumber(orderNumber: string): Promise<OrderRecord | null> {
    return this.orders.find((o) => o.orderNumber === orderNumber) ?? null;
  }

  async listOrders(filter: ListOrdersFilter): Promise<OrderRecord[]> {
    return this.orders.filter((o) => {
      if (filter.type && o.type !== filter.type) return false;
      if (filter.status && o.status !== filter.status) return false;
      if (filter.dateFrom && o.createdAt < filter.dateFrom) return false;
      if (filter.dateTo && o.createdAt > filter.dateTo) return false;
      return true;
    });
  }

  async updateOrderStatus(
    id: string,
    status: string,
    note?: string | null,
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    order.status = status as OrderRecord["status"];
    order.updatedAt = new Date().toISOString();
    this.statusHistory.push({
      id: `hist_${id}_${this.statusHistory.length}`,
      orderId: id,
      status: status as OrderStatusHistoryRecord["status"],
      note: note ?? null,
      createdAt: new Date().toISOString(),
    });
    return { id, status, updatedAt: order.updatedAt };
  }

  async updateDeliveryFee(
    id: string,
    deliveryFeeAmount: number,
    deliveryFeeStatus: DeliveryFeeStatus,
  ): Promise<OrderRecord> {
    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    order.deliveryFeeAmount = deliveryFeeAmount;
    order.deliveryFeeStatus = deliveryFeeStatus;
    order.total =
      order.subtotal -
      order.discount +
      order.packagingAmount +
      deliveryFeeAmount +
      order.tipAmount;
    order.updatedAt = new Date().toISOString();
    return order;
  }

  async addOrderItems(
    orderId: string,
    itemDetails: Array<{
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
    }>,
    newSubtotal: number,
    newDiscount: number,
    newPackagingAmount: number,
    newTipAmount: number,
    newTipRate: number | null,
    newTotal: number,
  ): Promise<OrderRecord> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");
    const startIdx = order.items.length;
    for (let i = 0; i < itemDetails.length; i++) {
      const item = itemDetails[i];
      order.items.push({
        id: `item_${orderId}_${startIdx + i}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        packagingUnitAmount: item.packagingUnitAmount,
        packagingQuantity: item.packagingQuantity,
        packagingTotalAmount: item.packagingTotalAmount,
        notes: item.notes,
        lineTotal: item.lineTotal,
        modifiers: item.modifiers.map((mod, mIdx) => ({
          id: `mod_${orderId}_${startIdx + i}_${mIdx}`,
          modifierOptionId: mod.modifierOptionId,
          name: mod.name,
          priceDelta: mod.priceDelta,
        })),
      });
    }
    order.subtotal = newSubtotal;
    order.discount = newDiscount;
    order.packagingAmount = newPackagingAmount;
    order.tipAmount = newTipAmount;
    order.tipRate = newTipRate;
    order.total = newTotal;
    order.updatedAt = new Date().toISOString();
    return order;
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryRecord[]> {
    return this.statusHistory.filter((h) => h.orderId === orderId);
  }

  async findCouponByCode(code: string): Promise<CouponRecord | null> {
    return this.coupons.find((c) => c.code.toUpperCase() === code.toUpperCase()) ?? null;
  }

  async consumeCouponUsage(id: string, usageLimit: number): Promise<boolean> {
    const coupon = this.coupons.find((c) => c.id === id);

    // `usageLimit: 0` es "sin límite" (mismo criterio que el adaptador de Prisma).
    if (!coupon || (usageLimit > 0 && coupon.usedCount >= usageLimit)) {
      return false;
    }

    coupon.usedCount += 1;

    return true;
  }

  async releaseCouponUsage(id: string): Promise<void> {
    const coupon = this.coupons.find((c) => c.id === id);

    if (coupon && coupon.usedCount > 0) {
      coupon.usedCount -= 1;
    }
  }

  // Administración de promos (T9c)
  async listCoupons(): Promise<CouponRecord[]> {
    return [...this.coupons].sort((a, b) => a.code.localeCompare(b.code));
  }

  async findCouponById(id: string): Promise<CouponRecord | null> {
    return this.coupons.find((c) => c.id === id) ?? null;
  }

  async createCoupon(input: CouponInput): Promise<CouponRecord> {
    const coupon: CouponRecord = {
      id: `coupon_${this.coupons.length + 1}`,
      code: input.code,
      type: input.type,
      value: input.value,
      isActive: input.isActive,
      usageLimit: input.usageLimit,
      usedCount: 0,
      expiresAt: input.expiresAt,
      buyQuantity: input.buyQuantity ?? null,
      freeQuantity: input.freeQuantity ?? null,
      scopeType: input.scopeType ?? "all",
      scopeId: input.scopeId ?? null,
    };

    this.coupons.push(coupon);
    return coupon;
  }

  async updateCoupon(id: string, input: Partial<CouponInput>): Promise<CouponRecord> {
    const coupon = this.coupons.find((c) => c.id === id);
    if (!coupon) throw new Error("Coupon not found");

    Object.assign(coupon, input);
    return coupon;
  }

  async deleteCoupon(id: string): Promise<void> {
    this.coupons = this.coupons.filter((coupon) => coupon.id !== id);
  }

  async findTableById(id: string): Promise<TableRecord | null> {
    return this.tables.find((t) => t.id === id) ?? null;
  }

  async findTableByQrToken(qrToken: string): Promise<TableRecord | null> {
    return this.tables.find((t) => t.qrToken === qrToken) ?? null;
  }

  async findDeliveryZoneById(id: string): Promise<DeliveryZoneRecord | null> {
    return this.zones.find((z) => z.id === id) ?? null;
  }

  async getProductWithModifiers(productId: string): Promise<{
    id: string;
    name: string;
    basePrice: number;
    packagingFeeAmount?: number | null;
    /** Categoría y subcategoría: las necesitan las promos por alcance (T9). */
    categoryId: string;
    subcategoryId?: string | null;
    isActive: boolean;
    isAvailable: boolean;
    modifierGroups: {
      id: string;
      name: string;
      isRequired: boolean;
      minSelections: number;
      maxSelections: number;
      options: {
        id: string;
        name: string;
        priceDelta: number;
        isActive: boolean;
      }[];
    }[];
  } | null> {
    return this.products.find((p) => p.id === productId) ?? null;
  }
}
