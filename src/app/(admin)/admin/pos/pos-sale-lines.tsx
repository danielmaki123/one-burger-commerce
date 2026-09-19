"use client";

import { ShoppingCart } from "lucide-react";

import { posLineKey, type PosDraftLine } from "@/modules/pos/domain/pos-draft";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

/**
 * Las líneas de la venta en curso del mostrador (extraído de `pos-client.tsx`, que es deuda con techo
 * congelado: no puede crecer). Es la parte que el cajero toca todo el tiempo —sumar, restar, sacar— y estaba
 * mezclada con el cobro, la caja y la confirmación.
 *
 * Las cantidades las resuelve el dominio (`setPosLineQuantity` / `removePosLine` en la pantalla): acá solo se
 * dice **qué línea** y cuánto, nunca cómo se recalcula la venta.
 *
 * La línea se direcciona por su **clave** (`posLineKey`: producto + modificadores + nota), no por el
 * producto: el mismo plato con dos configuraciones distintas son dos líneas y tocar "−" en una no puede
 * cambiar la otra. Los modificadores elegidos se muestran porque son lo único que las distingue.
 */

type PosSaleLinesProps = {
  lines: PosDraftLine[];
  currency: CurrencyFormat;
  /** Cantidad nueva para una línea (0 la saca; la regla la aplica el dominio). */
  onChangeQuantity: (lineKey: string, quantity: number) => void;
  onRemove: (lineKey: string) => void;
};

export default function PosSaleLines({
  lines,
  currency,
  onChangeQuantity,
  onRemove,
}: PosSaleLinesProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-low">
          <ShoppingCart aria-hidden="true" className="h-6 w-6 text-ink-muted" />
        </span>
        <p className="max-w-56 text-st-body text-ink-secondary">
          Agregá productos del catálogo para armar la venta.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Productos de la venta">
      {lines.map((line) => {
        const key = posLineKey(line);

        return (
          <li
            key={key}
            className="flex items-center justify-between gap-3 border-b border-line-subtle pb-3 last:border-b-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-st-body font-medium text-ink">{line.name}</p>
              {line.modifierNames && line.modifierNames.length > 0 ? (
                <p className="truncate text-st-caption text-ink-secondary">
                  {line.modifierNames.join(" · ")}
                </p>
              ) : null}
              {line.notes ? (
                <p className="truncate text-st-caption text-ink-muted">{line.notes}</p>
              ) : null}
              <p className="font-mono text-st-caption tabular-nums text-ink-secondary">
                {formatCurrency(line.unitPrice, currency)} × {line.quantity}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Quitar una unidad de ${line.name}`}
                onClick={() => onChangeQuantity(key, line.quantity - 1)}
              >
                −
              </Button>
              <span className="w-8 text-center text-st-body font-bold tabular-nums text-ink">
                {line.quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Agregar una unidad de ${line.name}`}
                onClick={() => onChangeQuantity(key, line.quantity + 1)}
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                aria-label={`Sacar ${line.name} de la venta`}
                onClick={() => onRemove(key)}
              >
                Sacar
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
