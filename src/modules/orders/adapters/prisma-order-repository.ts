import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type {
  CouponRecord,
  DeliveryFeeStatus,
  OrderRecord,
  OrderStatus,
  OrderStatusHistoryRecord,
  OrderType,
  TableRecord,
} from "@/modules/orders/domain/order.types";
import type {
  CreateOrderInput,
  ListOrdersFilter,
  OrderRepository,
} from "@/modules/orders/ports/order-repository";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function mapModifier(mod: {
  id: string;
  modifierOptionId: string;
  name: string;
  priceDelta: Decimal;
}): { id: string; modifierOptionId: string; name: string; priceDelta: number } {
  return {
    id: mod.id,
    modifierOptionId: mod.modifierOptionId,
    name: mod.name,
    priceDelta: decimalToNumber(mod.priceDelta),
  };
}

function mapItem(item: {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Decimal;
  packagingUnitAmount: Decimal;
  packagingQuantity: number;
  packagingTotalAmount: Decimal;
  notes: string | null;
  lineTotal: Decimal;
  modifiers: { id: string; modifierOptionId: string; name: string; priceDelta: Decimal }[];
}): OrderRecord["items"][number] {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: decimalToNumber(item.unitPrice),
    packagingUnitAmount: decimalToNumber(item.packagingUnitAmount),
    packagingQuantity: item.packagingQuantity,
    packagingTotalAmount: decimalToNumber(item.packagingTotalAmount),
    notes: item.notes,
    lineTotal: decimalToNumber(item.lineTotal),
    modifiers: item.modifiers.map(mapModifier),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(order: any): OrderRecord {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type as OrderRecord["type"],
    status: order.status as OrderRecord["status"],
    customerName: order.customerName,
    customerWhatsapp: order.customerWhatsapp,
    customerId: order.customerId,
    address: order.address,
    deliveryNotes: order.deliveryNotes,
    deliveryFeeStatus: order.deliveryFeeStatus,
    packagingAmount: decimalToNumber(order.packagingAmount),
    deliveryFeeAmount: decimalToNumber(order.deliveryFeeAmount),
    tipAmount: decimalToNumber(order.tipAmount),
    tipRate: order.tipRate ? decimalToNumber(order.tipRate) : null,
    pickupTime: order.pickupTime ? order.pickupTime.toISOString() : null,
    pickupScheduled: order.pickupScheduled,
    pickupNotes: order.pickupNotes,
    // La columna tiene default en la base: un pedido viejo nunca queda sin forma de pago.
    paymentMethod: (order.paymentMethod ?? "cash") as OrderRecord["paymentMethod"],
    paidWithAmount:
      order.paidWithAmount === null || order.paidWithAmount === undefined
        ? null
        : decimalToNumber(order.paidWithAmount),
    pickupPin: order.pickupPin ?? null,
    tableId: order.tableId,
    couponCode: order.couponCode,
    subtotal: decimalToNumber(order.subtotal),
    discount: decimalToNumber(order.discount),
    total: decimalToNumber(order.total),
    deliveryZoneId: order.deliveryZoneId,
    deliveryZoneName: order.deliveryZone?.name ?? null,
    customerLat: order.customerLat ? decimalToNumber(order.customerLat) : null,
    customerLng: order.customerLng ? decimalToNumber(order.customerLng) : null,
    geoAccuracy: order.geoAccuracy,
    geoCapturedAt: order.geoCapturedAt ? order.geoCapturedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(mapItem),
    orderLookupTokenHash: order.orderLookupTokenHash ?? null,
  };
}

export class PrismaOrderRepository implements OrderRepository {
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
    const prisma = getPrismaClient();

