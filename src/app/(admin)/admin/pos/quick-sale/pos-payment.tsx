"use client";

import * as React from "react";

import { PAYMENT_METHOD_TYPE_LABELS } from "@/modules/orders/domain/order.types";
import { calculateOrderChange } from "@/modules/orders/domain/payment-change";
import { POS_PAYMENT_METHODS } from "@/modules/pos/domain/pos-sale";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { roundCurrency } from "@/shared/lib/order-totals";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

import type { PosPaymentDraft } from "../pos-types";
import PosQuickCash from "../pos-quick-cash";
import { OverlineLabel } from "./pos-disclosure";

/**
 * El cobro de la venta normal: medio, moneda (si hay tasa), monto, montos rápidos y **vuelto en vivo**.
 *
 * **`mixed` no está en la lista y es a propósito**: el mixto es un *resultado* de partir el cobro entre dos
 * medios, no algo que el cajero elija. La lista sale del dominio (`POS_PAYMENT_METHODS`), la misma que
 * acepta la API del cobro y que se guarda en una venta en espera.
 *
 * El vuelto sale de `calculateOrderChange`, la misma fórmula que usa el servidor al registrar el cobro: el
 * número de la pantalla y el del arqueo no pueden discrepar. En un cobro **partido** no hay vuelto (lo dice
 * el panel) y lo que se muestra es cuánto se lleva cobrado del total.
 *
 * Partir el cobro vive detrás del disclosure (`Dar un segundo cobro`): es lo que se necesita *a veces*, no
 * en una venta normal, y su lugar natural es debajo de la primera fila.
 */

const PAYMENT_METHOD_CHOICES = POS_PAYMENT_METHODS.map((id) => ({
  id,
  label: PAYMENT_METHOD_TYPE_LABELS[id],
}));

/**
 * El vuelto en vivo de un cobro **único en efectivo**, mientras el cajero escribe.
 *
 * Si todavía no alcanza, lo dice: cobrar con un monto menor lo rechaza el alta.
 */
function LiveChange({
  paidWith,
  total,
  currency,
}: {
  paidWith: number;
  total: number;
  currency: CurrencyFormat;
}) {
  if (!Number.isFinite(paidWith) || paidWith <= 0) return null;

  const change = calculateOrderChange({ paidWithAmount: paidWith, total });
  if (change === null) return null;

  const missing = roundCurrency(total - paidWith);

  if (missing > 0) {
    return (
      <p className="text-st-caption font-medium text-status-sla-text">
        Faltan <span className="font-mono tabular-nums">{formatCurrency(missing, currency)}</span>
      </p>
    );
  }

  return (
    <p className="text-st-body text-ink-secondary">
      Vuelto{" "}
      <span className="font-mono text-st-h3 font-bold tabular-nums text-ink">
        {formatCurrency(change, currency)}
      </span>
    </p>
  );
}

