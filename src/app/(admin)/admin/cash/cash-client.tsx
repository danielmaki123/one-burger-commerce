"use client";

import Link from "next/link";
import * as React from "react";

import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { AdminEmptyState, AdminMetricStrip } from "../_components/admin-operational-ui";
import {
  CASH_DIFFERENCE_LABEL,
  formatCashDifference,
  formatShiftDateTime,
  getCashDifferenceTone,
  summarizeShifts,
  type CashDifferenceTone,
} from "./cash-shift-helpers";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — el historial de cierres.
 *
 * Hasta ahora el arqueo se veía **una sola vez** al cerrar y desaparecía al recargar, aunque los datos
 * estaban guardados (`Shift` + `ShiftCashCount`). Esta pantalla los lee tal como quedaron: el esperado
 * **congelado** al cerrar, no recalculado con la tasa de hoy.
 *
 * No es la pantalla del mostrador: la caja se abre y se cierra en `/admin/pos`. Acá se audita.
 */

export type CashLocationOption = { id: string; name: string };

type ShiftRow = {
  id: string;
  userId: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  notes: string | null;
};

type ShiftsPayload = {
  data: ShiftRow[];
  meta: { locationId: string | null; total: number; openCount: number; closedCount: number };
};

const DIFFERENCE_CLASS: Record<CashDifferenceTone, string> = {
  cuadra: "text-status-ready-text",
  falta: "text-status-sla-text",
  sobra: "text-status-prep-text",
  "sin-contar": "text-ink-muted",
};

const VIEW_OPTIONS = [
  { value: "closed", label: "Cierres" },
  { value: "all", label: "Todos" },
] as const;

type ViewFilter = (typeof VIEW_OPTIONS)[number]["value"];

const EMPTY_META = { locationId: null, total: 0, openCount: 0, closedCount: 0 };

export default function CashClient({ locations }: { locations: CashLocationOption[] }) {
  const currency = useCurrencyFormat();
  const { timezone, locale } = useBusinessSettings();

  const [locationId, setLocationId] = React.useState(() => locations[0]?.id ?? "");
  const [view, setView] = React.useState<ViewFilter>("closed");
  const [payload, setPayload] = React.useState<ShiftsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadShifts = React.useCallback(async (targetLocationId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/cash/shifts?locationId=${encodeURIComponent(targetLocationId)}`,
        { cache: "no-store" },
      );
      const body: {
        data?: ShiftRow[];
        meta?: ShiftsPayload["meta"];
        error?: { message?: string };
      } = await response.json();

      if (!response.ok) {
        throw new Error(body.error?.message ?? "No se pudo leer el historial de caja.");
      }

      setPayload({ data: body.data ?? [], meta: body.meta ?? EMPTY_META });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo leer el historial de caja.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    void loadShifts(locationId);
  }, [loadShifts, locationId]);

  const shifts = payload?.data ?? [];
  const visibleShifts =
    view === "closed" ? shifts.filter((shift) => shift.status === "closed") : shifts;
  const summary = summarizeShifts(visibleShifts);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {locations.length > 1 ? (
          <TabsList ariaLabel="Sucursal de la caja">
            {locations.map((location) => (
              <TabsTrigger
                key={location.id}
                value={location.id}
                activeValue={locationId}
                onClick={(value) => setLocationId(value)}
              >
                {location.name}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}

        <TabsList ariaLabel="Qué turnos mostrar">
          {VIEW_OPTIONS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              activeValue={view}
              onClick={(value) => setView(value as ViewFilter)}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {loading ? (
        <p role="status" className="text-st-body text-ink-secondary">
          Leyendo el historial de caja…
        </p>
      ) : null}

      {error ? (
        <section
          role="alert"
          className="space-y-3 rounded-stitch-lg border border-status-sla-border bg-status-sla-bg p-4"
        >
          <p className="text-st-body font-semibold text-status-sla-text">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void loadShifts(locationId)}
          >
            Reintentar
          </Button>
        </section>
      ) : null}

      {!loading && !error && visibleShifts.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay cierres en este local"
          description="Cuando se cierre la primera caja, acá queda el arqueo con lo contado, lo esperado y la diferencia."
        />
      ) : null}

      {!loading && !error && visibleShifts.length > 0 ? (
        <>
          <AdminMetricStrip
            items={[
              { label: "Cierres", value: String(summary.countedCount) },
              {
                label: "Sin contar",
                value: String(summary.pendingCount),
                tone: summary.pendingCount > 0 ? "warning" : "neutral",
              },
              {
                label: "Diferencia acumulada",
                value: formatCurrency(summary.differenceTotal, currency),
                tone: summary.differenceTotal === 0 ? "neutral" : "danger",
              },
              { label: "Turnos abiertos", value: String(payload?.meta.openCount ?? 0) },
            ]}
          />

          <ol aria-label="Cierres de caja" className="space-y-3">
            {visibleShifts.map((shift) => {
              const tone = getCashDifferenceTone(shift);

              return (
                <li key={shift.id}>
                  <Link
                    href={`/admin/cash/history/${shift.id}`}
                    className="block min-h-11 rounded-stitch-lg border border-line-subtle bg-surface-card p-4 transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-mono text-st-body tabular-nums text-ink">
                          {formatShiftDateTime(shift.openedAt, { timezone, locale })}
                          {" → "}
                          {formatShiftDateTime(shift.closedAt, { timezone, locale })}
                        </p>
                        <p className="text-st-body text-ink-secondary">
                          {shift.status === "open" ? "Caja abierta" : "Caja cerrada"} · abre{" "}
                          <span className="font-mono tabular-nums">
                            {formatCurrency(shift.openingAmount, currency)}
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                          {CASH_DIFFERENCE_LABEL[tone]}
                        </p>
                        <p
                          className={`font-mono text-st-body tabular-nums font-semibold ${DIFFERENCE_CLASS[tone]}`}
                        >
                          {formatCashDifference(shift, (value) => formatCurrency(value, currency))}
                        </p>
                        <p className="text-st-body text-ink-secondary">
                          Esperado{" "}
                          <span className="font-mono tabular-nums">
                            {shift.expectedAmount === null
                              ? "—"
                              : formatCurrency(shift.expectedAmount, currency)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </div>
  );
}
