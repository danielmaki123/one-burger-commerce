"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearDeviceOrders,
  markDeviceOrderStale,
  readDeviceOrders,
  type DeviceOrderRef,
} from "@/shared/lib/device-orders";
import { formatCurrency } from "@/shared/lib/format-currency";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { resolveWhatsappDefaultPrefix } from "@/shared/lib/whatsapp-input-value";
import { syncTrackedOrderToDeviceOrders } from "@/shared/lib/order-tracking-sync";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { WhatsAppInput } from "@/shared/ui/whatsapp-input";
import { useOrderTrackingSession } from "../_components/order-tracking-session";
import { formatPublicOrderUpdatedAt } from "./orders-page-helpers";

const ACTIVE_STATUS = new Set([
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
]);

type TrackingResponse = {
  data: {
    orderNumber: string;
    type: "delivery" | "pickup" | "table";
    status: string;
    statusLabel: string;
    updatedAt: string;
    total: number;
  };
};

function formatOrderType(type: DeviceOrderRef["type"]): string {
  if (type === "table") return "Mesa";
  if (type === "pickup") return "Para llevar";
  return "Delivery";
}

function splitOrders(orders: DeviceOrderRef[]) {
  const active: DeviceOrderRef[] = [];
  const history: DeviceOrderRef[] = [];
  for (const order of orders) {
    if (ACTIVE_STATUS.has(order.status)) active.push(order);
    else history.push(order);
  }
  return { active, history };
}

export default function DeviceOrdersPage() {
  const router = useRouter();
  const settings = useBusinessSettings();
  const [orders, setOrders] = useState<DeviceOrderRef[]>([]);
  const [whatsappInput, setWhatsappInput] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { trackingWhatsapp, setTrackingWhatsapp } = useOrderTrackingSession();

  useEffect(() => {
    const store = readDeviceOrders();
    setOrders(store.orders);
  }, []);

  const sections = useMemo(() => splitOrders(orders), [orders]);

  async function refreshWithWhatsapp(whatsapp: string) {
    setIsRefreshing(true);
    setFeedback(null);
    let hadFailures = false;

    const current = [...orders];
    for (const order of current) {
      try {
        const response = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber: order.orderNumber,
            customerWhatsapp: whatsapp,
          }),
        });

        if (!response.ok) {
          hadFailures = true;
          markDeviceOrderStale(order.orderNumber, true);
          continue;
        }

        const payload = (await response.json()) as TrackingResponse;
        syncTrackedOrderToDeviceOrders({
          orderNumber: payload.data.orderNumber,
          type: payload.data.type,
          status: payload.data.status,
          statusLabel: payload.data.statusLabel,
          updatedAt: payload.data.updatedAt,
          total: payload.data.total,
        });
      } catch {
        hadFailures = true;
        markDeviceOrderStale(order.orderNumber, true);
      }
    }

    const refreshed = readDeviceOrders();
    setOrders(refreshed.orders);
    setIsRefreshing(false);
    setFeedback(
      hadFailures
        ? "No pudimos actualizar algunos pedidos. Mostramos la última información guardada."
        : "Pedidos actualizados correctamente.",
    );
  }

  async function handleRefreshClick() {
    if (orders.length === 0) return;
    if (trackingWhatsapp) {
      await refreshWithWhatsapp(trackingWhatsapp);
      return;
    }
    setShowRefreshPrompt(true);
  }

  async function handleSubmitWhatsapp(event: React.FormEvent) {
    event.preventDefault();
    const normalized = whatsappInput.trim();
    if (!normalized) return;
    setTrackingWhatsapp(normalized);
    setShowRefreshPrompt(false);
    await refreshWithWhatsapp(normalized);
  }

  function handleClearOrders() {
    clearDeviceOrders();
    setOrders([]);
    setFeedback("Se borraron los pedidos guardados en este dispositivo.");
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Mis pedidos</h1>
        <p className="text-sm text-muted-foreground">Estos pedidos solo se guardan en este dispositivo.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button className="rounded-xl" onClick={() => void handleRefreshClick()} disabled={orders.length === 0 || isRefreshing}>
          {isRefreshing ? "Actualizando..." : "Actualizar estados"}
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={handleClearOrders} disabled={orders.length === 0}>
          Borrar mis pedidos de este dispositivo
        </Button>
      </div>

      {showRefreshPrompt ? (
        <Card className="border-border">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-foreground">Para proteger tu pedido, confirmá el WhatsApp usado al ordenar.</p>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={handleSubmitWhatsapp}>
              <WhatsAppInput
                value={whatsappInput}
                onChange={setWhatsappInput}
                defaultPrefix={resolveWhatsappDefaultPrefix(settings.phone)}
                className="flex-1"
              />
              <Button type="submit" className="rounded-xl">Actualizar</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}

      {orders.length === 0 ? (
        <Card className="border-border">
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">Aún no hay pedidos guardados en este dispositivo.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => router.push("/menu")} className="rounded-xl">Ir al menú</Button>
              <Button variant="outline" onClick={() => router.push("/orders/track")} className="rounded-xl">
                Consultar pedido manualmente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Activos</h2>
            {sections.active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pedidos activos.</p>
            ) : (
              <div className="grid gap-3">
                {sections.active.map((order) => (
                  <OrderCard key={order.orderNumber} order={order} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Historial</h2>
            {sections.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pedidos en historial.</p>
            ) : (
              <div className="grid gap-3">
                {sections.history.map((order) => (
                  <OrderCard key={order.orderNumber} order={order} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function OrderCard({ order }: { order: DeviceOrderRef }) {
  const router = useRouter();
  const currency = useCurrencyFormat();
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{order.orderNumber}</p>
          <p className="text-sm text-muted-foreground">{formatOrderType(order.type)} • {order.statusLabel}</p>
          <p className="text-xs text-muted-foreground">Última actualización: {formatPublicOrderUpdatedAt(order.updatedAt)}</p>
          {order.stale ? <p className="text-xs text-amber-700">Desactualizado</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-foreground">{formatCurrency(order.total, currency)}</p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => router.push(`/orders/track?orderNumber=${encodeURIComponent(order.orderNumber)}`)}
          >
            Ver estado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