export default function PosPaymentFields({
  payments,
  setPayments,
  fieldErrors,
  currencyCode,
  currency,
  total,
  usdExchangeRate,
  onRemovePayment,
  onAddPayment,
}: {
  payments: PosPaymentDraft[];
  setPayments: React.Dispatch<React.SetStateAction<PosPaymentDraft[]>>;
  /** Los errores por campo que devolvió el servidor (o los de la validación de la pantalla). */
  fieldErrors: Record<string, string>;
  currencyCode: string;
  /** El formato de la moneda del negocio, para los montos rápidos. */
  currency: CurrencyFormat;
  /** El total de la venta: es lo que llena el botón «Exacto». */
  total: number;
  /** Con tasa cargada el cajero puede cobrar en dólares; sin tasa, la moneda no se elige. */
  usdExchangeRate: number | null;
  /** Saca una fila del cobro partido (la primera no se saca: es el medio de la venta). */
  onRemovePayment?: (paymentId: string) => void;
  /** Agrega una fila de cobro con otro medio (partir el pago). */
  onAddPayment?: () => void;
}) {
  const paidTotal = payments.reduce(
    (sum, payment) => sum + (Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : 0),
    0,
  );

  return (
    <div className="space-y-3">
      <OverlineLabel>Pago</OverlineLabel>

      {payments.map((payment, index) => (
        <div key={payment.id} className="space-y-3 rounded-stitch-md border border-line-subtle p-3">
          {index > 0 ? (
            <p className="text-st-body font-semibold text-ink">{`Cobro ${index + 1}`}</p>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-st-body font-medium leading-none text-ink">¿Cómo paga?</p>
            <div role="group" aria-label="¿Cómo paga?" className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_CHOICES.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="pill"
                  variant={payment.method === option.id ? "primary" : "secondary"}
                  aria-pressed={payment.method === option.id}
                  onClick={() =>
                    setPayments((current) =>
                      current.map((item) =>
                        item.id === payment.id ? { ...item, method: option.id } : item,
                      ),
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {usdExchangeRate !== null ? (
            <Select
              label="Moneda del cobro"
              value={payment.currency}
              onChange={(event) =>
                setPayments((current) =>
                  current.map((item) =>
                    item.id === payment.id ? { ...item, currency: event.target.value } : item,
                  ),
                )
              }
              options={[
                { value: currencyCode, label: currencyCode },
                { value: "USD", label: "USD" },
              ]}
            />
          ) : null}

          <Input
            label={
              payment.currency === currencyCode
                ? "Con cuánto paga"
                : `Con cuánto paga (en ${payment.currency})`
            }
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={payment.amount}
            error={fieldErrors.amount ?? fieldErrors.payments}
            onChange={(event) =>
              setPayments((current) =>
                current.map((item) =>
                  item.id === payment.id ? { ...item, amount: event.target.value } : item,
                ),
              )
            }
          />

          {payment.method === "cash" && payment.currency === currencyCode ? (
            <PosQuickCash
              total={total}
              currency={currency}
              onPick={(amount) =>
                setPayments((current) =>
                  current.map((item) =>
                    item.id === payment.id ? { ...item, amount: String(amount) } : item,
                  ),
                )
              }
            />
          ) : null}

          {payment.method === "cash" &&
          payment.currency === currencyCode &&
          payment.amount.trim() !== "" ? (
            <LiveChange paidWith={Number(payment.amount)} total={total} currency={currency} />
          ) : null}

          {payment.method === "transfer" ? (
            <Input
              label="Referencia de la transferencia (opcional)"
              value={payment.reference ?? ""}
              onChange={(event) =>
                setPayments((current) =>
                  current.map((item) =>
                    item.id === payment.id ? { ...item, reference: event.target.value } : item,
                  ),
                )
              }
            />
          ) : null}

          {index > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() =>
                onRemovePayment
                  ? onRemovePayment(payment.id)
                  : setPayments((current) => current.filter((item) => item.id !== payment.id))
              }
            >
              {`Quitar el cobro ${index + 1}`}
            </Button>
          ) : null}
        </div>
      ))}

      {payments.length > 1 ? (
        <p className="text-st-body text-ink-secondary">
          Cobrado{" "}
          <span className="font-mono tabular-nums text-ink">{formatCurrency(paidTotal, currency)}</span> de{" "}
          <span className="font-mono tabular-nums">{formatCurrency(total, currency)}</span>. En un cobro
          partido no hay vuelto.
        </p>
      ) : null}

      {/*
        Partir el cobro: el cajero agrega una fila con otro medio (efectivo + transferencia, dos tarjetas). Vive
        debajo de la primera fila y no detrás de un disclosure: es la mecánica del cobro, no una opción de la
        venta, y el cajero tiene que poder verla sin abrir nada (`SCREEN-POS-QUICK-SALE-001` § *Venta normal*).
      */}
      {onAddPayment ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={onAddPayment}>
          Partir el cobro
        </Button>
      ) : null}
    </div>
  );
}
