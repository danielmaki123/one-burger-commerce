import { formatCurrency } from "@/shared/lib/format-currency";

/**
 * Tarea 1.2 del roadmap + decisión del owner (2026-09-17) — el **desglose por medio de pago** del turno,
 * en el detalle del cierre.
 *
 * El arqueo dice si el cajón cuadró; esto dice por dónde entró la otra plata del día (tarjeta y
 * transferencia, que no pasan por el cajón) y cuánto fueron las propinas. Son **números congelados al
 * cerrar**: no se recalculan con los cobros de hoy, porque un cierre es un documento.
 *
 * Un turno cerrado antes de que esto se persistiera no tiene el desglose: se dice con palabras en vez de
 * mostrar ceros, que afirmarían que no entró nada por tarjeta.
 */
export type PaymentMix = { cash: number; card: number; transfer: number; other: number; tips: number };

/**
 * El desglose del turno, o `null` si el cierre es anterior a que se guardara.
 *
 * La señal de «no hay desglose» es la **tarjeta**: un cierre viejo no tiene ninguna de las cuatro
 * columnas, y mostrar ceros diría que no entró nada por tarjeta. Vive acá (y no en la página) para que la
 * decisión se pruebe sola y la página del detalle no crezca.
 */
export function paymentMixOf(shift: {
  cashSalesAmount?: number | null;
  cardSalesAmount?: number | null;
  transferSalesAmount?: number | null;
  otherSalesAmount?: number | null;
  tipsAmount?: number | null;
}): PaymentMix | null {
  if (shift.cardSalesAmount === null || shift.cardSalesAmount === undefined) return null;

  return {
    cash: shift.cashSalesAmount ?? 0,
    card: shift.cardSalesAmount,
    transfer: shift.transferSalesAmount ?? 0,
    other: shift.otherSalesAmount ?? 0,
    tips: shift.tipsAmount ?? 0,
  };
}

export default function PaymentMixPanel({
  mix,
  currencySymbol,
  locale,
}: {
  /** `null` = el turno es anterior al desglose por medio. */
  mix: PaymentMix | null;
  currencySymbol: string;
  locale: string;
}) {
  const currency = { symbol: currencySymbol, locale };
  const format = (amount: number) => formatCurrency(amount, currency);

  return (
    <section
      aria-label="Cobros por medio"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <h2 className="text-st-h2 text-ink">Cobros por medio</h2>

      {mix === null ? (
        <p className="text-st-body text-ink-secondary">
          Este turno es anterior a que el cierre guardara el desglose por medio: el efectivo quedó
          congelado en el arqueo de arriba.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Efectivo
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">{format(mix.cash)}</dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Tarjeta
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">{format(mix.card)}</dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Transferencia
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">{format(mix.transfer)}</dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Otras formas
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">{format(mix.other)}</dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Propinas
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">{format(mix.tips)}</dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Total cobrado
            </dt>
            <dd className="font-mono text-st-body tabular-nums font-semibold text-ink">
              {format(mix.cash + mix.card + mix.transfer + mix.other)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
