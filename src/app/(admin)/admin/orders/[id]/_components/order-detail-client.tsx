"use client";

import { useEffect, useRef, useState } from "react";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { resolveFinancialStateLabel } from "@/modules/orders/domain/admin-order-filters";
import { getAdminOrderSolidStatus, AdminStatusSolid } from "../../../_components/admin-operational-ui";

import OrderInvoicePanel from "../../order-invoice-panel";
import OrderTicketButton from "../../order-ticket-button";
import { readOrderDetail } from "../../order-api";
import { FINANCIAL_TONE_CLASSES } from "../../order-list-types";
import {
  DetailPanel,
  OrderCustomerPanel,
  OrderHistoryPanel,
  OrderItemsPanel,
  OrderOperationPanel,
  OrderPaymentPanel,
  OrderPickupPanel,
  type OrderDetailView,
} from "../../order-detail-panels";
import { OrderDetailActions } from "./order-detail-actions";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **`/admin/orders/[id]`**, el detalle del pedido.
 *
 * Composición de la referencia aprobada: dos columnas en escritorio —a la izquierda el pedido, el cliente, el
 * retiro y el **historial real**; a la derecha el pago, la operación y los documentos— y **una** columna en
 * tablet y celular.
 *
 * Quién puede ver la plata **no lo decide esta pantalla**: el servidor devuelve la proyección con el recorte
 * aplicado, y `canViewFinancials` dice qué bloques existen. Si el rol no puede ver montos, los paneles de pago
 * y documentos no se dibujan **porque no hay datos**, no porque se escondan (`A-60`).
 *
 * Después de una acción administrativa (retirar, cerrar, cancelar) se **vuelve a leer** el pedido en vez de
 * parchear el estado a mano: los sellos y el estado financiero los resuelve el servidor.
 */
