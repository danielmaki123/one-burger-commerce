import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { canViewCashHistory } from "@/modules/auth/domain/admin-permissions";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { formatCurrency } from "@/shared/lib/format-currency";
import { roundCurrency } from "@/shared/lib/order-totals";

import { AdminPageHeader } from "../../../_components/admin-operational-ui";
import CashMovementsPanel from "../../cash-movements-panel";
import {
  CASH_DIFFERENCE_LABEL,
  countsTotalOf,
  formatCashDifference,
  formatShiftDateTime,
  getCashDifferenceTone,
  type StoredCashCount,
} from "../../cash-shift-helpers";
import ShiftReopenForm from "../../shift-reopen-form";

/**
 * Bloque 1.4 del roadmap del POS (Fase 2) — el detalle de un cierre.
 *
 * Lo que se cuenta acá es lo que **quedó guardado**: el conteo billete por billete de la apertura y
 * del cierre, el esperado congelado y la diferencia. Nada se recalcula con la tasa de hoy: un arqueo
 * es un documento, no una estimación.
 */

function countsToValues(
  counts: StoredCashCount[],
  kind: "opening" | "closing",
): StoredCashCount[] {
  return counts
    .filter((count) => count.kind === kind)
    .sort((a, b) =>
      a.currency === b.currency
        ? b.denomination - a.denomination
        : a.currency.localeCompare(b.currency),
    );
}

