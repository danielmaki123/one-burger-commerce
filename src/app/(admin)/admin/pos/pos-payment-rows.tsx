"use client";

import * as React from "react";

import { calculateOrderChange } from "@/modules/orders/domain/payment-change";
import type { PosPaymentMethodOption } from "@/modules/pos/domain/pos-payment-methods";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { roundCurrency } from "@/shared/lib/order-totals";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

import type { PosPaymentDraft } from "./pos-types";
import PosQuickCash from "./pos-quick-cash";

/**
 * Bloque 4 del roadmap del POS (Fase 2) — las filas del cobro del mostrador.
 *
 * Extraído de `pos-client.tsx`, que es deuda con techo congelado: no puede crecer.
 *
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §39) — **los medios salen del catálogo configurado**. Antes
 * esta pieza armaba sus botones con la constante `POS_PAYMENT_METHODS` («Efectivo», «Tarjeta»,
 * «Transferencia», «Otro») y decidía la referencia con `payment.method === "transfer"`, así que el medio que
 * el dueño configura en Finanzas —«Tarjeta BAC», «Zelle», «Transferencia Banpro»— **nunca llegaba al
 * mostrador**. Eso era la divergencia de `A-85`, marcada `cerrado` sólo por el backend.
 *
 * Dos reglas que ahora se cumplen acá:
 *
 * 1. **La opción es la configurada**, con su nombre real y su `paymentMethodId`: es lo que el servidor
 *    resuelve para el `kind`, la entidad y la disponibilidad por local.
 * 2. **La referencia la pide el medio, no el tipo** (`requiresReference`): Zelle es `wallet` y **sí** la pide;
 *    una transferencia puede **no** pedirla. Preguntar por `kind` sería adivinar la configuración.
 *
 * **`mixed` no existe como opción y es a propósito**: el mixto es un **resultado** de partir el cobro, no algo
 * que el cajero elija.
 */

/**
 * El vuelto en vivo de un cobro **único en efectivo**, mientras el cajero escribe.
 *
 * Sale de `calculateOrderChange`, la misma fórmula que usa el servidor al registrar el cobro, así que el
 * número de la pantalla y el del arqueo no pueden discrepar.
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
        Faltan{" "}
        <span className="font-mono tabular-nums">{formatCurrency(missing, currency)}</span>
      </p>
    );
  }

  return (
    <p className="text-st-body text-ink-secondary">
      Vuelto{" "}
      <span className="font-mono text-st-body font-bold tabular-nums text-ink">
        {formatCurrency(change, currency)}
      </span>
    </p>
  );
}

type PosPaymentRowsProps = {
  payments: PosPaymentDraft[];
  setPayments: React.Dispatch<React.SetStateAction<PosPaymentDraft[]>>;
  /** Los errores por campo que devolvió el servidor (o los de la validación de la pantalla). */
  fieldErrors: Record<string, string>;
  currencyCode: string;
  /** El formato de la moneda del negocio, para los montos rápidos. */
  currency: CurrencyFormat;
  /** El total de la venta: es lo que llena el botón «Exacto». */
  total: number;
  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`) — **las monedas que el negocio acepta hoy**, de
   * `money`. Es la lista completa, no «la base y el dólar»: ofrecer una moneda y convertir con otra tasa es
   * justamente lo que ese cierre arregló. Con una sola moneda no hay nada que elegir y el control no se
   * dibuja.
   */
  acceptedCurrencies: string[];
  /**
   * `TASK-ORDER-POS-OPERATIONAL-006` — los medios que **este local** ofrece, resueltos por el servidor.
   *
   * Sin opciones (una venta en espera vieja, un local sin medios configurados) la pieza no inventa botones:
   * lo dice. Cobrar con un medio que el negocio no ofrece es peor que no poder cobrar.
   */
  methodOptions: PosPaymentMethodOption[];
  /**
   * Saca una fila del cobro partido (la primera no se saca: es el medio de la venta).
   *
   * Lo llama la fila, que es quien conoce su índice; la pieza no necesita saber cómo se administra el estado.
   */
  onRemovePayment: (paymentId: string) => void;
};

/** El medio elegido de una fila, buscado por su id entre las opciones del local. */
function selectedOption(
  payment: PosPaymentDraft,
  methodOptions: readonly PosPaymentMethodOption[],
): PosPaymentMethodOption | null {
  return methodOptions.find((option) => option.id === payment.paymentMethodId) ?? null;
}

export default function PosPaymentRows({
  payments,
  setPayments,
  fieldErrors,
  currencyCode,
  currency,
  total,
  acceptedCurrencies,
  methodOptions,
  onRemovePayment,
}: PosPaymentRowsProps) {
  return (
    <>
      {methodOptions.length === 0 ? (
        <p role="status" className="text-st-body text-status-sla-text">
          Este local no tiene medios de pago configurados. Cargalos en Finanzas antes de cobrar.
        </p>
      ) : null}

      {payments.map((payment, index) => {
        const option = selectedOption(payment, methodOptions);
        const isCash = option?.kind === "cash";
        const needsReference = option?.requiresReference === true;

        return (
          <div key={payment.id} className="space-y-3 rounded-stitch-md border border-line-subtle p-3">
            {index > 0 ? (
              <p className="text-st-body font-semibold text-ink">Cobro {index + 1}</p>
            ) : null}

            <div className="space-y-1.5">
              <p className="text-st-body font-medium leading-none text-ink">¿Cómo paga?</p>
              {/*
                El grupo con su nombre accesible: los botones de medio son un conjunto excluyente por fila, y
                un lector de pantalla tiene que poder anunciar «¿Cómo paga?» y después la opción elegida.
              */}
              <div role="group" aria-label="¿Cómo paga?" className="flex flex-wrap gap-2">
                {methodOptions.map((choice) => (
                  <Button
                    key={choice.id}
                    type="button"
                    size="pill"
                    variant={payment.paymentMethodId === choice.id ? "primary" : "secondary"}
                    aria-pressed={payment.paymentMethodId === choice.id}
                    onClick={() =>
                      setPayments((current) =>
                        current.map((item) =>
                          item.id === payment.id
                            ? {
                                ...item,
                                paymentMethodId: choice.id,
                                // El enum histórico es una derivación del tipo configurado: el servidor
                                // resuelve el `kind` real desde el `paymentMethodId` y no confía en esto.
                                // `mixed` no es una opción ofrecible, así que el cast es seguro por
                                // construcción (`derivePosPaymentMethod` nunca lo devuelve).
                                method: choice.method as PosPaymentDraft["method"],
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>

            {acceptedCurrencies.length > 1 ? (
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
                options={acceptedCurrencies.map((code) => ({ value: code, label: code }))}
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

            {isCash && payment.currency === currencyCode ? (
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

            {isCash && payment.currency === currencyCode && payment.amount.trim() !== "" ? (
              <LiveChange paidWith={Number(payment.amount)} total={total} currency={currency} />
            ) : null}

            {/*
              `brief §39` — la referencia la pide el **medio configurado** (`requiresReference`), no el tipo
              histórico del cobro. Es la corrección del `payment.method === "transfer"` que había acá.
            */}
            {needsReference ? (
              <Input
                label="Referencia del cobro"
                value={payment.reference ?? ""}
                error={fieldErrors.reference}
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
                onClick={() => onRemovePayment(payment.id)}
              >
                {`Quitar el cobro ${index + 1}`}
              </Button>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
