"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  formatPickupAddress,
  type PickupLocation,
} from "@/modules/locations/domain/location-rules";
import {
  PAYMENT_METHOD_LABELS,
  type OrderPaymentMethod,
} from "@/modules/orders/domain/order.types";
import { calculateOrderChange } from "@/modules/orders/domain/payment-change";

import {
  AdminPickupTimingChip,
  AdminStatusSolid,
  formatAdminElapsed,
  getAdminOrderSolidStatus,
} from "../../_components/admin-operational-ui";
import {
  describeAdminPickup,
  resolveAdminPickupTiming,
} from "../../_components/admin-pickup-timing";

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

type OrderModifier = {
  id: string;
  modifierOptionId: string;
  name: string;
  priceDelta: number;
};

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  packagingUnitAmount: number;
  packagingQuantity: number;
  packagingTotalAmount: number;
  lineTotal: number;
  notes: string | null;
  modifiers: OrderModifier[];
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  customerWhatsapp: string;
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  deliveryFeeStatus?: string | null;
  tipAmount: number;
  tipRate?: number | null;
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  address?: string | null;
  deliveryNotes?: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: string | null;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  /** Forma de pago declarada por el cliente (T11). */
  paymentMethod?: OrderPaymentMethod | null;
  /** Con cuánto paga el cliente cuando es efectivo (T12). */
  paidWithAmount?: number | null;
  /** PIN de retiro para dictar en caja (T13). */
  pickupPin?: string | null;
  /** Local del que sale el pedido (T8 fase 7); `null` si el local ya no existe. */
  pickupLocation?: PickupLocation | null;
};

type GetOrderResponse = {
  data: OrderDetail;
};

type ReviewMode = "manual" | "reject" | null;

// Recorrido visible de la orden por tipo (admin v2).
const ORDER_JOURNEY: Record<OrderType, OrderStatus[]> = {
  delivery: ["new", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "closed"],
  pickup: ["new", "confirmed", "preparing", "ready_for_pickup", "picked_up", "closed"],
  table: ["new", "accepted", "preparing", "served", "closed"],
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Delivery",
  pickup: "Retiro",
  table: "Mesa",
};