    const order = await prisma.order.create({
      data: {
        orderNumber: input.orderNumber,
        type: input.type as OrderType,
        status: input.status as OrderStatus,
        customerName: input.customerName,
        customerWhatsapp: input.customerWhatsapp,
        customerId: input.customerId ?? null,
        address: input.address ?? null,
        deliveryNotes: input.deliveryNotes ?? null,
        deliveryFeeStatus: input.deliveryFeeStatus,
        packagingAmount: input.packagingAmount,
        deliveryFeeAmount: input.deliveryFeeAmount,
        tipAmount: input.tipAmount,
        tipRate: input.tipRate ?? null,
        pickupTime: input.pickupTime ?? null,
        pickupScheduled: input.pickupScheduled ?? false,
        pickupNotes: input.pickupNotes ?? null,
        // T11: sin esto el pedido se guardaba siempre como efectivo, aunque el
        // cliente hubiera elegido tarjeta (lo cazó el E2E, no el unitario).
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
        geoCapturedAt: input.geoCapturedAt ?? null,
        orderLookupTokenHash: input.orderLookupTokenHash ?? null,
        items: {
          create: itemDetails.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            packagingUnitAmount: item.packagingUnitAmount,
            packagingQuantity: item.packagingQuantity,
            packagingTotalAmount: item.packagingTotalAmount,
            notes: item.notes,
            lineTotal: item.lineTotal,
            modifiers: {
              create: item.modifiers.map((mod) => ({
                modifierOptionId: mod.modifierOptionId,
                name: mod.name,
                priceDelta: mod.priceDelta,
              })),
            },
          })),
        },
        statusHistory: {
          create: {
            status: input.status as OrderStatus,
            note: null,
          },
        },
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return mapOrder(order);
  }

  async findOrderById(id: string): Promise<OrderRecord | null> {
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        deliveryZone: true,
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });
    return order ? mapOrder(order) : null;
  }

  async findOrderByOrderNumber(orderNumber: string): Promise<OrderRecord | null> {
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        deliveryZone: true,
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });
    return order ? mapOrder(order) : null;
  }

  async listOrders(filter: ListOrdersFilter): Promise<OrderRecord[]> {
    const prisma = getPrismaClient();

    const where: {
      type?: OrderRecord["type"];
      status?: OrderRecord["status"];
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (filter.type) {
      where.type = filter.type as OrderType;
    }
    if (filter.status) {
      where.status = filter.status as OrderStatus;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        where.createdAt.gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        where.createdAt.lte = new Date(filter.dateTo);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return orders.map((o: unknown) => mapOrder(o));
  }

  async updateOrderStatus(
    id: string,
    status: string,
    note?: string | null,
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    const prisma = getPrismaClient();

    const [updated] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: status as OrderStatus },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          status: status as OrderStatus,
          note: note ?? null,
        },
      }),
    ]);

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async updateDeliveryFee(
    id: string,
    deliveryFeeAmount: number,
    deliveryFeeStatus: DeliveryFeeStatus,
  ): Promise<OrderRecord> {
    const prisma = getPrismaClient();

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    const newTotal =
      decimalToNumber(order.subtotal) -
      decimalToNumber(order.discount) +
      decimalToNumber(order.packagingAmount) +
      decimalToNumber(order.tipAmount) +
      deliveryFeeAmount;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        deliveryFeeAmount,
        deliveryFeeStatus,
        total: newTotal,
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return mapOrder(updated);
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
    const prisma = getPrismaClient();

    const [, order] = await prisma.$transaction([
      prisma.orderItem.createMany({
        data: itemDetails.map((item) => ({
          orderId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          packagingUnitAmount: item.packagingUnitAmount,
          packagingQuantity: item.packagingQuantity,
          packagingTotalAmount: item.packagingTotalAmount,
          notes: item.notes,
          lineTotal: item.lineTotal,
        })),
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          discount: newDiscount,
          packagingAmount: newPackagingAmount,
          tipAmount: newTipAmount,
          tipRate: newTipRate,
          total: newTotal,
        },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      }),
    ]);

    // Create modifiers separately since createMany doesn't support nested relations
    for (let i = 0; i < itemDetails.length; i++) {
      const item = itemDetails[i];
      const orderItem = order.items[order.items.length - itemDetails.length + i];
      if (item.modifiers.length > 0 && orderItem) {
        await prisma.orderItemModifier.createMany({
          data: item.modifiers.map((mod) => ({
            orderItemId: orderItem.id,
            modifierOptionId: mod.modifierOptionId,
            name: mod.name,
            priceDelta: mod.priceDelta,
          })),
        });
      }
    }

    // Re-fetch to include new modifiers
    const refreshed = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    if (!refreshed) {
      throw new Error("Order not found after update");
    }

    return mapOrder(refreshed);
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryRecord[]> {
    const prisma = getPrismaClient();
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    return history.map((h: {
      id: string;
      status: string;
      note: string | null;
      createdAt: Date;
    }) => ({
      id: h.id,
      orderId: (h as unknown as { orderId: string }).orderId,
      status: h.status as OrderStatusHistoryRecord["status"],
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  async findCouponByCode(code: string): Promise<CouponRecord | null> {
    const prisma = getPrismaClient();
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon) return null;
    return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type as CouponRecord["type"],
      buyQuantity: coupon.buyQuantity ?? null,
      freeQuantity: coupon.freeQuantity ?? null,
      scopeType: coupon.scopeType ?? "all",
      scopeId: coupon.scopeId ?? null,
      value: decimalToNumber(coupon.value),
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
    };
  }

  async consumeCouponUsage(
    id: string,
    usageLimit: number,
  ): Promise<boolean> {
    const prisma = getPrismaClient();
    // Single conditional UPDATE: the WHERE clause is evaluated by the database,
    // so two concurrent orders can never both pass the limit check.
    const result = await prisma.coupon.updateMany({
      where: { id, usedCount: { lt: usageLimit } },
      data: { usedCount: { increment: 1 } },
    });

    return result.count === 1;
  }

  async releaseCouponUsage(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.coupon.updateMany({
      where: { id, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  async findTableById(id: string): Promise<TableRecord | null> {
    const prisma = getPrismaClient();
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) return null;
    return {
      id: table.id,
      label: table.label,
      qrToken: table.qrToken,
      isActive: table.isActive,
      locationId: table.locationId,
    };
  }

  async findTableByQrToken(qrToken: string): Promise<TableRecord | null> {
    const prisma = getPrismaClient();
    const table = await prisma.table.findUnique({ where: { qrToken } });
    if (!table) return null;
    return {
      id: table.id,
      label: table.label,
      qrToken: table.qrToken,
      isActive: table.isActive,
      locationId: table.locationId,
    };
  }

  async findDeliveryZoneById(id: string): Promise<import("@/modules/orders/domain/order.types").DeliveryZoneRecord | null> {
    const prisma = getPrismaClient();
    const zone = await prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) return null;
    return {
      id: zone.id,
      name: zone.name,
      description: zone.description,
      baseFee: decimalToNumber(zone.baseFee),
      isActive: zone.isActive,
      sortOrder: zone.sortOrder,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString(),
    };
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
    const prisma = getPrismaClient();
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      basePrice: decimalToNumber(product.basePrice),
      packagingFeeAmount: product.packagingFeeAmount
        ? decimalToNumber(product.packagingFeeAmount)
        : null,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      isActive: product.isActive,
      isAvailable: product.isAvailable,
      modifierGroups: product.modifierGroups.map((mg: {
        modifierGroup: {
          id: string;
          name: string;
          isRequired: boolean;
          minSelections: number;
          maxSelections: number;
          options: Array<{
            id: string;
            name: string;
            priceDelta: Decimal;
            isActive: boolean;
          }>;
        };
      }) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        isRequired: mg.modifierGroup.isRequired,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        options: mg.modifierGroup.options.map((opt: {
          id: string;
          name: string;
          priceDelta: Decimal;
          isActive: boolean;
        }) => ({
          id: opt.id,
          name: opt.name,
          priceDelta: decimalToNumber(opt.priceDelta),
          isActive: opt.isActive,
        })),
      })),
    };
  }
}
