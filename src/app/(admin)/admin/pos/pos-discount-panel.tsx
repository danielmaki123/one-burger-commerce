"use client";

import * as React from "react";

import { manualDiscountAmount, type ManualDiscountInput } from "@/modules/orders/domain/sale-discount";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** de una venta de mostrador.
 *
 * Un cupón es una promo cargada: el cajero escribe el código y el servidor cotiza (tarea 9.6). Un descuento
 * manual es otra cosa —plata que el cliente deja de pagar porque alguien lo decidió— y por eso:
 *
 * 1. **Solo lo ve quien puede darlo.** La pantalla decide con `canDiscountPosSale` (owner y manager); el
 *    cajero no tiene el control y la ruta, además, lo rechaza.
 * 2. **El motivo es obligatorio.** Es lo único que seis meses después explica por qué esa venta entró con
 *    menos plata, y viaja al log de acciones sensibles.
 * 3. **El monto lo calcula el servidor.** Acá se manda la forma (porcentaje o monto) y el valor; el número
 *    que se muestra —y el que viaja en el cobro— sale de la misma regla del dominio, sobre el subtotal de la
 *    venta.
 */

export type AppliedManualDiscount = ManualDiscountInput & { amount: number };

type PosDiscountPanelProps = {
  /** El subtotal de la venta: base del porcentaje y tope del monto fijo. */
  subtotal: number;
  currency: CurrencyFormat;
  applied: AppliedManualDiscount | null;
  onChange: (discount: AppliedManualDiscount | null) => void;
};

export default function PosDiscountPanel({
  subtotal,
  currency,
  applied,
  onChange,
}: PosDiscountPanelProps) {
  const [kind, setKind] = React.useState<ManualDiscountInput["kind"]>("percentage");
  const [value, setValue] = React.useState("");
  const [reason, setReason] = React.useState("");

  const numericValue = Number(value);
  const candidate: ManualDiscountInput = { kind, value: numericValue, reason };
  const resolved = manualDiscountAmount({ discount: candidate, subtotal });

  const apply = () => {
    if (!resolved.ok) return;

    onChange({ ...candidate, reason: reason.trim(), amount: resolved.amount });
    setValue("");
    setReason("");
  };

  return (
    <section className="space-y-2 border-t border-line-subtle pt-3" aria-label="Descuento manual">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-st-h3 text-ink">Descuento manual</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            size="pill"
            variant={kind === "percentage" ? "primary" : "secondary"}
            aria-pressed={kind === "percentage"}
            onClick={() => setKind("percentage")}
          >
            Porcentaje
          </Button>
          <Button
            type="button"
            size="pill"
            variant={kind === "amount" ? "primary" : "secondary"}
            aria-pressed={kind === "amount"}
            onClick={() => setKind("amount")}
          >
            Monto fijo
          </Button>
        </div>
      </div>

      {applied ? (
        <div className="space-y-2 rounded-stitch-md border border-line-subtle p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-st-body font-semibold text-ink">
              {applied.kind === "percentage"
                ? `Descuento manual · ${applied.value} %`
                : "Descuento manual"}
            </p>
            <p className="font-mono text-st-body font-bold tabular-nums text-brand-primary">
              {`−${formatCurrency(applied.amount, currency)}`}
            </p>
          </div>
          <p className="text-st-caption text-ink-secondary">{applied.reason}</p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => onChange(null)}
          >
            Quitar descuento
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            label={kind === "percentage" ? "Descuento (%)" : `Descuento (${currency.symbol})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Input
            label="Motivo del descuento"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={!resolved.ok}
            onClick={apply}
          >
            Aplicar descuento
          </Button>
        </div>
      )}
    </section>
  );
}
