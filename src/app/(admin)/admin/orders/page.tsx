"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import { Button } from "@/shared/ui/button";
import {
  BUCKET_META,
  BUCKET_ORDER,
  businessDate,
  businessTurnRange,
  findNewOrderIds,
  orderBucket,
  orderTypePresentation,
  sortQueueOrders,
  type OrderBucket,
} from "./orders-page-helpers";
import { OrdersToolbar } from "./orders-toolbar";
import {
  isAlertSoundEnabled,
  playNewOrderAlert,
  setAlertSoundEnabled,
} from "./admin-alert-sound";
import { describeOrderActionFailure } from "./order-action-helpers";
import { OrderActions } from "./order-actions";
import {
  comandaCounters,
  comandaLane,
  comandaThresholds,
  resolveComandaUrgency,
  type ComandaLane,
} from "./comanda-helpers";
import { OrderComandaBoard } from "./order-comanda-board";
import type { ComandaItem } from "./order-comanda-card";
import { useComandaView } from "./use-comanda-view";
import { filterOrdersForBoardView } from "./orders-board-view";
import { readOrderUrlFilters, writeOrderUrlFilters, type OrderPaymentFilter } from "./comanda-url";
import { readAdminOrders, sanitizeOrderQuery, type OrderListFailure } from "./order-list-api";
import {
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

// Buckets de turno: viven en `orders-page-helpers` para poder probarlos solos.
// Un pedido abierto para otro día va a "Programados".

export default function AdminOrdersPage() {
  const { timezone: timeZone } = useBusinessSettings();
  // "Hoy" es el día del **negocio**, no el de la máquina que mira el panel.
  const today = useMemo(() => businessDate(new Date(), timeZone), [timeZone]);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Por qué falló la última lectura: la pantalla elige la acción (reintentar o limpiar los filtros). */
  const [errorKind, setErrorKind] = useState<OrderListFailure["kind"] | null>(null);
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

  // Punto 3: el modo cocina —el del dispositivo— esconde el chrome y deja los carriles.
  const { immersive: kitchenMode, setImmersive: setKitchenMode } = useComandaView();

  /**
   * El tab del modo cocina (Punto 3). Vive solo en memoria: es «qué estoy mirando ahora», no un filtro
   * que se comparta por enlace. El modo sí es del dispositivo, pero la pestaña con la que se entra a
   * un turno es una pregunta del momento.
   */
  const [kitchenTab, setKitchenTab] = useState("all");

  // La preferencia del aviso sonoro vive en el dispositivo (el navegador exige un toque para sonar).
  useEffect(() => {
    setSoundEnabled(isAlertSoundEnabled());
  }, []);

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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

  const currency = useCurrencyFormat();

  /**
   * La bandeja de Órdenes es **el turno**: el día del negocio, no la semana. El histórico con
   * sus rangos vive en `/admin/history` (sección Historial), que es donde se pregunta por meses.
   *
   * El rango incluye **mañana**, no solo hoy: el aviso de «comandas programadas para otro día» y el
   * grupo «Programados» del listado salen de pedidos que hoy no son del turno, y con el rango de un
   * día esos dos lugares quedaban siempre vacíos (`businessTurnRange`).
   */
  const range = useMemo<{ from?: string; to?: string }>(
    () => businessTurnRange(today, timeZone),
    [today, timeZone],
  );

  /**
   * Los tabs de estado son el filtro **y** el contenido: los activos se miran como tablero de
   * comandas —los carriles son el filtro— y las cerradas se miran como lista, porque el tablero no
   * tiene carril de cerradas (opción (a) del owner, 2026-09-18).
   *
   * En **modo cocina** (Punto 3) el tablero es la única vista: no hay lista de cerradas a la que ir.
   */
  const showBoard = kitchenMode || statusFilter !== "closed";

  const queryString = useMemo(() => {
    // Los filtros se sanean acá (bug de producción, 2026-09-18): un valor que la API rechaza se descarta
    // en vez de viajar y volver como 400, que era lo que dejaba el cartel de «no se pudieron cargar».
    return sanitizeOrderQuery({
      status: statusFilter === "all" ? null : statusFilter,
      type: typeFilter,
      locationId: locationFilter,
      search: searchQuery,
      paymentMethod: paymentFilter,
      dateFrom: range.from ?? null,
      dateTo: range.to ?? null,
    }).toString();
  }, [
    range,
    statusFilter,
    typeFilter,
    locationFilter,
    searchQuery,
    paymentFilter,
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
        const result = await readAdminOrders({ queryString });

        if (!result.ok) {
          // B0: **no** se borra la lista. Un fallo de red en una cocina no puede dejar la pantalla sin
          // pedidos; se conserva lo último que se leyó y se dice qué pasó, con el motivo real (bug de
          // producción, 2026-09-18: antes cualquier fallo decía «no se pudieron cargar»).
          if (result.failure.kind === "auth") {
            setAuthRequired(true);
            setOrders([]);
            return;
          }

          setError(result.failure.message);
          setErrorKind(result.failure.kind);
          return;
        }

        setErrorKind(null);

        const payload = { data: result.orders, meta: result.meta } as AdminOrdersResponse;
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
        // `readAdminOrders` no tira, pero un error inesperado no puede dejar la pantalla sin explicación.
        setError("No se pudieron cargar las órdenes.");
        setErrorKind("network");
      } finally {
        setLoading(false);
      }
    }

    void fetchOrders();
  }, [queryString, refreshToken]);

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
   * descendente, pero en el turno el que hay que empezar ya no puede quedar debajo de uno
   * comprometido para más tarde.
   */
  const queueOrders = useMemo(() => sortQueueOrders(orders), [orders]);

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
   * Los umbrales del tablero, **del local** que se está mirando.
   *
   * La sucursal del centro no cocina al ritmo de la de la carretera. Se usan los del local filtrado, o los
   * del único local del alcance. Con varias sucursales a la vista y sin filtro no hay un ritmo único que
   * valga, así que rigen los valores por defecto: inventar un promedio sería mentir sobre las dos.
   *
   * Vive acá arriba porque lo usan **el tablero y el anuncio accesible de atraso**: los dos tienen que medir
   * con el mismo número.
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
   * B3 — aviso para quien no está mirando la pantalla: cuando una comanda cruza el umbral de atraso se
   * anuncia **una vez** (no en cada refresco de 15 segundos, que sería ruido puro).
   *
   * El umbral es el **del local** (el mismo que usa el tablero, `boardThresholds`): antes el anuncio medía
   * con los valores por defecto, así que en una sucursal con otro ritmo decía un número que la pantalla no
   * estaba usando.
   */
  useEffect(() => {
    if (!showBoard) return;

    const lateOf = (status: OrderStatus) =>
      comandaLane(status) === "pending" ? boardThresholds.pending : boardThresholds.kitchen;

    const justLate = orders.filter((order) => {
      if (!comandaLane(order.status)) return false;
      if (announcedLateIdsRef.current.has(order.id)) return false;

      return (
        resolveComandaUrgency({
          stageChangedAt: order.stageChangedAt,
          nowMs,
          ...lateOf(order.status),
        }).level === "late"
      );
    });

    if (justLate.length === 0) return;

    for (const order of justLate) announcedLateIdsRef.current.add(order.id);

    const lateMinutes = lateOf(justLate[0].status).lateMinutes;

    setLateAnnouncement(
      justLate.length === 1
        ? `La comanda ${justLate[0].orderNumber} lleva más de ${lateMinutes} minutos en esta etapa.`
        : `${justLate.length} comandas llevan más de ${lateMinutes} minutos en esta etapa.`,
    );
  }, [boardThresholds, orders, nowMs, showBoard]);

  const boardCounters = useMemo(() => comandaCounters(orders), [orders]);

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
    const visible = !lateOnly
      ? queue
      : queue.filter(
          (order) =>
            resolveComandaUrgency({ stageChangedAt: order.stageChangedAt, nowMs }).level === "late",
        );

    // Punto 3: en modo cocina el tab elegido manda (y trae lo despachado hace poco, que ya no está
    // en los carriles).
    return filterOrdersForBoardView(visible, { kitchenMode, kitchenTab, nowMs });
  }, [orders, scheduledForAnotherDay, lateOnly, nowMs, kitchenMode, kitchenTab]);
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
   * Dejar la bandeja sin filtros. Lo usan el botón de la barra de trabajo y el error de filtros: la
   * acción que arregla un 400 por un filtro inválido es exactamente la misma, y antes estaba escrita
   * dos veces.
   */
  function clearAllFilters() {
    setStatusFilter("all");
    setTypeFilter("all");
    setLocationFilter("all");
    setPaymentFilter("all");
    setSearchQuery("");
    setSearchTerm("");
    setLateOnly(false);
  }

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
          "border-t border-line-subtle first:border-t-0",
          isNew ? "bg-warning/60" : "bg-surface-card",
        ].join(" ")}
      >
        <Link
          href={`/admin/orders/${order.id}`}
          aria-label={`Abrir orden ${order.orderNumber}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 pb-2.5 pt-3.5 transition-colors hover:bg-surface-elevated/40"
        >
          <div className="min-w-0">
            <p className="text-base font-bold text-ink">{order.orderNumber}</p>
            <p className="mt-0.5 truncate text-st-caption font-medium text-ink-secondary">
              <Icon className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-brand" strokeWidth={2} aria-hidden="true" />
              {typeLabel} · {order.customerName} ·{" "}
              <span className="font-mono font-semibold">{elapsed}</span>
              {/* De qué local es el pedido (T8): con una sola sucursal en el alcance no aporta. */}
              {scopedLocations.length > 1 && order.locationName ? ` · ${order.locationName}` : ""}
            </p>
          </div>
          <p className="text-right text-base font-bold tabular-nums text-ink">
            {formatCurrency(order.total, currency)}
          </p>
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              {pickupLabel ? (
                <span className="text-st-caption font-semibold text-ink tabular-nums">
                  {pickupLabel}
                </span>
              ) : (
                <span className="text-st-caption text-ink-secondary tabular-nums">
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
      {/* Punto 3 — en modo cocina **el encabezado también se va**: la regla del 20% de cabecera del
          sistema no aplica cuando la pantalla entera es el tablero, y el título («Órdenes», que la
          cocina ya sabe) le robaba alto a los carriles. */}
      {kitchenMode ? null : (
        <AdminPageHeader
          title="Órdenes"
          description="Bandeja de turno: prioriza ingresos nuevos y sigue cada pedido hasta su cierre."
        />
      )}

      {/* Una sola barra de trabajo para todo el shell (layout unificado, 2026-09-18): los tabs
          de estado son el filtro —carriles para los activos, lista para las cerradas—, y el
          local, los contadores y los controles del turno viven acá y no dentro de una vista. */}
      <OrdersToolbar
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        paymentFilter={paymentFilter}
        onPaymentChange={setPaymentFilter}
        lateOnly={lateOnly}
        onToggleLateOnly={() => setLateOnly((only) => !only)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        showLocationFilter={showLocationFilter}
        scopeLocationIds={scopeLocationIds}
        scopedLocations={scopedLocations}
        locationFilter={locationFilter}
        onLocationChange={setLocationFilter}
        counters={boardCounters}
        averagePrepMinutes={averagePrepMinutes}
        lastUpdatedAt={lastUpdatedAt}
        nowMs={nowMs}
        offline={error !== null}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          setAlertSoundEnabled(next);
        }}
        kitchenMode={kitchenMode}
        kitchenTab={kitchenTab}
        onKitchenTabChange={setKitchenTab}
        onToggleKitchenMode={() => setKitchenMode(!kitchenMode)}
        onRefresh={() => setRefreshToken((token) => token + 1)}
        showClearFilters={
          statusFilter !== "all" ||
          typeFilter !== "all" ||
          locationFilter !== "all" ||
          searchQuery !== "" ||
          paymentFilter !== "all" ||
          lateOnly
        }
        onClearFilters={clearAllFilters}
      />

      {/* B3: lo que se anuncia por lector de pantalla cuando una comanda se pasa de tiempo. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="comandas-late-announcement">
        {lateAnnouncement ?? ""}
      </p>

      {/* B3: los programados para otro día no son trabajo del turno. El aviso queda informativo: el
          listado con rangos vive en /admin/history (sección Historial), no en esta pantalla. */}
      {showBoard && scheduledForAnotherDay.length > 0 ? (
        <div
          data-testid="comandas-scheduled-notice"
          className="rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 text-st-body font-semibold text-ink"
        >
          {scheduledForAnotherDay.length === 1
            ? "1 comanda programada para otro día"
            : `${scheduledForAnotherDay.length} comandas programadas para otro día`}
          .
        </div>
      ) : null}

      {/* B2: qué se acaba de hacer. Sin esto, la fila cambia de estado y nadie sabe si funcionó. */}
      {actionNotice ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="orders-action-notice"
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

      {/* La vista del turno es el tablero de comandas (B3): la lista con chips, resumen y barra de
          filtros queda para el historial, donde sí hace falta. */}
      {!showBoard ? (
      <>
      <section
        aria-label="Resumen de órdenes"
        className="flex flex-col gap-3 rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 shadow-elevation-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md bg-surface-elevated text-brand">
            <ClipboardList aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary">Órdenes en vista</p>
            <p className="mt-0.5 text-st-body font-semibold text-ink">
              <span className="text-2xl leading-none">{ordersStatusCounts.total}</span>
              <span className="ml-2 text-ink-secondary">historial</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-st-body text-ink-secondary" aria-label="Estados en la vista actual">
          <span><strong className="text-ink">{ordersStatusCounts.new}</strong> nuevas</span>
          <span><strong className="text-ink">{ordersStatusCounts.preparing}</strong> preparando</span>
          <span><strong className="text-ink">{ordersStatusCounts.ready}</strong> listas</span>
          <span><strong className="text-ink">{ordersStatusCounts.closed}</strong> cerradas</span>
        </div>
      </section>

      </>
      ) : null}

      {/* B0: el spinner solo cuando todavía no hay nada que mostrar. Si la lista ya está, un
          refresco (o un poll de B1) no puede borrarla de la pantalla. */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-line-subtle border-t-brand" />
        </div>
      ) : null}

      {authRequired ? (
        <div className="rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text">
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

      {/* Sin lista que conservar, el error se explica entero, con el motivo real y la acción que sirve. */}
      {!authRequired && error && orders.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-stitch-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setRefreshToken((token) => token + 1)}
            >
              Reintentar
            </Button>
            {errorKind === "filters" ? (
              <Button variant="outline" className="min-h-11" onClick={clearAllFilters}>
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Con lista en pantalla, el fallo avisa que está vieja en vez de vaciarla (B0). */}
      {!authRequired && error && orders.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-stitch-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text sm:flex-row sm:items-center sm:justify-between">
          <span>
            No se pudo actualizar la bandeja.{" "}
            <span className="text-status-pending-text/80">
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
                <p className="mb-2 px-1 text-st-overline font-semibold uppercase tracking-wider text-ink-secondary">
                  {meta.title}
                  {meta.hint ? ` · ${meta.hint}` : ""} · {bucketOrders.length}
                </p>
                <div className="min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle shadow-elevation-1">
                  {bucketOrders.map(renderTicket)}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {!showBoard && !authRequired && orders.length > 0 && !groupByBucket ? (
        <div className="min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle shadow-elevation-1">
          {queueOrders.map(renderTicket)}
        </div>
      ) : null}
    </div>
  );
}

