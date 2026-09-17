import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import {
  groupDayCloseByLocation,
  summarizeDayClose,
  type DayCloseShift,
} from "@/modules/orders/domain/day-close";
import { businessDate, businessDayRange } from "@/shared/lib/business-days";
import { formatCurrency } from "@/shared/lib/format-currency";

import { AdminMetricStrip } from "../_components/admin-operational-ui";
import { formatShiftDate, formatSignedAmount } from "./cash-shift-helpers";

/**
 * Bloque 11.5/11.6 del roadmap del POS (Fase 2) — el **cierre del día consolidado** y la comparación
 * entre sucursales.
 *
 * El historial de abajo mira **una** sucursal y **un** turno por vez: sirve para auditar, no para
 * responder la pregunta del dueño («¿cuánto entró hoy y a quién le falta plata?»). Este panel suma el
 * día del negocio —no el del servidor— en todas las sucursales del alcance, y deja la comparación en una
 * fila por sucursal.
 *
 * Los números salen de lo **congelado al cerrar** (`day-close.ts`, dominio probado) y lo contado se
 * informa aparte de lo esperado: un día a medio arquear no es un faltante de plata.
 */
export default async function DayClosePanel({
  locations,
}: {
  locations: { id: string; name: string }[];
}) {
  if (locations.length === 0) return null;

  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const repository = new PrismaShiftRepository();
  const today = businessDate(new Date(), settings.timezone);
  const range = businessDayRange(today, settings.timezone);

  const shiftsByLocation = await Promise.all(
    locations.map(async (location) => (await repository.listShifts(location.id)) as DayCloseShift[]),
  );

  const dayShifts = shiftsByLocation.flat().filter((shift) => {
    if (!range.from || !range.to) return true;
    return shift.openedAt >= range.from && shift.openedAt <= range.to;
  });

  const totals = summarizeDayClose(dayShifts);
  const groups = groupDayCloseByLocation(dayShifts, locations);
  const currency = { symbol: settings.currencySymbol, locale: settings.locale };
  const formatAmount = (value: number) => formatCurrency(value, currency);

  return (
    <section
      aria-label="Cierre del día"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Cierre del día</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          {formatShiftDate(range.from ?? null, {
            timezone: settings.timezone,
            locale: settings.locale,
          })}
        </p>
      </div>

      {totals.shifts === 0 ? (
        <p className="text-st-body text-ink-secondary">
          Todavía no hay turnos abiertos hoy en las sucursales a tu cargo.
        </p>
      ) : (
        <>
          <AdminMetricStrip
            items={[
              {
                label: "Efectivo del día",
                value: formatAmount(totals.cashSales),
              },
              {
                label: "Movimientos",
                value: formatSignedAmount(totals.movements, formatAmount),
              },
              {
                label: "Devoluciones",
                value: formatSignedAmount(totals.refunds, formatAmount),
              },
              {
                label: "Diferencia del día",
                value:
                  totals.withoutCount === totals.shifts
                    ? "Sin contar"
                    : formatSignedAmount(totals.difference, formatAmount),
                tone: totals.difference === 0 ? "neutral" : "danger",
              },
            ]}
          />

          <p className="text-st-body text-ink-secondary">
            {totals.shifts} {totals.shifts === 1 ? "turno" : "turnos"} · {totals.closed} cerrado
            {totals.closed === 1 ? "" : "s"}
            {totals.open > 0 ? ` · ${totals.open} con la caja abierta` : ""}
            {totals.withoutCount > 0 ? ` · ${totals.withoutCount} sin contar` : ""}
          </p>
        </>
      )}

      {/* 11.6: la comparación. Se muestra siempre —una sucursal sin turnos va con ceros—: «no vendió»
          es un dato, y así la comparación no desaparece justo el día que nadie vendió. */}
      <ul aria-label="Comparación por sucursal" className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.locationId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-subtle pb-2 last:border-b-0"
          >
            <span className="font-semibold text-ink">{group.locationName}</span>
            <span className="space-x-4 text-st-body text-ink-secondary">
              <span>
                Efectivo{" "}
                <span className="font-mono tabular-nums text-ink">
                  {formatAmount(group.totals.cashSales)}
                </span>
              </span>
              <span>
                Turnos{" "}
                <span className="font-mono tabular-nums text-ink">{group.totals.shifts}</span>
              </span>
              <span>
                Diferencia{" "}
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {group.totals.withoutCount === group.totals.shifts && group.totals.shifts > 0
                    ? "Sin contar"
                    : formatSignedAmount(group.totals.difference, formatAmount)}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
