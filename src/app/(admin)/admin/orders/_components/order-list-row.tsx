"use client";

import Link from "next/link";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import { useCurrencyFormat, useBusinessSettings } from "@/shared/lib/business-settings";
import { AdminStatusSolid, getAdminOrderSolidStatus } from "../../_components/admin-operational-ui";

import {
  FINANCIAL_TONE_CLASSES,
  SOURCE_LABELS,
  SOURCE_TONE_CLASSES,
  financialLabel,
  type OrderListRow,
} from "../order-list-types";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **una fila del listado**: lo que hace falta para reconocer el pedido y decidir
 * si hay que abrirlo.
 *
 * Densidad de la referencia aprobada (~84 px, `min-h-[84px]`) y las seis columnas del encabezado: pedido (con
 * el canal), cliente, cuándo (hora prometida o ASAP, con PROGRAMADO), estado, total/pago y la flecha.
 *
 * La fila entera es el enlace, y la flecha es **decorativa**: un `<a>` no puede contener otro control, y el
 * nombre accesible sale del `aria-label`.
 *
 * **Hora del negocio**, no del navegador (`A-63`): se formatea con la zona de la configuración.
 */
export function OrderListRowView({ order }: { order: OrderListRow }) {
  const { timezone: timeZone } = useBusinessSettings();
  const currency = useCurrencyFormat();
  const financial = financialLabel(order);

  const pickupLabel = order.pickupTime ? formatTimeInTimeZone(order.pickupTime, timeZone) : null;

  return (
    <Link
      href={`/admin/orders/${order.id}`}
      aria-label={`Abrir pedido ${order.orderNumber}`}
      data-testid="order-list-row"
      data-order-number={order.orderNumber}
      data-order-id={order.id}
      /**
       * La fila es la misma en los dos anchos —número, canal, cliente, cuándo, estado, total y pago— pero la
       * **disposición** no: en celular son dos columnas (pedido y total arriba; cliente, cuándo y estado
       * apilados) porque las seis columnas de escritorio comprimidas a 375 px partían el número en dos líneas.
       * La estructura se elige con `lg:hidden` / `hidden lg:grid` en vez de recolocar un solo grid.
       */
      className="block min-h-[84px] border-b border-line-subtle px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:grid lg:grid-cols-[120px_minmax(180px,1.25fr)_minmax(150px,1fr)_150px_120px_24px] lg:items-center lg:gap-x-4 lg:px-1 lg:py-2"
    >
      {/* ---- Celular y tablet: dos columnas ---- */}
      <div className="flex min-w-0 items-start justify-between gap-3 lg:hidden">
        <div className="min-w-0">
          <p className="font-mono text-st-body font-bold tabular-nums whitespace-nowrap text-brand-primary">
            {order.orderNumber}
          </p>
          {order.source ? (
            <span
              className={`mt-1 inline-flex w-fit items-center rounded-stitch-sm px-1.5 py-0.5 text-st-overline font-bold uppercase tracking-wider ${SOURCE_TONE_CLASSES[order.source]}`}
            >
              {SOURCE_LABELS[order.source]}
            </span>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-st-body font-bold tabular-nums text-ink">
            {formatCurrency(order.total, currency)}
          </p>
          <p
            data-testid="order-list-financial"
            className={`mt-0.5 text-st-overline font-bold uppercase tracking-wide ${FINANCIAL_TONE_CLASSES[financial.tone]}`}
          >
            {financial.label}
          </p>
        </div>
      </div>

      <div className="mt-2 min-w-0 space-y-1 lg:hidden">
        <p className="truncate text-st-body font-semibold text-ink">{order.customerName}</p>
        <p className="truncate text-st-caption text-ink-secondary">
          {order.customerWhatsapp}
          {order.locationName ? ` · ${order.locationName}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-st-caption font-semibold tabular-nums text-ink">
            {pickupLabel ? `Retiro ${pickupLabel}` : "Lo antes posible"}
          </span>
          {/* `ASAP` sólo acompaña a una hora prometida: sin hora, «lo antes posible» ya lo dice. */}
          {order.pickupScheduled ? (
            <span className="inline-flex w-fit items-center rounded-full bg-status-pending-bg px-2 py-0.5 text-st-overline font-bold uppercase tracking-wide text-status-pending-text">
              Programado
            </span>
          ) : pickupLabel ? (
            <span className="text-st-overline font-bold uppercase tracking-wide text-ink-secondary">
              ASAP
            </span>
          ) : null}
          <AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
            {getAdminOrderStatusLabel(order.status)}
          </AdminStatusSolid>
        </div>
      </div>

      {/* ---- Escritorio: las seis columnas de la referencia ---- */}
      <div className="hidden min-w-0 lg:block">
        <span className="font-mono text-base font-bold tabular-nums whitespace-nowrap text-brand-primary">
          {order.orderNumber}
        </span>
        {order.source ? (
          <span
            className={`mt-1 flex w-fit items-center rounded-stitch-sm px-1.5 py-0.5 text-st-overline font-bold uppercase tracking-wider ${SOURCE_TONE_CLASSES[order.source]}`}
          >
            {SOURCE_LABELS[order.source]}
          </span>
        ) : null}
      </div>

      <div className="hidden min-w-0 lg:block">
        <p className="truncate text-st-body font-semibold text-ink">{order.customerName}</p>
        <p className="truncate text-st-caption text-ink-secondary">
          {order.customerWhatsapp}
          {order.locationName ? ` · ${order.locationName}` : ""}
        </p>
      </div>

      <div className="hidden min-w-0 lg:block">
        <span className="text-st-body font-semibold tabular-nums text-ink">
          {pickupLabel ? `Retiro ${pickupLabel}` : "Lo antes posible"}
        </span>
        {order.pickupScheduled ? (
          <span className="mt-1 flex w-fit items-center rounded-full bg-status-pending-bg px-2 py-0.5 text-st-overline font-bold uppercase tracking-wide text-status-pending-text">
            Programado
          </span>
        ) : pickupLabel ? (
          <span className="mt-1 block text-st-overline font-bold uppercase tracking-wide text-ink-secondary">
            ASAP
          </span>
        ) : null}
      </div>

      <div className="hidden lg:block">
        <AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
          {getAdminOrderStatusLabel(order.status)}
        </AdminStatusSolid>
      </div>

      <div className="hidden text-right lg:block">
        <p className="font-mono text-st-body font-bold tabular-nums text-ink">
          {formatCurrency(order.total, currency)}
        </p>
        <p
          data-testid="order-list-financial-desktop"
          className={`mt-0.5 text-st-overline font-bold uppercase tracking-wide ${FINANCIAL_TONE_CLASSES[financial.tone]}`}
        >
          {financial.label}
        </p>
      </div>

      <span aria-hidden="true" className="hidden text-right text-lg text-ink-muted lg:block">
        ›
      </span>
    </Link>
  );
}
