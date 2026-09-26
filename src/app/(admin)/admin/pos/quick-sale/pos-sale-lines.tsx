"use client";

import { ShoppingCart, X } from "lucide-react";

import { posLineKey, type PosDraftLine } from "@/modules/pos/domain/pos-draft";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

/**
 * Las líneas de la venta en curso.
 *
 * Es la parte que el cajero toca todo el tiempo —sumar, restar, sacar— y la que tiene que sobrevivir a un
 * panel de 320 px en la tablet del mostrador: la fila es **nombre + cantidad + controles**, y el precio de
 * la línea se lee debajo del nombre, no en una cuarta columna que empujaría el ancho.
 *
 * Las cantidades las resuelve el dominio (`setPosLineQuantity` / `removePosLine` en la pantalla): acá solo se
 * dice **qué línea** y cuánto. La línea se direcciona por su **clave** (`posLineKey`: producto +
 * modificadores + nota): el mismo plato con dos configuraciones distintas son dos líneas y tocar "−" en una
 * no puede cambiar la otra.
 *
 * **Divergencia deliberada con los botones de texto del panel**: los controles de esta fila son de
 * **ícono** con `aria-label` (la ley de `CONTENT.md` §5 para un botón de icono), porque los labels
 * completos —"Sacar", "Agregar una unidad de"— no entran en una fila de 320 px sin empujar el nombre. El
 * nombre accesible es el mismo que tendría el botón con texto visible.
 */
export default function PosSaleLines({
  lines,
  currency,
  onChangeQuantity,
  onRemove,
  emptyHint = "Agregá productos del catálogo para armar la venta.",
}: {
  lines: PosDraftLine[];
  currency: CurrencyFormat;
  /** Cantidad nueva para una línea (0 la saca; la regla la aplica el dominio). */
  onChangeQuantity: (lineKey: string, quantity: number) => void;
  onRemove: (lineKey: string) => void;
  /** El texto del vacío: en el sheet del celular el catálogo no está al lado, así que se dice distinto. */
  emptyHint?: string;
}) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-low">
          <ShoppingCart aria-hidden="true" className="h-5 w-5 text-ink-muted" />
        </span>
        <p className="max-w-56 text-st-body text-ink-secondary">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Productos de la venta">
      {lines.map((line) => {
        const key = posLineKey(line);

        return (
          <li key={key} className="flex items-center gap-2 border-b border-line-subtle pb-3 last:border-b-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-st-body font-semibold text-ink">{line.name}</p>
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

            <div className="flex shrink-0 items-center gap-1">
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
              <span className="w-7 text-center font-mono text-st-body font-bold tabular-nums text-ink">
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
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Sacar ${line.name} de la venta`}
                onClick={() => onRemove(key)}
              >
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
