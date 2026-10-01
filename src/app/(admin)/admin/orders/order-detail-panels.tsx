import type { OrderDetailProjection } from "@/modules/orders/features/get-order/order-detail-projection";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **los paneles del detalle**, uno por bloque de la referencia aprobada.
 *
 * Son de presentación y **no deciden nada de negocio**: el recorte financiero ya lo aplicó el servidor (lo
 * que llega en `null` es porque el rol no puede verlo), y el recorrido sale del **historial real** que trae la
 * proyección, no de un mapa estado→etapa paralelo.
 *
 * Las fechas se formatean **en la zona del negocio** (`A-63`), no con la del navegador.
 */
export type OrderDetailView = OrderDetailProjection;

/** El panel base: mismo borde, mismo radio y mismo encabezado en todos los bloques. */
export function DetailPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-stitch-lg border border-line-subtle bg-surface-card p-3 shadow-elevation-1 ${className}`}
    >
      <h2 className="mb-2 text-st-overline font-bold uppercase tracking-wider text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Una fila etiqueta → valor. Los números van en mono con `tabular-nums`. */
export function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-st-body">
      <span className="text-ink-secondary">{label}</span>
      <strong
        className={`text-right font-semibold tabular-nums ${strong ? "text-base text-ink" : "text-ink"}`}
      >
        {value}
      </strong>
    </div>
  );
}

export function OrderItemsPanel({
  items,
  currency,
  canViewFinancials,
}: {
  items: OrderDetailView["items"];
  currency: CurrencyFormat;
  canViewFinancials: boolean;
}) {
  return (
    <DetailPanel title="Pedido">
      <div className="divide-y divide-line-subtle">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 py-2">
            <span className="font-mono text-st-body font-bold tabular-nums text-brand-amber">
              {item.quantity}×
            </span>
            <div className="min-w-0">
              <p className="text-st-body font-semibold text-ink">{item.productName}</p>
              {item.modifiers.length > 0 ? (
                <p className="mt-1 text-st-caption text-ink-secondary">
                  {item.modifiers
                    .map((modifier) =>
                      modifier.priceDelta > 0
                        ? `${modifier.name} (+${formatCurrency(modifier.priceDelta, currency)})`
                        : modifier.name,
                    )
                    .join(" · ")}
                </p>
              ) : null}
              {item.notes ? (
                <p className="mt-1 inline-block rounded-stitch-sm bg-status-pending-bg px-1.5 py-0.5 text-st-caption font-medium text-status-pending-text">
                  {item.notes}
                </p>
              ) : null}
            </div>
            {/* El precio por línea es plata: sin capacidad financiera no se dibuja. */}
            <span className="font-mono text-st-caption tabular-nums text-ink-secondary">
              {canViewFinancials ? formatCurrency(item.lineTotal, currency) : ""}
            </span>
          </div>
        ))}
      </div>
    </DetailPanel>
  );
}

export function OrderCustomerPanel({
  customer,
  pickupPin,
  canViewFinancials,
}: {
  customer: OrderDetailView["customer"];
  pickupPin: string | null;
  canViewFinancials: boolean;
}) {
  return (
    <DetailPanel title="Cliente">
      <DetailRow label="Nombre" value={customer.name} />
      <DetailRow label="WhatsApp" value={customer.whatsapp || "—"} />
      {customer.email ? <DetailRow label="Correo" value={customer.email} /> : null}
      {/* El PIN es de mostrador: lo dicta el cliente para que le entreguen el pedido. */}
      {canViewFinancials && pickupPin ? (
        <div className="flex items-center justify-between py-1 text-st-body">
          <span className="text-ink-secondary">PIN retiro</span>
          <strong className="font-mono text-st-body font-bold tracking-[0.18em] text-brand-primary">
            {pickupPin}
          </strong>
        </div>
      ) : null}
    </DetailPanel>
  );
}

export function OrderPickupPanel({
  pickup,
  timeZone,
}: {
  pickup: OrderDetailView["pickup"];
  timeZone: string;
}) {
  const time = pickup.time ? formatTimeInTimeZone(pickup.time, timeZone) : null;

  return (
    <DetailPanel title="Retiro">
      <DetailRow label="Modalidad" value={pickup.mode === "scheduled" ? "Programado" : "Lo antes posible"} />
      <DetailRow label="Hora" value={time ?? "—"} />
      <DetailRow label="Local" value={pickup.location?.name ?? "—"} />
      {pickup.notes ? <DetailRow label="Notas" value={pickup.notes} /> : null}
    </DetailPanel>
  );
}

/**
 * **El historial real**: cada cambio de estado con su hora y su **actor**, tal como quedó asentado.
 *
 * No hay un recorrido «esperado» dibujado aparte: lo que se ve es lo que pasó. Un evento sin firma (un
 * usuario borrado o un cambio viejo) queda sin nombre en vez de inventar uno.
 */
export function OrderHistoryPanel({
  history,
  timeZone,
}: {
  history: OrderDetailView["history"];
  timeZone: string;
}) {
  return (
    <DetailPanel title="Historial real">
      {history.length === 0 ? (
        <p className="text-st-body text-ink-secondary">Este pedido no tiene cambios de estado asentados.</p>
      ) : (
        <ol className="space-y-0">
          {history.map((event) => (
            /*
             * En celular el evento va en **una línea que fluye** (hora · texto): en la columna angosta de un
             * panel a 375 px, «8:51 p. m.» se partía en dos y la línea de tiempo se leía mal. En escritorio
             * vuelven las tres columnas de la referencia —hora, punto y texto— con el punto del timeline.
             */
            <li
              key={event.id}
              className="flex flex-wrap items-baseline gap-x-2 py-1 text-st-caption lg:grid lg:grid-cols-[3.5rem_0.75rem_minmax(0,1fr)] lg:items-start lg:gap-x-2"
            >
              <span className="font-mono tabular-nums whitespace-nowrap text-ink-secondary">
                {formatTimeInTimeZone(event.at, timeZone) || "—"}
              </span>
              <span
                aria-hidden="true"
                className="mt-1.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary lg:block"
              />
              <span className="min-w-0 text-ink">
                {STATUS_EVENT_LABELS[event.status] ?? event.status}
                {event.actor ? <span className="text-ink-secondary"> · {event.actor}</span> : null}
                {event.note ? <span className="text-ink-secondary"> · {event.note}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </DetailPanel>
  );
}

/**
 * El texto de cada hito del historial. Es **vocabulario del evento** («Pedido confirmado»), no un mapa
 * estado→etapa: el recorrido sale de las filas reales y este mapa sólo las redacta.
 */
const STATUS_EVENT_LABELS: Record<string, string> = {
  new: "Pedido creado",
  confirmed: "Pedido confirmado",
  accepted: "Pedido aceptado",
  preparing: "Preparación iniciada",
  ready: "Pedido listo",
  ready_for_pickup: "Marcado como listo",
  picked_up: "Retirado por el cliente",
  out_for_delivery: "Salió a entregar",
  delivered: "Entregado",
  served: "Servido",
  closed: "Pedido cerrado",
  cancelled: "Pedido cancelado",
};

/** El bloque de plata: subtotal, empaque, descuento, total, pagado y pendiente. Nada se recalcula acá. */
export function OrderPaymentPanel({
  totals,
  financial,
  payments,
  currency,
}: {
  totals: NonNullable<OrderDetailView["totals"]>;
  financial: NonNullable<OrderDetailView["financial"]>;
  payments: OrderDetailView["payments"];
  currency: CurrencyFormat;
}) {
  return (
    <DetailPanel title="Pago">
      <DetailRow label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
      <DetailRow label="Empaque" value={formatCurrency(totals.packagingAmount, currency)} />
      <DetailRow label="Descuento" value={`-${formatCurrency(totals.discount, currency)}`} />
      <DetailRow label="Total" value={formatCurrency(totals.total, currency)} strong />
      <DetailRow label="Pagado" value={formatCurrency(financial.paidAmount, currency)} />
      <DetailRow label="Pendiente" value={formatCurrency(financial.outstandingAmount, currency)} />
      {financial.unresolvedAmount > 0 ? (
        <DetailRow
          label="Sin demostrar"
          value={`${formatCurrency(financial.unresolvedAmount, currency)} · revisar`}
        />
      ) : null}
      <DetailRow label="Moneda" value={financial.baseCurrencyCode} />
      {payments.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-line-medium pt-2">
          {payments.map((payment) => (
            <p key={payment.id} className="text-st-caption text-ink-secondary">
              <span className="font-semibold text-ink">
                {payment.currency ?? financial.baseCurrencyCode} {payment.amount.toFixed(2)}
              </span>{" "}
              · {payment.method}
              {payment.changeAmount > 0 ? ` · cambio ${payment.changeAmount.toFixed(2)}` : ""}
              {payment.voidedAt ? " · ANULADO" : ""}
              {payment.voidReason ? ` · ${payment.voidReason}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </DetailPanel>
  );
}

/** Los sellos por etapa, derivados del historial por el dominio. «—» = esa etapa no pasó. */
export function OrderOperationPanel({
  createdAt,
  stageTimes,
  timeZone,
}: {
  createdAt: string;
  stageTimes: OrderDetailView["stageTimes"];
  timeZone: string;
}) {
  const stamp = (value: string | null) => (value ? formatTimeInTimeZone(value, timeZone) || "—" : "—");

  return (
    <DetailPanel title="Operación">
      <DetailRow label="Creado" value={stamp(createdAt)} />
      <DetailRow label="Confirmado" value={stamp(stageTimes.confirmedAt)} />
      <DetailRow label="Inicio prep." value={stamp(stageTimes.preparingAt)} />
      <DetailRow label="Terminado" value={stamp(stageTimes.readyAt)} />
      <DetailRow label="Retirado" value={stamp(stageTimes.pickedUpAt)} />
      <DetailRow label="Cerrado" value={stamp(stageTimes.closedAt)} />
    </DetailPanel>
  );
}
