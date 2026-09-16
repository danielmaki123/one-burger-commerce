"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  BellOff,
  ClipboardList,
  Maximize2,
  PanelLeft,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

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
  findNewOrderIds,
  formatUpdatedAgo,
  orderBucket,
  orderTypePresentation,
  shiftBusinessDays,
  sortQueueOrders,
  type OrderBucket,
} from "./orders-page-helpers";
import {
  isAlertSoundEnabled,
  playNewOrderAlert,
  setAlertSoundEnabled,
} from "./admin-alert-sound";
import { describeOrderActionFailure } from "./order-action-helpers";
import { OrderActions } from "./order-actions";
import {
  DEFAULT_LATE_MINUTES,
  comandaCounters,
  comandaLane,
  comandaThresholds,
  resolveComandaUrgency,
  type ComandaLane,
} from "./comanda-helpers";
import { OrderComandaBoard } from "./order-comanda-board";
import type { ComandaItem } from "./order-comanda-card";
import { useComandaView, useFullscreen } from "./use-comanda-view";
import { readOrderUrlFilters, writeOrderUrlFilters, type OrderPaymentFilter } from "./comanda-url";
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
  /** Cuándo empezó la etapa actual (B3a): la comanda mide su urgencia con esto. */
  stageChangedAt: string;
  /** Lo que hay que cocinar, con modificadores y notas (B3). */
  items: ComandaItem[];
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; si no, es "lo antes posible". */
  pickupScheduled?: boolean;
  /** Local del pedido (T8), resuelto por la API. */
  locationName?: string | null;
};

type AdminOrdersResponse = {
  data: OrderSummary[];
  /**
   * `locationScope` es lo que el usuario **puede** ver (A): `null`/ausente = todas. Lo usa la
   * pantalla para no ofrecer sucursales ajenas, sin reimplementar la regla. No confundir con
   * `locationIds`, que es el filtro aplicado en esa respuesta.
   */
  meta?: {
    count?: number;
    locationIds?: string[];
    locationScope?: string[] | null;
    /** B5: cuánto tarda la cocina hoy, en minutos (`null` si todavía no hay ningún pedido listo). */
    averagePrepMinutes?: number | null;
  };
};

type OrdersView = "today" | "history";
type HistoryPreset = "week" | "month" | "all" | "custom";

/**
 * B1 — cada cuánto se pide la lista sola, y cada cuánto late el reloj del turno.
 *
 * El poll va con la pestaña visible: una tablet de cocina encendida toda la noche no puede estar
 * pidiendo datos. El reloj late más seguido que el poll porque la frescura se muestra en segundos
 * («actualizado hace 20 s»), y el costo de repintar la lista del día es despreciable.
 */
const POLL_INTERVAL_MS = 15_000;
const CLOCK_TICK_MS = 5_000;

/** Cuánto dura el resaltado de una comanda recién llegada (B3): lo suficiente para encontrarla. */
const HIGHLIGHT_MS = 1_200;

