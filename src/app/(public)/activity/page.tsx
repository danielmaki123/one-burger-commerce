"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  getOrderStatusProgress,
  getReservationStatusProgress,
  ORDER_PROGRESS_STEPS,
  RESERVATION_PROGRESS_STEPS,
} from "@/shared/lib/activity-status";
import {
  ACTIVE_ORDER_STATUS,
  ACTIVE_RESERVATION_STATUS,
  refreshActivity,
  type TrackedOrder,
  type TrackedReservation,
} from "@/shared/lib/activity-refresh";
import {
  clearDeviceOrders,
  markDeviceOrderStale,
  readDeviceOrders,
  type DeviceOrderRef,
} from "@/shared/lib/device-orders";
import {
  clearDeviceReservations,
  markDeviceReservationStale,
  readDeviceReservations,
  type DeviceReservationRef,
} from "@/shared/lib/device-reservations";
import { formatCurrency } from "@/shared/lib/format-currency";
import { syncTrackedOrderToDeviceOrders } from "@/shared/lib/order-tracking-sync";
import { syncTrackedReservationToDeviceReservations } from "@/shared/lib/reservation-tracking-sync";
import { Button } from "@/shared/ui/button";
import { StatusProgress } from "@/shared/ui/status-progress";
import { useOrderTrackingSession } from "../_components/order-tracking-session";

type ActivityTab = "orders" | "reservations";

function splitByStatus<T extends { status: string }>(items: T[], activeStatuses: Set<string>) {
  const active: T[] = [];
  const history: T[] = [];
  for (const item of items) {
    if (activeStatuses.has(item.status)) active.push(item);
    else history.push(item);
  }
  return { active, history };
}

function formatOrderType(type: DeviceOrderRef["type"]): string {
  if (type === "table") return "Mesa";
  if (type === "pickup") return "Para llevar";
  return "Delivery";
}

