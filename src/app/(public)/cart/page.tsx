"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/shared/lib/cart";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

import { EmptyCartState } from "../_components/empty-cart-state";
import { formatItemCountLabel, OrderSummaryCard } from "../_components/order-summary-card";
import { CartLineCard } from "./_components/cart-line-card";
import { publicCartScaleClasses } from "./cart-scale-helpers";

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, removeItem, updateQuantity } = useCart();
  // Unidades, no líneas: es la misma cuenta que muestra el badge del header.
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const packagingAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.packagingTotalAmount, 0),
    [items],
  );

  if (items.length === 0) {
    return <EmptyCartState />;
  }

  return (
    <div className="min-h-screen brand-canvas px-4 py-7 pb-[calc(11.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className={publicCartScaleClasses.shell}>
        <div className="space-y-4">
          <header className="space-y-2">
            <div className="space-y-1">
              <h1
                className={publicCartScaleClasses.heading}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Tu carrito
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                {formatItemCountLabel(itemCount)}
              </p>
            </div>
          </header>

          <Card className={publicCartScaleClasses.lineItemsFrame}>
            {items.map((item, index) => (
              <CartLineCard
                key={`${item.productId}-${index}`}
                item={item}
                onDecrease={() =>
                  updateQuantity(index, Math.max(1, item.quantity - 1))
                }
                onIncrease={() => updateQuantity(index, item.quantity + 1)}
                onRemove={() => removeItem(index)}
              />
            ))}
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          <OrderSummaryCard
            itemCount={itemCount}
            subtotal={subtotal}
            packagingAmount={packagingAmount}
          >
            <Button
              className={publicCartScaleClasses.summaryPrimaryCta}
              onClick={() => router.push("/checkout")}
            >
              Ir a pagar
            </Button>
          </OrderSummaryCard>
        </div>
      </div>
    </div>
  );
}
