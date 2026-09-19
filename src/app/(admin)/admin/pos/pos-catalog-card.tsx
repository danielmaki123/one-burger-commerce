"use client";

import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

/**
 * La tarjeta de un producto en el catálogo del mostrador.
 *
 * Se extrajo de `pos-client.tsx` (deuda con techo congelado: no puede crecer) al cambiar el shape del
 * catálogo. Tiene **tres estados**, y ninguno miente:
 *
 * - **Agotado**: el producto existe pero el local no lo tiene. Se muestra igual —el cajero necesita
 *   poder decir "está agotado"— y sin botón, porque el alta lo rechaza con 409.
 * - **Se elige en la carta**: el producto exige modificadores y el mostrador todavía no los pregunta.
 * - **Agregar**: se puede vender de un toque.
 */
export default function PosCatalogCard({
  product,
  currency,
  onAdd,
}: {
  product: PosCatalogProduct;
  currency: CurrencyFormat;
  onAdd: (product: PosCatalogProduct) => void;
}) {
  const soldOut = !product.availability.isAvailable;

  return (
    <li className="flex min-h-24 flex-col justify-between gap-2 rounded-stitch-lg border border-line-subtle bg-surface-card p-3">
      <div>
        <p className="text-st-body font-semibold text-ink">{product.name}</p>
        <p className="text-st-overline font-bold uppercase tracking-wider text-brand-amber">
          {product.categoryName}
        </p>
        <p className="mt-1 font-mono text-st-body font-bold tabular-nums text-ink">
          {formatCurrency(product.basePrice, currency)}
        </p>
      </div>

      {soldOut ? (
        <p className="w-full rounded-stitch-sm border border-line-subtle bg-surface-low px-2 py-2 text-center text-st-caption font-semibold text-ink-muted">
          Agotado
        </p>
      ) : product.requiresOptions ? (
        // No se puede vender de un toque: la carta obliga a elegir. Sin botón que mienta.
        <p className="text-st-caption font-medium text-ink-secondary">Se elige en la carta</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          aria-label={`Agregar ${product.name} a la venta`}
          onClick={() => onAdd(product)}
        >
          Agregar
        </Button>
      )}
    </li>
  );
}
