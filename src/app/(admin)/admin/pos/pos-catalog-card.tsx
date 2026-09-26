"use client";

import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

import PosCatalogPhoto from "./pos-catalog-photo";

/**
 * La tarjeta de un producto en el catálogo del mostrador.
 *
 * **Densidad** (`SCREEN-POS-QUICK-SALE-001.1` §7): el primer viewport tiene que mostrar más productos sin
 * degradar la lectura ni el toque. Contra la versión anterior: la foto baja de `h-24` a `h-20`, la tarjeta
 * pierde padding y **no repite la categoría** —ya está en los chips, que además filtran—, y el precio queda en
 * una fila con el `+`. El `+` conserva el mínimo táctil de 44 px.
 *
 * Dos estados, y se distinguen por algo más que el color:
 *
 * - **Agotado**: el producto existe pero el local no lo tiene. Se muestra igual —el cajero necesita poder
 *   decir «está agotado»— y sin botón, porque el alta lo rechaza con 409.
 * - **Agregar**: el resto. Si tiene modificadores, la pantalla los pregunta en el selector antes de que la
 *   línea entre a la venta (la tarjeta no decide eso).
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
    <li className="flex flex-col overflow-hidden rounded-stitch-md border border-line-subtle bg-surface-card">
      <PosCatalogPhoto name={product.name} images={product.images} />

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <p className="line-clamp-2 text-st-body font-semibold text-ink">{product.name}</p>

        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="font-mono text-st-body font-bold tabular-nums text-ink">
            {formatCurrency(product.basePrice, currency)}
          </p>

          {soldOut ? (
            <p className="rounded-stitch-sm border border-line-subtle bg-surface-low px-2 py-1.5 text-st-caption font-semibold text-ink-muted">
              Agotado
            </p>
          ) : (
            // Todos los productos se agregan desde acá: el que tiene modificadores los pregunta en el
            // selector antes de entrar a la venta (lo decide la pantalla, no la tarjeta).
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="min-h-11 min-w-11 shrink-0"
              aria-label={`Agregar ${product.name} a la venta`}
              onClick={() => onAdd(product)}
            >
              <span aria-hidden="true" className="text-h3 leading-none">
                +
              </span>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
