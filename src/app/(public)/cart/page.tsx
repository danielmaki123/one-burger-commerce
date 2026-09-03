"use client";

import { useMemo } from "react";

import { useCart } from "@/shared/lib/cart";
import { Card } from "@/shared/ui/card";

import { CartLineCard } from "./_components/cart-line-card";
import { CartSummaryCard } from "./_components/cart-summary-card";
import { EmptyCartState } from "./_components/empty-cart-state";
import { publicCartScaleClasses } from "./cart-scale-helpers";

export default function CartPage() {
  const { items, subtotal, removeItem, updateQuantity } = useCart();
  const cartItemCount = items.length;
  const packagingAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.packagingTotalAmount, 0),
    [items],
  );

  if (items.length === 0) {
    return <EmptyCartState />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(43,108,150,0.07),transparent_55%),linear-gradient(180deg,#fcfaf6_0%,#f4f2ec_100%)] px-4 py-7 pb-[calc(11.5rem+env(safe-area-inset-bottom))] md:pb-10">
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
                {cartItemCount} {cartItemCount === 1 ? "producto" : "productos"}
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
          <CartSummaryCard
            subtotal={subtotal}
            packagingAmount={packagingAmount}
          />
        </div>
      </div>
    </div>
  );
}