export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ kind: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const currency = useCurrencyFormat();
  const { timezone: timeZone } = useBusinessSettings();

  // Los setters de `useState` son estables: el efecto no se vuelve a disparar por ellos.
  const setOrderRef = useRef(setOrder);
  const setLoadingRef = useRef(setLoading);
  const setFailureRef = useRef(setFailure);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingRef.current(true);

      const result = await readOrderDetail(orderId);
      if (cancelled) return;

      if (result.ok) {
        setOrderRef.current(result.data as unknown as OrderDetailView);
        setFailureRef.current(null);
      } else {
        setFailureRef.current({ kind: result.kind, message: result.message });
      }

      setLoadingRef.current(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken]);

  if (loading && !order) {
    return <p className="text-st-body text-ink-secondary">Cargando pedido…</p>;
  }

  if (!order) {
    return (
      <div className="space-y-3">
        <BackLink />
        <div className="rounded-stitch-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground">
          {failure?.message ?? "No se pudo cargar el pedido."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-28 md:pb-4">
      <BackLink />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-st-h2 font-bold tracking-tight text-ink">
            {order.orderNumber} · {order.customer.name}
          </h1>
          <p className="mt-1 text-st-caption text-ink-secondary">
            {SOURCE_TEXT[order.source ?? "menu"]} ·{" "}
            {order.pickup.mode === "scheduled" ? "Programado" : "ASAP"} ·{" "}
            {order.pickup.location?.name ?? "Sin local"}
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-st-overline font-bold uppercase tracking-wide">
          <AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
            {getAdminOrderStatusLabel(order.status)}
          </AdminStatusSolid>
          {order.financial ? (
            <span
              className={`rounded-full bg-surface-elevated px-3 py-1.5 ${FINANCIAL_TONE_CLASSES[financialStateTone(order)]}`}
            >
              {financialText(order)}
            </span>
          ) : null}
        </p>
      </header>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="order-detail-notice"
          className="flex flex-wrap items-center justify-between gap-2 rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 text-st-body font-semibold text-ink"
        >
          {notice}
          <Button variant="ghost" className="min-h-11" onClick={() => setNotice(null)}>
            Cerrar
          </Button>
        </div>
      ) : null}

      {/* Resumen de una línea, como la referencia. Sólo con capacidad financiera hay total que mostrar. */}
      {order.totals && order.financial ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-st-caption text-ink-secondary">
          <span>
            Total{" "}
            <strong className="font-mono tabular-nums text-ink">
              {formatCurrency(order.totals.total, currency)}
            </strong>
          </span>
          <span>
            Pagado{" "}
            <strong className="font-mono tabular-nums text-ink">
              {formatCurrency(order.financial.paidAmount, currency)}
            </strong>
          </span>
          <span>
            Pendiente{" "}
            <strong className="font-mono tabular-nums text-ink">
              {formatCurrency(order.financial.outstandingAmount, currency)}
            </strong>
          </span>
        </p>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-3">
          <OrderItemsPanel
            items={order.items}
            currency={currency}
            canViewFinancials={order.canViewFinancials}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <OrderCustomerPanel
              customer={order.customer}
              pickupPin={order.pickupPin}
              canViewFinancials={order.canViewFinancials}
            />
            <OrderPickupPanel pickup={order.pickup} timeZone={timeZone} />
          </div>
          <OrderHistoryPanel history={order.history} timeZone={timeZone} />
        </div>

        <div className="min-w-0 space-y-3">
          {order.totals && order.financial ? (
            <OrderPaymentPanel
              totals={order.totals}
              financial={order.financial}
              payments={order.payments}
              currency={currency}
            />
          ) : null}
          <OrderOperationPanel
            createdAt={order.createdAt}
            stageTimes={order.stageTimes}
            timeZone={timeZone}
          />
          {order.canViewFinancials ? (
            <DetailPanel title="Documentos">
              <div className="space-y-3">
                <OrderTicketButton order={ticketOrderFor(order)} />
                <OrderInvoicePanel orderId={order.id} currency={currency} />
                {order.invoice ? (
                  <a
                    className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline underline-offset-2"
                    href={order.invoice.printUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Imprimir {order.invoice.number} (80 mm)
                  </a>
                ) : null}
              </div>
            </DetailPanel>
          ) : null}
          <OrderDetailActions
            order={order}
            onDone={(message) => {
              setNotice(message);
              setReloadToken((token) => token + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}

const SOURCE_TEXT: Record<string, string> = {
  menu: "Menú",
  pos: "POS",
};

function financialText(order: OrderDetailView): string {
  if (!order.financial) return "";

  if (order.financial.status === "paid") return "Pagado";
  if (order.financial.unresolvedAmount > 0) return "Parcial · revisar";
  if (order.financial.status === "partial") return "Parcial";

  return "Pendiente";
}

/** El tono del rótulo financiero, con la misma regla que el listado (dominio, una sola vez). */
function financialStateTone(order: OrderDetailView) {
  if (!order.financial) return "pending" as const;

  return resolveFinancialStateLabel({
    state: order.financial.status,
    unresolvedAmount: order.financial.unresolvedAmount,
  }).tone;
}

/**
 * La forma que el ticket de cliente necesita, armada desde la proyección.
 *
 * El button del ticket es anterior a esta TASK y su contrato es el de la pantalla vieja (`OrderRecord`); el
 * detalle ahora recibe la proyección, así que este mapeo es el adaptador entre las dos. Los datos financieros
 * del detalle y los del ticket son **los mismos**: el ticket no recalcula nada.
 */
function ticketOrderFor(order: OrderDetailView) {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    createdAt: order.createdAt,
    items: order.items,
    subtotal: order.totals?.subtotal ?? 0,
    discount: order.totals?.discount ?? 0,
    packagingAmount: order.totals?.packagingAmount ?? 0,
    tipAmount: order.totals?.tipAmount ?? 0,
    total: order.totals?.total ?? 0,
    payments: order.payments.map((payment) => ({
      method: payment.method as "cash" | "card",
      amount: payment.amount,
      currency: payment.currency,
    })),
    pickupTime: order.pickup.time,
    pickupScheduled: order.pickup.scheduled,
    pickupLocation: order.pickup.location,
  };
}

function BackLink() {
  return (
    <a
      href="/admin/orders"
      className="inline-flex min-h-11 items-center text-st-body font-medium text-ink-secondary hover:text-ink"
    >
      ← Pedidos
    </a>
  );
}
