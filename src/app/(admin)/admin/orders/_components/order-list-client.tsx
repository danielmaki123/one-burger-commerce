"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Skeleton, SkeletonAnnouncement } from "@/shared/ui/skeleton";

import { AdminEmptyState } from "../../_components/admin-operational-ui";
import { readOrderList, type OrderListFailureKind } from "../order-api";
import {
  ALL_LOCATIONS,
  DEFAULT_ORDER_LIST_FILTERS,
  readOrderListFilters,
  writeOrderListFilters,
  type OrderListFilters,
} from "../order-list-filters";
import type { OrderListResponse, OrderListRow } from "../order-list-types";
import { OrderListFilters as Filters } from "./order-list-filters";
import { OrderListHeader } from "./order-list-header";
import { OrderListPagination } from "./order-list-pagination";
import { OrderListRowView } from "./order-list-row";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **`/admin/orders`**, el listado administrativo.
 *
 * La página es un **cliente** porque el listado pagina y filtra sin recargar: cada cambio de filtro es una
 * lectura nueva contra `GET /api/admin/orders`, que es la que filtra, pagina y agrega **en el servidor**. La
 * pantalla no filtra nada por su cuenta.
 *
 * Cuatro reglas que sigue:
 *
 * 1. **Los filtros viven en la URL** (`A-62`): el estado inicial sale de `window.location` y cada cambio se
 *    reescribe ahí con `replaceState`, así recargar o compartir el enlace no pierde nada.
 * 2. **Los KPI son del servidor** y describen el filtro completo: cambiar de página no los cambia.
 * 3. **Un fallo de red no borra la lista**: se conserva lo último leído y se dice **cuándo** se leyó.
 * 4. **Scroll del listado, no de la página**: el alto de la superficie es el del viewport menos el chrome del
 *    panel y el scroll vive adentro de la lista (Viewport Contract).
 */
