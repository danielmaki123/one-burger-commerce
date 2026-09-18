"use client";

import * as React from "react";

import { PAYMENT_METHOD_TYPE_LABELS } from "@/modules/orders/domain/order.types";
import { POS_PAYMENT_METHODS } from "@/modules/pos/domain/pos-sale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

import type { PosPaymentDraft } from "./pos-types";

/**
 * Bloque 4 del roadmap del POS (Fase 2) — las filas del cobro del mostrador.
 *
 * Extraído de `pos-client.tsx`, que es deuda con techo congelado: no puede crecer. Es la parte que arma el
 * cobro —medio, moneda, monto y la referencia de la transferencia— y estaba mezclada con el catálogo, la
 * caja, el cupón y la confirmación.
 *
 * **`mixed` no está en la lista y es a propósito**: el mixto es un **resultado** de partir el cobro entre dos
 * medios, no algo que el cajero elija. La lista de medios sale del dominio (`POS_PAYMENT_METHODS`), la misma
 * que acepta la API del cobro y la que se guarda en una venta en espera.
 */

const PAYMENT_METHOD_CHOICES = POS_PAYMENT_METHODS.map((id) => ({
  id,
  label: PAYMENT_METHOD_TYPE_LABELS[id],
}));

type PosPaymentRowsProps = {
  payments: PosPaymentDraft[];
  setPayments: React.Dispatch<React.SetStateAction<PosPaymentDraft[]>>;
  /** Los errores por campo que devolvió el servidor (o los de la validación de la pantalla). */
  fieldErrors: Record<string, string>;
  currencyCode: string;
  /** Con tasa cargada el cajero puede cobrar en dólares; sin tasa, la moneda no se elige. */
  usdExchangeRate: number | null;
};

export default function PosPaymentRows({
  payments,
  setPayments,
  fieldErrors,
  currencyCode,
  usdExchangeRate,
}: PosPaymentRowsProps) {
  return (
    <>
      {payments.map((payment, index) => (
        <div key={payment.id} className="space-y-3 rounded-stitch-md border border-line-subtle p-3">
          {index > 0 ? (
            <p className="text-st-body font-semibold text-ink">Cobro {index + 1}</p>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-st-body font-medium leading-none text-ink">¿Cómo paga?</p>
            <div className="flex flex-wrap gap-2">
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
              onClick={() => setPayments((current) => current.filter((item) => item.id !== payment.id))}
            >
              Quitar este cobro
            </Button>
          ) : null}
        </div>
      ))}
    </>
  );
}
