"use client";

import * as React from "react";

import type { PosOperationalOrder } from "@/modules/orders/domain/pos-operational-orders";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";

import {
  POS_OPERATIONAL_MODE_TITLES,
  filterPosOperationalOrders,
  sortByPickupTime,
  type PosOperationalMode,
} from "./pos-operational-band";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §21, §22, §23) — **el panel operacional reutilizable**.
 *
 * Un solo panel para los cuatro modos. El brief es explícito: «No crear cuatro modales independientes» y
 * «evitar múltiples `<dialog>` montados que puedan interceptar punteros o romper E2E» — la deuda `A-92` es
 * exactamente eso, dos `<dialog open>` donde el que recibe el toque no es el que el spec cree.
 *
 * Por eso el panel **se monta sólo cuando está abierto**: no hay un diálogo cerrado esperando en el DOM. Y el
 * `mode` es una prop: abrir «Listos» y después «Por cobrar» es el **mismo** componente con otro filtro, no otra
 * pantalla.
 *
 * Las filas son las cuatro columnas que el cajero necesita para decidir (brief §22): número, cliente, canal y
 * los dos estados —producción y financiero— que son **ejes independientes** y por eso se dibujan separados.
 * Lo que el panel **no** hace: reconstruir `/admin/orders`. La búsqueda es por número o nombre —lo que el
 * cajero tiene a mano cuando el cliente está enfrente— y el detalle completo se abre en Pedidos.
 */

/** Los badges del canal. Sin valor **no** se dibuja etiqueta: nunca una adivinada (`D-015`). */
const SOURCE_LABELS: Record<"menu" | "pos", string> = { menu: "MENÚ", pos: "POS" };

/**
 * El rótulo del estado de **producción**, en el vocabulario del POS.
 *
 * Es distinto del grupo del listado administrativo a propósito: acá el cajero pregunta «¿ya lo puedo
 * entregar?», no «¿en qué grupo de búsqueda cae?».
 */
const PRODUCTION_LABELS: Record<string, string> = {
  new: "NUEVO",
  confirmed: "CONFIRMADO",
  accepted: "ACEPTADO",
  preparing: "PREPARANDO",
  ready: "LISTO",
  ready_for_pickup: "LISTO",
};

const FINANCIAL_LABELS = {
  pending: "POR COBRAR",
  partial: "PARCIAL",
  paid: "PAGADO",
} as const;

/** El tono visual del estado financiero. `review` es el único que pide una decisión antes de cobrar. */
function financialBadge(order: PosOperationalOrder): { label: string; className: string } {
  const { status, unresolvedAmount } = order.financialState;

  if (status === "paid") {
    return { label: FINANCIAL_LABELS.paid, className: "border-status-ready-border bg-status-ready-bg text-status-ready-text" };
  }

  if (status === "partial" && unresolvedAmount > 0) {
    return { label: "REVISAR", className: "border-status-sla-border bg-status-sla-bg text-status-sla-text" };
  }

  return { label: FINANCIAL_LABELS[status], className: "border-status-pending-border bg-status-pending-bg text-status-pending-text" };
}

/** La hora prometida, en la **zona del negocio** — nunca la del navegador (brief §56). */
export function formatPickupTime(
  pickupTime: string | null,
  timeZone: string,
  locale = "es-NI",
): string | null {
  if (!pickupTime) return null;

  const parsed = new Date(pickupTime);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function PosOperationalPanel({
  mode,
  orders,
  timeZone,
  onClose,
  onOpenOrder,
}: {
  mode: PosOperationalMode;
  /** El feed operacional completo del local; el panel sólo lo filtra por modo. */
  orders: readonly PosOperationalOrder[];
  /** La zona horaria del negocio, resuelta por el servidor. */
  timeZone: string;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [search, setSearch] = React.useState("");

  const byMode = React.useMemo(() => {
    const filtered = filterPosOperationalOrders(orders, mode);

    // En «Programados» el orden es la hora prometida; en el resto, el del feed del servidor.
    return mode === "scheduled" ? sortByPickupTime(filtered) : filtered;
  }, [mode, orders]);

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? byMode.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(needle) ||
          order.customerName.toLowerCase().includes(needle),
      )
    : byMode;

  /** Escape lo maneja el `Modal` (evento `cancel` del `<dialog>` nativo): acá no se reimplementa. */
  return (
    <Modal
      open
      onClose={onClose}
      title={POS_OPERATIONAL_MODE_TITLES[mode]}
      size="full"
      testId="pos-operational-panel"
      closeLabel="Cerrar panel"
      /**
       * **Capa, no modal** (brief §21). Con el panel abierto el cajero tiene que poder pulsar **otro** KPI y
       * cambiar de modo en el **mismo** panel: un modal del navegador intercepta esos toques —el spec E2E lo
       * midió: `<dialog …> intercepts pointer events`— y además convertiría el cambio de modo en un cierre y
       * una apertura, que es justo lo que el brief prohíbe («no crear cuatro modales independientes»).
       */
      layered
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle pb-2">
        <span className="mr-auto font-mono text-st-body tabular-nums text-ink-secondary">
          {visible.length} {visible.length === 1 ? "pedido" : "pedidos"}
        </span>
      </div>

      <div className="py-2">
        <Input
          label="Buscar pedido"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Número de pedido o cliente"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-3 text-st-body text-ink-secondary">
          {byMode.length === 0
            ? "No hay pedidos en esta lista."
            : "Ningún pedido coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="max-h-[52vh] overflow-y-auto">
          {visible.map((order) => {
            const financial = financialBadge(order);
            const pickup = order.pickupScheduled
              ? formatPickupTime(order.pickupTime, timeZone)
              : null;

            return (
              <li key={order.id}>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="pos-operational-row"
                  onClick={() => onOpenOrder(order.id)}
                  className="min-h-11 w-full rounded-none border-b border-line-subtle px-4 py-2"
                >
                  {/*
                    El contenido va en su propio `flex`: el primitivo centra a sus hijos y la fila necesita
                    repartir número, cliente, badges y hora en un renglón que envuelve en el celular.
                  */}
                  <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left">
                  <span className="font-mono text-st-body font-semibold tabular-nums text-ink">
                    {order.orderNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-st-body text-ink">
                    {order.customerName}
                  </span>

                  {/*
                    El canal es un **badge**, no un KPI (brief §22). Sin valor no se dibuja: un pedido anterior
                    a la columna no tiene canal declarado y adivinarlo sería inventar un dato (`D-015`).
                  */}
                  {order.source ? (
                    <span className="rounded-stitch-sm border border-line-subtle px-1.5 py-0.5 text-st-caption font-medium text-ink-secondary">
                      {SOURCE_LABELS[order.source]}
                    </span>
                  ) : null}

                  <span className="text-st-caption font-semibold text-ink-secondary">
                    {PRODUCTION_LABELS[order.status] ?? order.status}
                  </span>

                  <span
                    className={[
                      "rounded-stitch-sm border px-1.5 py-0.5 text-st-caption font-semibold",
                      financial.className,
                    ].join(" ")}
                  >
                    {financial.label}
                  </span>

                  {pickup ? (
                    <span className="font-mono text-st-caption tabular-nums text-ink-secondary">
                      {pickup}
                    </span>
                  ) : null}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export default PosOperationalPanel;
