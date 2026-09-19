"use client";

import React, { useState } from "react";
import Link from "next/link";

import { useCart } from "@/shared/lib/cart";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { getPublicStartingPrice } from "@/shared/lib/public-product-pricing";
import { buildQuickAddCartItem } from "@/shared/lib/product-quick-add";
import { Card, CardContent } from "@/shared/ui/card";
import { resolveCategoryCardColors } from "@/modules/menu/domain/category-color";
import { canQuickAddProduct } from "@/modules/menu/domain/modifier-selection";
import { getMenuProductActionCopy } from "./menu-page-helpers";

export interface PublicMenuProductCardData {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  packagingFeeAmount?: number | null;
  images: { url: string; alt: string | null }[];
  modifierGroups?: {
    isRequired?: boolean | null;
    minSelections?: number | null;
    options?: { priceDelta?: number | null; isActive?: boolean | null }[] | null;
  }[] | null;
}

function PhotoPlaceholder({ productName }: { productName: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden brand-photo">
      <div className="relative flex flex-col items-center gap-2.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/15 bg-card/80 text-brand/75 shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
            <path d="M18 22v-7" />
          </svg>
        </span>
        <p className="max-w-[12rem] text-center text-[11px] font-semibold tracking-[0.18em] text-brand/55 uppercase">
          {productName}
        </p>
      </div>
    </div>
  );
}

export function MenuProductCard({
  product,
  category = null,
  className = "",
}: {
  product: PublicMenuProductCardData;
  /** Categoría del producto: de acá sale el color de la tarjeta (T3.1). */
  category?: { name: string; color: string | null } | null;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const currency = useCurrencyFormat();
  const { addItem } = useCart();
  const hasPrimaryImage = Boolean(product.images?.[0]?.url) && !imageFailed;
  const actionCopy = getMenuProductActionCopy(product);
  // El "+" del mock (24 px) no agregaba nada. Acá agrega de verdad cuando el
  // producto no obliga a elegir; cuando sí, la tarjeta lleva a elegir.
  const quickAdd = canQuickAddProduct(product);
  // Color de la categoría elegido en el admin, con el texto más legible encima.
  const colors = resolveCategoryCardColors(category?.color);

  function handleQuickAdd() {
    addItem(buildQuickAddCartItem(product));
    setJustAdded(true);
  }

  return (
    <article className={`group relative block ${className}`}>
      {/* Enlace estirado: la tarjeta entera lleva al producto, y el "+" queda por encima */}
      <Link
        href={`/menu/${product.id}`}
        aria-label={actionCopy.ariaLabel}
        className="absolute inset-0 z-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />

      <Card
        className="overflow-hidden rounded-[20px] border-border bg-card shadow-card transition duration-300 group-hover:-translate-y-0.5"
        style={
          colors
            ? { backgroundColor: colors.backgroundColor, borderColor: colors.backgroundColor }
            : undefined
        }
      >
        <div className="pointer-events-none relative aspect-[1/1.04] overflow-hidden bg-cream">
          {hasPrimaryImage ? (
            <img
              src={product.images[0].url}
              alt={product.images[0].alt || product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <PhotoPlaceholder productName={product.name} />
          )}
        </div>

        <CardContent className="pointer-events-none min-h-16 px-3 py-3.5">
          <div className="space-y-2">
            <h3
              className="line-clamp-2 text-title"
              style={{
                fontFamily: "var(--font-heading)",
                color: colors?.foregroundColor,
              }}
            >
              {product.name}
            </h3>

            <div className="flex items-center justify-between gap-2">
              <span
                className="text-label leading-none"
                style={{ color: colors?.foregroundColor }}
              >
                {formatCurrency(getPublicStartingPrice(product), currency)}
              </span>
              {quickAdd ? (
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  aria-label={`Agregar ${product.name} al carrito`}
                  className="pointer-events-auto relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm transition active:scale-95"
                  style={
                    colors
                      ? {
                          backgroundColor: colors.foregroundColor,
                          color: colors.backgroundColor,
                        }
                      : undefined
                  }
                >
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    {justAdded ? (
                      <path d="m5 13 4 4L19 7" />
                    ) : (
                      <>
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </>
                    )}
                  </svg>
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-brand"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {justAdded ? (
        <span role="status" className="sr-only">
          Agregado al carrito
        </span>
      ) : null}
    </article>
  );
}
