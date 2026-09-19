"use client";

import * as React from "react";

import { filterPosProducts } from "@/modules/pos/domain/search-pos-products";
import type { PosCatalogCategoryChip, PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import type { CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { AdminEmptyState } from "../_components/admin-operational-ui";
import PosCatalogCard from "./pos-catalog-card";
import PosCategoryChips from "./pos-category-chips";

/**
 * El panel del catálogo del mostrador: buscador, chips de categoría, tarjetas y sus estados.
 *
 * Se extrajo de `pos-client.tsx` (deuda con techo congelado: no puede crecer) al sumar los chips. La
 * pantalla conserva el **estado** del filtro (término y categoría elegida); el panel decide qué se ve con
 * la regla compartida del dominio (`filterPosProducts`) y la categoría del producto.
 *
 * Los tres estados vacíos son distintos a propósito: el local sin carta, el filtro sin resultados y el
 * error de carga se arreglan de maneras distintas.
 */
export default function PosCatalogGrid({
  products,
  categories,
  query,
  onQueryChange,
  activeCategoryId,
  onCategorySelect,
  loading,
  loadError,
  onRetry,
  currency,
  onAdd,
}: {
  products: PosCatalogProduct[];
  categories: PosCatalogCategoryChip[];
  query: string;
  onQueryChange: (query: string) => void;
  activeCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  currency: CurrencyFormat;
  onAdd: (product: PosCatalogProduct) => void;
}) {
  const visibleProducts = React.useMemo(() => {
    const matched = filterPosProducts(products, query);

    return activeCategoryId === null
      ? matched
      : matched.filter((product) => product.categoryId === activeCategoryId);
  }, [products, query, activeCategoryId]);

  return (
    <section className="min-w-0 space-y-4" aria-label="Catálogo">
      <Input
        label="Buscar en el catálogo"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Taco, bebida, postre…"
      />

      <PosCategoryChips
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelect={onCategorySelect}
      />

      {loading ? (
        <p className="rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-6 text-st-body text-ink-secondary">
          Cargando el catálogo…
        </p>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudo cargar el catálogo"
          description={loadError}
          action={
            <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
              Reintentar
            </Button>
          }
        />
      ) : visibleProducts.length === 0 ? (
        <AdminEmptyState
          title={products.length === 0 ? "El local no tiene productos vendibles" : "Sin resultados"}
          description={
            products.length === 0
              ? "Cargá la carta del local en Menú y volvé a entrar."
              : "Probá con otro nombre o con la categoría."
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Productos del local">
          {visibleProducts.map((product) => (
            <PosCatalogCard
              key={product.id}
              product={product}
              currency={currency}
              onAdd={onAdd}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
