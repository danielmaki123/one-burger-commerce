"use client";

import React, { useState } from "react";

import { businessInitials } from "@/modules/business-settings/domain/brand-initials";
import type { CartItem } from "@/shared/lib/cart";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Card, CardContent } from "@/shared/ui/card";

/**
 * El único bloque de resumen del pedido: lo usan `/cart` y `/checkout`.
 *
 * Antes cada pantalla tenía el suyo, con títulos distintos ("Tu bolsa" / "Tu pedido"
 * / "Total estimado" / "Total a pagar") y hasta cuentas distintas (líneas vs
 * unidades). Un solo componente evita que vuelvan a divergir.
 */

export const ORDER_SUMMARY_TITLE = "Resumen del pedido";

/** Etiqueta del contador. Cuenta unidades, igual que el badge del header. */
export function formatItemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "producto" : "productos"}`;
}

function OrderSummaryLine({ item }: { item: CartItem }) {
  const currency = useCurrencyFormat();
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.imageUrl) && !imageFailed;
  const modifiers = item.modifiers?.map((modifier) => modifier.optionName).join(", ");

  return (
    <div className="flex items-start gap-3">
      {hasImage ? (
        <img
          src={item.imageUrl}
          alt={item.imageAlt || item.productName}
          className="h-14 w-14 shrink-0 rounded-[16px] object-cover ring-1 ring-border"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-cream text-[10px] font-semibold tracking-[0.16em] text-foreground ring-1 ring-border">
          {businessInitials(item.productName)}
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.productName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.quantity}x
            {modifiers ? ` · ${modifiers}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-foreground">
          {formatCurrency(item.lineTotal, currency)}
        </span>
      </div>
    </div>
  );
}

export function OrderSummaryCard({
  items,
  itemCount,
  subtotal,
  packagingAmount,
  tipAmount = 0,
  tipRate = null,
  children,
}: {
  /** Se omite en el carrito: ahí las líneas ya son el contenido de la página. */
  items?: CartItem[];
  itemCount: number;
  subtotal: number;
  packagingAmount: number;
  tipAmount?: number;
  tipRate?: number | null;
  /** El CTA de la pantalla, para que viva adentro del resumen. */
  children?: React.ReactNode;
}) {
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  const total = subtotal + packagingAmount + tipAmount;

  return (
    <Card className="overflow-hidden rounded-[24px] border-white/80 bg-card/90 shadow-[0_28px_70px_-42px_rgba(41,37,36,0.75)] ring-1 ring-border">
      {/* `CardContent` trae `p-6 pt-0`: hay que reponer el `pt` o el título queda pegado. */}
      <CardContent className="space-y-5 p-5 pt-5 sm:p-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{ORDER_SUMMARY_TITLE}</h2>
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-foreground">
            {formatItemCountLabel(itemCount)}
          </span>
        </div>

        {items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <OrderSummaryLine key={`${item.productId}-${index}`} item={item} />
            ))}
          </div>
        ) : null}

        <div className="space-y-3 rounded-[20px] border border-border bg-cream/50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(subtotal, currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Empaque</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(packagingAmount, currency)}
            </span>
          </div>
          {tipAmount > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Propina{tipRate ? ` (${tipRate}%)` : ""}
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(tipAmount, currency)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-3 text-lg font-bold text-brand">
            <span>Total a pagar</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>

        {settings.paymentInstructions ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {settings.paymentInstructions}
          </p>
        ) : null}

        {children ? <div className="space-y-2">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
