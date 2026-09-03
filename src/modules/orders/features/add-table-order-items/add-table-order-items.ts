import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

export type AddTableOrderItemsRequest = {
  items: Array<{
    productId: string;
    quantity: number;
    modifierOptionIds?: string[];
    notes?: string | null;
  }>;
};

export async function addTableOrderItems(
  orderId: string,
  input: AddTableOrderItemsRequest,
  { repository }: { repository: OrderRepository },
) {
  const order = await repository.findOrderById(orderId);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  if (order.type !== "table") {
    throw new OrderError(409, "CONFLICT", "Only table orders can have items added after creation");
  }

  if (order.status === "closed") {
    throw new OrderError(409, "CONFLICT", "Cannot add items to a closed order");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { items: "Required and must not be empty" });
  }

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
    const unitPrice = product.basePrice + modifiersPrice;
    const lineTotal = unitPrice * item.quantity;

    itemDetails.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      packagingUnitAmount: 0,
      packagingQuantity: 0,
      packagingTotalAmount: 0,
      notes: item.notes ?? null,
      lineTotal,
      modifiers,
    });
  }

  const addedSubtotal = itemDetails.reduce((sum, item) => sum + item.lineTotal, 0);
  const newSubtotal = order.subtotal + addedSubtotal;
  const newDiscount = order.discount;
  const newPackagingAmount = 0;
  const newTipAmount = 0;
  const newTipRate = null;
  const newTotal = newSubtotal - newDiscount + order.deliveryFeeAmount;

  const updated = await repository.addOrderItems(
    orderId,
    itemDetails,
    newSubtotal,
    newDiscount,
    newPackagingAmount,
    newTipAmount,
    newTipRate,
    newTotal,
  );

  return { data: updated };
}
