"use client";

import * as React from "react";

import {
  addPosLine,
  createPosDraft,
  posDraftSubtotal,
  removePosLine,
  setPosLineQuantity,
  type PosDraft,
} from "@/modules/pos/domain/pos-draft";
import { filterPosProducts } from "@/modules/pos/domain/search-pos-products";
import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";

/**
 * TASK-302 — el mostrador: catálogo del local a un lado, borrador de la venta al otro.
 *
 * Lo que esta pantalla **no** hace todavía, a propósito: cobrar. El cobro con `Payment` es TASK-303,
 * así que no hay botón de cobrar (un botón que no cobra es un control que miente, y en el repo está
 * prohibido). Acá se arma el borrador y se ve su subtotal.
 *
 * La búsqueda filtra en memoria con la regla compartida (`filterPosProducts`): el catálogo del local
 * se trae **una vez** y escribir no dispara una consulta por tecla.
 */

export type PosLocationOption = { id: string; name: string };

function catalogUrl(locationId: string) {
  return `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`;
}

export default function PosClient({ locations }: { locations: PosLocationOption[] }) {
  const currency = useCurrencyFormat();

  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [products, setProducts] = React.useState<PosCatalogProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<PosDraft>(() => createPosDraft(locations[0]?.id ?? ""));
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (locationId === "") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const response = await fetch(catalogUrl(locationId));
        if (!response.ok) throw new Error("No se pudo cargar el catálogo de ese local.");

        const body = (await response.json()) as { data: { products: PosCatalogProduct[] } };
        if (cancelled) return;

        setProducts(body.data.products);
      } catch (error) {
        if (cancelled) return;
        setProducts([]);
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId, reloadKey]);

  // Cambiar de local empieza una venta nueva: el borrador lleva el local y sus precios.
  React.useEffect(() => {
    setDraft(createPosDraft(locationId));
  }, [locationId]);

  const visibleProducts = React.useMemo(
    () => filterPosProducts(products, query),
    [products, query],
  );
  const subtotal = posDraftSubtotal(draft);

  const addProduct = (product: PosCatalogProduct) => {
    setDraft((current) =>
      addPosLine(current, {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
      }),
    );
  };

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Caja"
        title="Punto de venta"
        description="Armá la venta del mostrador con el catálogo del local."
      />

      {locations.length === 0 ? (
        <AdminEmptyState
          title="Sin locales activos"
          description="El punto de venta necesita un local activo para saber qué precios cobrar."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-4" aria-label="Catálogo">
            <Select
              label="Local"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              options={locations.map((location) => ({ value: location.id, label: location.name }))}
            />

            <Input
              label="Buscar en el catálogo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Taco, bebida, postre…"
            />

            {loading ? (
              <p className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Cargando el catálogo…
              </p>
            ) : loadError ? (
              <AdminEmptyState
                title="No se pudo cargar el catálogo"
                description={loadError}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setReloadKey((key) => key + 1)}
                  >
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
                  <li
                    key={product.id}
                    className="flex min-h-24 flex-col justify-between gap-2 rounded-card border border-border bg-card p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                        {formatCurrency(product.price, currency)}
                      </p>
                    </div>

                    {product.requiresOptions ? (
                      // No se puede vender de un toque: la carta obliga a elegir. Sin botón que mienta.
                      <p className="text-xs font-medium text-muted-foreground">Se elige en la carta</p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full"
                        aria-label={`Agregar ${product.name} a la venta`}
                        onClick={() => addProduct(product)}
                      >
                        Agregar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="h-fit space-y-3 rounded-panel border border-border bg-card p-4"
            aria-label="Venta en curso"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-headline text-foreground">Venta en curso</h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {draft.lines.length === 0
                  ? "Sin productos"
                  : `${draft.lines.length} ${draft.lines.length === 1 ? "producto" : "productos"}`}
              </p>
            </div>

            {draft.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Agregá productos del catálogo para armar la venta.
              </p>
            ) : (
              <ul className="space-y-3" aria-label="Productos de la venta">
                {draft.lines.map((line) => (
                  <li
                    key={`${line.productId}-${line.notes ?? ""}`}
                    className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(line.unitPrice, currency)} × {line.quantity}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="min-h-11 min-w-11"
                        aria-label={`Quitar una unidad de ${line.name}`}
                        onClick={() =>
                          setDraft((current) =>
                            setPosLineQuantity(current, line.productId, line.quantity - 1),
                          )
                        }
                      >
                        −
                      </Button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums text-foreground">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="min-h-11 min-w-11"
                        aria-label={`Agregar una unidad de ${line.name}`}
                        onClick={() =>
                          setDraft((current) =>
                            setPosLineQuantity(current, line.productId, line.quantity + 1),
                          )
                        }
                      >
                        +
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        aria-label={`Sacar ${line.name} de la venta`}
                        onClick={() =>
                          setDraft((current) => removePosLine(current, line.productId))
                        }
                      >
                        Sacar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">Subtotal</p>
              <p className="text-title font-bold tabular-nums text-foreground" aria-live="polite">
                {formatCurrency(subtotal, currency)}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
