"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  getOrderStatusProgress,
  ORDER_PROGRESS_STEPS,
} from "@/shared/lib/activity-status";
import {
  ACTIVE_ORDER_STATUS,
  refreshActivity,
  type TrackedOrder,
} from "@/shared/lib/activity-refresh";
import {
  clearDeviceOrders,
  markDeviceOrderStale,
  readDeviceOrders,
  type DeviceOrderRef,
} from "@/shared/lib/device-orders";
import { formatCurrency } from "@/shared/lib/format-currency";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { useCart } from "@/shared/lib/cart";
import { syncTrackedOrderToDeviceOrders } from "@/shared/lib/order-tracking-sync";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { StatusProgress } from "@/shared/ui/status-progress";
import { useOrderTrackingSession } from "../_components/order-tracking-session";
import {
  buildOrderTimeline,
  filterDeviceOrders,
  formatOrderPickupEstimate,
  formatOrderPickupPin,
  formatTimelineProgress,
  summarizeOrderItems,
} from "./activity-page-helpers";

type ActivityTab = "orders";

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

export default function CustomerActivityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>("orders");
  const [orders, setOrders] = useState<DeviceOrderRef[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);
  const { trackingWhatsapp } = useOrderTrackingSession();
  const { addItem } = useCart();
  const settings = useBusinessSettings();

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "orders") setActiveTab("orders");
    setOrders(readDeviceOrders().orders);
  }, []);

  const orderSections = useMemo(() => splitByStatus(orders, ACTIVE_ORDER_STATUS), [orders]);

  /** El buscador del historial: filtra por número de pedido o por plato (T7). */
  const visibleOrders = useMemo(
    () => filterDeviceOrders([...orderSections.active, ...orderSections.history], query),
    [orderSections, query],
  );

  /**
   * "Pedir nuevamente": vuelve a armar el pedido con las líneas guardadas.
   *
   * Los pedidos guardados antes de T7 no tienen líneas: en esos casos la tarjeta
   * no ofrece repetir, en vez de un botón que no hace nada.
   */
  function handleReorder(order: DeviceOrderRef) {
    const items = order.items ?? [];
    if (items.length === 0) return;

    items.forEach((item) => {
      addItem({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        packagingUnitAmount: item.packagingUnitAmount,
        packagingTotalAmount: item.packagingUnitAmount * item.quantity,
        modifierOptionIds: item.modifierOptionIds,
        modifiers: item.modifiers,
        notes: item.notes,
        lineTotal: item.lineTotal,
      });
    });

    setReorderFeedback(`${items.length} ${items.length === 1 ? "plato" : "platos"} agregados al carrito.`);
    router.push("/cart");
  }

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderNumber === selectedOrderNumber) ?? null,
    [orders, selectedOrderNumber],
  );

  const lastUpdateText = useMemo(() => {
    const timestamps = orders
      .map((order) => order.lastCheckedAt ?? order.updatedAt)
      .map((value) => (value ? new Date(value).getTime() : Number.NaN))
      .filter(Number.isFinite);

    if (timestamps.length === 0) return "Sin actividad guardada";
    return `Actualizado ${formatActivityDateTime(new Date(Math.max(...timestamps)).toISOString())}`;
  }, [orders]);

  const hasRefreshableActivity = orderSections.active.length > 0;

  function handleTabChange(tab: ActivityTab) {
    setActiveTab(tab);
    setSelectedOrderNumber(null);
    window.history.replaceState(null, "", "/activity?tab=orders");
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

  async function handleRefreshClick() {
    if (!hasRefreshableActivity || isRefreshing) return;

    setIsRefreshing(true);
    setRefreshFeedback(null);
    const result = await refreshActivity(
      {
        orders,
        trackingWhatsapp: trackingWhatsapp.trim(),
      },
      {
        getCheckedAt: () => new Date().toISOString(),
        markOrderStale: (orderNumber, stale) => markDeviceOrderStale(orderNumber, stale),
        syncOrder: (tracked, checkedAt) => syncTrackedOrderToDeviceOrders(tracked, { checkedAt }),
        trackOrder,
      },
    );

    setOrders(readDeviceOrders().orders);
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
              Revisá tus pedidos recientes.
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
          <div className="grid grid-cols-1 gap-1">
            <TabButton
              isActive={activeTab === "orders"}
              onClick={() => handleTabChange("orders")}
            >
              Pedidos
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
          {orders.length > 0 ? (
            <div className="space-y-3">
              <label className="block">
                <span className="sr-only">Buscar en el historial</span>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por número de pedido o plato"
                  aria-label="Buscar en el historial"
                />
              </label>
              {reorderFeedback ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {reorderFeedback}
                </p>
              ) : null}
            </div>
          ) : null}
          {orders.length === 0 ? (
            <EmptyState
              title="Aún no tenés pedidos"
              description="Cuando hagás un pedido, aparecerá aquí para que podás darle seguimiento."
              actionLabel="Ver menú"
              onAction={() => router.push("/menu")}
            />
          ) : visibleOrders.length === 0 ? (
            <EmptyState
              title="No encontramos pedidos con esa búsqueda"
              description="Probá con el número de pedido o con el nombre de un plato."
              actionLabel="Ver todos"
              onAction={() => setQuery("")}
            />
          ) : (
            <div className="space-y-4">
              {visibleOrders.map((order) => (
                <OrderHistoryCard
                  key={order.orderNumber}
                  order={order}
                  timeZone={settings.timezone}
                  onOpen={() => setSelectedOrderNumber(order.orderNumber)}
                  onReorder={() => handleReorder(order)}
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
    </HistoryShell>
  );
}

function HistoryShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh brand-canvas">
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

export function OrderHistoryCard({
  order,
  onOpen,
  onReorder,
  timeZone = "America/Managua",
}: {
  order: DeviceOrderRef;
  onOpen: () => void;
  onReorder?: () => void;
  timeZone?: string;
}) {
  const progress = getOrderStatusProgress(order.status);
  const latestText = order.lastCheckedAt ?? order.updatedAt;
  const currency = useCurrencyFormat();
  const meta = formatHistoryMeta(latestText, [
    order.type === "pickup" ? "Retiro" : formatOrderType(order.type),
    formatHistoryTime(latestText),
  ]);
  // El resumen sale de las líneas guardadas (T7): antes había un plato escrito a mano.
  const itemSummary = summarizeOrderItems(order.items);
  const pickupEstimate = formatOrderPickupEstimate(order, timeZone);
  const pickupPinLabel = formatOrderPickupPin(order.pickupPin);
  const cardStatusLabel = progress.label === "En preparación" ? "Preparando" : progress.label;
  const statusClass =
    cardStatusLabel === "Completada"
      ? "bg-warning text-warning-foreground"
      : "bg-brand/10 text-brand";

  return (
    <div className="rounded-[28px] border border-border bg-card/92 px-5 py-5 shadow-card">
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

        {itemSummary ? <p className="text-lg text-foreground">{itemSummary}</p> : null}

        <OrderTimeline status={order.status} />

        {pickupEstimate ? (
          <p className="text-sm text-muted-foreground">{pickupEstimate}</p>
        ) : null}
        {/* El PIN se dicta en caja: tiene que estar también acá, no solo en la confirmación. */}
        {pickupPinLabel ? (
          <p className="font-mono text-sm font-semibold tracking-[0.14em] text-brand">
            {pickupPinLabel}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(order.total, currency)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full px-5"
              onClick={onOpen}
            >
              Ver recibo
            </Button>
            {onReorder && itemSummary ? (
              <Button
                type="button"
                className="min-h-11 rounded-full px-5"
                onClick={onReorder}
              >
                Pedir nuevamente
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Timeline del pedido: los pasos reales, con lo hecho, lo actual y lo que falta.
 *
 * El mock dibuja 4 barras sin texto y sin semántica; acá cada paso se lee (también
 * con lector de pantalla) y hay un `Paso N de 5` explícito.
 */
export function OrderTimeline({ status }: { status: string }) {
  const steps = buildOrderTimeline(status);
  const progressLabel = formatTimelineProgress(status);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {progressLabel}
      </p>
      <ol className="flex flex-wrap gap-x-3 gap-y-1.5">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${
                step.isDone
                  ? "bg-success-strong"
                  : step.isCurrent
                    ? "bg-brand"
                    : "bg-border"
              }`}
            />
            <span
              className={
                step.isDone || step.isCurrent
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }
            >
              {step.label}
            </span>
            {step.isCurrent ? <span className="sr-only">(paso actual)</span> : null}
          </li>
        ))}
      </ol>
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
  const currency = useCurrencyFormat();

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
          <CompactFact label="Subtotal" value={formatCurrency(order.subtotal, currency)} />
        ) : null}
        {typeof order.discount === "number" && order.discount > 0 ? (
          <CompactFact label="Descuento" value={`-${formatCurrency(order.discount, currency)}`} />
        ) : null}
        {typeof order.packagingAmount === "number" ? (
          <CompactFact label="Empaque" value={formatCurrency(order.packagingAmount, currency)} />
        ) : null}
        {typeof order.deliveryFeeAmount === "number" ? (
          <CompactFact label="Envío" value={formatCurrency(order.deliveryFeeAmount, currency)} />
        ) : null}
        {typeof order.tipAmount === "number" ? (
          <CompactFact
            label="Propina"
            value={
              order.tipAmount > 0
                ? `${formatCurrency(order.tipAmount, currency)}${order.tipRate ? ` (${order.tipRate}%)` : ""}`
                : "No agregada"
            }
          />
        ) : null}
        <CompactFact label="Total" value={formatCurrency(order.total, currency)} strong />
        <CompactFact label="Tipo" value={formatOrderType(order.type)} />
        <CompactFact label="Artículos" value="Detalle completo en seguimiento" />
      </DetailCard>
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
