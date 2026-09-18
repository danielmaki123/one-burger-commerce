"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusPill,
} from "../../_components/admin-operational-ui";
import { businessDate, businessDayRange } from "../../orders/orders-page-helpers";
import { HistoryTabs } from "../history-tabs";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Cierres**.
 *
 * Es la consulta del arqueo: qué turno cerró quién, en qué sucursal, por cuánto y con qué diferencia. La
 * sección es de solo lectura —ver el detalle y nada más—, así que la pantalla no toca nada: lee
 * `/api/admin/history/cierres`, que ya aplica el permiso (`canViewHistory`) y el alcance por sucursal.
 *
 * El filtro de sucursal y el de cajero se arman con **lo que hay en la lista**, así que nunca se ofrece
 * una sucursal o un cajero sin nada que mostrar. Las filas son filas y no una tabla: a 375 px una tabla de
 * seis columnas obliga a scrollear a lo ancho.
 */

type HistoryShift = {
  id: string;
  locationId: string;
  locationName: string | null;
  userId: string;
  cashierName: string | null;
  closedAt: string | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
};

const ALL = "all";

const LINK_BUTTON_CLASS =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-stitch-md border border-line-subtle bg-surface-card px-3 text-st-body font-semibold text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none";

export function CierresClient() {
  const { timezone: timeZone } = useBusinessSettings();
  const currency = useCurrencyFormat();

  const [day, setDay] = useState(() => businessDate(new Date(), timeZone));
  const [locationId, setLocationId] = useState<string>(ALL);
  const [cashierUserId, setCashierUserId] = useState<string>(ALL);
  const [onlyDifference, setOnlyDifference] = useState(false);

  const [rows, setRows] = useState<HistoryShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (day) {
      const range = businessDayRange(day, timeZone);
      if (range.from) params.set("dateFrom", range.from);
      if (range.to) params.set("dateTo", range.to);
    }

    if (locationId !== ALL) params.set("locationId", locationId);
    if (cashierUserId !== ALL) params.set("cashierUserId", cashierUserId);
    if (onlyDifference) params.set("onlyDifference", "1");

    return params.toString();
  }, [day, locationId, cashierUserId, onlyDifference, timeZone]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/history/cierres?${queryString}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setError("No se pudo cargar el historial de cierres.");
          return;
        }

        const payload = (await response.json()) as { data?: HistoryShift[] };
        if (!cancelled) setRows(payload.data ?? []);
      } catch {
        if (!cancelled) setError("No se pudo cargar el historial de cierres.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [queryString, refreshToken]);

  const locationOptions = useMemo(() => {
    const seen = new Map<string, string>();

    for (const row of rows) {
      if (!seen.has(row.locationId)) seen.set(row.locationId, row.locationName ?? "Sucursal");
    }

    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const cashierOptions = useMemo(() => {
    const seen = new Map<string, string>();

    for (const row of rows) {
      if (!seen.has(row.userId)) seen.set(row.userId, row.cashierName ?? "Sin nombre");
    }

    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const clearFilters = useCallback(() => {
    setDay("");
    setLocationId(ALL);
    setCashierUserId(ALL);
    setOnlyDifference(false);
  }, []);

  return (
    <div className="min-w-0 space-y-4" aria-busy={loading}>
      <AdminPageHeader
        title="Historial"
        description="Consulta de cierres de caja y facturas emitidas. Solo lectura."
      />

      <HistoryTabs />

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-h-11 items-center gap-2">
          <span className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary">
            Día
          </span>
          <Input
            type="date"
            className="h-11"
            aria-label="Día del cierre"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>

        {locationOptions.length > 1 ? (
          <div className="w-[12rem]">
            <Select
              aria-label="Sucursal de los cierres"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              options={[{ value: ALL, label: "Todas las sucursales" }, ...locationOptions]}
            />
          </div>
        ) : null}

        {cashierOptions.length > 1 ? (
          <div className="w-[12rem]">
            <Select
              aria-label="Cajero de los cierres"
              value={cashierUserId}
              onChange={(event) => setCashierUserId(event.target.value)}
              options={[{ value: ALL, label: "Todos los cajeros" }, ...cashierOptions]}
            />
          </div>
        ) : null}

        <Button
          variant="outline"
          className="min-h-11 gap-2"
          aria-pressed={onlyDifference}
          onClick={() => setOnlyDifference((only) => !only)}
        >
          Solo descuadre
        </Button>

        <Button variant="ghost" className="min-h-11" onClick={clearFilters}>
          Limpiar filtros
        </Button>

        <Button
          variant="outline"
          className="ml-auto min-h-11 gap-2"
          onClick={() => setRefreshToken((token) => token + 1)}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground">
          {error}
        </div>
      ) : null}

      {!error && !loading && rows.length === 0 ? (
        <AdminEmptyState
          title="Sin cierres en este rango"
          description="No hay turnos cerrados para los filtros seleccionados."
        />
      ) : null}

      {rows.length > 0 ? (
        <ul className="min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3 last:border-0 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-mono text-st-body font-semibold tabular-nums text-ink">
                  {row.closedAt ? formatTimeInTimeZone(row.closedAt, timeZone) : "—"}
                  <span className="ml-2 font-sans text-st-caption font-medium text-ink-secondary">
                    {row.closedAt ? businessDate(new Date(row.closedAt), timeZone) : ""}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-st-caption text-ink-secondary">
                  <span className="font-semibold text-ink">{row.locationName ?? "Sucursal"}</span>
                  <span>{row.cashierName ?? "Sin cajero"}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <span className="font-mono text-st-body font-semibold tabular-nums text-ink">
                  {formatCurrency(row.closingAmount ?? 0, currency)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-st-caption font-semibold tabular-nums text-ink-secondary">
                    {formatCurrency(row.difference ?? 0, currency)}
                  </span>
                  {row.difference === 0 ? (
                    <AdminStatusPill tone="success">Cuadró</AdminStatusPill>
                  ) : (
                    <AdminStatusPill tone="danger">Descuadre</AdminStatusPill>
                  )}
                </span>

                <Link href={`/admin/cash/history/${row.id}`} className={LINK_BUTTON_CLASS}>
                  <Lock aria-hidden="true" className="h-4 w-4" />
                  Ver detalle
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
