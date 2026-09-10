"use client";

import React, { useState } from "react";
import Link from "next/link";

import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { getPublicStartingPrice } from "@/shared/lib/public-product-pricing";
import { Card, CardContent } from "@/shared/ui/card";
import { getMenuProductActionCopy } from "./menu-page-helpers";

export interface PublicMenuProductCardData {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  images: { url: string; alt: string | null }[];
  modifierGroups?: {
    minSelections?: number | null;
    options?: { priceDelta?: number | null; isActive?: boolean | null }[] | null;
  }[] | null;
}

function PhotoPlaceholder({ productName }: { productName: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_18%,rgba(43,108,150,0.1),transparent_55%),linear-gradient(160deg,#f7f1e6_0%,#eef2f5_100%)]">
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
  className = "",
}: {
  product: PublicMenuProductCardData;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const currency = useCurrencyFormat();
  const hasPrimaryImage = Boolean(product.images?.[0]?.url) && !imageFailed;
  const actionCopy = getMenuProductActionCopy(product);

  return (
    <Link href={`/menu/${product.id}`} aria-label={actionCopy.ariaLabel} className={`group block ${className}`}>
      <Card className="overflow-hidden rounded-[20px] border-border bg-card shadow-[0_10px_24px_rgba(60,40,20,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(60,40,20,0.14)]">
        <div className="relative aspect-[1/1.04] overflow-hidden bg-cream">
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

        <CardContent className="min-h-16 px-3 py-3.5">
          <div className="space-y-2">
            <h3
              className="line-clamp-2 text-base font-semibold leading-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {product.name}
            </h3>

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold leading-none text-foreground">
                {formatCurrency(getPublicStartingPrice(product), currency)}
              </span>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand/18 bg-sky-50 text-[1.15rem] font-medium leading-none text-brand shadow-[0_3px_8px_rgba(43,108,150,0.10)] transition duration-300 group-hover:border-brand/30 group-hover:bg-white"
              >
                {actionCopy.symbol}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
