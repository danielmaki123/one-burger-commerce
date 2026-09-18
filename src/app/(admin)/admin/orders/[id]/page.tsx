"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { formatPickupAddress } from "@/modules/locations/domain/location-rules";
import { PAYMENT_METHOD_LABELS } from "@/modules/orders/domain/order.types";
import { calculateOrderChange } from "@/modules/orders/domain/payment-change";
import { getAllowedNextStatuses } from "@/modules/orders/domain/order-workflows";

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
import OrderTicketButton from "../order-ticket-button";
import OrderInvoicePanel from "../order-invoice-panel";

import type { GetOrderResponse, OrderDetail, OrderStatus, OrderType } from "./order-detail-types";

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

/**
 * B2 — el flujo de estados **no se escribe acá**: sale de `order-workflows.ts`, que es la misma regla
 * que valida el servidor. Antes esta pantalla tenía su propia copia del mapa, así que podía ofrecer
 * botones que la API rechazaba (y de hecho B2 los necesitaba iguales en la bandeja).
 */
function allowedTransitionsFor(order: { type: OrderType; status: OrderStatus } | null) {
  return order ? getAllowedNextStatuses(order.type, order.status) : [];
}

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
  const { timezone: timeZone, currencyCode: businessCurrencyCode } = useBusinessSettings();
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
        // El servidor sabe por qué no se puede ver (A: "este pedido es de otra sucursal"): se
        // muestra su mensaje en vez de uno genérico que no explica nada.
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "No se pudo cargar el detalle de la orden.");
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

    setNextStatus(allowedTransitionsFor(order)[0] ?? "");
    setReviewMode(null);
  }, [order]);

  const allowedTransitions = useMemo(() => allowedTransitionsFor(order), [order]);

  const isNewOrder = order?.status === "new";
  const acceptStatus = useMemo(
    () => allowedTransitions.find((status) => status !== "cancelled") ?? "",
    [allowedTransitions],
  );
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-line-subtle border-t-brand" />
      </div>
    );
  }

  // La hora prometida y su semáforo: mismo criterio que la bandeja de órdenes.
  const pickupLabel = order
    ? describeAdminPickup({
        pickupTime: order.pickupTime,
        pickupScheduled: order.pickupScheduled,
        timeZone,
        nowMs,
      })
    : null;
  const pickupTiming = order
    ? resolveAdminPickupTiming({
        pickupTime: order.pickupTime,
        status: order.status,
        nowMs,
        timeZone,
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
        className="inline-flex items-center text-st-body text-ink-secondary hover:text-ink"
      >
        Volver a órdenes
      </Link>

      {authRequired ? (
        <div className="rounded-md border border-warning-strong/30 bg-warning p-4 text-st-body text-status-pending-text">
          Sesión admin requerida para consultar o actualizar órdenes.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground">
          {error}
        </div>
      ) : null}

      {!authRequired && !error && order ? (
        <>
          <section className="space-y-3 rounded-stitch-md border border-line-subtle bg-surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-ink">
                  {order.orderNumber}
                </h1>
                <p className="mt-1 text-st-body text-ink-secondary">
                  {ORDER_TYPE_LABELS[order.type]} · {order.customerName} · {order.customerWhatsapp}
                </p>
              </div>
              <AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
                {getAdminOrderStatusLabel(order.status)}
              </AdminStatusSolid>
            </div>

            {/* Bloque 10.4 del roadmap del POS (Fase 2): el ticket del cliente se reimprime desde acá,
                con los mismos datos que ya cargó la pantalla. */}
            <div className="flex flex-wrap items-center gap-2">
              <OrderTicketButton order={order} />
            </div>

            {/* Factura simple (2026-09-18): el documento que se lleva el cliente. Lo emite quien cobra y
                queda congelado; el detalle solo lo muestra, lo emite y lo vuelve a imprimir. */}
            <section
              className="space-y-3 rounded-stitch-md border border-line-subtle bg-surface-card p-4"
              aria-label="Factura"
            >
              <h2 className="text-st-h3 text-ink">Factura</h2>
              <OrderInvoicePanel orderId={order.id} currency={currency} />
            </section>
            <p className="text-st-caption text-ink-secondary">
              Recibida {new Date(order.createdAt).toLocaleString()} ·{" "}
              <span className="font-mono font-semibold text-ink">
                {formatAdminElapsed(order.createdAt, nowMs)}
              </span>
            </p>

            {pickupLabel || (pickupTiming && pickupTiming.state !== "done" && pickupTiming.state !== "unknown") ? (
              <div className="flex flex-wrap items-center gap-2 rounded-stitch-md bg-surface-elevated px-3 py-2">
                {pickupLabel ? (
                  <span className="text-st-body font-semibold text-ink tabular-nums">
                    {pickupLabel}
                  </span>
                ) : null}
                {pickupTiming ? <AdminPickupTimingChip timing={pickupTiming} /> : null}
                {/* La caja necesita saber si preparar el vuelto (T11 y T12). */}
                <span className="rounded-full border border-line-subtle bg-surface-card px-2.5 py-1 text-st-caption font-semibold text-ink">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod ?? "cash"]}
                </span>
                {order.paidWithAmount !== null && order.paidWithAmount !== undefined ? (
                  <span className="rounded-full border border-line-subtle bg-surface-card px-2.5 py-1 text-st-caption font-semibold text-ink">
                    Paga con {formatCurrency(order.paidWithAmount, currency)}
                    {changeLabel ? ` · ${changeLabel}` : ""}
                  </span>
                ) : null}
                {/* PIN de retiro (T13): el cliente lo dicta acá para entregarle el pedido. */}
                {order.pickupPin ? (
                  <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 font-mono text-st-caption font-bold tracking-[0.18em] text-brand">
                    PIN {order.pickupPin}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/*
              TASK-304: los cobros registrados. Un pedido del checkout no tiene ninguno (se paga al
              retirar); una venta de mostrador sí, y la caja necesita ver con qué y en qué moneda
              pagó. El monto en otra moneda se muestra con **su código**, no con el símbolo del
              negocio: "C$3.00" por un cobro de US$3 sería un número falso.
            */}
            {order.payments && order.payments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-stitch-md border border-line-subtle bg-surface-card px-3 py-2">
                <span className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary">
                  Cobrado en el mostrador
                </span>
                {order.payments.map((payment) => {
                  const isBusinessCurrency =
                    payment.currency === null || payment.currency === businessCurrencyCode;

                  return (
                    <span
                      key={payment.id}
                      className="rounded-full border border-line-subtle bg-surface-elevated px-2.5 py-1 text-st-caption font-semibold tabular-nums text-ink"
                    >
                      {PAYMENT_METHOD_LABELS[payment.method]}{" "}
                      {isBusinessCurrency
                        ? formatCurrency(payment.amount, currency)
                        : `${payment.currency} ${payment.amount.toFixed(2)}`}
                    </span>
                  );
                })}
              </div>
            ) : null}

            {order.status === "cancelled" ? (
              <p className="rounded-stitch-md bg-danger px-3 py-2 text-st-body font-medium text-danger-foreground">
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
                              : "border-line-subtle bg-surface-card",
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
                          "text-st-body font-semibold",
                          state === "now" ? "text-brand-primary" : state === "pending" ? "text-ink-secondary/60" : "text-ink",
                        ].join(" ")}>
                          {getAdminOrderStatusLabel(step)}
                        </p>
                        {index === 0 ? (
                          <p className="font-mono text-st-caption text-ink-secondary">
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

          <section className="rounded-stitch-md border border-line-subtle bg-surface-card">
            {order.items.map((item) => (
              <div key={item.id} className="border-b border-line-subtle p-4 last:border-b-0">
                <div className="flex items-center justify-between">
                  <p className="text-st-body text-ink">
                    {item.quantity}x {item.productName}
                  </p>
                  <p className="text-st-body font-semibold text-ink">
                    {formatCurrency(item.lineTotal, currency)}
                  </p>
                </div>
                {item.packagingTotalAmount > 0 ? (
                  <p className="mt-1 text-st-caption text-ink-secondary">
                    Empaque: {formatCurrency(item.packagingUnitAmount, currency)} x {item.packagingQuantity} = {formatCurrency(item.packagingTotalAmount, currency)}
                  </p>
                ) : null}
                {item.modifiers && item.modifiers.length > 0 ? (
                  <ul className="ml-6 mt-1 list-disc text-st-caption text-ink-secondary">
                    {item.modifiers.map((mod) => (
                      <li key={mod.id}>
                        {mod.name}
                        {mod.priceDelta > 0 ? ` (+${formatCurrency(mod.priceDelta, currency)})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.notes ? (
                  <p className="mt-2 w-fit rounded-stitch-md bg-surface-low px-2.5 py-1.5 text-st-caption font-medium text-ink">
                    Nota: {item.notes}
                  </p>
                ) : null}
              </div>
            ))}

            <div className="space-y-1 border-t border-line-subtle p-4 text-st-body">
              <div className="flex justify-between text-ink-secondary">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Descuento</span>
                <span>-{formatCurrency(order.discount, currency)}</span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Empaque</span>
                <span>{formatCurrency(order.packagingAmount, currency)}</span>
              </div>
              {order.type === "delivery" ? (
                <div className="flex justify-between text-ink-secondary">
                  <span>Envío</span>
                  <span>{formatCurrency(order.deliveryFeeAmount, currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-secondary">
                <span>Propina</span>
                <span>
                  {order.tipAmount > 0
                    ? `${formatCurrency(order.tipAmount, currency)}${order.tipRate ? ` (${order.tipRate}%)` : ""}`
                    : formatCurrency(0, currency)}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold text-ink">
                <span>Total</span>
                <span>{formatCurrency(order.total, currency)}</span>
              </div>
            </div>
          </section>

          {/* Local del pedido (T8 fase 7): con más de una sucursal, dos pedidos del mismo
              tipo salen de cocinas distintas. Se muestra siempre que el servidor pudo
              resolverlo, con la dirección para poder ubicarlo. */}
          {order.pickupLocation ? (
            <section className="space-y-3 rounded-stitch-md border border-line-subtle bg-surface-card p-4">
              <h2 className="text-lg font-semibold text-ink">Punto de retiro</h2>
              <div className="grid grid-cols-1 gap-2 text-st-body">
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Local</span>
                  <span className="font-medium text-ink">
                    {order.pickupLocation.name}
                  </span>
                </div>
                {pickupAddress ? (
                  <div className="flex justify-between">
                    <span className="text-ink-secondary">Dirección</span>
                    <span className="text-right font-medium text-ink">
                      {pickupAddress}
                    </span>
                  </div>
                ) : null}
                {order.pickupLocation.mapsUrl ? (
                  <a
                    href={order.pickupLocation.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-11 text-st-body font-medium text-brand-primary hover:underline"
                  >
                    Ver en mapa
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          {order.type === "delivery" ? (
            <section className="space-y-3 rounded-stitch-md border border-line-subtle bg-surface-card p-4">
              <h2 className="text-lg font-semibold text-ink">
                Información de entrega
              </h2>
              <div className="grid grid-cols-1 gap-2 text-st-body">
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Zona</span>
                  <span className="font-medium text-ink">
                    {order.deliveryZoneName ?? order.deliveryZoneId ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Dirección</span>
                  <span className="text-right font-medium text-ink">
                    {order.address ?? "—"}
                  </span>
                </div>
                {order.deliveryNotes ? (
                  <div className="flex justify-between">
                    <span className="text-ink-secondary">Notas</span>
                    <span className="text-right font-medium text-ink">
                      {order.deliveryNotes}
                    </span>
                  </div>
                ) : null}
                {order.customerLat != null && order.customerLng != null ? (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-ink-secondary">Coordenadas GPS</span>
                      <a
                        href={`https://www.google.com/maps?q=${order.customerLat},${order.customerLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-primary hover:underline"
                      >
                        Ver en mapa
                      </a>
                    </div>
                    <p className="text-st-caption text-ink-secondary">
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
                    <span className="text-ink-secondary">GPS</span>
                    <span className="text-right text-ink-secondary">
                      GPS no capturado
                    </span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-stitch-md border border-line-subtle bg-surface-card p-4">
            <h2 className="text-lg font-semibold text-ink">
              Actualizar estado
            </h2>

            {allowedTransitions.length === 0 ? (
              <p className="text-st-body text-ink-secondary">
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

                    <p className="text-st-body text-ink-secondary">
                      Usa estas acciones rápidas para confirmar o rechazar pedidos nuevos sin abrir opciones avanzadas.
                    </p>

                    {reviewMode === "reject" ? (
                      <div className="space-y-3 rounded-stitch-md border border-danger-strong/30 bg-danger p-3">
                        <div className="space-y-1">
                          <p className="text-st-body font-medium text-danger-foreground">
                            Confirmar rechazo
                          </p>
                          <p className="text-st-caption text-danger-foreground">
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

                    <details className="rounded-stitch-md border border-line-subtle bg-surface-low px-3 py-2">
                      <summary className="cursor-pointer list-none text-st-body font-medium text-ink">
                        Opciones avanzadas
                      </summary>
                      <div className="mt-3 space-y-3">
                        <select
                          value={nextStatus}
                          onChange={(event) => {
                            setNextStatus(event.target.value as OrderStatus);
                            setReviewMode(null);
                          }}
                          className="h-10 w-full rounded-md border border-line-subtle bg-surface-card px-3 text-st-body focus:border-line-subtle focus:outline-none"
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
                          <div className="rounded-md border border-warning-strong/30 bg-warning p-3 text-st-body text-status-pending-text">
                            <p>
                              Confirmar cambio:{" "}
                              <strong>{getAdminOrderStatusLabel(order.status)}</strong> a{" "}
                              <strong>{getAdminOrderStatusLabel(nextStatus)}</strong>.
                            </p>
                            {isCancelling ? (
                              <p className="mt-1 text-st-caption text-status-pending-text">
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
                      className="h-10 w-full rounded-md border border-line-subtle bg-surface-card px-3 text-st-body focus:border-line-subtle focus:outline-none"
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
                      <p className="text-st-caption text-ink-secondary">
                        Esta acción marcará el pedido como cancelado. No borra el historial.
                      </p>
                    ) : null}

                    {reviewMode === "manual" ? (
                      <div className="rounded-md border border-warning-strong/30 bg-warning p-3 text-st-body text-status-pending-text">
                        <p>
                          Confirmar cambio:{" "}
                          <strong>{getAdminOrderStatusLabel(order.status)}</strong> a{" "}
                          <strong>{getAdminOrderStatusLabel(nextStatus)}</strong>.
                        </p>
                        {isCancelling ? (
                          <p className="mt-1 text-st-caption text-status-pending-text">
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
                  <p className="text-st-body text-danger-foreground">{statusError}</p>
                ) : null}
              </>
            )}
          </section>

          {advanceStatus ? (
            <div className="fixed inset-x-0 bottom-14 z-40 border-t border-line-subtle bg-canvas/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:bottom-0">
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
