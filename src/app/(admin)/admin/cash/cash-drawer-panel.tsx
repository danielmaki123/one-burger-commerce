"use client";

import * as React from "react";
import Link from "next/link";

import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

import {
  CashCountGrid,
  toCashCountRows,
  type CashCountValues,
} from "../pos/cash-count-grid";

/**
 * Tarea 1 del brief (2026-09-17) — **la caja, separada del POS**.
 *
 * El mostrador cobra; la caja se abre y se cierra acá, en «Caja del día». El POS quedó limpio (era el
 * pedido: «POS limpio, Caja aparte») y esta pantalla es la que tiene el conteo, la apertura, el cierre y el
 * arqueo —lo mismo que antes vivía plegado en el POS, con más lugar y con el historial al lado—.
 *
 * Funciona contra las mismas rutas del POS (`/api/admin/pos/shift*`): la caja es la del mostrador, y
 * duplicar el endpoint habría creado dos formas de mover la misma plata.
 */

type OpenShift = {
  id: string;
  openedAt: string;
  openingAmount: number;
};

type ClosedShiftSummary = {
  id?: string;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  expectedByCurrency?: Record<string, number>;
};

const REFRESH_MS = 15000;

export default function CashDrawerPanel({
  locations,
  canSeeCloseDetail = false,
}: {
  locations: { id: string; name: string }[];
  /**
   * Tarea 5 del brief (2026-09-17) — el operario ve solo «Cierre registrado» + el id del turno (y la
   * diferencia, por la tarea 6); quien audita ve además el arqueo completo. Lo decide la pantalla con
   * `canViewCashHistory`, no este componente.
   */
  canSeeCloseDetail?: boolean;
}) {
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [shift, setShift] = React.useState<OpenShift | null>(null);
  const [closedShift, setClosedShift] = React.useState<ClosedShiftSummary | null>(null);
  const [countValues, setCountValues] = React.useState<CashCountValues>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cashCurrencies = React.useMemo(
    () => [settings.currencyCode, ...(settings.usdExchangeRate !== null ? ["USD"] : [])],
    [settings.currencyCode, settings.usdExchangeRate],
  );

  const loadShift = React.useCallback(async (target: string) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/pos/shift?locationId=${encodeURIComponent(target)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as { data?: OpenShift | null };

      setShift(body.data ?? null);
    } catch {
      setError("No se pudo leer el estado de la caja: revisá la conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setClosedShift(null);
    setCountValues({});
    void loadShift(locationId);
  }, [locationId, loadShift]);

  // El estado puede cambiar en otra terminal (la caja se cierra desde el POS viejo o desde otra pestaña).
  React.useEffect(() => {
    if (!locationId) return;

    const timer = setInterval(() => void loadShift(locationId), REFRESH_MS);
    return () => clearInterval(timer);
  }, [locationId, loadShift]);

  async function move(action: "open" | "close") {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/pos/shift/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          counts: toCashCountRows(countValues, cashCurrencies),
        }),
      });
      const body = (await response.json()) as {
        data?: OpenShift & ClosedShiftSummary;
        meta?: { expectedByCurrency?: Record<string, number> };
        error?: { message?: string };
      };

      if (!response.ok || !body.data) {
        setError(
          body.error?.message ??
            (action === "open" ? "No se pudo abrir la caja." : "No se pudo cerrar la caja."),
        );
        return;
      }

      setCountValues({});

      if (action === "open") {
        setShift({ id: body.data.id, openedAt: body.data.openedAt, openingAmount: body.data.openingAmount });
        setClosedShift(null);
        return;
      }

      setShift(null);
      setClosedShift({
        ...body.data,
        expectedByCurrency: body.meta?.expectedByCurrency ?? {},
      });
    } catch {
      setError(
        action === "open"
          ? "No se pudo abrir la caja: revisá la conexión."
          : "No se pudo cerrar la caja: revisá la conexión.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (locations.length === 0) return null;

  const expectedByCurrency = Object.entries(closedShift?.expectedByCurrency ?? {});

  return (
    <section
      aria-label="Caja del local"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Abrir o cerrar la caja</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          Efectivo en córdobas
        </p>
      </div>

      {locations.length > 1 ? (
        <Select
          label="Local"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
        />
      ) : null}

      {loading ? (
        <p role="status" className="text-st-body text-ink-secondary">
          Leyendo el estado de la caja…
        </p>
      ) : (
        <>
          <p className="text-st-body text-ink-secondary">
            {shift ? (
              <>
                Caja abierta desde{" "}
                <span className="font-mono tabular-nums text-ink">
                  {new Intl.DateTimeFormat(settings.locale, {
                    timeZone: settings.timezone,
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(shift.openedAt))}
                </span>{" "}
                · fondo{" "}
                <span className="font-mono tabular-nums text-ink">
                  {formatCurrency(shift.openingAmount, currency)}
                </span>
              </>
            ) : (
              "Sin caja abierta en este local: contá con cuánto abrís."
            )}
          </p>

          <p className="text-st-body text-ink-secondary">
            {shift ? "Contá lo que hay en la caja para cerrarla." : "Contá con cuánto abrís la caja."}
          </p>

          <CashCountGrid
            currencies={cashCurrencies}
            values={countValues}
            onChange={(key, quantity) => setCountValues((current) => ({ ...current, [key]: quantity }))}
            disabled={busy}
            formatAmount={(value) => formatCurrency(value, currency)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={() => void move(shift ? "close" : "open")}
            >
              {busy ? "Guardando…" : shift ? "Cerrar caja" : "Abrir caja"}
            </Button>

            {shift ? (
              <Link
                href={`/admin/cash/history/${shift.id}`}
                className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
              >
                Ver el turno abierto
              </Link>
            ) : null}
          </div>
        </>
      )}

      {/*
        Tareas 5 y 6 del brief (2026-09-17) — qué ve quien cierra:
        el **operario** ve «Cierre registrado», el id del turno y la diferencia (decisión del owner: sin
        cierre ciego, la diferencia se ve); el **dueño/manager** ve además el arqueo completo —contado,
        esperado y el detalle por moneda— porque es quien audita. El detalle vive en la mitad de auditoría
        de esta pantalla y en el historial del turno.
      */}
      {closedShift ? (
        <div
          role="status"
          className="space-y-2 rounded-stitch-lg border border-status-ready-border bg-status-ready-bg px-3 py-2 text-st-body text-status-ready-text"
        >
          <p>
            Cierre registrado
            {closedShift.id ? (
              <>
                {" · turno "}
                <span className="font-mono tabular-nums">{closedShift.id}</span>
              </>
            ) : null}{" "}
            ·{" "}
            {closedShift.difference === 0
              ? "sin diferencia"
              : `diferencia ${formatCurrency(closedShift.difference ?? 0, currency)}`}
          </p>

          {canSeeCloseDetail ? (
            <>
              <p className="text-st-body">
                Contado{" "}
                <span className="font-mono tabular-nums">
                  {formatCurrency(closedShift.closingAmount ?? 0, currency)}
                </span>{" "}
                · esperado{" "}
                <span className="font-mono tabular-nums">
                  {formatCurrency(closedShift.expectedAmount ?? 0, currency)}
                </span>
              </p>

              {expectedByCurrency.length > 0 ? (
                <ul className="space-y-1 text-st-body">
                  {expectedByCurrency.map(([code, expected]) => (
                    <li key={code}>
                      {code}: esperado{" "}
                      <span className="font-mono tabular-nums">
                        {formatCurrency(expected, code.toUpperCase() === settings.currencyCode.toUpperCase() ? currency : { symbol: `${code.toUpperCase()} `, locale: settings.locale })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}
    </section>
  );
}