export default function AdminOrdersListClient() {
  /**
   * Los filtros se leen de la URL en un efecto, y la URL **no se escribe** hasta que esa lectura ocurrió.
   *
   * Las dos mitades importan:
   *
   * - leer la URL en el inicializador del estado rompía la **hidratación** (el servidor renderiza «Hoy» y el
   *   cliente otro rango: React regeneraba el árbol y avisaba del mismatch);
   * - escribir la URL antes de leerla la **pisaba** con los defaults, así que recargar perdía los filtros
   *   (`A-62`, que es exactamente lo que la URL tiene que evitar).
   */
  const [filters, setFilters] = useState<OrderListFilters>(DEFAULT_ORDER_LIST_FILTERS);
  const [urlReady, setUrlReady] = useState(false);
  const [response, setResponse] = useState<OrderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ kind: OrderListFailureKind; message: string } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [scopeLocationIds, setScopeLocationIds] = useState<string[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setFilters(readOrderListFilters(window.location.search));
    setUrlReady(true);
  }, []);

  /**
   * Cada cambio de filtro se escribe en la URL. `replaceState` y no `pushState`: cambiar un control de filtro
   * no tiene que llenar el historial de pasos hacia atrás.
   */
  useEffect(() => {
    if (!urlReady) return;

    const query = writeOrderListFilters("", filters);
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [filters, urlReady]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(writeOrderListFilters("", filters));
    // El tamaño de página no es un control de la pantalla: lo fija el listado.
    params.set("pageSize", String(PAGE_SIZE));

    return params.toString();
  }, [filters]);

  useEffect(() => {
    if (!urlReady) return;

    let cancelled = false;

    async function load() {
      try {
        const result = await readOrderList({ queryString });
        if (cancelled) return;

        if (!result.ok) {
          setFailure({ kind: result.failure.kind, message: result.failure.message });
          // Un 401/403 significa que no hay nada que conservar: la lista no es «vieja», no corresponde.
          if (result.failure.kind === "auth" || result.failure.kind === "forbidden") setResponse(null);
          return;
        }

        setFailure(null);
        setResponse({
          data: result.payload.data as unknown as OrderListRow[],
          meta: {
            page: Number(result.payload.meta.page ?? 1),
            pageSize: Number(result.payload.meta.pageSize ?? PAGE_SIZE),
            total: Number(result.payload.meta.total ?? 0),
            locationScope: result.payload.meta.locationScope ?? null,
          },
          kpi: {
            total: Number(result.payload.kpi.total ?? 0),
            active: Number(result.payload.kpi.active ?? 0),
            pendingPayment: Number(result.payload.kpi.pendingPayment ?? 0),
            scheduled: Number(result.payload.kpi.scheduled ?? 0),
          },
        });
        setScopeLocationIds(result.payload.meta.locationScope ?? null);
        setLastUpdatedAt(Date.now());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    void load();

    return () => {
      cancelled = true;
    };
  }, [queryString, refreshToken, urlReady]);

  // El nombre de las sucursales, para el filtro: con una sola no se dibuja.
  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      try {
        const response = await fetch("/api/admin/locations", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          data?: Array<{ id: string; name: string; isActive: boolean }>;
        };
        if (!cancelled) {
          setLocations((payload.data ?? []).filter((location) => location.isActive));
        }
      } catch {
        // Sin locales la lista sigue: el filtro de sucursal es una comodidad, no un requisito.
      }
    }

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  // Reloj propio para «hace N min» de la frescura.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * Con alcance acotado, el filtro sólo ofrece **esas** sucursales: ofrecer una ajena sería mandar al usuario
   * a una lista vacía sin explicación.
   */
  const scopedLocations = scopeLocationIds
    ? locations.filter((location) => scopeLocationIds.includes(location.id))
    : locations;
  const showLocationFilter = scopedLocations.length > 1;

  const data = response?.data ?? [];
  const meta = response?.meta ?? { page: 1, pageSize: PAGE_SIZE, total: 0 };
  const kpi = response?.kpi ?? { total: 0, active: 0, pendingPayment: 0, scheduled: 0 };

  /**
   * Cualquier cambio de filtro vuelve a la primera página: quedarse en la 4 de un filtro nuevo mostraría una
   * lista vacía sin motivo.
   *
   * `useCallback` **no es cosmético acá**: el buscador de la barra de filtros espera 300 ms antes de avisar, y
   * con una función nueva en cada render ese efecto se reiniciaba antes de vencer —el temporizador nunca
   * disparaba y la búsqueda no llegaba a la URL—.
   */
  const patchFilters = useCallback((patch: Partial<OrderListFilters>) => {
    const resetsPage = !("page" in patch);

    setFilters((current) => ({ ...current, ...patch, ...(resetsPage ? { page: 1 } : {}) }));
  }, []);

  const activeFilterLabel = describeActiveFilters(filters, scopedLocations);

  return (
    <div
      className="flex h-[calc(100dvh-12rem)] min-h-0 min-w-0 flex-col gap-3 overflow-hidden md:h-[calc(100dvh-3.5rem)]"
      /**
       * `data-loaded` dice si la **primera lectura** terminó. Lo usan los E2E: esperar los KPI no alcanza
       * —la superficie lee la URL y escribe los filtros en un efecto de montaje— y sin esta marca un test que
       * escribe en el buscador puede pisarse con ese efecto.
       */
      data-testid="orders-list"
      data-loaded={!loading && urlReady ? "true" : "false"}
    >
      {/* La cabecera es sólo contexto (título + KPI + actualizar); los filtros van **fuera** para que el
          20% del alto del design system mida lo que tiene que medir. */}
      <section aria-label="Cabecera de pedidos">
        <OrderListHeader
          contextLabel={activeFilterLabel}
          kpi={kpi}
          loading={loading}
          onRefresh={() => setRefreshToken((token) => token + 1)}
          onApplyFilter={(filter) => {
            if (filter === "active") patchFilters({ status: "process" });
            if (filter === "pendingPayment") patchFilters({ payment: "pending" });
            if (filter === "scheduled") patchFilters({ scheduledOnly: true });
          }}
        />
      </section>

      <Filters
        filters={filters}
        locations={scopedLocations}
        showLocationFilter={showLocationFilter}
        onChange={patchFilters}
        showClear={isFiltered(filters)}
        onClear={() => setFilters({ ...DEFAULT_ORDER_LIST_FILTERS })}
      />

      {/* Sin permiso: mensaje **de permiso**, no de sesión. La sesión vieja se explica sola. */}
      {failure && failure.kind === "forbidden" ? (
        <div
          data-testid="orders-forbidden"
          className="rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text"
        >
          <p>Tu usuario no revisa Pedidos.</p>
          <p className="mt-1">
            Cocina opera las comandas en su propia pantalla; pedile al dueño que revise tu rol si necesitás
            entrar acá.
          </p>
        </div>
      ) : null}

      {failure && failure.kind === "auth" ? (
        <div className="rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text">
          <p>Sesión vencida. Volvé a iniciar sesión para seguir.</p>
        </div>
      ) : null}

      {failure && failure.kind !== "auth" && failure.kind !== "forbidden" && data.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-stitch-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{failure.message}</span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setRefreshToken((token) => token + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {failure && failure.kind !== "auth" && failure.kind !== "forbidden" && data.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text sm:flex-row sm:items-center sm:justify-between">
          <span>
            No se pudo actualizar el listado.{" "}
            <span className="text-status-pending-text/80">Última lectura {elapsedLabel(lastUpdatedAt, nowMs)}.</span>
          </span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setRefreshToken((token) => token + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {loading && data.length === 0 && !failure ? (
        <div className="min-h-0 flex-1 space-y-2" aria-busy="true">
          <SkeletonAnnouncement label="Cargando pedidos" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {!loading && !failure && data.length === 0 ? (
        <AdminEmptyState
          title={isFiltered(filters) ? "Sin coincidencias" : "Sin pedidos en este rango"}
          description={
            isFiltered(filters)
              ? "No hay pedidos para los filtros seleccionados."
              : "No hay pedidos en el rango elegido."
          }
        />
      ) : null}

      {data.length > 0 || (loading && response) ? (
        <section
          aria-label="Listado de pedidos"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1"
        >
          {/* Encabezado de tabla fijo: en celular no hay columnas, así que no se dibuja. */}
          <div
            aria-hidden="true"
            className="hidden shrink-0 grid-cols-[120px_minmax(180px,1.25fr)_minmax(150px,1fr)_150px_120px_24px] items-center gap-x-4 border-b border-line-subtle px-1 py-2 text-st-overline font-bold uppercase tracking-wider text-ink-muted lg:grid"
          >
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Cuándo / estado</span>
            <span>Estado</span>
            <span className="text-right">Total / pago</span>
            <span />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="order-list-scroll">
            {data.map((order) => (
              <OrderListRowView key={order.id} order={order} />
            ))}
          </div>

          <OrderListPagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            loading={loading}
            onPageChange={(page) => patchFilters({ page })}
          />
        </section>
      ) : null}
    </div>
  );
}

/** El tamaño de página del listado. No es un control de la pantalla. */
const PAGE_SIZE = 25;

/** El contexto de la cabecera: qué se está mirando, en una frase. */
function describeActiveFilters(
  filters: OrderListFilters,
  locations: Array<{ id: string; name: string }>,
): string {
  const scope =
    filters.locationId === ALL_LOCATIONS
      ? "Todas las sucursales"
      : (locations.find((location) => location.id === filters.locationId)?.name ?? "Sucursal");

  return scope;
}

function isFiltered(filters: OrderListFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.locationId !== ALL_LOCATIONS ||
    filters.status !== "all" ||
    filters.payment !== "all" ||
    filters.scheduledOnly ||
    filters.date !== DEFAULT_ORDER_LIST_FILTERS.date
  );
}

function elapsedLabel(lastUpdatedAt: number | null, nowMs: number): string {
  if (!lastUpdatedAt) return "desconocida";

  const minutes = Math.max(0, Math.floor((nowMs - lastUpdatedAt) / 60_000));
  if (minutes < 1) return "hace instantes";

  return `hace ${minutes} min`;
}
