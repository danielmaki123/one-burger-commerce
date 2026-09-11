"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { resolveBrandImageUrl, resolveFaviconUrl } from "@/modules/business-settings/domain/brand-assets";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";

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
  modifiers: OrderModifier[];
};

export type OrderSuccessData = {
  orderNumber: string;
  type: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  tipRate?: number | null;
  customerName: string;
  items: OrderItem[];
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
  pickupScheduled?: boolean;
};

/**
 * Hora de retiro para el cliente. Sin programar se muestra con `~` para que se lea como
 * estimación y no como una hora reservada.
 */
function formatPickupForCustomer(
  order: OrderSuccessData,
  timeZone: string,
): string | null {
  if (order.type !== "pickup" || !order.pickupTime) return null;

  const time = formatTimeInTimeZone(order.pickupTime, timeZone);
  if (!time) return null;

  return order.pickupScheduled ? time : `~${time}`;
}

function formatOrderType(type: string): string {
  if (type === "delivery") return "Delivery";
  if (type === "pickup") return "Retiro";
  if (type === "table") return "Mesa";
  return type;
}

function formatPublicOrderStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "new") return "Recibida";
  if (normalized === "confirmed") return "Confirmada";
  if (normalized === "preparing") return "En preparación";
  if (normalized === "ready") return "Lista";
  if (normalized === "ready_for_pickup") return "Lista para retirar";
  if (normalized === "picked_up") return "Retirada";
  if (normalized === "out_for_delivery") return "En camino";
  if (normalized === "delivered") return "Entregada";
  if (normalized === "accepted") return "Aceptada";
  if (normalized === "served") return "Servida";
  if (normalized === "closed") return "Completada";
  if (normalized === "cancelled") return "Cancelada";
  return status;
}

type OrderSuccessViewProps = {
  order: OrderSuccessData;
  onViewActivity?: () => void;
  onOrderAgain?: () => void;
};

export default function OrderSuccessView({
  order,
  onViewActivity,
}: OrderSuccessViewProps) {
  const [hideMascot, setHideMascot] = useState(false);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const itemCountLabel =
  itemCount === 1 ? "1 producto" : `${itemCount} productos`;
  const statusLabel = formatPublicOrderStatus(order.status);
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  // Logo completo; si todavía no hay ninguno configurado se mantiene el asset de
  // respaldo que ya se mostraba acá como mascota.
  const brandMark = resolveBrandImageUrl(settings, "full") ?? resolveFaviconUrl(settings);
  const pickupLabel = formatPickupForCustomer(order, settings.timezone);

  return (
    <div className="brand-canvas min-h-dvh text-foreground">
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-28 pt-6 sm:max-w-2xl sm:px-8 sm:pb-16 sm:pt-10">
        <p
          className="text-center text-3xl font-semibold text-ink-green"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {settings.name}
        </p>

        <section className="mt-7 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center">
            {!hideMascot && brandMark ? (
              <div className="relative flex w-full items-end justify-center pt-2">
                <div className="absolute bottom-0 h-24 w-56 rounded-t-full bg-brand/10 sm:h-28 sm:w-72" />
                <img
                  src={brandMark}
                  alt=""
                  aria-hidden="true"
                  className="relative z-10 h-auto w-[178px] object-contain brand-drop-shadow sm:w-[220px]"
                  onError={() => setHideMascot(true)}
                />
              </div>
            ) : null}

            <span
              aria-hidden="true"
              className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#8aa060] text-xl font-semibold text-white shadow-[0_8px_18px_-12px_rgba(41,37,36,0.65)]"
            >
              ✓
            </span>

            <h1
              className="mt-4 text-center text-4xl font-semibold leading-tight text-foreground sm:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              ¡Pedido confirmado!
            </h1>
            <p className="mt-3 max-w-sm text-center text-base leading-6 text-muted-foreground sm:text-lg">
              Tu orden ya está en {settings.name}.
            </p>

            <Badge
              variant="success"
              className="mt-5 border border-brand/25 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand"
            >
              <span
                aria-hidden="true"
                className="mr-2 h-2 w-2 rounded-full bg-brand"
              />
              {statusLabel}
            </Badge>
          </div>
        </section>

        <div className="mt-7">
          <Button
            className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground brand-shadow-cta hover:bg-brand-strong"
            onClick={onViewActivity}
          >
            Ver mis pedidos
          </Button>
        </div>

        <section className="mt-7 rounded-3xl bg-card/92 p-5 shadow-[0_18px_38px_-30px_rgba(60,40,20,0.55)] ring-1 ring-border sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Resumen del pedido
          </h2>
          <div className="mt-5 space-y-4">
            <SummaryRow label="Número de pedido" value={order.orderNumber} />
            <SummaryRow label="Tipo" value={formatOrderType(order.type)} />
            <SummaryRow label="Artículos" value={itemCountLabel} />
            {pickupLabel ? (
              <SummaryRow label="Hora de retiro" value={pickupLabel} />
            ) : null}
            <SummaryRow label="Subtotal" value={formatCurrency(order.subtotal, currency)} />
            {order.discount > 0 ? (
              <SummaryRow
                label="Descuento"
                value={`-${formatCurrency(order.discount, currency)}`}
              />
            ) : null}
            <SummaryRow label="Empaque" value={formatCurrency(order.packagingAmount, currency)} />
            {order.type === "delivery" ? (
              <SummaryRow
                label="Envío"
                value={formatCurrency(order.deliveryFeeAmount, currency)}
              />
            ) : null}
            <SummaryRow
              label="Propina"
              value={
                order.tipAmount > 0
                  ? `${formatCurrency(order.tipAmount, currency)}${order.tipRate ? ` (${order.tipRate}%)` : ""}`
                  : "No agregada"
              }
            />
            <div className="flex items-end justify-between gap-4 border-t border-border pt-4">
              <span className="text-xl font-semibold text-foreground">Total</span>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {formatCurrency(order.total, currency)}
              </span>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-7 max-w-sm space-y-1 text-center text-sm leading-6 text-muted-foreground">
          {settings.paymentInstructions ? (
            <p className="font-semibold text-foreground">{settings.paymentInstructions}</p>
          ) : null}
          <p>Te enviaremos actualizaciones sobre tu pedido.</p>
          <p>Gracias por elegir {settings.name}.</p>
        </div>
      </main>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
