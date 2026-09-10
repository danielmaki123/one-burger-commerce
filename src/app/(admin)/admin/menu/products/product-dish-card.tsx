"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import * as React from "react";

import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { patchAdminProduct, type AdminProduct } from "./product-list-helpers";

type ProductDishCardProps = {
  product: AdminProduct;
  onUpdated: (product: AdminProduct) => void;
};

export default function ProductDishCard({ product, onUpdated }: ProductDishCardProps) {
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const currency = useCurrencyFormat();
  const isAvailable = product.availability.isAvailable;

  const toggleAvailability = async () => {
    if (isSavingAvailability) return;

    setIsSavingAvailability(true);
    setFeedback(null);
    try {
      const updated = await patchAdminProduct(product.id, {
        availability: {
          isAvailable: !isAvailable,
          isActive: product.availability.isActive,
        },
      });
      onUpdated(updated);
      setFeedback(
        updated.availability.isAvailable
          ? `${product.name} vuelve a estar disponible.`
          : `${product.name} marcado como agotado.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la disponibilidad.",
      );
    } finally {
      setIsSavingAvailability(false);
    }
  };

  return (
    <article className="admin-dish-card flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link
        href={`/admin/menu/products/${product.id}`}
        aria-label={`Editar ${product.name}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="admin-product-thumb relative aspect-[4/3] w-full overflow-hidden bg-accent">
          {product.images?.[0] ? (
            <img
              src={product.images[0].url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent/80 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-brand">
              Sin foto
            </div>
          )}
          {!product.availability.isActive ? (
            <span className="absolute left-2 top-2 rounded-full bg-status-cerrada px-2.5 py-1 text-xs font-medium text-white">
              Inactivo
            </span>
          ) : null}
        </div>
        <div className="space-y-0.5 px-3 pt-2">
          <h3 className="truncate font-heading text-sm font-semibold tracking-tight text-foreground">
            {product.name}
          </h3>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(product.basePrice, currency)}
          </p>
        </div>
      </Link>

      <div className="mt-auto flex min-h-11 items-center justify-between gap-2 px-3 pb-2 pt-1">
        <span
          className={
            isAvailable
              ? "text-xs font-medium text-muted-foreground"
              : "text-xs font-bold text-status-alerta"
          }
        >
          {isAvailable ? "Disponible" : "Agotado"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isAvailable}
          aria-label={`Cambiar disponibilidad de ${product.name}`}
          disabled={isSavingAvailability}
          onClick={() => void toggleAvailability()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60"
        >
          {isSavingAvailability ? (
            <LoaderCircle
              className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <span
              aria-hidden="true"
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors motion-reduce:transition-none",
                isAvailable ? "bg-brand" : "bg-secondary",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform motion-reduce:transition-none",
                  isAvailable ? "translate-x-5.5" : "translate-x-0.5",
                ].join(" ")}
              />
            </span>
          )}
        </button>
      </div>

      <span className="sr-only" aria-live="polite">
        {feedback ?? ""}
      </span>
    </article>
  );
}
