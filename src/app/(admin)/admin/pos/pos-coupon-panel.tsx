"use client";

import * as React from "react";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón de la venta en curso.
 *
 * El cajero escribe el código que el cliente trajo, el **servidor** dice cuánto descuenta (con el mismo
 * cálculo que el alta del pedido, sin consumir el cupón) y esa cotización se muestra **antes** de cobrar: en
 * el mostrador el cajero tiene que saber cuánto pedirle al cliente.
 *
 * Tres cosas que la pantalla dice sin que nadie las adivine:
 *
 * 1. **Qué promo es** (código + descripción), para que el cliente la reconozca.
 * 2. **Cuánto baja** el total, en la misma tipografía mono que el resto de la plata.
 * 3. Que un cambio en la venta **vence** la cotización: el descuento se calculó sobre lo que había. La
 *    cotización vencida no se descuenta del total (lo decide la pantalla, que es la que tiene las líneas) y
 *    acá se pide volver a aplicarla.
 */

type PosCouponPanelProps = {
  applied: { code: string; label: string; discount: number } | null;
  /** Se aplicó un código y la venta cambió después. */
  stale: boolean;
  /** El servidor está cotizando. */
  busy: boolean;
  error: string | null;
  currency: CurrencyFormat;
  onApply: (code: string) => void;
  onRemove: () => void;
};

export default function PosCouponPanel({
  applied,
  stale,
  busy,
  error,
  currency,
  onApply,
  onRemove,
}: PosCouponPanelProps) {
  const [code, setCode] = React.useState("");

  const submit = () => {
    const value = code.trim();
    if (value === "" || busy) return;

    onApply(value);
  };

  return (
    <div className="space-y-2 border-t border-line-subtle pt-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Código de promo (opcional)"
            value={code}
            // Enter en el campo aplica el código: es lo que hace todo el mundo después de escribirlo.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || code.trim() === ""}
          onClick={submit}
        >
          {busy ? "Cotizando…" : "Aplicar"}
        </Button>
      </div>

      {applied ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-stitch-md border border-line-subtle p-3">
          <div className="min-w-0">
            <p className="text-st-body font-semibold text-ink">
              Promo <span className="font-mono">{applied.code}</span>
            </p>
            <p className="text-st-caption text-ink-secondary">{applied.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-st-body font-bold tabular-nums text-brand-primary">
              {`−${formatCurrency(applied.discount, currency)}`}
            </p>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onRemove}>
              Quitar
            </Button>
          </div>
        </div>
      ) : null}

      {stale ? (
        <p className="text-st-body text-ink-secondary">
          La venta cambió: volvé a aplicar el código para recalcular el descuento.
        </p>
      ) : null}

      {error ? <p className="text-st-body font-medium text-status-sla-text">{error}</p> : null}
    </div>
  );
}
