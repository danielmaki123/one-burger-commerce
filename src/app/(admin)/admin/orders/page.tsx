"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, ShoppingBag, SlidersHorizontal, Table2, Truck } from "lucide-react";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  BUCKET_META,
  BUCKET_ORDER,
  businessDate,
  businessDayRange,
  orderBucket,
  shiftBusinessDays,
  type OrderBucket,
} from "./orders-page-helpers";
import {
  AdminCompactToolbar,
  AdminEmptyState,
  AdminPageHeader,
  AdminPickupTimingChip,
  AdminStatusSolid,
  formatAdminElapsed,
  getAdminOrderSolidStatus,
} from "../_components/admin-operational-ui";
import {
  describeAdminPickup,
  resolveAdminPickupTiming,
} from "../_components/admin-pickup-timing";

type OrderType = "delivery" | "pickup" | "table";
type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "closed"
  | "ready_for_pickup"
  | "picked_up"
  | "accepted"
  | "served"
  | "cancelled";

type OrderSummary = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  customerWhatsapp: string;
  total: number;
  createdAt: string;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; si no, es "lo antes posible". */
  pickupScheduled?: boolean;
  /** Local del pedido (T8), resuelto por la API. */
  locationName?: string | null;
};

type AdminOrdersResponse = {
  data: OrderSummary[];
};

type OrdersView = "today" | "history";
type HistoryPreset = "week" | "month" | "all" | "custom";

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevos" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: "closed", label: "Cerrados" },
];

const TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pickup", label: "Retiro" },
];

// Órdenes "abiertas" = aún en operación (no terminales).
const OPEN_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
]);

function orderTypePresentation(type: OrderType) {
  if (type === "delivery") return { label: "Delivery", Icon: Truck };
  if (type === "pickup") return { label: "Retiro", Icon: ShoppingBag };
  return { label: "Mesa", Icon: Table2 };
}

// Buckets de turno: viven en `orders-page-helpers` para poder probarlos solos.
// Un pedido abierto para otro día va a "Programados".

const CHIP_LIST_CLASS =
  "flex flex-wrap gap-2 bg-transparent p-0";
const CHIP_TRIGGER_CLASS =
  "min-h-11 flex-none whitespace-nowrap rounded-xl border border-border bg-card px-3";

