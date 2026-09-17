import Link from "next/link";

import type { DayCloseLocationGroup, DayCloseTotals } from "@/modules/orders/domain/day-close";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { formatSignedAmount } from "../cash-shift-helpers";

/**
 * Tarea 1.5 del roadmap + decisión del owner (2026-09-17) — el **reporte diario de caja**.
 *
 * El reporte diario que existía era de **órdenes** (valor completado, ticket promedio) y no decía nada de
 * la plata del día. Este es el de caja: por dónde entró (efectivo, tarjeta, transferencia, otras), cuánto
 * se cobró, las propinas, los movimientos, las devoluciones y cómo quedó el arqueo — una fila por sucursal
 * y el total del alcance.
 *
 * Todo sale de lo que cada turno **congeló al cerrar** (tareas 1.1/1.2/1.5): no se recalcula con los cobros
 * de hoy. Un turno abierto no aporta desglose —todavía no se cerró— y el reporte lo dice en vez de estimarlo.
 *
 * La fecha viaja por la URL (`?date=`) en un formulario `GET`: sin JavaScript, se puede compartir el enlace
 * del día y el navegador la recuerda.
 */
export default function CashDayReportPanel({
  date,
  today,
  groups,
  totals,
  currency,
}: {
  date: string;
  /** El día del negocio de hoy, para el tope del selector. */
  today: string;
  groups: DayCloseLocationGroup[];
  totals: DayCloseTotals;
  currency: CurrencyFormat;
}) {
  const format = (amount: number) => formatCurrency(amount, currency);

  return (
    <section
      aria-label="Reporte de caja del día"
      className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-st-h2 text-ink">Caja del día</h2>
          <p className="text-st-body text-ink-secondary">
            {totals.shifts === 0
              ? "No hubo turnos de caja ese día en las sucursales a tu cargo."
              : `${totals.shifts} ${totals.shifts === 1 ? "turno" : "turnos"} · ${totals.closed} cerrado${
                  totals.closed === 1 ? "" : "s"
                }${totals.open > 0 ? ` · ${totals.open} con la caja abierta` : ""}${
                  totals.withoutCount > 0 ? ` · ${totals.withoutCount} sin contar` : ""
                }`}
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <Input label="Día" type="date" name="date" defaultValue={date} max={today} />
          <Button type="submit" variant="outline" className="min-h-11">
            Ver el día
          </Button>
        </form>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Total cobrado
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">{format(totals.collected)}</dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Efectivo
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">{format(totals.cashSales)}</dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Tarjeta
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">{format(totals.cardSales)}</dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Transferencia
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">
            {format(totals.transferSales)}
          </dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Otras formas
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">{format(totals.otherSales)}</dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Propinas
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">{format(totals.tips)}</dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Movimientos
          </dt>
          <dd className="font-mono text-st-body tabular-nums text-ink">{format(totals.movements)}</dd>
        </div>
        <div>
          <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Diferencia
          </dt>
          <dd className="font-mono text-st-body tabular-nums font-semibold text-ink">
            {formatSignedAmount(totals.difference, format)}
          </dd>
        </div>
      </dl>

      <ul aria-label="Caja por sucursal" className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.locationId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-subtle pb-2 last:border-b-0"
          >
            <span className="font-semibold text-ink">{group.locationName}</span>
            <span className="space-x-4 text-st-body text-ink-secondary">
              <span>
                Cobrado{" "}
                <span className="font-mono tabular-nums text-ink">
                  {format(group.totals.collected)}
                </span>
              </span>
              <span>
                Efectivo{" "}
                <span className="font-mono tabular-nums text-ink">
                  {format(group.totals.cashSales)}
                </span>
              </span>
              <span>
                Turnos{" "}
                <span className="font-mono tabular-nums text-ink">{group.totals.shifts}</span>
              </span>
              <span>
                Diferencia{" "}
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {formatSignedAmount(group.totals.difference, format)}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-st-body text-ink-secondary">
        Un turno con la caja abierta no tiene desglose por medio hasta que se cierre. El detalle de cada
        cierre está en{" "}
        <Link href="/admin/cash" className="font-semibold text-brand-primary underline">
          Caja del día
        </Link>
        .
      </p>
    </section>
  );
}
