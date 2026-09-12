"use client";

import type { ReactNode } from "react";

import {
  getOrderStatusProgress,
  ORDER_PROGRESS_STEPS,
} from "@/shared/lib/activity-status";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import type { DeviceOrderRef } from "@/shared/lib/device-orders";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { StatusProgress } from "@/shared/ui/status-progress";
import {
  buildOrderTimeline,
  formatOrderPickupEstimate,
  formatOrderPickupPin,
  formatTimelineProgress,
  summarizeOrderItems,
} from "./activity-page-helpers";

/**
 * Vistas del historial de pedidos: la tarjeta, el timeline y el detalle.
 *
 * Vivían **exportadas desde `page.tsx`**, y eso rompía `next build --webpack`: Next
 * genera un tipo para cada página que exige que el módulo exporte solo lo que él
 * conoce (`default`, `metadata`, …), así que un componente exportado ahí lo hace fallar.
 * El build con Turbopack no corría esa validación y el problema quedaba escondido.
 */

function formatOrderType(type: DeviceOrderRef["type"]): string {
  if (type === "table") return "Mesa";
  if (type === "pickup") return "Para llevar";
  return "Delivery";
}

export function formatActivityDateTime(value: string) {
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
function OrderTimeline({ status }: { status: string }) {
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
