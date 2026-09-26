"use client";

import * as React from "react";

import type {
  PosCatalogCategoryChip,
  PosCatalogProduct,
  PosCatalogView,
} from "@/modules/pos/ports/pos-catalog";
import type { CurrencyFormat } from "@/shared/lib/format-currency";

import type { PosLocationOption } from "../pos-types";

/**
 * El estado y la carga del **catálogo** del mostrador: local elegido, productos, chips de categoría,
 * búsqueda, categoría activa, refresco de fondo y las terminales del local.
 *
 * Sale de `pos-client.tsx` (deuda con techo congelado) al rediseñar la venta rápida: la pantalla queda como
 * orquestación y cada responsabilidad con su API. Lo que este hook **no** hace es filtrar productos ni
 * resolver precios: eso es del dominio y de la respuesta del servidor.
 *
 * Tres decisiones que ya estaban en la pantalla y se conservan:
 *
 * 1. **El catálogo se trae una vez por local** y la búsqueda filtra en memoria: escribir no dispara una
 *    consulta por tecla.
 * 2. **El refresco de fondo es `silent`** (TASK-306): no muestra «Cargando…» ni borra lo que el cajero ya
 *    tiene en pantalla si la red falla.
 * 3. **Una respuesta de un local que el cajero ya dejó no pisa el catálogo del actual** (`locationRef`).
 */

export const POS_REFRESH_MS = 3000;

function catalogUrl(locationId: string) {
  return `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`;
}

export type UsePosCatalogParams = {
  locations: PosLocationOption[];
  /** Las terminales activas por local, resueltas en el servidor (Fase 6 del rediseño de Caja). */
  cashTerminalsByLocation?: Record<string, { id: string; label: string }[]>;
  /** La moneda del negocio: cambiarla empieza una venta nueva (lo resuelve la pantalla). */
  currencyCode: string;
  /** Formato de la moneda del negocio, para las piezas que muestran precios. */
  currency: CurrencyFormat;
};

export function usePosCatalog({
  locations,
  cashTerminalsByLocation = {},
  currencyCode,
}: UsePosCatalogParams) {
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");

  /**
   * Fase 6 — la **terminal** del POS elegida en este local. Nace en la primera activa. Sin terminales
   * cargadas queda `null`: la venta entra al turno «sin terminal» del local, que es la sucursal de una sola
   * caja.
   */
  const terminals = React.useMemo(
    () => cashTerminalsByLocation[locationId] ?? [],
    [cashTerminalsByLocation, locationId],
  );
  const [terminalId, setTerminalId] = React.useState<string | null>(
    () => cashTerminalsByLocation[locations[0]?.id ?? ""]?.[0]?.id ?? null,
  );

  /**
   * La terminal elegida. El efecto **no pisa** una elección válida: solo corrige cuando la terminal actual no
   * existe en el local (cambio de sucursal, terminal desactivada) y entonces hereda la primera activa. Sin
   * eso, el cajero elegía «Barra» y cualquier refresco del arreglo lo devolvía a «Caja 1».
   */
  React.useEffect(() => {
    setTerminalId((current) =>
      current !== null && terminals.some((terminal) => terminal.id === current)
        ? current
        : (terminals[0]?.id ?? null),
    );
  }, [terminals]);

  const [products, setProducts] = React.useState<PosCatalogProduct[]>([]);
  const [categories, setCategories] = React.useState<PosCatalogCategoryChip[]>([]);
  /** La categoría elegida en los chips; `null` es «Todos». */
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [reloadKey, setReloadKey] = React.useState(0);
  // El local actual, para que un refresco que llega tarde no pise el catálogo del local nuevo.
  const locationRef = React.useRef(locationId);

  const applyCatalog = React.useCallback(
    async (targetLocationId: string, options: { silent?: boolean } = {}) => {
      if (targetLocationId === "") {
        setLoading(false);
        return;
      }

      if (!options.silent) {
        setLoading(true);
        setLoadError(null);
      }

      try {
        const response = await fetch(catalogUrl(targetLocationId));
        if (!response.ok) throw new Error("No se pudo cargar el catálogo de ese local.");

        // La respuesta es la **vista** del catálogo (el caso de uso del menú + la proyección del POS):
        // los productos ya traen el precio del local en `basePrice` y los agotados. Los chips de categoría
        // (`categories`) llegan en la misma respuesta.
        const body = (await response.json()) as { data: PosCatalogView };
        if (locationRef.current !== targetLocationId) return;

        // Solo se reemplaza si cambió: refrescar cada 3 s no tiene que re-renderizar la pantalla.
        setProducts((current) =>
          JSON.stringify(current) === JSON.stringify(body.data.products) ? current : body.data.products,
        );
        setCategories(body.data.categories);
      } catch (error) {
        if (options.silent) return;

        setProducts([]);
        setCategories([]);
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    locationRef.current = locationId;
    void applyCatalog(locationId);
  }, [locationId, reloadKey, applyCatalog]);

  const refreshCatalog = React.useCallback(
    (options: { silent?: boolean } = {}) => applyCatalog(locationId, options),
    [applyCatalog, locationId],
  );

  /** Cambiar de local vuelve a «Todos»: los chips del local anterior ya no describen este catálogo. */
  React.useEffect(() => {
    setActiveCategoryId(null);
  }, [locationId]);

  return {
    locationId,
    setLocationId,
    terminals,
    terminalId,
    setTerminalId,
    products,
    categories,
    query,
    setQuery,
    activeCategoryId,
    setActiveCategoryId,
    loading,
    loadError,
    refreshCatalog,
    /** Reintenta la carga del catálogo (el botón del estado de error). */
    retryCatalog: () => setReloadKey((key) => key + 1),
    /** El intervalo del refresco automático, para que la pantalla lo arranque con la caja. */
    refreshMs: POS_REFRESH_MS,
    /** La moneda con la que se pintan los precios (llega por parámetro, no se lee acá). */
    currencyCode,
  };
}