/** B4: la demora del buscador. Con 300 ms, escribir «Ana» hace un viaje en vez de tres. */
const SEARCH_DEBOUNCE_MS = 300;

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
  /** Cuándo se leyó la lista por última vez: el aviso de «sin actualizar» no puede mentir. */
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  /** Cambia para volver a pedir la lista (botón Actualizar, Reintentar y el poll de B1). */
  const [refreshToken, setRefreshToken] = useState(0);
  /** Pedidos que aparecieron desde la última lectura y todavía nadie miró (B1). */
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  /** Confirmación del último cambio de estado (B2): la pantalla dice qué pasó, no lo deja adivinar. */
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  /** Para saber qué apareció hay que recordar qué había: no alcanza con la lista actual del render. */
  const previousOrderIdsRef = useRef<string[] | null>(null);
  const previousQueryRef = useRef<string | null>(null);
  /** B3: qué carril se ve en celular (en escritorio se ven los tres). */
  const [activeLane, setActiveLane] = useState<ComandaLane>("pending");
  /** B3: las comandas que se acaban de resaltar por llegar solas (el aviso dura ~1,2 s). */
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  /** B3: lo que se anuncia por lector de pantalla cuando una comanda se pasa de tiempo. */
  const [lateAnnouncement, setLateAnnouncement] = useState<string | null>(null);
  const announcedLateIdsRef = useRef<Set<string>>(new Set());
  /** B5: cuánto tarda la cocina hoy, tal como lo resolvió el servidor en la última lectura. */
  const [averagePrepMinutes, setAveragePrepMinutes] = useState<number | null>(null);

  /**
   * B4 — los filtros del tablero. Arrancan en la URL (así un enlace a «el pedido de Ana» funciona y al
   * recargar no se pierde lo que se estaba mirando) y se vuelven a escribir ahí cuando cambian.
   */
  const [initialFilters] = useState(() =>
    typeof window === "undefined"
      ? { search: "", paymentMethod: "all" as OrderPaymentFilter, lateOnly: false }
      : readOrderUrlFilters(window.location.search),
  );
  /** Lo que se escribe en el buscador y lo que ya se pidió: sin la demora, cada tecla sería un viaje. */
  const [searchTerm, setSearchTerm] = useState(initialFilters.search);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentFilter>(
    initialFilters.paymentMethod,
  );
  const [lateOnly, setLateOnly] = useState(initialFilters.lateOnly);

  // B3: la barra lateral del panel se esconde mientras esta vista está montada.
  const { immersive, setImmersive } = useComandaView();
  const fullscreen = useFullscreen();

  // La preferencia del aviso sonoro vive en el dispositivo (el navegador exige un toque para sonar).
  useEffect(() => {
    setSoundEnabled(isAlertSoundEnabled());
  }, []);

  const [view, setView] = useState<OrdersView>("today");
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>("week");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState("all");
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; acceptAlertMinutes?: number; prepAlertMinutes?: number }>
  >([]);
  /** Alcance por sucursal que devolvió el servidor (A). `null` = ve todas. */
  const [scopeLocationIds, setScopeLocationIds] = useState<string[] | null>(null);

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

  /**
   * B3 — el turno se mira como **tablero de comandas**: los carriles son el filtro, así que el filtro
   * por estado (que es del historial) no viaja en la consulta del día.
   */
  const showBoard = view === "today";

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (!showBoard && statusFilter !== "all") query.set("status", statusFilter);
    if (typeFilter !== "all") query.set("type", typeFilter);
    if (locationFilter !== "all") query.set("locationId", locationFilter);
    if (searchQuery) query.set("search", searchQuery);
    if (paymentFilter !== "all") query.set("paymentMethod", paymentFilter);
    if (range.from) query.set("dateFrom", range.from);
    if (range.to) query.set("dateTo", range.to);
    return query.toString();
  }, [
    range,
    statusFilter,
    typeFilter,
    locationFilter,
    searchQuery,
    paymentFilter,
    showBoard,
  ]);

  /** El buscador no dispara un viaje por tecla: espera a que la persona termine de escribir. */
  useEffect(() => {
    if (searchTerm === searchQuery) return;

    const timer = window.setTimeout(() => setSearchQuery(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm, searchQuery]);

  /** La URL refleja lo que se está mirando: recargar o compartir el enlace no pierde los filtros. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const next = writeOrderUrlFilters(window.location.search, {
      search: searchQuery,
      paymentMethod: paymentFilter,
      lateOnly,
    });
    window.history.replaceState(null, "", `${window.location.pathname}${next}`);
  }, [searchQuery, paymentFilter, lateOnly]);

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
          // B0: **no** se borra la lista. Un fallo de red en una cocina no puede dejar la pantalla
          // sin pedidos; se conserva lo último que se leyó y se dice que está viejo.
          setError("read-failed");
          return;
        }

        const payload = (await response.json()) as AdminOrdersResponse;
        const incoming = payload.data ?? [];

        /**
         * B1 — qué llegó nuevo. Solo se compara cuando la consulta es la misma que la anterior: al
         * cambiar un filtro la lista es otra y todo parecería nuevo. Y en la primera lectura no hay
         * nada «nuevo»: la pantalla recién se abre.
         */
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
        setScopeLocationIds(payload.meta?.locationScope ?? null);
        // B5: el promedio del día lo calcula el servidor con los sellos de todos los pedidos; la
        // pantalla lo muestra tal cual, sin recalcularlo con lo que tiene a mano.
        setAveragePrepMinutes(payload.meta?.averagePrepMinutes ?? null);
        setLastUpdatedAt(Date.now());
      } catch {
        setError("read-failed");
      } finally {
        setLoading(false);
      }
    }

    void fetchOrders();
  }, [queryString, refreshToken]);

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

  /**
   * Las sucursales que este usuario puede mirar (A): las del alcance cuando lo hay, todas si no.
   * El filtro se dibuja solo si hay más de una: con una sola sería un control decorativo.
   */
  const scopedLocations = scopeLocationIds
    ? locations.filter((location) => scopeLocationIds.includes(location.id))
    : locations;
  const showLocationFilter = scopedLocations.length > 1;

  // Si el alcance no incluye lo que estaba filtrado (le cambiaron las sucursales), se vuelve a
  // "mis sucursales" en vez de dejar un filtro que no corresponde a ninguna opción.
  useEffect(() => {
    if (locationFilter === "all") return;
    if (scopedLocations.some((location) => location.id === locationFilter)) return;

    setLocationFilter("all");
  }, [locationFilter, scopedLocations]);

  // Reloj del turno: refresca los "hace N min" y la frescura de la lista.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * B1 — el poll. Solo con la pestaña **visible**; al volver a la pestaña se refresca al instante,
   * que es cuando el dato puede haber quedado viejo sin que nadie mirara.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setRefreshToken((token) => token + 1);
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setRefreshToken((token) => token + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  /**
   * La cola del turno se ordena por **hora prometida** (B0): la API devuelve por creación
   * descendente, que es lo correcto para el historial, pero en el turno el que hay que empezar ya no
   * puede quedar debajo de uno comprometido para más tarde. El historial conserva el orden del
   * servidor (lo más reciente primero).
   */
  const queueOrders = useMemo(
    () => (view === "today" ? sortQueueOrders(orders) : orders),
    [orders, view],
  );

  /**
   * La lista se agrupa por etapa cuando no hay un filtro de estado puesto. Es la forma en que el
   * listado sigue distinguiendo lo programado para otro día de lo que es trabajo del turno, incluso
   * cuando se llega desde el tablero con "Ver en el listado".
   */
  const groupByBucket = statusFilter === "all";

  /**
   * B3 — el resaltado de lo que llega solo dura un momento: si se quedara, a la media hora de turno
   * todas las comandas estarían "nuevas" y el resaltado no diría nada.
   */
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
   * B3 — aviso para quien no está mirando la pantalla: cuando una comanda cruza el umbral de atraso se
   * anuncia **una vez** (no en cada refresco de 15 segundos, que sería ruido puro).
   */
  useEffect(() => {
    if (!showBoard) return;

    const justLate = orders.filter((order) => {
      if (!comandaLane(order.status)) return false;
      if (announcedLateIdsRef.current.has(order.id)) return false;

      return (
        resolveComandaUrgency({ stageChangedAt: order.stageChangedAt, nowMs }).level === "late"
      );
    });

    if (justLate.length === 0) return;

    for (const order of justLate) announcedLateIdsRef.current.add(order.id);

    setLateAnnouncement(
      justLate.length === 1
        ? `La comanda ${justLate[0].orderNumber} lleva más de ${DEFAULT_LATE_MINUTES} minutos en esta etapa.`
        : `${justLate.length} comandas llevan más de ${DEFAULT_LATE_MINUTES} minutos en esta etapa.`,
    );
  }, [orders, nowMs, showBoard]);

  const boardCounters = useMemo(() => comandaCounters(orders), [orders]);

  /**
   * B5 — con qué minutos avisa este tablero.
   *
   * Los umbrales son **del local**: la sucursal del centro no cocina al ritmo de la de la carretera. Se
   * usan los del local que se está mirando (el filtro elegido, o el único del alcance). Con varias
   * sucursales a la vista y sin filtro no hay un ritmo único que valga, así que rigen los valores por
   * defecto: inventar un promedio sería mentir sobre las dos.
   */
  const boardThresholds = useMemo(() => {
    const activeLocation =
      locationFilter !== "all"
        ? locations.find((location) => location.id === locationFilter)
        : scopedLocations.length === 1
          ? scopedLocations[0]
          : undefined;

    return comandaThresholds({
      acceptAlertMinutes: activeLocation?.acceptAlertMinutes,
      prepAlertMinutes: activeLocation?.prepAlertMinutes,
    });
  }, [locationFilter, locations, scopedLocations]);

  /**
   * B3 — un pedido programado para **otro día** no es trabajo de este turno: no entra en los carriles
   * (la cocina lo empezaría hoy) y se anuncia aparte, con la salida al listado donde tiene su grupo.
   * Es la separación de la fase 4 del checkout, que el tablero tiene que respetar igual que la lista.
   */
  const scheduledForAnotherDay = useMemo(
    () =>
      orders.filter(
        (order) =>
          orderBucket(order.status, {
            pickupTime: order.pickupTime,
            today,
            timeZone,
          }) === "programados",
      ),
    [orders, today, timeZone],
  );
  const boardOrders = useMemo(() => {
    // La cola del tablero se ordena por **hora prometida** (B0): dentro de cada carril, lo que hay que
    // empezar ya no puede quedar debajo de un pedido comprometido para más tarde.
    const queue = sortQueueOrders(
      orders.filter((order) => !scheduledForAnotherDay.includes(order)),
    );

    // "Atrasados" se filtra en el cliente a propósito: la urgencia es el tiempo en la etapa **ahora**,
    // y eso cambia entre lecturas; pedirlo al servidor devolvería una foto que ya venció.
    if (!lateOnly) return queue;

    return queue.filter(
      (order) =>
        resolveComandaUrgency({ stageChangedAt: order.stageChangedAt, nowMs }).level === "late",
    );
  }, [orders, scheduledForAnotherDay, lateOnly, nowMs]);
  const bucketedOrders = useMemo(() => {
    const buckets = new Map<OrderBucket, OrderSummary[]>();
    for (const bucket of BUCKET_ORDER) buckets.set(bucket, []);
    for (const order of queueOrders) {
      // El día del pedido decide si es trabajo de este turno (fase 4): un retiro
      // programado para otro día va a "Programados" en vez de a "Nuevas".
      buckets
        .get(orderBucket(order.status, { pickupTime: order.pickupTime, today, timeZone }))
        ?.push(order);
    }
    return buckets;
  }, [queueOrders, today, timeZone]);

  /**
   * B2 — cambiar el estado de un pedido desde la fila.
   *
   * Devuelve una promesa que **rechaza con un mensaje legible**: el componente de acciones lo muestra
   * al lado del botón, así nadie se queda mirando una pantalla que no hizo nada. Un 409 no es un error
   * de quien toca —alguien más movió el pedido, o el poll lo trajo actualizado—, así que además se
   * vuelve a leer la lista para que la comanda quede donde corresponde.
   */
  async function changeOrderStatus(
    order: OrderSummary,
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

      throw new Error(describeOrderActionFailure(response.status));
    }

    setActionNotice(
      `Orden ${order.orderNumber} ${getAdminOrderStatusLabel(status).toLowerCase()}.`,
    );
    setRefreshToken((token) => token + 1);
  }

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
      /**
       * B2: la fila **no** es un `<Link>` completo. Un botón dentro de un enlace es HTML inválido y,
       * además, un toque en «Aceptar» aterrizaría en el detalle. El enlace cubre la información —el
       * blanco grande para abrir la orden— y las acciones viven al lado, con su propio espacio.
       */
      <div
        key={order.id}
        className={[
          "border-t border-border first:border-t-0",
          isNew ? "bg-warning/60" : "bg-card",
        ].join(" ")}
      >
        <Link
          href={`/admin/orders/${order.id}`}
          aria-label={`Abrir orden ${order.orderNumber}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 pb-2.5 pt-3.5 transition-colors hover:bg-accent/40"
        >
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground">{order.orderNumber}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
              <Icon className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-brand" strokeWidth={2} aria-hidden="true" />
              {typeLabel} · {order.customerName} ·{" "}
              <span className="font-mono font-semibold">{elapsed}</span>
              {/* De qué local es el pedido (T8): con una sola sucursal en el alcance no aporta. */}
              {scopedLocations.length > 1 && order.locationName ? ` · ${order.locationName}` : ""}
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

        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-3.5 pt-0.5">
          <OrderActions
            layout="row"
            order={order}
            disabled={error !== null}
            disabledReason="Sin conexión: no se puede cambiar el estado."
            onUpdateStatus={(status, note) => changeOrderStatus(order, status, note)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6" aria-busy={loading}>
      {/*
        B3 — la barra de las comandas. Es la única navegación de esta vista (la barra lateral del panel
        se esconde, §4.1), así que lleva el enlace para volver, los contadores del turno, el estado de
        la conexión y los tres controles: sonido, pantalla completa y refresco.
      */}
      {showBoard ? (
        <div
          data-testid="comandas-topbar"
          /* Pegajosa solo en escritorio: ahí las columnas scrollean **adentro** y la barra no se mueve.
             En celular la barra envuelve en varias filas y, pegada, taparía el conmutador de carriles. */
          className="z-30 -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 lg:sticky lg:top-0 md:-mx-7"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-base font-bold tracking-tight text-foreground">
              Comandas
            </h1>

            <Tabs className="min-w-0">
              <TabsList className={CHIP_LIST_CLASS}>
                <TabsTrigger
                  value="today"
                  activeValue={view}
                  onClick={(value) => setView(value as OrdersView)}
                  className={CHIP_TRIGGER_CLASS}
                >
                  Hoy
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  activeValue={view}
                  onClick={(value) => setView(value as OrdersView)}
                  className={CHIP_TRIGGER_CLASS}
                >
                  Historial
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {showLocationFilter ? (
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <span className="sr-only sm:not-sr-only sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wide sm:text-muted-foreground">
                  Local
                </span>
                <select
                  aria-label="Local de las comandas"
                  className="h-11 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                >
                  <option value="all">
                    {scopeLocationIds ? "Mis sucursales" : "Todas las sucursales"}
                  </option>
                  {scopedLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <p
              className="flex flex-wrap items-center gap-2"
              aria-label="Comandas en el turno"
            >
              {/* Los contadores del sistema: una píldora por estado, con su punto y el número en
                  mono (`design-system.md` §6.5 y §2.1), para leer el turno de un vistazo. */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-1 font-mono text-st-caption font-semibold tabular-nums text-status-pending-text">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-status-pending-dot motion-safe:animate-pulse"
                />
                Nuevas: {boardCounters.pending}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-prep-bg px-2.5 py-1 font-mono text-st-caption font-semibold tabular-nums text-status-prep-text">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-prep-dot" />
                Preparando: {boardCounters.preparing}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-ready-bg px-2.5 py-1 font-mono text-st-caption font-semibold tabular-nums text-status-ready-text">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-ready-dot" />
                Listas: {boardCounters.ready}
              </span>
            </p>

            <span className="ml-auto flex flex-wrap items-center gap-2">
              {/* B5: el ritmo de la cocina hoy. Sin pedidos listos dice que todavía no hay datos,
                  porque un "0 min" se leería como una cocina instantánea. */}
              <span
                data-testid="orders-average-prep"
                className="font-mono text-st-caption font-semibold text-ink-secondary tabular-nums"
              >
                {averagePrepMinutes === null
                  ? "Preparación promedio: sin datos todavía"
                  : `Preparación promedio hoy: ${averagePrepMinutes} min`}
              </span>

              <span
                className={`text-xs font-semibold tabular-nums ${error ? "text-warning-foreground" : "text-muted-foreground"}`}
                data-testid="orders-freshness"
              >
                {error ? "Sin conexión · " : ""}Actualizado{" "}
                {lastUpdatedAt ? formatUpdatedAgo(lastUpdatedAt, nowMs) : "…"}
              </span>

              <Button
                variant="outline"
                className="min-h-11 gap-2"
                aria-pressed={soundEnabled}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  setAlertSoundEnabled(next);
                }}
              >
                {soundEnabled ? (
                  <Bell aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <BellOff aria-hidden="true" className="h-4 w-4" />
                )}
                Aviso sonoro
              </Button>

              {/*
                B6 — un solo control para volver: el tablero se abre a pantalla completa (sin la barra
                lateral del panel, que es lo que la cocina quiere en el tablet de pared) y este botón
                devuelve el panel, con su navegación y su sesión, **sin cerrar sesión**. Es lo que el
                owner necesitaba: cada tablet tiene su sección (comandas, POS, inventario) y hay que
                poder volver a elegir. Si el navegador lo permite, además entra o sale de pantalla
                completa de verdad.
              */}
              <Button
                variant="outline"
                className="min-h-11 gap-2"
                aria-pressed={!immersive}
                onClick={() => {
                  setImmersive(!immersive);
                  if (fullscreen.supported) void fullscreen.toggle();
                }}
              >
                {immersive ? (
                  <PanelLeft aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Maximize2 aria-hidden="true" className="h-4 w-4" />
                )}
                {immersive ? "Ver el panel" : "Pantalla completa"}
              </Button>

              <Button
                variant="outline"
                className="min-h-11 gap-2"
                onClick={() => setRefreshToken((token) => token + 1)}
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Actualizar
              </Button>
            </span>
          </div>

          {/* B4 — buscar y acotar el turno. El buscador no dispara un viaje por tecla (300 ms) y los
              filtros quedan en la URL: lo que se está mirando se puede compartir y sobrevive al
              recargar. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 min-w-[12rem] flex-1 items-center gap-2">
              <span className="sr-only">Buscar comanda</span>
              <Input
                type="search"
                className="h-11"
                placeholder="Número, nombre, WhatsApp o PIN"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <label className="flex min-h-11 items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pago
              </span>
              <select
                aria-label="Forma de pago"
                className="h-11 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(event.target.value as OrderPaymentFilter)
                }
              >
                <option value="all">Todas</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
              </select>
            </label>

            <Button
              variant="outline"
              className="min-h-11 gap-2"
              aria-pressed={lateOnly}
              onClick={() => setLateOnly((only) => !only)}
            >
              <AlarmClock aria-hidden="true" className="h-4 w-4" />
              Atrasados
            </Button>

            {searchQuery || paymentFilter !== "all" || lateOnly ? (
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={() => {
                  setSearchTerm("");
                  setSearchQuery("");
                  setPaymentFilter("all");
                  setLateOnly(false);
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <AdminPageHeader
          title="Órdenes"
          description="Bandeja de turno: prioriza ingresos nuevos y sigue cada pedido hasta su cierre."
        />
      )}

      {/* B3: lo que se anuncia por lector de pantalla cuando una comanda se pasa de tiempo. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="comandas-late-announcement">
        {lateAnnouncement ?? ""}
      </p>

      {/* B3: los programados para otro día no son trabajo del turno; se ven en el listado. */}
      {showBoard && scheduledForAnotherDay.length > 0 ? (
        <div
          data-testid="comandas-scheduled-notice"
          className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="font-semibold text-foreground">
            {scheduledForAnotherDay.length === 1
              ? "1 comanda programada para otro día"
              : `${scheduledForAnotherDay.length} comandas programadas para otro día`}
            .
          </span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setView("history")}
          >
            Ver en el listado
          </Button>
        </div>
      ) : null}

      {/* B2: qué se acaba de hacer. Sin esto, la fila cambia de estado y nadie sabe si funcionó. */}
      {actionNotice ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="orders-action-notice"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground"
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
          className="flex flex-col gap-3 rounded-2xl border border-brand/40 bg-accent px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-sm font-semibold text-foreground">
            {newOrderIds.length === 1
              ? "1 pedido nuevo"
              : `${newOrderIds.length} pedidos nuevos`}
          </span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => {
              setNewOrderIds([]);
              window.scrollTo({ top: 0 });
            }}
          >
            Ver nuevos
          </Button>
        </div>
      ) : null}

      {/* B1: frescura de la lista y los dos controles del turno (actualizar y sonido). En el tablero
          de comandas estos controles viven en la barra superior (B3), así que acá quedan para el
          historial. */}
      {!showBoard ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" data-testid="orders-freshness">
          Actualizado{" "}
          {lastUpdatedAt ? formatUpdatedAgo(lastUpdatedAt, nowMs) : "…"}
        </span>
        <Button
          variant="outline"
          className="min-h-11 gap-2"
          onClick={() => setRefreshToken((token) => token + 1)}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Actualizar
        </Button>
        <Button
          variant="outline"
          className="min-h-11 gap-2"
          aria-pressed={soundEnabled}
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            setAlertSoundEnabled(next);
          }}
        >
          {soundEnabled ? (
            <Bell aria-hidden="true" className="h-4 w-4" />
          ) : (
            <BellOff aria-hidden="true" className="h-4 w-4" />
          )}
          Aviso sonoro
        </Button>
      </div>
      ) : null}

      {/* La vista del turno es el tablero de comandas (B3): la lista con chips, resumen y barra de
          filtros queda para el historial, donde sí hace falta. */}
      {!showBoard ? (
      <>
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
              <span className="ml-2 text-muted-foreground">historial</span>
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
          {`Historial · estado: ${activeStatusLabel} · tipo: ${activeTypeLabel}.`}
        </p>

        {filtersOpen ? (
          <div id="order-filters" aria-label="Filtros de órdenes" className="space-y-4 border-t border-border pt-3">
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

            {/* Filtro por local: las sucursales del alcance del usuario (A) y solo si hay más de
                una; el servidor vuelve a aplicar el alcance aunque se pida otra por query. */}
            {showLocationFilter ? (
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
                  <option value="all">
                    {scopeLocationIds ? "Mis sucursales" : "Todas las sucursales"}
                  </option>
                  {scopedLocations.map((location) => (
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
      </>
      ) : null}

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

      {/* B0: el spinner solo cuando todavía no hay nada que mostrar. Si la lista ya está, un
          refresco (o un poll de B1) no puede borrarla de la pantalla. */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
        </div>
      ) : null}

      {authRequired ? (
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

      {/* Sin lista que conservar, el error se explica entero. */}
      {!authRequired && error && orders.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-danger-strong/30 bg-danger p-4 text-sm text-danger-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>No se pudieron cargar las órdenes.</span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setRefreshToken((token) => token + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {/* Con lista en pantalla, el fallo avisa que está vieja en vez de vaciarla (B0). */}
      {!authRequired && error && orders.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-warning-strong/30 bg-warning p-4 text-sm text-warning-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            No se pudo actualizar la bandeja.{" "}
            <span className="text-warning-foreground/80">
              Última actualización{" "}
              {lastUpdatedAt ? formatAdminElapsed(new Date(lastUpdatedAt).toISOString(), nowMs) : "desconocida"}.
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

      {!showBoard && !loading && !authRequired && !error && orders.length === 0 ? (
        <AdminEmptyState
          title="Sin órdenes en este rango"
          description="No hay órdenes para los filtros seleccionados."
        />
      ) : null}

      {/* B3: el tablero del turno. Los carriles existen siempre y cada vacío explica qué va a
          aparecer: un tablero en blanco no dice si no hay pedidos o si algo se rompió. */}
      {showBoard && !authRequired && (!error || orders.length > 0) ? (
        <OrderComandaBoard
          orders={boardOrders}
          nowMs={nowMs}
          timeZone={timeZone}
          newOrderIds={highlightIds}
          activeLane={activeLane}
          onActiveLaneChange={setActiveLane}
          disabled={error !== null}
          disabledReason="Sin conexión: no se puede cambiar el estado."
          thresholds={boardThresholds}
          showLocation={scopedLocations.length > 1}
          searchTerm={searchQuery}
          onUpdateStatus={(orderId, status, note) => {
            const target = orders.find((order) => order.id === orderId);
            if (!target) return Promise.resolve();

            return changeOrderStatus(target, status, note);
          }}
        />
      ) : null}

      {!showBoard && !authRequired && orders.length > 0 && groupByBucket ? (
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

      {!showBoard && !authRequired && orders.length > 0 && !groupByBucket ? (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border shadow-sm">
          {queueOrders.map(renderTicket)}
        </div>
      ) : null}
    </div>
  );
}



