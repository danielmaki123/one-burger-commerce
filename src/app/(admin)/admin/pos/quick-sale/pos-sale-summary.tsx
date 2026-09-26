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
  variant = "full",
}: {
  linesCount: number;
  totals: PosSaleTotals;
  /** El cupón cotizado y vigente, o `null`. */
  appliedCoupon: { code: string; discount: number } | null;
  /** El monto del descuento manual autorizado, o `0`. */
  manualDiscountAmount: number;
  currency: CurrencyFormat;
  /**
   * `full` (dentro del checkout: subtotal, descuentos y **total**) o `meta` (solo el conteo de líneas, para el
   * encabezado del panel, donde el título y el conteo van juntos y los importes viven más abajo).
   */
  variant?: "full" | "meta";
}) {
  const discount = (appliedCoupon?.discount ?? 0) + manualDiscountAmount;

  if (variant === "meta") {
    return (
      <p
        data-testid="pos-sale-lines-count"
        className="text-panel-overline font-bold uppercase tracking-wider text-ink-muted"
      >
        {posSaleLinesLabel(linesCount)}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <dl className="space-y-1 border-b border-line-subtle pb-2">
        <div className="flex items-baseline justify-between text-st-caption">
          <dt className="text-ink-secondary">Subtotal</dt>
          <dd className="font-mono tabular-nums text-ink-secondary">
            {formatCurrency(totals.subtotal, currency)}
          </dd>
        </div>

        {totals.packagingAmount > 0 ? (
          <div className="flex items-baseline justify-between text-st-caption">
            <dt className="text-ink-secondary">Empaque</dt>
            <dd className="font-mono tabular-nums text-ink-secondary">
              {formatCurrency(totals.packagingAmount, currency)}
            </dd>
          </div>
        ) : null}

        {discount > 0 ? (
          <div className="flex items-baseline justify-between text-st-caption">
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

        {/*
          El **total** es el número de mayor jerarquía de la pantalla: el cajero lo dice en voz alta. Va en su
          fila, en `text-panel-display` y mono tabular (el número no tiembla cuando cambia).
        */}
        <div className="flex items-end justify-between gap-2 pt-1">
          <dt className="text-panel-item font-bold text-ink">Total</dt>
          <dd
            data-testid="pos-sale-total"
            aria-live="polite"
            className="font-mono text-panel-display font-bold tabular-nums text-brand-primary"
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
