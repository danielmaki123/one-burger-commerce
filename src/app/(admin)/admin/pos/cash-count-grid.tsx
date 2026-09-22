"use client";

import * as React from "react";

import { CASH_DENOMINATIONS } from "@/modules/orders/domain/shift-cash";
import { Input } from "@/shared/ui/input";

/**
 * TASK-305b — la grilla con la que el cajero cuenta la caja.
 *
 * Es la parte que el owner pidió explícita: **contar billetes**, no escribir un total. La lista de
 * denominaciones sale del dominio (`CASH_DENOMINATIONS`), así la pantalla y el servidor no pueden
 * discrepar sobre qué billetes existen.
 */

/** Cantidades por billete: `NIO-100` → 10. */
export type CashCountValues = Record<string, number>;

export function cashCountKey(currency: string, denomination: number): string {
  return `${currency}-${denomination}`;
}

/** Total contado de una moneda, con los billetes que la pantalla tiene cargados. */
export function cashCountTotalFor(
  values: CashCountValues,
  currency: string,
  denominations: number[] = CASH_DENOMINATIONS[currency] ?? [],
): number {
  return denominations.reduce(
    (sum, denomination) => sum + denomination * (values[cashCountKey(currency, denomination)] ?? 0),
    0,
  );
}

/** Lo que se manda al servidor: una fila por billete contado (los ceros no viajan). */
export function toCashCountRows(
  values: CashCountValues,
  currencies: string[],
  denominations: Record<string, number[]> = CASH_DENOMINATIONS,
): { currency: string; denomination: number; quantity: number }[] {
  return currencies.flatMap((currency) =>
    (denominations[currency] ?? [])
      .map((denomination) => ({
        currency,
        denomination,
        quantity: values[cashCountKey(currency, denomination)] ?? 0,
      }))
      .filter((row) => row.quantity > 0),
  );
}

export function CashCountGrid({
  currencies,
  denominations = CASH_DENOMINATIONS,
  values,
  onChange,
  disabled = false,
  formatAmount,
}: {
  currencies: string[];
  /**
   * Fase 2 del rediseño de Caja (2026-09-22) — **los billetes de cada moneda**, tal como los ofrece la
   * config del local. Sin esto se usan los defaults del módulo (`CASH_DENOMINATIONS`), que es lo que
   * necesita el POS y cualquier pantalla que todavía no reciba la config.
   */
  denominations?: Record<string, number[]>;
  values: CashCountValues;
  onChange: (key: string, quantity: number) => void;
  disabled?: boolean;
  formatAmount: (value: number) => string;
}) {
  return (
    <div className="space-y-4">
      {currencies.map((currency) => (
        <fieldset key={currency} className="space-y-2">
          <legend className="text-st-body font-semibold text-ink">{currency}</legend>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(denominations[currency] ?? []).map((denomination) => {
              const key = cashCountKey(currency, denomination);
              const quantity = values[key] ?? 0;

              return (
                <Input
                  key={key}
                  label={`${currency} ${denomination}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={disabled}
                  aria-label={`Cantidad de billetes de ${currency} ${denomination}`}
                  value={quantity === 0 ? "" : String(quantity)}
                  onChange={(event) =>
                    onChange(key, event.target.value === "" ? 0 : Number(event.target.value))
                  }
                />
              );
            })}
          </div>

          <p className="text-st-body text-ink-secondary">
            Total {currency}:{" "}
            <span className="font-semibold tabular-nums text-ink">
              {formatAmount(cashCountTotalFor(values, currency, denominations[currency] ?? []))}
            </span>
          </p>
        </fieldset>
      ))}
    </div>
  );
}
