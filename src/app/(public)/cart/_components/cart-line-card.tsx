"use client";

import { useState } from "react";
import { formatCurrency } from "@/shared/lib/format-currency";
import type { CartItem } from "@/shared/lib/cart";
import { Button } from "@/shared/ui/button";
import { publicCartScaleClasses } from "../cart-scale-helpers";

function getPlaceholderLabel(productName: string) {
  const words = productName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "CA";

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

export function CartLineCard({
  item,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.imageUrl) && !imageFailed;
  const modifiersLabel =
    item.modifiers && item.modifiers.length > 0
      ? item.modifiers.map((modifier) => modifier.optionName).join(", ")
      : "Sin modificadores";

  return (
    <div className={publicCartScaleClasses.lineCard}>
      <div className={publicCartScaleClasses.lineCardContent}>
        {hasImage ? (
          <img
            src={item.imageUrl}
            alt={item.imageAlt || item.productName}
            className="mx-auto h-14 w-14 shrink-0 rounded-xl object-cover object-center"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream text-xs font-semibold tracking-[0.12em] text-brand">
            {getPlaceholderLabel(item.productName)}
          </div>
        )}

        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p
                className="line-clamp-1 text-[1rem] font-semibold leading-5 text-ink-green"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {item.productName}
              </p>
              <p className="line-clamp-1 text-[0.8125rem] leading-4 text-muted-foreground">
                {modifiersLabel}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="shrink-0 text-[0.95rem] font-bold leading-5 text-foreground">
                {formatCurrency(item.lineTotal)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className={publicCartScaleClasses.removeButton}
                onClick={onRemove}
                aria-label={`Quitar ${item.productName} del carrito`}
              >
                Quitar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              {item.notes ? (
                <p className="line-clamp-1 text-[11px] leading-4 text-muted-foreground">
                  {item.notes}
                </p>
              ) : null}
            </div>

            <div className="inline-flex shrink-0 items-center rounded-full border border-border bg-cream/50">
              <Button
                size="sm"
                variant="ghost"
                className={publicCartScaleClasses.stepperButton}
                onClick={onDecrease}
                aria-label={`Restar una unidad de ${item.productName}`}
              >
                −
              </Button>
              <span className="min-w-4 text-center text-sm font-semibold text-foreground">
                {item.quantity}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className={publicCartScaleClasses.stepperButton}
                onClick={onIncrease}
                aria-label={`Sumar una unidad de ${item.productName}`}
              >
                +
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