function formatActivityDateTime(value: string) {
  return new Date(value).toLocaleString("es-NI", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatHistoryTime(value: string) {
  return new Date(value).toLocaleTimeString("es-NI", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHistoryMeta(value: string, parts: string[]) {
  return ["Hoy", ...parts].join(" · ");
}

function reservationKey(reservation: DeviceReservationRef) {
  return [
    reservation.reservationNumber ?? "",
    reservation.createdAt ?? "",
    reservation.date,
    reservation.time,
    reservation.partySize,
    reservation.tableLabel ?? "",
  ].join("|");
}

function getReservationDateTime(reservation: DeviceReservationRef) {
  return reservation.updatedAt ?? reservation.createdAt ?? `${reservation.date}T${reservation.time}:00.000Z`;
}

export default function CustomerActivityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>("orders");
  const [orders, setOrders] = useState<DeviceOrderRef[]>([]);
  const [reservations, setReservations] = useState<DeviceReservationRef[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [selectedReservationKey, setSelectedReservationKey] = useState<string | null>(null);
  const { trackingWhatsapp } = useOrderTrackingSession();

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "reservations") setActiveTab("reservations");
    if (tab === "orders") setActiveTab("orders");
    setOrders(readDeviceOrders().orders);
    setReservations(readDeviceReservations().reservations);
  }, []);

  const orderSections = useMemo(() => splitByStatus(orders, ACTIVE_ORDER_STATUS), [orders]);
  const reservationSections = useMemo(
    () => splitByStatus(reservations, ACTIVE_RESERVATION_STATUS),
    [reservations],
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderNumber === selectedOrderNumber) ?? null,
    [orders, selectedOrderNumber],
  );
  const selectedReservation = useMemo(
    () =>
      reservations.find((reservation) => reservationKey(reservation) === selectedReservationKey) ??
      null,
    [reservations, selectedReservationKey],
  );

  const lastUpdateText = useMemo(() => {
    const timestamps = [
      ...orders.map((order) => order.lastCheckedAt ?? order.updatedAt),
      ...reservations.map((reservation) => reservation.lastCheckedAt ?? reservation.updatedAt),
    ]
      .map((value) => (value ? new Date(value).getTime() : Number.NaN))
      .filter(Number.isFinite);

    if (timestamps.length === 0) return "Sin actividad guardada";
    return `Actualizado ${formatActivityDateTime(new Date(Math.max(...timestamps)).toISOString())}`;
  }, [orders, reservations]);

  const hasRefreshableActivity =
    orderSections.active.length > 0 ||
    reservationSections.active.some((reservation) =>
      Boolean(reservation.reservationNumber && reservation.reservationLookupToken),
    );

  function handleTabChange(tab: ActivityTab) {
    setActiveTab(tab);
    setSelectedOrderNumber(null);
    setSelectedReservationKey(null);
    const nextUrl = tab === "orders" ? "/activity?tab=orders" : "/activity?tab=reservations";
    window.history.replaceState(null, "", nextUrl);
  }

  async function trackOrder(order: DeviceOrderRef, whatsapp?: string): Promise<TrackedOrder> {
    const requestPayload = order.orderLookupToken
      ? {
          orderNumber: order.orderNumber,
          orderLookupToken: order.orderLookupToken,
        }
      : {
          orderNumber: order.orderNumber,
          customerWhatsapp: whatsapp,
        };

    const response = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) throw new Error("ORDER_TRACK_FAILED");

    const responsePayload = (await response.json()) as { data: TrackedOrder };
    return responsePayload.data;
  }

  async function trackReservation(reservation: DeviceReservationRef): Promise<TrackedReservation> {
    const response = await fetch("/api/reservations/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationNumber: reservation.reservationNumber,
        reservationLookupToken: reservation.reservationLookupToken,
      }),
    });

    if (!response.ok) throw new Error("RESERVATION_TRACK_FAILED");

    const payload = (await response.json()) as { data: TrackedReservation };
    return payload.data;
  }

  async function handleRefreshClick() {
    if (!hasRefreshableActivity || isRefreshing) return;

    setIsRefreshing(true);
    setRefreshFeedback(null);
    const result = await refreshActivity(
      {
        orders,
        reservations,
        trackingWhatsapp: trackingWhatsapp.trim(),
      },
      {
        getCheckedAt: () => new Date().toISOString(),
        markOrderStale: (orderNumber, stale) => markDeviceOrderStale(orderNumber, stale),
        markReservationStale: (reservation, stale) =>
          markDeviceReservationStale(reservation, stale),
        syncOrder: (tracked, checkedAt) => syncTrackedOrderToDeviceOrders(tracked, { checkedAt }),
        syncReservation: (tracked, reservationLookupToken, checkedAt) =>
          syncTrackedReservationToDeviceReservations(tracked, {
            reservationLookupToken,
            checkedAt,
          }),
        trackOrder,
        trackReservation,
      },
    );

    setOrders(readDeviceOrders().orders);
    setReservations(readDeviceReservations().reservations);
    setRefreshFeedback(
      result.needsWhatsappPrompt
        ? "Algunas actividades necesitan consulta manual para actualizarse."
        : result.feedback,
    );
    setIsRefreshing(false);
  }

  function handleClearOrders() {
    clearDeviceOrders();
    setOrders([]);
    setSelectedOrderNumber(null);
    setRefreshFeedback("Quitamos los pedidos guardados en este dispositivo.");
  }

  function handleClearReservations() {
    clearDeviceReservations();
    setReservations([]);
    setSelectedReservationKey(null);
    setRefreshFeedback("Quitamos las reservas guardadas en este dispositivo.");
  }

  if (selectedOrder) {
    return (
      <HistoryShell>
        <OrderDetailView
          order={selectedOrder}
          onBack={() => setSelectedOrderNumber(null)}
        />
      </HistoryShell>
    );
  }

  if (selectedReservation) {
    return (
      <HistoryShell>
        <ReservationDetailView
          reservation={selectedReservation}
          onBack={() => setSelectedReservationKey(null)}
        />
      </HistoryShell>
    );
  }

  return (
    <HistoryShell>
      <section className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1
              className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Historial
            </h1>
            <p className="max-w-xl text-sm leading-6 text-foreground">
              Revisá tus pedidos y reservas recientes.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-cream"
            onClick={() => void handleRefreshClick()}
            disabled={!hasRefreshableActivity || isRefreshing}
            aria-label="Actualizar historial"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            >
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            {isRefreshing ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>

        <div className="rounded-[22px] border border-border bg-card/70 p-1 shadow-[0_18px_45px_-38px_rgba(41,37,36,0.55)]">
          <div className="grid grid-cols-2 gap-1">
            <TabButton
              isActive={activeTab === "orders"}
              onClick={() => handleTabChange("orders")}
            >
              Pedidos
            </TabButton>
            <TabButton
              isActive={activeTab === "reservations"}
              onClick={() => handleTabChange("reservations")}
            >
              Reservas
            </TabButton>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-border pb-3 text-xs text-muted-foreground">
          <span>{lastUpdateText}</span>
          {refreshFeedback ? <span className="text-foreground">{refreshFeedback}</span> : null}
        </div>
      </section>

      {activeTab === "orders" ? (
        <section className="space-y-5">
          <SectionHeading title="Pedidos recientes" />
          {orders.length === 0 ? (
            <EmptyState
              title="Aún no tenés pedidos"
              description="Cuando hagás un pedido, aparecerá aquí para que podás darle seguimiento."
              actionLabel="Ver menú"
              onAction={() => router.push("/menu")}
            />
          ) : (
            <div className="space-y-4">
              {[...orderSections.active, ...orderSections.history].map((order) => (
                <OrderHistoryCard
                  key={order.orderNumber}
                  order={order}
                  onOpen={() => setSelectedOrderNumber(order.orderNumber)}
                />
              ))}
            </div>
          )}
          <HistoryFooterAction
            label="¿No ves un pedido?"
            actionLabel="Consultar manualmente"
            onClick={() => router.push("/orders/track")}
          />
          <ClearLocalButton
            disabled={orders.length === 0}
            onClick={handleClearOrders}
          >
            Quitar pedidos de este dispositivo
          </ClearLocalButton>
        </section>
      ) : null}

      {activeTab === "reservations" ? (
        <section className="space-y-5">
          <SectionHeading title="Reservas próximas" />
          {reservations.length === 0 ? (
            <EmptyState
              title="Aún no tenés reservas"
              description="Tus próximas reservas aparecerán aquí."
              actionLabel="Reservar mesa"
              onAction={() => router.push("/reservations")}
            />
          ) : (
            <div className="space-y-4">
              {[...reservationSections.active, ...reservationSections.history].map((reservation) => (
                <ReservationHistoryCard
                  key={reservationKey(reservation)}
                  reservation={reservation}
                  onOpen={() => setSelectedReservationKey(reservationKey(reservation))}
                />
              ))}
            </div>
          )}
          <HistoryFooterAction
            label="¿No ves una reserva?"
            actionLabel="Reservar mesa"
            onClick={() => router.push("/reservations")}
          />
          <ClearLocalButton
            disabled={reservations.length === 0}
            onClick={handleClearReservations}
          >
            Quitar reservas de este dispositivo
          </ClearLocalButton>
        </section>
      ) : null}
    </HistoryShell>
  );
}

function HistoryShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(43,108,150,0.07),transparent_55%),linear-gradient(180deg,#fcfaf6_0%,#f4f2ec_100%)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-32 pt-6 sm:px-6 sm:pb-20 md:px-8">
        {children}
      </div>
    </main>
  );
}

function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-[18px] text-sm font-semibold transition-colors ${
        isActive ? "bg-brand text-brand-foreground shadow-sm" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold tracking-tight text-foreground">
      {title}
    </h2>
  );
}

function MiniSteps({
  mode,
}: {
  mode: "active" | "done";
}) {
  return (
    <div className="mini-steps flex gap-4 pt-1" aria-hidden="true">
      <span className={`h-3 flex-1 rounded-full ${mode === "done" || mode === "active" ? "bg-emerald-900" : "bg-muted"}`} />
      <span className={`h-3 flex-1 rounded-full ${mode === "done" ? "bg-emerald-900" : mode === "active" ? "bg-brand" : "bg-muted"}`} />
      <span className={`h-3 flex-1 rounded-full ${mode === "done" ? "bg-emerald-900" : "bg-muted"}`} />
    </div>
  );
}

export function OrderHistoryCard({
  order,
  onOpen,
}: {
  order: DeviceOrderRef;
  onOpen: () => void;
}) {
  const progress = getOrderStatusProgress(order.status);
  const latestText = order.lastCheckedAt ?? order.updatedAt;
  const meta =
    order.type === "table"
      ? formatHistoryMeta(latestText, [
          "Terraza",
          "Mesa 12",
        ])
      : formatHistoryMeta(latestText, [
          order.type === "pickup" ? "Retiro" : formatOrderType(order.type),
          formatHistoryTime(latestText),
        ]);
  const itemSummary =
    order.type === "table" ? "Aperol Spritz" : "Sangría · ½ Litro";
  const cardStatusLabel = progress.label === "En preparacion" ? "Preparando" : progress.label;
  const statusClass =
    cardStatusLabel === "Completada"
      ? "bg-amber-100 text-amber-800"
      : "bg-sky-100 text-brand";

  return (
    <div className="rounded-[28px] border border-border bg-card/92 px-5 py-5 shadow-[0_24px_55px_-46px_rgba(41,37,36,0.6)]">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p
              className="text-[2rem] font-semibold leading-none tracking-tight text-ink-green"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {order.orderNumber}
            </p>
            <p className="text-sm text-muted-foreground">{meta}</p>
          </div>
          <span className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] ${statusClass}`}>
            {cardStatusLabel === "Completada" ? "Entregado" : cardStatusLabel}
          </span>
        </div>

        <p className="text-lg text-foreground">{itemSummary}</p>
        <MiniSteps mode={cardStatusLabel === "Completada" ? "done" : "active"} />

        <div className="flex items-center justify-between gap-4">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(order.total)}
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-sky-100 px-5 py-3 text-base font-semibold text-brand"
          >
            Volver a pedir
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReservationHistoryCard({
  reservation,
  onOpen,
}: {
  reservation: DeviceReservationRef;
  onOpen: () => void;
}) {
  const progress = getReservationStatusProgress(reservation.status);

  return (
    <div className="rounded-[28px] border border-border bg-card/92 px-5 py-5 shadow-[0_24px_55px_-46px_rgba(41,37,36,0.6)]">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p
              className="text-[2rem] font-semibold leading-none tracking-tight text-ink-green"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {reservation.reservationNumber ?? "Reserva"}
            </p>
            <p className="text-sm text-muted-foreground">
              Hoy · {reservation.tableLabel ?? "Terraza · Mesa 12"}
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-amber-800">
            {progress.label}
          </span>
        </div>

        <p className="text-lg text-foreground">Reserva · {reservation.partySize} personas</p>
        <MiniSteps mode={progress.label === "Completada" ? "done" : "active"} />

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-sky-100 px-5 py-3 text-base font-semibold text-brand"
          >
            Volver a pedir
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailView({
  order,
  onBack,
}: {
  order: DeviceOrderRef;
  onBack: () => void;
}) {
  const progress = getOrderStatusProgress(order.status);
  const latestText = order.lastCheckedAt ?? order.updatedAt;

  return (
    <section className="space-y-5">
      <BackButton onClick={onBack} />
      <DetailHeader
        title={order.orderNumber}
        eyebrow={formatOrderType(order.type)}
        badge={
          <StatusBadge
            label={progress.label}
            tone={progress.tone}
            isTerminalNegative={progress.isTerminalNegative}
          />
        }
      />
      <DetailCard>
        <CompactFact label="Fecha del pedido" value={formatActivityDateTime(order.createdAt ?? order.updatedAt)} />
        <CompactFact label="Última actualización" value={formatActivityDateTime(latestText)} />
      </DetailCard>
      <DetailSection title="Estado del pedido">
        <StatusProgress
          steps={ORDER_PROGRESS_STEPS}
          currentIndex={progress.stepIndex}
          statusLabel={progress.label}
          tone={progress.tone}
          isTerminalNegative={progress.isTerminalNegative}
        />
      </DetailSection>
      <DetailCard title="Resumen del pedido">
        {typeof order.subtotal === "number" ? (
          <CompactFact label="Subtotal" value={formatCurrency(order.subtotal)} />
        ) : null}
        {typeof order.discount === "number" && order.discount > 0 ? (
          <CompactFact label="Descuento" value={`-${formatCurrency(order.discount)}`} />
        ) : null}
        {typeof order.packagingAmount === "number" ? (
          <CompactFact label="Empaque" value={formatCurrency(order.packagingAmount)} />
        ) : null}
        {typeof order.deliveryFeeAmount === "number" ? (
          <CompactFact label="Envío" value={formatCurrency(order.deliveryFeeAmount)} />
        ) : null}
        {typeof order.tipAmount === "number" ? (
          <CompactFact
            label="Propina"
            value={
              order.tipAmount > 0
                ? `${formatCurrency(order.tipAmount)}${order.tipRate ? ` (${order.tipRate}%)` : ""}`
                : "No agregada"
            }
          />
        ) : null}
        <CompactFact label="Total" value={formatCurrency(order.total)} strong />
        <CompactFact label="Tipo" value={formatOrderType(order.type)} />
        <CompactFact label="Artículos" value="Detalle completo en seguimiento" />
      </DetailCard>
      <Button className="h-12 w-full rounded-2xl text-base" onClick={onBack}>
        Volver al historial
      </Button>
    </section>
  );
}

export function ReservationDetailView({
  reservation,
  onBack,
}: {
  reservation: DeviceReservationRef;
  onBack: () => void;
}) {
  const progress = getReservationStatusProgress(reservation.status);

  return (
    <section className="space-y-5">
      <BackButton onClick={onBack} />
      <DetailHeader
        title={reservation.reservationNumber ?? "Reserva guardada"}
        eyebrow="Mesa en restaurante"
        badge={
          <StatusBadge
            label={progress.label}
            tone={progress.tone}
            isTerminalNegative={progress.isTerminalNegative}
          />
        }
      />
      <DetailCard>
        <CompactFact label="Fecha" value={reservation.date} />
        <CompactFact label="Hora" value={reservation.time} />
        <CompactFact label="Personas" value={`${reservation.partySize} personas`} />
        <CompactFact label="Tipo" value={reservation.tableLabel ?? "Mesa por confirmar"} />
      </DetailCard>
      <DetailSection title="Estado de la reserva">
        <StatusProgress
          steps={RESERVATION_PROGRESS_STEPS}
          currentIndex={progress.stepIndex}
          statusLabel={progress.label}
          tone={progress.tone}
          isTerminalNegative={progress.isTerminalNegative}
        />
      </DetailSection>
      <DetailCard title="Detalles de la reserva">
        <CompactFact label="Área / mesa" value={reservation.tableLabel ?? "Por confirmar"} />
        <CompactFact label="Código de reserva" value={reservation.reservationNumber ?? "Pendiente"} strong />
        <CompactFact
          label="Última actualización"
          value={formatActivityDateTime(getReservationDateTime(reservation))}
        />
      </DetailCard>
      <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm leading-6 text-emerald-900">
        Te enviaremos un recordatorio antes de tu reserva.
      </div>
      <Button className="h-12 w-full rounded-2xl text-base" onClick={onBack}>
        Volver al historial
      </Button>
    </section>
  );
}

function DetailHeader({
  title,
  eyebrow,
  badge,
}: {
  title: string;
  eyebrow: string;
  badge: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">{eyebrow}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          className="text-3xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h1>
        {badge}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="rounded-[24px] border border-border bg-card/92 p-5 shadow-[0_24px_55px_-46px_rgba(41,37,36,0.6)]">
        {children}
      </div>
    </section>
  );
}

function DetailCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-border bg-card/92 p-5 shadow-[0_24px_55px_-46px_rgba(41,37,36,0.6)]">
      {title ? <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2> : null}
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-xl text-foreground shadow-sm"
      aria-label="Volver al historial"
    >
      ←
    </button>
  );
}

function StatusBadge({
  label,
  tone,
  isTerminalNegative,
}: {
  label: string;
  tone: "warning" | "success" | "danger";
  isTerminalNegative: boolean;
}) {
  const className =
    isTerminalNegative || tone === "danger"
      ? "bg-red-100 text-red-700"
      : tone === "success"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function CompactFact({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? "text-lg font-semibold text-foreground" : "font-medium text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="rounded-[26px] border border-border bg-card/92 px-5 py-8 text-center shadow-[0_24px_55px_-46px_rgba(41,37,36,0.6)]">
      <p className="text-xl font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Button onClick={onAction} className="mt-5 h-12 rounded-2xl px-6 text-base">
        {actionLabel}
      </Button>
    </section>
  );
}

function HistoryFooterAction({
  label,
  actionLabel,
  onClick,
}: {
  label: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <span>{label}</span>
      <button type="button" onClick={onClick} className="font-medium text-emerald-800">
        {actionLabel}
      </button>
    </div>
  );
}

function ClearLocalButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  // Si el usuario no confirma, descartamos el modo confirmación tras unos segundos.
  useEffect(() => {
    if (!confirming) return;
    const timeout = window.setTimeout(() => setConfirming(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [confirming]);

  if (confirming) {
    return (
      <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-3 text-xs">
        <span className="text-muted-foreground">¿Quitar del dispositivo?</span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onClick();
          }}
          className="font-semibold text-red-700 underline-offset-2 hover:underline"
        >
          Sí, quitar
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="mx-auto flex w-fit rounded-xl px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-red-700"
      onClick={() => setConfirming(true)}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
