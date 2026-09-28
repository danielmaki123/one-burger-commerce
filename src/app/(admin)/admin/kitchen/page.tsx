"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft } from "lucide-react";

import { formatKitchenClock, describeKitchenLocation } from "./kitchen-header";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { businessDate } from "@/shared/lib/business-days";
import { resolveOrderLane, type OrderLane } from "@/modules/orders/domain/order-lanes";
import type { OrderStatus } from "@/modules/orders/domain/order.types";
import type { KitchenOrderProjection } from "@/modules/orders/features/list-kitchen-orders/kitchen-order-projection";

import { comandaThresholds, DEFAULT_LATE_MINUTES, DEFAULT_WARNING_MINUTES, type ComandaThresholdsByLane } from "../orders/comanda-helpers";
import { describeOrderActionFailure } from "../orders/order-action-helpers";
import { isAlertSoundEnabled, playNewOrderAlert, setAlertSoundEnabled } from "../orders/admin-alert-sound";
import { findNewOrderIds, formatUpdatedAgo } from "../orders/orders-page-helpers";
import { kitchenOrdersQuery, readKitchenOrders } from "./kitchen-api";
import { OrderComandaBoard } from "./order-comanda-board";
import { KitchenToolbar } from "./kitchen-toolbar";
import { filterKitchenOrders } from "./kitchen-tabs";
import { readKitchenUrlFilters, writeKitchenUrlFilters } from "./kitchen-url";

/**
 * `/admin/kitchen` — la superficie de **Cocina**.
 *
 * Es una **proyección de `orders`**: no tiene dueño propio de reglas y no crea un módulo. Todo lo que
 * decide sale de otro lado, a propósito:
 *
 * - **Qué es cada pedido**: `orders` (la API devuelve `KitchenOrderProjection`, que **no tiene un solo
 *   campo de dinero**).
 * - **En qué carril va**: `orders/domain/order-lanes` —el mapa canónico, el mismo que usa Pedidos—.
 * - **Cuándo empieza la preparación**: `preparingAt` derivado de `OrderStatusHistory`.
 * - **Cuándo conviene arrancar un programado**: `orders/domain/order-scheduling` con el
 *   `pickupLeadMinutes` del local.
 * - **La autorización**: `canOperateKitchen`, aplicada **en el servidor** por la ruta.
 *
 * Lo que la pantalla sí hace es lo que le toca: pedir la cola cada 15 s con la pestaña visible, avisar con
 * un sonido lo que entra, dejar buscar y filtrar, y decir —sin mentir— qué pasó si la lectura falla.
 */

/** B1 de Órdenes, el mismo ritmo: una tablet de cocina encendida toda la noche no puede pedir datos. */
const POLL_INTERVAL_MS = 15_000;
const CLOCK_TICK_MS = 5_000;

/** Cuánto dura el resaltado de una comanda recién llegada: lo suficiente para encontrarla. */
const HIGHLIGHT_MS = 1_200;

