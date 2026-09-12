"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

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
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { useCart } from "@/shared/lib/cart";
import { syncTrackedOrderToDeviceOrders } from "@/shared/lib/order-tracking-sync";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useOrderTrackingSession } from "../_components/order-tracking-session";
import { filterDeviceOrders } from "./activity-page-helpers";
import {
  OrderDetailView,
  OrderHistoryCard,
  formatActivityDateTime,
} from "./order-history-views";

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