const STATUS_TRANSITIONS: Record<OrderType, Record<OrderStatus, OrderStatus[]>> =
  {
    delivery: {
      new: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["out_for_delivery"],
      out_for_delivery: ["delivered"],
      delivered: ["closed"],
      closed: [],
      ready_for_pickup: [],
      picked_up: [],
      accepted: [],
      served: [],
      cancelled: [],
    },
    pickup: {
      new: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready_for_pickup", "cancelled"],
      ready_for_pickup: ["picked_up"],
      picked_up: ["closed"],
      closed: [],
      ready: [],
      out_for_delivery: [],
      delivered: [],
      accepted: [],
      served: [],
      cancelled: [],
    },
    table: {
      new: ["accepted", "cancelled"],
      accepted: ["preparing"],
      preparing: ["served", "cancelled"],
      served: ["closed"],
      closed: [],
      confirmed: [],
      ready: [],
      out_for_delivery: [],
      delivered: [],
      ready_for_pickup: [],
      picked_up: [],
      cancelled: [],
    },
  };

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = useMemo(() => String(params.id || ""), [params.id]);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>(null);
  const currency = useCurrencyFormat();
  const { timezone: timeZone } = useBusinessSettings();
  const isCancelling = nextStatus === "cancelled";

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);

    try {
      const response = await fetch(`/api/admin/orders/${id}`);
      if (response.status === 401) {
        setAuthRequired(true);
        setOrder(null);
        return;
      }
      if (!response.ok) {
        setError("No se pudo cargar el detalle de la orden.");
        setOrder(null);
        return;
      }

      const payload = (await response.json()) as GetOrderResponse;
      setOrder(payload.data);
      setReviewMode(null);
    } catch {
      setError("No se pudo cargar el detalle de la orden.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("ID de orden inválido.");
      return;
    }
    void loadOrder();
  }, [id, loadOrder]);

  useEffect(() => {
    if (!order) {
      setNextStatus("");
      return;
    }

    const allowed = STATUS_TRANSITIONS[order.type]?.[order.status] ?? [];
    setNextStatus(allowed[0] ?? "");
    setReviewMode(null);
  }, [order]);

  const allowedTransitions = useMemo(() => {
    if (!order) return [];
    return STATUS_TRANSITIONS[order.type]?.[order.status] ?? [];
  }, [order]);

  const isNewOrder = order?.status === "new";
  const acceptStatus = useMemo(() => {
    if (!order) return "";
    return (
      (STATUS_TRANSITIONS[order.type]?.[order.status] ?? []).find(
        (status) => status !== "cancelled",
      ) ?? ""
    );
  }, [order]);
  const canReject = allowedTransitions.includes("cancelled");

  // Reloj del turno para "hace N min".
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Siguiente paso operativo (excluye cancelación) para la barra de acción fija.
  const advanceStatus = useMemo(() => {
    return allowedTransitions.find((status) => status !== "cancelled") ?? "";
  }, [allowedTransitions]);

  const journey = order ? ORDER_JOURNEY[order.type] : [];
  const journeyIndex = order ? journey.indexOf(order.status) : -1;

  const submitStatusUpdate = async (targetStatus?: OrderStatus) => {
    if (!order) return;

    const statusToApply = targetStatus ?? nextStatus;
    if (!statusToApply) return;

    if (statusToApply === "cancelled" && !note.trim()) {
      setStatusError("Debes ingresar una nota para cancelar el pedido.");
      return;
    }

    setSubmitting(true);
    setStatusError(null);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusToApply,
          note: note.trim() || undefined,
        }),
      });

      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? ((payload as { error?: { message?: string } }).error?.message ??
              "No se pudo actualizar el estado.")
            : "No se pudo actualizar el estado.";
        setStatusError(message);
        return;
      }

      await loadOrder();
      setNote("");
      setReviewMode(null);
    } catch {
      setStatusError("No se pudo actualizar el estado.");
    } finally {
      setSubmitting(false);
    }
  };

  const startStatusReview = () => {
    if (!nextStatus) return;
    if (isCancelling && !note.trim()) {
      setStatusError("Debes ingresar una nota para cancelar el pedido.");
      return;
    }

    setStatusError(null);
    setReviewMode("manual");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
      </div>
    );
  }

  // La hora prometida y su semáforo: mismo criterio que la bandeja de órdenes.
  const pickupLabel = order
    ? describeAdminPickup({
        pickupTime: order.pickupTime,
        pickupScheduled: order.pickupScheduled,
        timeZone,
      })
    : null;
  const pickupTiming = order
    ? resolveAdminPickupTiming({
        pickupTime: order.pickupTime,
        status: order.status,
        nowMs,
      })
    : null;
  /** Vuelto del efectivo (T12): se deriva del monto y el total que ve la caja. */
  const orderChange = order
    ? calculateOrderChange({
        paidWithAmount: order.paidWithAmount ?? null,
        total: order.total,
      })
    : null;
  const changeLabel =
    orderChange === null || orderChange === 0
      ? orderChange === 0
        ? "Sin cambio"
        : null
      : `Cambio ${formatCurrency(orderChange, currency)}`;
  /** Dirección del local (T8 fase 7), ya armada en una línea. */
  const pickupAddress = formatPickupAddress(order?.pickupLocation ?? null);

  return (
    <div className="space-y-6 pb-40 md:pb-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        Volver a órdenes
      </Link>

      {authRequired ? (
        <div className="rounded-md border border-warning-strong/30 bg-warning p-4 text-sm text-warning-foreground">
          Sesión admin requerida para consultar o actualizar órdenes.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger-strong/30 bg-danger p-4 text-sm text-danger-foreground">
          {error}
        </div>
      ) : null}

      {!authRequired && !error && order ? (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {order.orderNumber}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ORDER_TYPE_LABELS[order.type]} · {order.customerName} · {order.customerWhatsapp}
                </p>
              </div>
              <AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
                {getAdminOrderStatusLabel(order.status)}
              </AdminStatusSolid>
            </div>
            <p className="text-xs text-muted-foreground">
              Recibida {new Date(order.createdAt).toLocaleString()} ·{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatAdminElapsed(order.createdAt, nowMs)}
              </span>
            </p>

            {pickupLabel || (pickupTiming && pickupTiming.state !== "done" && pickupTiming.state !== "unknown") ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/60 px-3 py-2">
                {pickupLabel ? (
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {pickupLabel}
                  </span>
                ) : null}
                {pickupTiming ? <AdminPickupTimingChip timing={pickupTiming} /> : null}
                {/* La caja necesita saber si preparar el vuelto (T11 y T12). */}
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod ?? "cash"]}
                </span>
                {order.paidWithAmount !== null && order.paidWithAmount !== undefined ? (
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
                    Paga con {formatCurrency(order.paidWithAmount, currency)}
                    {changeLabel ? ` · ${changeLabel}` : ""}
                  </span>
                ) : null}
                {/* PIN de retiro (T13): el cliente lo dicta acá para entregarle el pedido. */}
                {order.pickupPin ? (
                  <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.18em] text-brand">
                    PIN {order.pickupPin}
                  </span>
                ) : null}
              </div>
            ) : null}

            {order.status === "cancelled" ? (
              <p className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-danger-foreground">
                Orden cancelada. El historial se conserva.
              </p>
            ) : journeyIndex >= 0 ? (
              <ol aria-label="Recorrido de la orden" className="space-y-0 pt-1">
                {journey.map((step, index) => {
                  const state =
                    index < journeyIndex ? "done" : index === journeyIndex ? "now" : "pending";
                  return (
                    <li key={step} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
                      {index < journey.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[0.6875rem] top-6 h-full w-0.5 ${state === "done" ? "bg-status-lista" : "bg-border"}`}
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={[
                          "z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2",
                          state === "done"
                            ? "border-status-lista bg-status-lista text-white"
                            : state === "now"
                              ? "border-brand bg-brand text-white shadow-[0_0_0_4px_var(--accent)]"
                              : "border-border bg-card",
                        ].join(" ")}
                      >
                        {state === "done" ? (
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </span>
                      <div className="pb-4">
                        <p className={[
                          "text-sm font-semibold",
                          state === "now" ? "text-brand-strong" : state === "pending" ? "text-muted-foreground/60" : "text-foreground",
                        ].join(" ")}>
                          {getAdminOrderStatusLabel(step)}
                        </p>
                        {index === 0 ? (
                          <p className="font-mono text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card">
            {order.items.map((item) => (
              <div key={item.id} className="border-b border-border p-4 last:border-b-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">
                    {item.quantity}x {item.productName}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(item.lineTotal, currency)}
                  </p>
                </div>
                {item.packagingTotalAmount > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Empaque: {formatCurrency(item.packagingUnitAmount, currency)} x {item.packagingQuantity} = {formatCurrency(item.packagingTotalAmount, currency)}
                  </p>
                ) : null}
                {item.modifiers && item.modifiers.length > 0 ? (
                  <ul className="ml-6 mt-1 list-disc text-xs text-muted-foreground">
                    {item.modifiers.map((mod) => (
                      <li key={mod.id}>
                        {mod.name}
                        {mod.priceDelta > 0 ? ` (+${formatCurrency(mod.priceDelta, currency)})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.notes ? (
                  <p className="mt-2 w-fit rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground">
                    Nota: {item.notes}
                  </p>
                ) : null}
              </div>
            ))}

            <div className="space-y-1 border-t border-border p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Descuento</span>
                <span>-{formatCurrency(order.discount, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Empaque</span>
                <span>{formatCurrency(order.packagingAmount, currency)}</span>
              </div>
              {order.type === "delivery" ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Envío</span>
                  <span>{formatCurrency(order.deliveryFeeAmount, currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-muted-foreground">
                <span>Propina</span>
                <span>
                  {order.tipAmount > 0
                    ? `${formatCurrency(order.tipAmount, currency)}${order.tipRate ? ` (${order.tipRate}%)` : ""}`
                    : formatCurrency(0, currency)}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(order.total, currency)}</span>
              </div>
            </div>
          </section>

          {/* Local del pedido (T8 fase 7): con más de una sucursal, dos pedidos del mismo
              tipo salen de cocinas distintas. Se muestra siempre que el servidor pudo
              resolverlo, con la dirección para poder ubicarlo. */}
          {order.pickupLocation ? (
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-foreground">Punto de retiro</h2>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Local</span>
                  <span className="font-medium text-foreground">
                    {order.pickupLocation.name}
                  </span>
                </div>
                {pickupAddress ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dirección</span>
                    <span className="text-right font-medium text-foreground">
                      {pickupAddress}
                    </span>
                  </div>
                ) : null}
                {order.pickupLocation.mapsUrl ? (
                  <a
                    href={order.pickupLocation.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-11 text-sm font-medium text-brand hover:underline"
                  >
                    Ver en mapa
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          {order.type === "delivery" ? (
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-foreground">
                Información de entrega
              </h2>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zona</span>
                  <span className="font-medium text-foreground">
                    {order.deliveryZoneName ?? order.deliveryZoneId ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dirección</span>
                  <span className="text-right font-medium text-foreground">
                    {order.address ?? "—"}
                  </span>
                </div>
                {order.deliveryNotes ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notas</span>
                    <span className="text-right font-medium text-foreground">
                      {order.deliveryNotes}
                    </span>
                  </div>
                ) : null}
                {order.customerLat != null && order.customerLng != null ? (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coordenadas GPS</span>
                      <a
                        href={`https://www.google.com/maps?q=${order.customerLat},${order.customerLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand hover:underline"
                      >
                        Ver en mapa
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lat: {order.customerLat.toFixed(6)}, Lng: {order.customerLng.toFixed(6)}
                      {order.geoAccuracy != null
                        ? ` · Precisión: ${order.geoAccuracy.toFixed(1)}m`
                        : null}
                      {order.geoCapturedAt
                        ? ` · Capturado: ${new Date(order.geoCapturedAt).toLocaleString()}`
                        : null}
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GPS</span>
                    <span className="text-right text-muted-foreground">
                      GPS no capturado
                    </span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-foreground">
              Actualizar estado
            </h2>

            {allowedTransitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay transiciones disponibles para el estado actual.
              </p>
            ) : (
              <>
                {isNewOrder ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        onClick={() => void submitStatusUpdate(acceptStatus as OrderStatus)}
                        disabled={!acceptStatus || submitting}
                        className="w-full"
                      >
                        {submitting && reviewMode !== "reject"
                          ? "Aceptando..."
                          : "Aceptar pedido"}
                      </Button>

                      {canReject ? (
                        <Button
                          variant="danger"
                          className="w-full"
                          onClick={() => {
                            setNextStatus("cancelled");
                            setStatusError(null);
                            setReviewMode("reject");
                          }}
                          disabled={submitting}
                        >
                          Rechazar pedido
                        </Button>
                      ) : null}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Usa estas acciones rápidas para confirmar o rechazar pedidos nuevos sin abrir opciones avanzadas.
                    </p>

                    {reviewMode === "reject" ? (
                      <div className="space-y-3 rounded-lg border border-danger-strong/30 bg-danger p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-danger-foreground">
                            Confirmar rechazo
                          </p>
                          <p className="text-xs text-danger-foreground">
                            Esta acción marcará el pedido como cancelado y no borra el historial.
                          </p>
                        </div>

                        <Input
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Motivo de rechazo (obligatorio)"
                        />

                        <div className="flex gap-2">
                          <Button
                            variant="danger"
                            onClick={() => void submitStatusUpdate("cancelled")}
                            disabled={submitting}
                          >
                            {submitting ? "Rechazando..." : "Confirmar rechazo"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReviewMode(null);
                              setNote("");
                              setStatusError(null);
                            }}
                            disabled={submitting}
                          >
                            Volver
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <details className="rounded-lg border border-border bg-muted px-3 py-2">
                      <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                        Opciones avanzadas
                      </summary>
                      <div className="mt-3 space-y-3">
                        <select
                          value={nextStatus}
                          onChange={(event) => {
                            setNextStatus(event.target.value as OrderStatus);
                            setReviewMode(null);
                          }}
                          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus:border-border focus:outline-none"
                        >
                          {allowedTransitions.map((status) => (
                            <option key={status} value={status}>
                              {getAdminOrderStatusLabel(status)}
                            </option>
                          ))}
                        </select>

                        <Input
                          value={note}
                          onChange={(event) => {
                            setNote(event.target.value);
                            setReviewMode(null);
                          }}
                          placeholder={
                            isCancelling
                              ? "Motivo de cancelación (obligatorio)"
                              : "Nota de cambio (opcional)"
                          }
                        />

                        {reviewMode === "manual" ? (
                          <div className="rounded-md border border-warning-strong/30 bg-warning p-3 text-sm text-warning-foreground">
                            <p>
                              Confirmar cambio:{" "}
                              <strong>{getAdminOrderStatusLabel(order.status)}</strong> a{" "}
                              <strong>{getAdminOrderStatusLabel(nextStatus)}</strong>.
                            </p>
                            {isCancelling ? (
                              <p className="mt-1 text-xs text-warning-foreground">
                                La cancelación quedará registrada con la nota ingresada.
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {reviewMode === "manual" ? (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => void submitStatusUpdate()}
                              disabled={!nextStatus || submitting}
                            >
                              {submitting ? "Actualizando..." : "Confirmar cambio"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setReviewMode(null)}
                              disabled={submitting}
                            >
                              Volver
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={startStatusReview}
                            disabled={!nextStatus || submitting}
                          >
                            Revisar cambio manual
                          </Button>
                        )}
                      </div>
                    </details>
                  </div>
                ) : (
                  <>
                    <select
                      value={nextStatus}
                      onChange={(event) => {
                        setNextStatus(event.target.value as OrderStatus);
                        setReviewMode(null);
                      }}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus:border-border focus:outline-none"
                    >
                      {allowedTransitions.map((status) => (
                        <option key={status} value={status}>
                          {getAdminOrderStatusLabel(status)}
                        </option>
                      ))}
                    </select>

                    {allowedTransitions.includes("cancelled") ? (
                      <Button
                        variant="outline"
                        className="w-full border-danger-strong/40 text-danger-foreground hover:bg-danger"
                        onClick={() => {
                          setNextStatus("cancelled");
                          setReviewMode(null);
                        }}
                      >
                        Cancelar pedido
                      </Button>
                    ) : null}

                    <Input
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        setReviewMode(null);
                      }}
                      placeholder={
                        isCancelling
                          ? "Motivo de cancelación (obligatorio)"
                          : "Nota de cambio (opcional)"
                      }
                    />

                    {allowedTransitions.includes("cancelled") ? (
                      <p className="text-xs text-muted-foreground">
                        Esta acción marcará el pedido como cancelado. No borra el historial.
                      </p>
                    ) : null}

                    {reviewMode === "manual" ? (
                      <div className="rounded-md border border-warning-strong/30 bg-warning p-3 text-sm text-warning-foreground">
                        <p>
                          Confirmar cambio:{" "}
                          <strong>{getAdminOrderStatusLabel(order.status)}</strong> a{" "}
                          <strong>{getAdminOrderStatusLabel(nextStatus)}</strong>.
                        </p>
                        {isCancelling ? (
                          <p className="mt-1 text-xs text-warning-foreground">
                            La cancelación quedará registrada con la nota ingresada.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {reviewMode === "manual" ? (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => void submitStatusUpdate()}
                          disabled={!nextStatus || submitting}
                        >
                          {submitting ? "Actualizando..." : "Confirmar cambio"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setReviewMode(null)}
                          disabled={submitting}
                        >
                          Volver
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={startStatusReview}
                        disabled={!nextStatus || submitting}
                      >
                        Revisar cambio
                      </Button>
                    )}
                  </>
                )}

                {statusError ? (
                  <p className="text-sm text-danger-foreground">{statusError}</p>
                ) : null}
              </>
            )}
          </section>

          {advanceStatus ? (
            <div className="fixed inset-x-0 bottom-14 z-40 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:bottom-0">
              <Button
                className="min-h-12 w-full text-base font-semibold"
                onClick={() => void submitStatusUpdate(advanceStatus as OrderStatus)}
                disabled={submitting}
              >
                {submitting
                  ? "Actualizando..."
                  : isNewOrder
                    ? "Aceptar pedido"
                    : `Avanzar a ${getAdminOrderStatusLabel(advanceStatus)}`}
              </Button>
            </div>
          ) : null}

        </>
      ) : null}
    </div>
  );
}