/** La demora del buscador: con 300 ms, escribir «Ana» hace un viaje en vez de tres. */
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminKitchenPage() {
  const { timezone: timeZone } = useBusinessSettings();
  // "Hoy" es el día del **negocio**: separa los programados de otro día de los del turno.
  const today = useMemo(() => businessDate(new Date(), timeZone), [timeZone]);

  const [orders, setOrders] = useState<KitchenOrderProjection[]>([]);
  const [summary, setSummary] = useState<{
    averagePrepMinutes: number | null;
    longestPrepMinutes: number | null;
    prepTargetMinutes: number;
    acceptTargetMinutes: number;
  }>({
    averagePrepMinutes: null,
    longestPrepMinutes: null,
    // Antes de la primera lectura rigen los **defaults del dominio**, no cero: un «Objetivo 0 min» en la
    // cabecera es un número que la cocina no configuró y leería como una meta imposible.
    prepTargetMinutes: DEFAULT_LATE_MINUTES,
    acceptTargetMinutes: DEFAULT_WARNING_MINUTES,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeLane, setActiveLane] = useState<OrderLane>("entry");
  const [filter, setFilter] = useState<string>("all");
  const previousOrderIdsRef = useRef<string[] | null>(null);
  const previousQueryRef = useRef<string | null>(null);

  const [initialFilters] = useState(() =>
    typeof window === "undefined" ? { search: "", lateOnly: false } : readKitchenUrlFilters(window.location.search),
  );
  const [searchTerm, setSearchTerm] = useState(initialFilters.search);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [lateOnly, setLateOnly] = useState(initialFilters.lateOnly);

  // El aviso sonoro es opt-in (el navegador exige un toque) y vive en el dispositivo.
  useEffect(() => {
    setSoundEnabled(isAlertSoundEnabled());
  }, []);

  /** El buscador no dispara un viaje por tecla. */
  useEffect(() => {
    if (searchTerm === searchQuery) return;

    const timer = window.setTimeout(() => setSearchQuery(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm, searchQuery]);

  /** La URL refleja lo que se está mirando: recargar o compartir el enlace no pierde la búsqueda. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const next = writeKitchenUrlFilters(window.location.search, { search: searchQuery, lateOnly });
    window.history.replaceState(null, "", `${window.location.pathname}${next}`);
  }, [searchQuery, lateOnly]);

  const queryString = useMemo(() => kitchenOrdersQuery({ search: searchQuery }), [searchQuery]);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      setAuthRequired(false);

      const result = await readKitchenOrders({ queryString });

      if (!result.ok) {
        // Un fallo de red **no** borra el tablero: se conserva lo último leído y se dice qué pasó.
        if (result.failure.kind === "auth") {
          setAuthRequired(true);
          setOrders([]);
          return;
        }

        setError(result.failure.message);
        return;
      }

      const incoming = result.data ?? [];
      const isSameQuery = previousQueryRef.current === queryString;
      const fresh =
        isSameQuery && previousOrderIdsRef.current !== null
          ? findNewOrderIds(previousOrderIdsRef.current, incoming)
          : [];

      if (fresh.length > 0) {
        setNewOrderIds((current) => [...new Set([...current, ...fresh])]);
        playNewOrderAlert();
      }

      previousOrderIdsRef.current = incoming.map((order) => order.id);
      previousQueryRef.current = queryString;

      setOrders(incoming);
      setSummary(
        result.meta?.summary ?? {
          averagePrepMinutes: null,
          longestPrepMinutes: null,
          prepTargetMinutes: DEFAULT_LATE_MINUTES,
          acceptTargetMinutes: DEFAULT_WARNING_MINUTES,
        },
      );
      setLastUpdatedAt(Date.now());
      setLoading(false);
    }

    void fetchOrders();
  }, [queryString, refreshToken]);

  // Reloj del turno: refresca los «hace N min» y la frescura.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  /** El poll, sólo con la pestaña visible; al volver a la pestaña se refresca al instante. */
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setRefreshToken((token) => token + 1);
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") setRefreshToken((token) => token + 1);
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  /** El resaltado dura un momento: si se quedara, media hora de turno dejaría todo «nuevo». */
  useEffect(() => {
    if (newOrderIds.length === 0) {
      setHighlightIds([]);
      return;
    }

    setHighlightIds(newOrderIds);
    const timer = window.setTimeout(() => setHighlightIds([]), HIGHLIGHT_MS);

    return () => window.clearTimeout(timer);
  }, [newOrderIds]);

  /**
   * Los umbrales del local, **del servidor**: el resumen trae el de cocina (el «objetivo» de la cabecera)
   * y el de la entrada, del local que se está mirando o el default del sistema con varias a la vista. La
   * pantalla no reimplementa la configuración del local.
   */
  const thresholds: ComandaThresholdsByLane = useMemo(
    () =>
      comandaThresholds({
        acceptAlertMinutes: summary.acceptTargetMinutes || undefined,
        prepAlertMinutes: summary.prepTargetMinutes || undefined,
      }),
    [summary.acceptTargetMinutes, summary.prepTargetMinutes],
  );

  const visibleOrders = useMemo(
    () => filterKitchenOrders(orders, { filter, search: searchQuery, lateOnly, thresholds, nowMs }),
    [orders, filter, searchQuery, lateOnly, thresholds, nowMs],
  );

  /**
   * B2 — cambiar el estado de un pedido desde la comanda.
   *
   * Devuelve una promesa que **rechaza con un mensaje legible**. Un 409 no es un error de quien toca
   * —alguien más movió el pedido, o el poll lo trajo actualizado—, así que además se relee la cola. Un
   * 403 acá significa que el **servidor** recortó la capacidad de Cocina: el mensaje lo dice tal cual.
   */
  async function changeOrderStatus(
    order: KitchenOrderProjection,
    status: OrderStatus,
    note?: string | null,
  ): Promise<void> {
    setActionNotice(null);

    let response: Response;
    try {
      response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note ?? null }),
      });
    } catch {
      throw new Error(describeOrderActionFailure(0));
    }

    if (response.status === 401) {
      setAuthRequired(true);
      throw new Error(describeOrderActionFailure(401));
    }

    if (!response.ok) {
      if (response.status === 409) setRefreshToken((token) => token + 1);
      if (response.status === 403) {
        throw new Error("La cocina no puede entregar ni cerrar el pedido: eso es del mostrador.");
      }

      throw new Error(describeOrderActionFailure(response.status));
    }

    setActionNotice(`Comanda ${order.orderNumber} actualizada.`);
    setRefreshToken((token) => token + 1);
  }

  const locationLabel = describeKitchenLocation(
    orders.map((order) => ({
      id: order.location.id,
      name: order.location.name,
      pickupLeadMinutes: order.location.pickupLeadMinutes,
    })),
  );
  const statusCounters = useMemo(() => {
    const entry = orders.filter((order) => resolveOrderLane(order.status) === "entry").length;

    return { total: orders.length, entry };
  }, [orders]);

  return (
    /**
     * El alto de la superficie es el del **viewport menos el chrome del panel** (`md:p-7` son 3.5rem
     * arriba y abajo) y en celular menos la barra inferior (`pb-24` son 6rem). Así **la página no
     * scrollea** y el scroll vive en el cuerpo de cada carril, que es lo que el Viewport Contract pide
     * para una superficie operativa y lo que la referencia aprobada muestra.
     */
    <div
      className="flex h-[calc(100dvh-12rem)] min-h-0 min-w-0 flex-col gap-3 overflow-hidden md:h-[calc(100dvh-3.5rem)]"
      aria-busy={loading}
    >
      {/* Cabecera de una línea: título + local + métricas + reloj. El 80% del alto es para los carriles. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="font-heading text-st-h2 font-bold uppercase tracking-tight text-ink">Cocina</h1>
          <span className="truncate text-st-caption font-semibold text-ink-secondary">{locationLabel}</span>
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-st-caption font-semibold text-ink-secondary">
          <span>
            Prep. promedio{" "}
            <strong className="font-mono tabular-nums text-ink" data-testid="kitchen-average-prep">
              {summary.averagePrepMinutes === null ? "sin datos" : `${summary.averagePrepMinutes} min`}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          {/* El «objetivo» de la referencia **es** el umbral del local: no hay un objetivo de negocio aparte. */}
          <span>
            Objetivo{" "}
            <strong className="font-mono tabular-nums text-ink">
              {summary.prepTargetMinutes} min
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Más larga{" "}
            <strong className="font-mono tabular-nums text-status-sla-text" data-testid="kitchen-longest-prep">
              {summary.longestPrepMinutes === null ? "sin datos" : `${summary.longestPrepMinutes} min`}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            En el turno <strong className="font-mono tabular-nums text-ink">{statusCounters.total}</strong>
          </span>
        </p>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="font-mono text-st-h3 font-bold tabular-nums text-ink"
            data-testid="kitchen-clock"
          >
            {formatKitchenClock(new Date(nowMs).toISOString(), timeZone)}
          </span>
          {authRequired ? null : (
            // La vuelta al panel es un **enlace**, no un botón: hay que poder abrirlo en otra pestaña y
            // el navegador tiene que anunciarlo como navegación. `window.history.back()` no es una salida.
            <Link
              href="/admin/orders"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-stitch-md px-3 text-st-body font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Volver al panel</span>
            </Link>
          )}
        </div>
      </header>

      <KitchenToolbar
        filter={filter}
        onFilterChange={(value) => {
          setFilter(value);
          const lane = value === "all" ? null : (value as OrderLane);
          if (lane) setActiveLane(lane);
        }}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        lateOnly={lateOnly}
        onToggleLateOnly={() => setLateOnly((only) => !only)}
        lastUpdatedAt={lastUpdatedAt}
        nowMs={nowMs}
        offline={error !== null}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          setAlertSoundEnabled(next);
        }}
        onRefresh={() => setRefreshToken((token) => token + 1)}
      />

      {/* Sin permiso: mensaje **de permiso**, no de sesión (con sesión válida decir «sesión requerida» miente). */}
      {authRequired ? (
        <div className="rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text">
          <p>Tu usuario no opera Cocina.</p>
          <p className="mt-1">
            Pedile al dueño que revise tu rol: para cocinar hace falta la capacidad de operar comandas.
          </p>
        </div>
      ) : null}

      {/* Sin cola que conservar, el error se explica entero, con el motivo real y la acción que sirve. */}
      {!authRequired && error && orders.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-stitch-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setRefreshToken((token) => token + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {/* Con cola en pantalla, el fallo avisa que está vieja en vez de vaciarla. */}
      {!authRequired && error && orders.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text sm:flex-row sm:items-center sm:justify-between">
          <span>
            No se pudo actualizar el tablero.{" "}
            <span className="text-status-pending-text/80">
              Última actualización{" "}
              {lastUpdatedAt
                ? formatUpdatedAgo(lastUpdatedAt, nowMs)
                : "desconocida"}
              .
            </span>
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

      {actionNotice ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="kitchen-action-notice"
          className="flex flex-wrap items-center justify-between gap-2 rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 text-st-body font-semibold text-ink"
        >
          {actionNotice}
          <Button variant="ghost" className="min-h-11" onClick={() => setActionNotice(null)}>
            Cerrar
          </Button>
        </div>
      ) : null}

      {/* B1: lo que apareció solo se anuncia; el aviso se cierra cuando alguien lo mira. */}
      {newOrderIds.length > 0 ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-stitch-lg border border-brand/40 bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-st-body font-semibold text-ink">
            {newOrderIds.length === 1 ? "1 comanda nueva" : `${newOrderIds.length} comandas nuevas`}
          </span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setNewOrderIds([])}
          >
            Ver nuevas
          </Button>
        </div>
      ) : null}

      {loading && orders.length === 0 && !authRequired ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-line-subtle border-t-brand" />
        </div>
      ) : null}

      {!authRequired ? (
        <OrderComandaBoard
          orders={visibleOrders}
          nowMs={nowMs}
          timeZone={timeZone}
          today={today}
          newOrderIds={highlightIds}
          activeLane={activeLane}
          onActiveLaneChange={setActiveLane}
          disabled={error !== null}
          disabledReason="Sin conexión: no se puede cambiar el estado."
          thresholds={thresholds}
          showLocation={false}
          searchTerm={searchQuery}
          onUpdateStatus={(orderId, status, note) => {
            const target = orders.find((order) => order.id === orderId);
            if (!target) return Promise.resolve();

            return changeOrderStatus(target, status, note);
          }}
        />
      ) : null}

      {/* El aviso de «nada coincide» cuando la búsqueda deja el tablero vacío de verdad. */}
      {!authRequired && !loading && orders.length > 0 && visibleOrders.length === 0 ? (
        <p
          role="status"
          className="rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 text-st-body font-semibold text-ink"
          data-testid="kitchen-no-matches"
        >
          Sin coincidencias. {lateOnly ? "Probá apagar «Solo atrasadas»." : `Ninguna comanda coincide con «${searchQuery}».`}
        </p>
      ) : null}
    </div>
  );
}
