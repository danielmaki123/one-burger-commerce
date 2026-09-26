"use client";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

/**
 * La plata de la venta: subtotal, descuentos y **total**, más la barra inferior del celular.
 *
 * El total es el número de mayor jerarquía del POS: el cajero lo dice en voz alta y es el que el servidor
 * va a cobrar. Por eso se escribe con `text-panel-display` + `font-mono tabular-nums` (el número no tiembla
 * cuando cambia) y vive en su propia pieza, separado de las líneas: el mismo resumen se usa en la columna de
 * escritorio y en el sheet del celular.
 *
 * **El total no se calcula acá.** Llega ya resuelto por `posDraftTotals` —la misma fórmula que usa el
 * servidor—: una segunda suma en la pantalla es exactamente lo que este repo prohíbe (`AGENTS.md`: una sola
 * fuente por cálculo).
 */

export type PosSaleTotals = {
  subtotal: number;
  packagingAmount: number;
  total: number;
};

/** El conteo del encabezado de la venta: líneas (no unidades) y su singular/plural. */
export function posSaleLinesLabel(linesCount: number): string {
  if (linesCount === 0) return "Sin productos";
  return `${linesCount} ${linesCount === 1 ? "producto" : "productos"}`;
}

export default function PosSaleSummary({
  linesCount,
  totals,
  appliedCoupon,
  manualDiscountAmount,
  currency,
}: {
  linesCount: number;
  totals: PosSaleTotals;
  /** El cupón cotizado y vigente, o `null`. */
  appliedCoupon: { code: string; discount: number } | null;
  /** El monto del descuento manual autorizado, o `0`. */
  manualDiscountAmount: number;
  currency: CurrencyFormat;
}) {
  const discount = (appliedCoupon?.discount ?? 0) + manualDiscountAmount;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-panel-section font-bold tracking-tight text-ink">Venta en curso</h2>
        <p
          data-testid="pos-sale-lines-count"
          className="text-panel-overline font-bold uppercase tracking-wider text-ink-muted"
        >
          {posSaleLinesLabel(linesCount)}
        </p>
      </div>

      <dl className="space-y-1">
        <div className="flex items-baseline justify-between text-st-body">
          <dt className="text-ink-secondary">Subtotal</dt>
          <dd className="font-mono tabular-nums text-ink">{formatCurrency(totals.subtotal, currency)}</dd>
        </div>

        {totals.packagingAmount > 0 ? (
          <div className="flex items-baseline justify-between text-st-body">
            <dt className="text-ink-secondary">Empaque</dt>
            <dd className="font-mono tabular-nums text-ink">
              {formatCurrency(totals.packagingAmount, currency)}
            </dd>
          </div>
        ) : null}

        {discount > 0 ? (
          <div className="flex items-baseline justify-between text-st-body">
            <dt className="text-ink-secondary">
              {appliedCoupon ? (
                <>
                  Descuento <span className="font-mono">{appliedCoupon.code}</span>
                </>
              ) : (
                "Descuento"
              )}
            </dt>
            <dd className="font-mono tabular-nums text-brand-primary">
              {`−${formatCurrency(discount, currency)}`}
            </dd>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between gap-2 border-t border-line-subtle pt-2">
          <dt className="text-st-h3 font-bold text-ink">Total</dt>
          <dd
            data-testid="pos-sale-total"
            aria-live="polite"
            className="font-mono text-st-display font-bold tabular-nums text-brand-primary"
          >
            {formatCurrency(totals.total, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * La barra inferior del celular (375 px): `N productos · Total` y **Ver venta**.
 *
 * Es la pieza que hace que en móvil el ticket no esté "varios scrolls abajo": el resumen vive fijo sobre la
 * navegación del panel y el checkout entero se abre en un sheet. El total va en el nombre accesible del botón
 * porque es lo que el cajero mira antes de abrirlo.
 */
export function PosMobileSaleBar({
  linesCount,
  unitsCount,
  total,
  currency,
  onOpen,
}: {
  linesCount: number;
  unitsCount: number;
  total: number;
  currency: CurrencyFormat;
  onOpen: () => void;
}) {
  const lines = posSaleLinesLabel(linesCount);
  const units = `${unitsCount} ${unitsCount === 1 ? "unidad" : "unidades"}`;
  const money = formatCurrency(total, currency);

  return (
    <div
      role="region"
      aria-label="Resumen de la venta"
      className="flex items-center gap-3 rounded-stitch-xl border border-line-medium bg-surface-elevated p-3 shadow-elevation-3"
    >
      <p className="min-w-0 flex-1 text-st-body">
        <span className="block truncate font-semibold text-ink">{lines}</span>
        <span className="block truncate text-st-caption text-ink-secondary">
          <span>{units}</span> · <span className="font-mono tabular-nums text-ink">{money}</span>
        </span>
      </p>

      <Button
        type="button"
        data-pos-sale-sheet-trigger="true"
        className="min-h-11 shrink-0"
        aria-label={`Ver venta · ${money}`}
        onClick={onOpen}
      >
        Ver venta →
      </Button>
    </div>
  );
}
