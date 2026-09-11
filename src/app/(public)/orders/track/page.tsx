"use client";

import { useEffect, useMemo, useState } from "react";

import { formatCurrency } from "@/shared/lib/format-currency";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { resolveWhatsappDefaultPrefix } from "@/shared/lib/whatsapp-input-value";
import { syncTrackedOrderToDeviceOrders } from "@/shared/lib/order-tracking-sync";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { WhatsAppInput } from "@/shared/ui/whatsapp-input";
import { useOrderTrackingSession } from "../../_components/order-tracking-session";

type TrackingResponse = {
  data: {
    orderNumber: string;
    type: "delivery" | "pickup" | "table";
    status: string;
    statusLabel: string;
    updatedAt: string;
    items: Array<{
      productName: string;
      quantity: number;
    }>;
    subtotal: number;
    discount: number;
    packagingAmount: number;
    deliveryFeeAmount: number;
    tipAmount: number;
    tipRate?: number | null;
    total: number;
  };
};

const TRACKING_ERROR_MESSAGE =
  "No pudimos validar ese pedido. Revisá que el WhatsApp sea el mismo que usaste al ordenar.";

export default function OrderTrackingPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const { trackingWhatsapp, setTrackingWhatsapp } = useOrderTrackingSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse["data"] | null>(null);
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const canSubmit = useMemo(
    () => orderNumber.trim().length > 0 && trackingWhatsapp.trim().length > 0 && !loading,
    [orderNumber, trackingWhatsapp, loading],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = new URLSearchParams(window.location.search).get("orderNumber");
    if (fromQuery && orderNumber.trim().length === 0) {
      setOrderNumber(fromQuery.trim());
    }
  }, [orderNumber]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setTracking(null);

    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, customerWhatsapp: trackingWhatsapp }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(TRACKING_ERROR_MESSAGE);
        return;
      }

      const trackedOrder = (body as TrackingResponse).data;
      syncTrackedOrderToDeviceOrders({
        orderNumber: trackedOrder.orderNumber,
        type: trackedOrder.type,
        status: trackedOrder.status,
        statusLabel: trackedOrder.statusLabel,
        updatedAt: trackedOrder.updatedAt,
        subtotal: trackedOrder.subtotal,
        discount: trackedOrder.discount,
        packagingAmount: trackedOrder.packagingAmount,
        deliveryFeeAmount: trackedOrder.deliveryFeeAmount,
        tipAmount: trackedOrder.tipAmount,
        tipRate: trackedOrder.tipRate ?? null,
        total: trackedOrder.total,
      });
      setTracking(trackedOrder);
    } catch {
      setError(TRACKING_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Estado de tu pedido</h1>
        <p className="text-sm text-muted-foreground">Ingresá tu número de pedido y WhatsApp para ver el avance.</p>
      </header>

      <Card className="border-border">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="orderNumber" className="text-sm font-medium text-foreground">Número de pedido</label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder="Ej: D-ABC123"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <WhatsAppInput
                id="customerWhatsapp"
                value={trackingWhatsapp}
                onChange={setTrackingWhatsapp}
                defaultPrefix={resolveWhatsappDefaultPrefix(settings.phone)}
              />
              <p className="text-xs text-muted-foreground">Usá el mismo WhatsApp que ingresaste al hacer el pedido.</p>
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <Button type="submit" className="h-11 w-full rounded-xl" disabled={!canSubmit}>
              {loading ? "Consultando..." : "Ver estado"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {tracking ? (
        <Card className="border-border">
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Número</p>
                <p className="font-semibold text-foreground">{tracking.orderNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estado</p>
                <p className="font-semibold text-amber-700">{tracking.statusLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Última actualización</p>
                <p className="font-semibold text-foreground">{new Date(tracking.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subtotal</p>
                <p className="font-semibold text-foreground">{formatCurrency(tracking.subtotal, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Empaque</p>
                <p className="font-semibold text-foreground">{formatCurrency(tracking.packagingAmount, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Propina</p>
                <p className="font-semibold text-foreground">
                  {tracking.tipAmount > 0
                    ? `${formatCurrency(tracking.tipAmount, currency)}${tracking.tipRate ? ` (${tracking.tipRate}%)` : ""}`
                    : "No agregada"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Envío</p>
                <p className="font-semibold text-foreground">{formatCurrency(tracking.deliveryFeeAmount, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold text-foreground">{formatCurrency(tracking.total, currency)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border">
              {tracking.items.map((item, index) => (
                <div key={`${item.productName}-${index}`} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
                  <span className="text-sm text-foreground">{item.productName}</span>
                  <span className="text-sm font-semibold text-foreground">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
