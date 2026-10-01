"use client";

import * as React from "react";

import { paidTotalInBaseCurrency } from "@/modules/money/domain/paid-total";
import type { PosPaymentMethodOption } from "@/modules/pos/domain/pos-payment-methods";
import type { MoneyContext } from "@/modules/money/domain/money-context";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";

import { formatPickupTime } from "./pos-operational-panel";
import PosPaymentRows from "./pos-payment-rows";
import type { PosPaymentDraft } from "./pos-types";
import type { PosExistingOrder } from "./use-pos-operational";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §15, §16, §17, §18) — **el modo «pedido existente» del POS**.
 *
 * El caso que cierra `A-67`: un pedido que ya existe —del menú, programado o de mostrador— se abre acá, se
 * cobra y se entrega **sin salir del POS**.
 *
 * Cuatro decisiones, y las cuatro son del brief:
 *
 * 1. **El pedido es inmutable desde esta superficie** (§15). No se agregan ni se quitan productos, no se
 *    cambian cantidades ni modificadores, no se edita el cliente, no hay cupón ni descuento manual ni venta en
 *    espera. La única cosa que se puede hacer con un pedido existente es **cobrarlo y entregarlo**: lo demás
 *    pertenece a Pedidos. Es una decisión de producto y también la razón de que este panel no reutilice el
 *    carrito: un carrito para editar un pedido es la recreación que el brief prohíbe (§15).
 * 2. **Cobrar y entregar son dos hechos, no uno** (§17). El cajero ve dos acciones consecutivas en el mismo
 *    panel: `Cobrar` → «Pago registrado» → `Entregar`. No existe un «Cobrar y entregar» que los fusione.
 * 3. **La acción la decide el estado** (§16): `ready + pending → Cobrar`; `ready + paid → Entregar`;
 *    `preparing + paid → esperar Cocina`; `picked_up/closed/cancelled → nada`;
 *    `partial`/`unresolved → REVISAR`.
 * 4. **Cobrar no marca entregado, y quedar listo no cobra** (§16, §62): son tres ejes independientes
 *    (producción, financiero, entrega) y ninguna transición mueve las otras dos.
 */

const STATUS_LABELS: Record<string, string> = {
  new: "NUEVO",
  confirmed: "CONFIRMADO",
  accepted: "ACEPTADO",
  preparing: "PREPARANDO",
  ready: "LISTO",
  ready_for_pickup: "LISTO",
  picked_up: "ENTREGADO",
  delivered: "ENTREGADO",
  closed: "CERRADO",
  cancelled: "CANCELADO",
};

const SOURCE_LABELS: Record<"menu" | "pos", string> = { menu: "MENÚ", pos: "POS" };

/** Lo que el cajero puede hacer con este pedido **ahora**. Es la matriz del brief §16, en una sola función. */
export type ExistingOrderAction =
  | { kind: "collect" }
  | { kind: "deliver" }
  | { kind: "await-kitchen" }
  | { kind: "review" }
  | { kind: "none"; reason: string };

export function resolveExistingOrderAction(order: PosExistingOrder): ExistingOrderAction {
  const financial = order.financial;
  const production = order.status;

  if (production === "cancelled") return { kind: "none", reason: "El pedido está cancelado." };
  if (production === "picked_up" || production === "delivered" || production === "closed") {
    return { kind: "none", reason: "El pedido ya se entregó." };
  }

  // Sin capacidad financiera no hay saldo demostrable: primero hay que revisarlo, no cobrarlo.
  if (!financial) return { kind: "review" };

  // Brief §32: `partial` con plata cuyo equivalente no se demuestra sale del flujo normal.
  if (financial.unresolvedAmount > 0) return { kind: "review" };

  if (financial.status === "paid") {
    // Brief §16: `ready + paid → Entregar`. Cualquier otro estado con la plata cobrada espera a Cocina.
    return production === "ready_for_pickup"
      ? { kind: "deliver" }
      : { kind: "await-kitchen" };
  }

  return { kind: "collect" };
}