export default function AdminOrdersPage() {
  const { timezone: timeZone } = useBusinessSettings();
  // "Hoy" es el día del **negocio**, no el de la máquina que mira el panel.
  const today = useMemo(() => businessDate(new Date(), timeZone), [timeZone]);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const [view, setView] = useState<OrdersView>("today");
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>("week");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState("all");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  // Locales del negocio (T8): con uno solo no hay nada que filtrar y el control no se dibuja.
  useEffect(() => {
    let cancelled = false;

    async function fetchLocations() {
      try {
        const response = await fetch("/api/admin/locations");
        if (!response.ok) return;

        const payload = (await response.json()) as {
          data?: Array<{ id: string; name: string; isActive: boolean }>;
        };
        if (!cancelled) {
          setLocations((payload.data ?? []).filter((location) => location.isActive));
        }
      } catch {
        // Sin locales cargados la lista sigue funcionando: es un filtro, no un requisito.
      }
    }

    void fetchLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  const [olderOpenCount, setOlderOpenCount] = useState<number | null>(null);
  const currency = useCurrencyFormat();

  const range = useMemo<{ from?: string; to?: string }>(() => {
    if (view === "today") {
      return businessDayRange(today, timeZone);
    }
    if (historyPreset === "week") {
      return {
        from: businessDayRange(shiftBusinessDays(today, -6), timeZone).from,
        to: businessDayRange(today, timeZone).to,
      };
    }
    if (historyPreset === "month") {
      return {
        from: businessDayRange(shiftBusinessDays(today, -29), timeZone).from,
        to: businessDayRange(today, timeZone).to,
      };
    }
    if (historyPreset === "all") {
      return {};
    }
    return {
      from: dateFrom ? businessDayRange(dateFrom, timeZone).from : undefined,
      to: dateTo ? businessDayRange(dateTo, timeZone).to : undefined,
    };
  }, [view, historyPreset, dateFrom, dateTo, today, timeZone]);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (typeFilter !== "all") query.set("type", typeFilter);
    if (locationFilter !== "all") query.set("locationId", locationFilter);
    if (range.from) query.set("dateFrom", range.from);
    if (range.to) query.set("dateTo", range.to);
    return query.toString();
  }, [range, statusFilter, typeFilter, locationFilter]);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      setAuthRequired(false);

      try {
        const response = await fetch(
          `/api/admin/orders${queryString ? `?${queryString}` : ""}`,
        );

        if (response.status === 401) {
          setAuthRequired(true);
          setOrders([]);
          return;
        }

        if (!response.ok) {
          setError("No se pudieron cargar las órdenes.");
          setOrders([]);
          return;
        }

        const payload = (await response.json()) as AdminOrdersResponse;
        setOrders(payload.data ?? []);
      } catch {
        setError("No se pudieron cargar las órdenes.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    void fetchOrders();
  }, [queryString]);

  // Conteo en segundo plano de órdenes abiertas de días anteriores, para que no
  // desaparezcan al enfocar el día. Solo lectura; no bloquea la vista principal.
  useEffect(() => {
    async function fetchOlderOpen() {
      try {
        const params = new URLSearchParams({
          dateTo: businessDayRange(shiftBusinessDays(today, -1), timeZone).to ?? "",
        });
        const response = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as AdminOrdersResponse;
        const open = (payload.data ?? []).filter((order) =>
          OPEN_STATUSES.has(order.status),
        ).length;
        setOlderOpenCount(open);
      } catch {
        // best-effort: si falla, simplemente no mostramos el aviso
      }
    }

    void fetchOlderOpen();
  }, [today, timeZone]);

  const ordersStatusCounts = {
    total: orders.length,
    new: orders.filter((order) => order.status === "new").length,
    preparing: orders.filter((order) => order.status === "preparing").length,
    ready: orders.filter(
      (order) => order.status === "ready" || order.status === "ready_for_pickup",
    ).length,
    closed: orders.filter(
      (order) =>
        order.status === "closed" ||
        order.status === "delivered" ||
        order.status === "picked_up" ||
        order.status === "served",
    ).length,
  };

  const showOlderOpenNotice = view === "today" && (olderOpenCount ?? 0) > 0;
  const activeStatusLabel = STATUS_FILTERS.find((option) => option.value === statusFilter)?.label ?? "Todos";
  const activeTypeLabel = TYPE_FILTERS.find((option) => option.value === typeFilter)?.label ?? "Todos";

  // Reloj del turno: refresca los "hace N min" cada 30 s.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const groupByBucket = view === "today" && statusFilter === "all";
  const bucketedOrders = useMemo(() => {
    const buckets = new Map<OrderBucket, OrderSummary[]>();
    for (const bucket of BUCKET_ORDER) buckets.set(bucket, []);
    for (const order of orders) {
      // El día del pedido decide si es trabajo de este turno (fase 4): un retiro
      // programado para otro día va a "Programados" en vez de a "Nuevas".
      buckets
        .get(orderBucket(order.status, { pickupTime: order.pickupTime, today, timeZone }))
        ?.push(order);
    }
    return buckets;
  }, [orders, today, timeZone]);

  const STATUS_CHIP_OPTIONS: Array<{ value: string; label: string; count: number }> = [
    { value: "all", label: "Todas", count: ordersStatusCounts.total },
    { value: "new", label: "Nuevas", count: ordersStatusCounts.new },
    { value: "preparing", label: "Preparando", count: ordersStatusCounts.preparing },
    { value: "ready", label: "Listas", count: ordersStatusCounts.ready },
    { value: "closed", label: "Cerradas", count: ordersStatusCounts.closed },
  ];

  function renderTicket(order: OrderSummary) {
    const { label: typeLabel, Icon } = orderTypePresentation(order.type);
    const elapsed = formatAdminElapsed(order.createdAt, nowMs);
    const isNew = order.status === "new";
    // El semáforo va contra la hora prometida, no contra la antigüedad del pedido: un
    // pedido programado para más tarde no puede estar en rojo por haber entrado temprano.
    // Y si el retiro es de otro día, no hay cuenta regresiva: lo dice la etiqueta.
    const timing = resolveAdminPickupTiming({
      pickupTime: order.pickupTime,
      status: order.status,
      nowMs,
      timeZone,
    });
    const pickupLabel = describeAdminPickup({
      pickupTime: order.pickupTime,
      pickupScheduled: order.pickupScheduled,
      timeZone,
      nowMs,
    });

    return (
      <Link
        key={order.id}
        href={`/admin/orders/${order.id}`}
        aria-label={`Abrir orden ${order.orderNumber}`}
        className={[
          "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3.5 transition-colors first:border-t-0 hover:bg-accent/40",
          isNew ? "bg-warning/60" : "bg-card",
        ].join(" ")}
      >
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">{order.orderNumber}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
            <Icon className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-brand" strokeWidth={2} aria-hidden="true" />
            {typeLabel} · {order.customerName} ·{" "}
            <span className="font-mono font-semibold">{elapsed}</span>
            {/* De qué local es el pedido (T8): con una sola sucursal no aporta y no se muestra. */}
            {locations.length > 1 && order.locationName ? ` · ${order.locationName}` : ""}
          </p>
        </div>
        <p className="text-right text-base font-bold tabular-nums text-foreground">
          {formatCurrency(order.total, currency)}
        </p>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {pickupLabel ? (
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {pickupLabel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground tabular-nums">
                Recibida {formatTimeInTimeZone(order.createdAt, timeZone) ?? "—"}
              </span>
            )}
            <AdminPickupTimingChip timing={timing} />
          </span>
          <AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
            {getAdminOrderStatusLabel(order.status)}
          </AdminStatusSolid>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        title="Órdenes"
        description="Bandeja de turno: prioriza ingresos nuevos y sigue cada pedido hasta su cierre."
      />

      <section
        aria-label="Resumen de órdenes"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand">
            <ClipboardList aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Órdenes en vista</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <span className="text-2xl leading-none">{ordersStatusCounts.total}</span>
              <span className="ml-2 text-muted-foreground">{view === "today" ? "hoy" : "historial"}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Estados en la vista actual">
          <span><strong className="text-foreground">{ordersStatusCounts.new}</strong> nuevas</span>
          <span><strong className="text-foreground">{ordersStatusCounts.preparing}</strong> preparando</span>
          <span><strong className="text-foreground">{ordersStatusCounts.ready}</strong> listas</span>
          <span><strong className="text-foreground">{ordersStatusCounts.closed}</strong> cerradas</span>
        </div>
      </section>

      <div role="group" aria-label="Filtro rápido por estado" className="flex flex-wrap gap-2">
        {STATUS_CHIP_OPTIONS.map((option) => {
          const isActive = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setStatusFilter(option.value)}
              className={[
                "inline-flex min-h-11 flex-none items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              ].join(" ")}
            >
              {option.label}
              <span className={`rounded-full px-1.5 py-0.5 font-mono text-xs font-bold ${isActive ? "bg-white/20" : "bg-black/10"}`}>
                {option.count}
              </span>
            </button>
          );
        })}
      </div>

      <AdminCompactToolbar className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vista</p>
            <Tabs className="min-w-0">
              <TabsList className={CHIP_LIST_CLASS}>
                <TabsTrigger value="today" activeValue={view} onClick={(value) => setView(value as OrdersView)} className={CHIP_TRIGGER_CLASS}>
                  Hoy
                </TabsTrigger>
                <TabsTrigger value="history" activeValue={view} onClick={(value) => setView(value as OrdersView)} className={CHIP_TRIGGER_CLASS}>
                  Historial
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 gap-2 px-3"
            aria-expanded={filtersOpen}
            aria-controls="order-filters"
            onClick={() => setFiltersOpen((isOpen) => !isOpen)}
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {view === "today"
            ? `Mostrando órdenes de hoy (${today}).`
            : `Historial · estado: ${activeStatusLabel} · tipo: ${activeTypeLabel}.`}
        </p>

        {filtersOpen ? (
          <div id="order-filters" aria-label="Filtros de órdenes" className="space-y-4 border-t border-border pt-3">
            {view === "history" ? (
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rango</p>
                <Tabs className="min-w-0">
                  <TabsList className={CHIP_LIST_CLASS}>
                    <TabsTrigger value="week" activeValue={historyPreset} onClick={(value) => setHistoryPreset(value as HistoryPreset)} className={CHIP_TRIGGER_CLASS}>Semana</TabsTrigger>
                    <TabsTrigger value="month" activeValue={historyPreset} onClick={(value) => setHistoryPreset(value as HistoryPreset)} className={CHIP_TRIGGER_CLASS}>Mes</TabsTrigger>
                    <TabsTrigger value="all" activeValue={historyPreset} onClick={(value) => setHistoryPreset(value as HistoryPreset)} className={CHIP_TRIGGER_CLASS}>Todo</TabsTrigger>
                    <TabsTrigger value="custom" activeValue={historyPreset} onClick={(value) => setHistoryPreset(value as HistoryPreset)} className={CHIP_TRIGGER_CLASS}>Rango</TabsTrigger>
                  </TabsList>
                </Tabs>
                {historyPreset === "custom" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><label className="text-xs uppercase tracking-wide text-muted-foreground">Desde</label><Input className="h-11" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs uppercase tracking-wide text-muted-foreground">Hasta</label><Input className="h-11" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</p>
                <Tabs className="min-w-0"><TabsList className={CHIP_LIST_CLASS}>{STATUS_FILTERS.map((option) => <TabsTrigger key={option.value} value={option.value} activeValue={statusFilter} onClick={setStatusFilter} className={CHIP_TRIGGER_CLASS}>{option.label}</TabsTrigger>)}</TabsList></Tabs>
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo</p>
                <Tabs className="min-w-0"><TabsList className={CHIP_LIST_CLASS}>{TYPE_FILTERS.map((option) => <TabsTrigger key={option.value} value={option.value} activeValue={typeFilter} onClick={setTypeFilter} className={CHIP_TRIGGER_CLASS}>{option.label}</TabsTrigger>)}</TabsList></Tabs>
              </div>
            </div>

            {/* Filtro por local (T8): con un solo local no se dibuja, sería un control
                decorativo. Cada sucursal ve lo suyo. */}
            {locations.length > 1 ? (
              <div className="min-w-0 space-y-2">
                <label
                  htmlFor="orders-location-filter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Local
                </label>
                <select
                  id="orders-location-filter"
                  className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:max-w-xs"
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                >
                  <option value="all">Todos los locales</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminCompactToolbar>

      {showOlderOpenNotice ? (
        <div className="flex flex-col gap-2 rounded-lg border border-warning-strong/30 bg-warning p-4 text-sm text-warning-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hay {olderOpenCount} orden{olderOpenCount === 1 ? "" : "es"} abierta
            {olderOpenCount === 1 ? "" : "s"} de días anteriores.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHistoryPreset("all");
              setStatusFilter("all");
              setView("history");
            }}
          >
            Ver en Historial
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
        </div>
      ) : null}

      {!loading && authRequired ? (
        <div className="rounded-md border border-warning-strong/30 bg-warning p-4 text-sm text-warning-foreground">
          <p>Sesión de administrador requerida.</p>
          <p className="mt-1">
            <Link
              href="/admin/login"
              className="font-medium underline underline-offset-2"
            >
              Ir a inicio de sesión
            </Link>
          </p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-danger-strong/30 bg-danger p-4 text-sm text-danger-foreground">
          {error}
        </div>
      ) : null}

      {!loading && !authRequired && !error && orders.length === 0 ? (
        <AdminEmptyState
          title={view === "today" ? "Sin órdenes hoy" : "Sin órdenes en este rango"}
          description={
            view === "today"
              ? "Todavía no hay órdenes registradas hoy."
              : "No hay órdenes para los filtros seleccionados."
          }
        />
      ) : null}

      {!loading && !authRequired && !error && orders.length > 0 && groupByBucket ? (
        <div className="min-w-0 space-y-5">
          {BUCKET_ORDER.map((bucket) => {
            const bucketOrders = bucketedOrders.get(bucket) ?? [];
            if (bucketOrders.length === 0) return null;
            const meta = BUCKET_META[bucket];

            return (
              <section key={bucket} aria-label={`${meta.title} · ${bucketOrders.length}`} className="min-w-0">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.title}
                  {meta.hint ? ` · ${meta.hint}` : ""} · {bucketOrders.length}
                </p>
                <div className="min-w-0 overflow-hidden rounded-2xl border border-border shadow-sm">
                  {bucketOrders.map(renderTicket)}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {!loading && !authRequired && !error && orders.length > 0 && !groupByBucket ? (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border shadow-sm">
          {orders.map(renderTicket)}
        </div>
      ) : null}
    </div>
  );
}
