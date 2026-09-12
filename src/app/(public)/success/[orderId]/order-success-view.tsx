"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { resolveBrandImageUrl, resolveFaviconUrl } from "@/modules/business-settings/domain/brand-assets";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import {
  formatPickupAddress,
  type PickupLocation,
} from "@/modules/locations/domain/location-rules";
import { pickupDayLabel } from "@/modules/business-settings/domain/pickup-days";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import {
  PAYMENT_METHOD_LABELS,
  type OrderPaymentMethod,
} from "@/modules/orders/domain/order.types";
import { calculateOrderChange } from "@/modules/orders/domain/payment-change";

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
  /** Forma de pago declarada por el cliente (T11). */
  paymentMethod?: OrderPaymentMethod | null;
  /** Con cuánto paga el cliente cuando es efectivo (T12). */
  paidWithAmount?: number | null;
  /** PIN corto para dictar en caja (T13). */
  pickupPin?: string | null;
  /** Dónde retira (T8 fase 7): el local del pedido, ya resuelto por el servidor. */
  pickupLocation?: PickupLocation | null;
};

/**
 * Hora de retiro para el cliente. Sin programar se muestra con `~` para que se lea como
 * estimación y no como una hora reservada.
 *
 * Con un máximo configurado (T5) se promete una **franja** en vez de un instante: el
 * rango arranca en la hora prometida y termina en la diferencia entre el máximo y el
 * mínimo de preparación.
 */
function formatPickupForCustomer(
  order: OrderSuccessData,
  timeZone: string,
  pickupLeadMinutes: number,
  pickupMaxMinutes: number | null,
): string | null {
  if (order.type !== "pickup" || !order.pickupTime) return null;

  const time = formatTimeInTimeZone(order.pickupTime, timeZone);
  if (!time) return null;

  // Si el retiro es para otro día (fase 4), el día es parte de la respuesta: "12:00 p. m."
  // a secas se leería como hoy.
  const day = pickupDayLabel({ pickupTime: order.pickupTime, nowMs: Date.now(), timeZone });
  const withDay = (value: string) => (day ? `${day} ${value}` : value);

  if (order.pickupScheduled) return withDay(time);

  const extraMinutes =
    pickupMaxMinutes === null ? 0 : Math.trunc(pickupMaxMinutes) - Math.trunc(pickupLeadMinutes);
  if (extraMinutes <= 0) return withDay(`~${time}`);

  const endIso = new Date(
    new Date(order.pickupTime).getTime() + extraMinutes * 60_000,
  ).toISOString();
  const end = formatTimeInTimeZone(endIso, timeZone);

  return end ? withDay(`entre ${time} y ${end}`) : withDay(`~${time}`);
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
  /** Volver a la carta: la segunda salida que muestra el mock (T6). */
  onOrderAgain?: () => void;
};

export default function OrderSuccessView({
  order,
  onViewActivity,
  onOrderAgain,
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
  const pickupLabel = formatPickupForCustomer(
    order,
    settings.timezone,
    settings.pickupLeadMinutes,
    settings.pickupMaxMinutes,
  );

  /** Vuelto (T12): se deriva del monto y el total, nunca se guarda. */
  const paidWithAmount = order.paidWithAmount ?? null;
  const orderChange = calculateOrderChange({ paidWithAmount, total: order.total });
  const changeLabel = orderChange === null ? null : formatCurrency(orderChange, currency);

  // Dónde retira (T8 fase 7). El nombre siempre está si el local existe; la dirección y el
  // mapa solo si el owner los cargó.
  const pickupLocation = order.pickupLocation ?? null;
  const pickupAddress = formatPickupAddress(pickupLocation);

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

            {/* PIN de retiro (T13): el código corto que se dicta en caja. */}
            {order.pickupPin ? (
              <div className="mt-5 rounded-2xl border border-border bg-card px-5 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  PIN de retiro
                </p>
                <p
                  className="mt-1 text-4xl font-semibold tracking-[0.18em] tabular-nums text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {order.pickupPin}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Díctalo en caja al retirar.</p>
              </div>
            ) : null}

            {/* Dónde retira (T8 fase 7): el nombre del local y, si el owner la cargó, la
                dirección con el mapa. Va arriba, junto al PIN, porque es lo que el cliente
                mira cuando sale a buscar el pedido. */}
            {pickupLocation ? (
              <div className="mt-4 flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left">
                <span aria-hidden="true" className="text-base text-brand">
                  📍
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-foreground">
                    Retiro en {pickupLocation.name}
                  </p>
                  {pickupAddress ? (
                    <p className="text-muted-foreground">{pickupAddress}</p>
                  ) : null}
                </div>
                {pickupLocation.mapsUrl ? (
                  <a
                    href={pickupLocation.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 shrink-0 items-center rounded-xl px-2 text-sm font-semibold text-brand"
                  >
                    Cómo llegar
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button
            className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground brand-shadow-cta hover:bg-brand-strong"
            onClick={onViewActivity}
          >
            Ver mis pedidos
          </Button>
          {onOrderAgain ? (
            <Button
              variant="outline"
              className="h-14 w-full rounded-2xl text-base font-semibold"
              onClick={onOrderAgain}
            >
              Volver a la carta
            </Button>
          ) : null}
        </div>

        <section className="mt-7 rounded-3xl bg-card/92 p-5 shadow-[0_18px_38px_-30px_rgba(60,40,20,0.55)] ring-1 ring-border sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Resumen del pedido
          </h2>
          <div className="mt-5 space-y-4">
            <SummaryRow label="Número de pedido" value={order.orderNumber} />
            <SummaryRow label="Tipo" value={formatOrderType(order.type)} />
            {pickupLocation ? (
              <SummaryRow label="Retiro en" value={pickupLocation.name} />
            ) : null}
            <SummaryRow
              label="Forma de pago"
              value={PAYMENT_METHOD_LABELS[order.paymentMethod ?? "cash"]}
            />
            <SummaryRow label="Artículos" value={itemCountLabel} />
            {pickupLabel ? (
              <SummaryRow label="Hora de retiro" value={pickupLabel} />
            ) : null}
            {paidWithAmount !== null ? (
              <SummaryRow
                label="Pagás con"
                value={formatCurrency(paidWithAmount, currency)}
              />
            ) : null}
            {changeLabel ? <SummaryRow label="Cambio" value={changeLabel} /> : null}
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