export function PosExistingOrderPanel({
  order,
  loading,
  error,
  money,
  methodOptions,
  acceptedCurrencies,
  currency,
  timeZone,
  onClose,
  onCollected,
  onDelivered,
}: {
  order: PosExistingOrder | null;
  loading: boolean;
  error: string | null;
  money: MoneyContext;
  methodOptions: PosPaymentMethodOption[];
  /** `A-85` — las monedas que el negocio acepta, de `money`: son las que el cobro ofrece. */
  acceptedCurrencies: string[];
  currency: CurrencyFormat;
  /** La zona horaria del **negocio** para la hora prometida: nunca la del navegador (brief §56). */
  timeZone: string;
  onClose: () => void;
  /** Se llama después de que el servidor confirmó la liquidación, para releer el hecho canónico. */
  onCollected: () => void;
  /** Se llama después de que el servidor confirmó la entrega. */
  onDelivered: () => void;
}) {
  const [payments, setPayments] = React.useState<PosPaymentDraft[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const firstMethod = methodOptions[0] ?? null;
  const outstanding = order?.financial?.outstandingAmount ?? 0;

  /**
   * La liquidación nace con **una** fila por el saldo exacto y el primer medio del local: es el caso normal
   * (un medio, todo el saldo) y el cajero sólo toca algo si va a partir el cobro.
   */
  React.useEffect(() => {
    setPayments(
      firstMethod === null || outstanding <= 0
        ? []
        : [
            {
              id: "pay_1",
              method: firstMethod.method as PosPaymentDraft["method"],
              paymentMethodId: firstMethod.id,
              currency: money.baseCurrencyCode,
              amount: String(outstanding),
            },
          ],
    );
    setActionError(null);
    setNotice(null);
  }, [order?.id, outstanding, firstMethod, money.baseCurrencyCode]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const paidInBase = paidTotalInBaseCurrency({
    payments,
    baseCurrencyCode: money.baseCurrencyCode,
    rates: money.rates,
  });

  const collect = async () => {
    if (!order) return;

    setBusy(true);
    setActionError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments: payments
            .filter((payment) => payment.paymentMethodId && Number(payment.amount) > 0)
            .map((payment) => ({
              paymentMethodId: payment.paymentMethodId,
              method: payment.method,
              amount: Number(payment.amount),
              currency: payment.currency,
              reference: payment.reference ?? null,
            })),
          idempotencyKey: createCollectionKey(),
        }),
      });

      const body = (await response.json()) as {
        data?: { appliedAmount: number };
        error?: { message?: string };
      };

      if (!response.ok || !body.data) {
        setActionError(body.error?.message ?? "No se pudo registrar el cobro.");
        return;
      }

      // Brief §17: el cobro queda **registrado** y el cajero ve la entrega como el paso siguiente.
      setNotice("Pago registrado.");
      onCollected();
    } catch {
      setActionError("No se pudo registrar el cobro: revisá la conexión y reintentá.");
    } finally {
      setBusy(false);
    }
  };

  const deliver = async () => {
    if (!order) return;

    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "picked_up" }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setActionError(body.error?.message ?? "No se pudo entregar el pedido.");
        return;
      }

      setNotice("Pedido entregado.");
      onDelivered();
    } catch {
      setActionError("No se pudo entregar el pedido: revisá la conexión y reintentá.");
    } finally {
      setBusy(false);
    }
  };

  const action = order ? resolveExistingOrderAction(order) : { kind: "none" as const, reason: "" };
  const financial = order?.financial ?? null;

  /**
   * El panel es un `Modal` del sistema y no un diálogo declarado a mano: el guardrail
   * `manual-aria-role` lo prohíbe con techo 0, y el primitivo ya trae el foco atrapado, el Escape y la
   * semántica. El pedido **es** la tarea del cajero en este momento, así que la capa modal es correcta:
   * se cierra para volver al mostrador.
   */
  return (
    <Modal
      open
      onClose={onClose}
      title="Pedido existente"
      size="full"
      testId="pos-existing-order-panel"
      closeLabel="Cerrar pedido"
    >

      {loading ? (
        <p role="status" className="px-4 py-3 text-st-body text-ink-secondary">
          Leyendo el pedido…
        </p>
      ) : error ? (
        <p role="status" className="px-4 py-3 text-st-body text-status-sla-text">
          {error}
        </p>
      ) : order ? (
        <div className="max-h-[62vh] space-y-3 overflow-y-auto px-4 py-3">
          {/*
            La identidad del pedido: número, cliente, canal y retiro. Sin el canal declarado no se dibuja
            etiqueta —nunca una adivinada (`D-015`)—.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-st-h4 font-bold tabular-nums text-ink">
              {order.orderNumber}
            </span>
            <span className="text-st-body text-ink">{order.customerName}</span>
            {order.source ? (
              <span className="rounded-stitch-sm border border-line-subtle px-1.5 py-0.5 text-st-caption font-medium text-ink-secondary">
                {SOURCE_LABELS[order.source]}
              </span>
            ) : null}
            {order.pickupScheduled && order.pickupTime ? (
              <span className="font-mono text-st-caption tabular-nums text-ink-secondary">
                {`Retiro ${formatPickupTime(order.pickupTime, timeZone) ?? ""}`.trim()}
              </span>
            ) : null}
          </div>

          {/* Brief §4: los dos ejes se muestran separados porque son independientes. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-stitch-sm border border-line-subtle bg-surface-low px-2 py-0.5 text-st-caption font-semibold text-ink">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            <span
              className={[
                "rounded-stitch-sm border px-2 py-0.5 text-st-caption font-semibold",
                financial?.status === "paid"
                  ? "border-status-ready-border bg-status-ready-bg text-status-ready-text"
                  : financial && financial.unresolvedAmount > 0
                    ? "border-status-sla-border bg-status-sla-bg text-status-sla-text"
                    : "border-status-pending-border bg-status-pending-bg text-status-pending-text",
              ].join(" ")}
            >
              {financial === null
                ? "SIN DATO FINANCIERO"
                : financial.unresolvedAmount > 0
                  ? "REVISAR"
                  : financial.status === "paid"
                    ? "PAGADO"
                    : financial.status === "partial"
                      ? "PARCIAL"
                      : "PENDIENTE DE PAGO"}
            </span>
          </div>

          {financial ? (
            <dl className="grid grid-cols-3 gap-2 rounded-stitch-md border border-line-subtle p-2">
              <div>
                <dt className="text-st-caption text-ink-secondary">Total</dt>
                <dd className="font-mono text-st-body tabular-nums text-ink">
                  {formatCurrency(order.total, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-st-caption text-ink-secondary">Pagado</dt>
                <dd className="font-mono text-st-body tabular-nums text-ink">
                  {formatCurrency(financial.paidAmount, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-st-caption text-ink-secondary">Pendiente</dt>
                <dd className="font-mono text-st-body font-bold tabular-nums text-ink">
                  {formatCurrency(financial.outstandingAmount, currency)}
                </dd>
              </div>
            </dl>
          ) : null}

          {/*
            El pedido es **inmutable desde acá** (brief §15). Se dice explícitamente: el cajero que busca
            «agregar un producto» tiene que saber que eso vive en Pedidos, no que la pantalla está rota.
          */}
          <p className="text-st-caption text-ink-secondary">
            Desde el POS este pedido sólo se cobra y se entrega. Para cambiarlo, abrilo en Pedidos.
          </p>

          {action.kind === "collect" && financial ? (
            <div className="space-y-2">
              <PosPaymentRows
                payments={payments}
                setPayments={setPayments}
                fieldErrors={{}}
                currencyCode={money.baseCurrencyCode}
                currency={currency}
                total={outstanding}
                acceptedCurrencies={acceptedCurrencies}
                methodOptions={methodOptions}
                onRemovePayment={(paymentId) =>
                  setPayments((current) => current.filter((item) => item.id !== paymentId))
                }
              />

              {payments.length > 1 ? (
                <p className="text-st-caption text-ink-secondary">
                  Se aplican{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {formatCurrency(paidInBase, currency)}
                  </span>{" "}
                  de <span className="font-mono tabular-nums">{formatCurrency(outstanding, currency)}</span>.
                  La liquidación tiene que cubrir el saldo exacto.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    setPayments((current) => [
                      ...current,
                      {
                        id: `pay_${current.length + 1}`,
                        method: (firstMethod?.method ?? "cash") as PosPaymentDraft["method"],
                        ...(firstMethod ? { paymentMethodId: firstMethod.id } : {}),
                        currency: money.baseCurrencyCode,
                        amount: "",
                      },
                    ])
                  }
                >
                  Partir el cobro
                </Button>

                <Button
                  type="button"
                  className="min-h-11"
                  disabled={busy || payments.length === 0}
                  onClick={() => void collect()}
                >
                  {busy ? "Cobrando…" : `Cobrar ${formatCurrency(outstanding, currency)}`}
                </Button>
              </div>
            </div>
          ) : null}

          {/*
            Brief §16/§17: con la plata cobrada y el pedido listo, la acción es **entregar** y aparece en el
            mismo panel. Cobrar no entregó nada.
          */}
          {action.kind === "deliver" ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() => void deliver()}
            >
              {busy ? "Entregando…" : "Entregar"}
            </Button>
          ) : null}

          {action.kind === "await-kitchen" ? (
            <p role="status" className="text-st-body text-ink-secondary">
              El pedido está cobrado y la cocina todavía lo está preparando. Entregalo cuando esté listo.
            </p>
          ) : null}

          {action.kind === "review" ? (
            <p role="status" className="text-st-body text-status-sla-text">
              Este pedido necesita revisión antes de cobrarse: hay plata cobrada cuyo equivalente no se puede
              demostrar. Revisalo desde Pedidos.
            </p>
          ) : null}

          {action.kind === "none" ? (
            <p role="status" className="text-st-body text-ink-secondary">
              {action.reason}
            </p>
          ) : null}

          {notice ? (
            <p role="status" className="text-st-body font-medium text-status-ready-text">
              {notice}
            </p>
          ) : null}

          {actionError ? (
            <p role="alert" className="text-st-body text-status-sla-text">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : (
        <p role="status" className="px-4 py-3 text-st-body text-ink-secondary">
          No hay un pedido abierto.
        </p>
      )}
    </Modal>
  );
}

/**
 * `A-71` — la clave de idempotencia de **esta** liquidación, generada en el dispositivo.
 *
 * La clave la manda el cliente porque una inventada por el servidor no deduplica nada (cada request tendría
 * una distinta). Es una por intento de cobro: si el cajero corrige un monto y vuelve a cobrar, es otra
 * liquidación y le corresponde otra clave; si el request se reintenta por red, la misma clave devuelve el
 * hecho que ya existe en vez de cobrar dos veces.
 */
export function createCollectionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `pos-order-${crypto.randomUUID()}`;
  }

  return `pos-order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default PosExistingOrderPanel;

