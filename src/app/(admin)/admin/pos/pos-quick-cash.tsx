"use client";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

/**
 * Los montos con los que el cliente paga en efectivo, para no tipear.
 *
 * Son **billetes reales de Nicaragua** —200, 500 y 1000— y **no se configuran**: es una constante del
 * mostrador con su test (decisión del owner, 2026-09-19: nada de C$150, que no existe como billete).
 * «Exacto» llena el total de la venta, que es el caso más frecuente en el mostrador.
 */
export const POS_QUICK_CASH_AMOUNTS = [200, 500, 1000] as const;

export default function PosQuickCash({
  total,
  currency,
  onPick,
}: {
  /** El total de la venta: es lo que llena «Exacto». */
  total: number;
  currency: CurrencyFormat;
  onPick: (amount: number) => void;
}) {
  return (
    <div role="group" aria-label="Montos rápidos de efectivo" className="flex flex-wrap gap-2">
      <Button type="button" size="pill" variant="secondary" onClick={() => onPick(total)}>
        Exacto
      </Button>

      {POS_QUICK_CASH_AMOUNTS.map((amount) => (
        <Button
          key={amount}
          type="button"
          size="pill"
          variant="secondary"
          onClick={() => onPick(amount)}
        >
          {formatCurrency(amount, currency)}
        </Button>
      ))}
    </div>
  );
}