export default async function AdminCashShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();

  if (!canViewCashHistory(session.user.role)) {
    redirect("/admin/orders");
  }

  const { id } = await params;
  const locations = await requireCashScope({
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
  });

  const shift = await new PrismaShiftRepository().findShiftById(id);
  // Un turno de otra sucursal no existe para quien no la atiende (misma regla que la API).
  if (!shift || !locations.some((location) => location.id === shift.locationId)) {
    notFound();
  }

  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const currency = { symbol: settings.currencySymbol, locale: settings.locale };
  const formatAmount = (value: number) => formatCurrency(value, currency);
  const counts = shift.cashCounts ?? [];
  const tone = getCashDifferenceTone(shift);
  const locationName =
    locations.find((location) => location.id === shift.locationId)?.name ?? shift.locationId;
  const expectedByCurrencyEntries = Object.entries(shift.expectedByCurrency ?? {});
  const movements = await new PrismaCashMovementRepository().listByShift(shift.id);
  // Las monedas del alta: las que se contaron y las que ya se movieron, más la del negocio.
  const countedCurrencies = [
    ...new Set([
      settings.currencyCode,
      ...counts.map((count) => count.currency),
      ...movements.map((movement) => movement.currency),
    ]),
  ];

  /**
   * Un conteo en otra moneda se muestra con **su** código, no con el símbolo del negocio: `US$30`
   * con el símbolo local sería un número falso (misma regla que el detalle del cobro en el POS).
   */
  function currencyFormatFor(code: string) {
    return code.toUpperCase() === settings.currencyCode.toUpperCase()
      ? currency
      : { symbol: `${code.toUpperCase()} `, locale: settings.locale };
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Cierre de caja"
        title={formatShiftDateTime(shift.openedAt, {
          timezone: settings.timezone,
          locale: settings.locale,
        })}
        description={`${locationName} · turno ${shift.status === "open" ? "abierto" : "cerrado"} · responsable ${shift.userId}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/cash"
              className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
            >
              Volver a Caja del día
            </Link>
            {/* Bloque 1.10: solo un turno cerrado se puede reabrir (y no siempre: ver el detalle). */}
            {shift.status === "closed" ? <ShiftReopenForm shiftId={shift.id} /> : null}
          </div>
        }
      />

      <section
        aria-label="Arqueo del cierre"
        className="rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Arqueo</h2>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Fondo
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">
              {formatAmount(shift.openingAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Contado
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">
              {shift.closingAmount === null ? "Sin contar" : formatAmount(shift.closingAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Esperado
            </dt>
            <dd className="font-mono text-st-body tabular-nums text-ink">
              {shift.expectedAmount === null ? "—" : formatAmount(shift.expectedAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              {CASH_DIFFERENCE_LABEL[tone]}
            </dt>
            <dd className="font-mono text-st-body tabular-nums font-semibold text-ink">
              {formatCashDifference(shift, formatAmount)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-st-body text-ink-secondary">
          Cerrado{" "}
          <span className="font-mono tabular-nums">
            {formatShiftDateTime(shift.closedAt, {
              timezone: settings.timezone,
              locale: settings.locale,
            })}
          </span>
        </p>

        {shift.notes ? (
          <p className="mt-2 text-st-body text-ink-secondary">Nota: {shift.notes}</p>
        ) : null}
      </section>

      <section
        aria-label="Conteo por moneda"
        className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Conteo por moneda</h2>

        {(["opening", "closing"] as const).map((kind) => {
          const rows = countsToValues(counts, kind);

          return (
            <div key={kind} className="space-y-2">
              <h3 className="text-st-h3 text-ink">
                {kind === "opening" ? "Con cuánto se abrió" : "Con qué se cerró"}
              </h3>
              {rows.length === 0 ? (
                <p className="text-st-body text-ink-secondary">
                  Este turno no tiene conteo cargado de este lado.
                </p>
              ) : (
                <ul className="space-y-1">
                  {rows.map((row) => (
                    <li
                      key={`${row.currency}-${row.denomination}`}
                      className="flex items-baseline justify-between gap-3 border-b border-line-subtle py-1 last:border-b-0"
                    >
                      <span className="text-st-body text-ink-secondary">
                        {row.quantity} × {row.currency}{" "}
                        <span className="font-mono tabular-nums">
                          {formatCurrency(row.denomination, currencyFormatFor(row.currency))}
                        </span>
                      </span>
                      <span className="font-mono text-st-body tabular-nums text-ink">
                        {formatCurrency(
                          row.denomination * row.quantity,
                          currencyFormatFor(row.currency),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      {/* Bloque 1.1/1.6 del roadmap del POS (Fase 2): el esperado por moneda que quedó **guardado**
          al cerrar, contra lo que se contó. Nada se recalcula: si el turno es viejo y no tiene el
          dato, se dice, no se estima con la tasa de hoy. */}
      <section
        aria-label="Esperado por moneda"
        className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Por moneda</h2>

        {expectedByCurrencyEntries.length === 0 ? (
          <p className="text-st-body text-ink-secondary">
            Este cierre no tiene el detalle por moneda guardado (es anterior a que se persistiera el
            arqueo). El total esperado quedó congelado al cerrar:{" "}
            <span className="font-mono tabular-nums text-ink">
              {shift.expectedAmount === null ? "—" : formatAmount(shift.expectedAmount)}
            </span>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {expectedByCurrencyEntries.map(([currency, expected]) => {
              const counted = countsTotalOf(counts, currency, "closing");
              const delta = counted === null ? null : roundCurrency(counted - expected);

              return (
                <li
                  key={currency}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-subtle pb-2 last:border-b-0"
                >
                  <span className="font-semibold text-ink">{currency}</span>
                  <span className="space-x-4 text-st-body text-ink-secondary">
                    <span>
                      Esperado{" "}
                      <span className="font-mono tabular-nums text-ink">
                        {formatCurrency(expected, currencyFormatFor(currency))}
                      </span>
                    </span>
                    <span>
                      Contado{" "}
                      <span className="font-mono tabular-nums text-ink">
                        {counted === null
                          ? "—"
                          : formatCurrency(counted, currencyFormatFor(currency))}
                      </span>
                    </span>
                    <span>
                      Diferencia{" "}
                      <span className="font-mono tabular-nums font-semibold text-ink">
                        {delta === null
                          ? "—"
                          : `${delta === 0 ? "" : delta > 0 ? "+" : "-"}${formatCurrency(Math.abs(delta), currencyFormatFor(currency))}`}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-st-body text-ink-secondary">
          Efectivo del turno (monto + propina − vuelto, en {settings.currencyCode}):{" "}
          <span className="font-mono tabular-nums text-ink">
            {shift.cashSalesAmount === null || shift.cashSalesAmount === undefined
              ? "—"
              : formatAmount(shift.cashSalesAmount)}
          </span>
        </p>

        <p className="text-st-body text-ink-secondary">
          Movimientos del turno (retiros restan, ingresos suman):{" "}
          <span className="font-mono tabular-nums text-ink">
            {shift.cashMovementsAmount === null || shift.cashMovementsAmount === undefined
              ? "—"
              : formatAmount(shift.cashMovementsAmount)}
          </span>
        </p>
      </section>

      {/* Bloque 2.3 del roadmap del POS (Fase 2): el historial de retiros e ingresos del turno, con el
          alta cuando la caja sigue abierta. El neto ya viaja en el arqueo de arriba. */}
      <CashMovementsPanel
        shiftId={shift.id}
        initialMovements={movements}
        currencies={countedCurrencies}
        shiftIsOpen={shift.status === "open"}
        currency={currency}
        timezone={settings.timezone}
        locale={settings.locale}
      />
    </div>
  );
}
