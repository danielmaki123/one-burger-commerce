"use client";

import * as React from "react";

import type { CashCountConfig } from "@/modules/cash-config/domain/cash-config.types";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

import { CashCountGrid, toCashCountRows, type CashCountValues } from "../pos/cash-count-grid";
import type { CashCountRow, ClosedCashShift } from "./use-cash-shift";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **sin turno**: la apertura.
 *
 * Solo efectivo y por denominación (el conteo de billetes que pidió el owner): la plata que se manda es el
 * conteo y el **fondo lo deriva el servidor**, igual que el esperado del cierre — la pantalla no calcula
 * arqueos.
 *
 * El aviso del cierre recién hecho vive acá a propósito: después de cerrar, el estado es «sin turno». A
 * quien **no** audita se le dice que quedó registrado, con el id y la diferencia (decisiones de las tareas
 * 5 y 6 del brief del POS: sin cierre ciego); el arqueo completo —contado, esperado y el detalle por
 * moneda— es de quien audita.
 */
export default function CashOpenSection({
  countConfig,
  busy,
  closedShift,
  actionError,
  canSeeCloseDetail,
  blindCount = true,
  onOpen,
}: {
  /** Fase 2 — la config del conteo del local: monedas y billetes, tal como la lee la pantalla. */
  countConfig: CashCountConfig;
  busy: boolean;
  /** El cierre recién registrado, si la pantalla viene de cerrar la caja. */
  closedShift: ClosedCashShift | null;
  /** Error de la última acción (abrir), no de la lectura: el estado de la pantalla no cambia por esto. */
  actionError: string | null;
  /** `true` = además del resumen, el arqueo completo con el detalle por moneda. */
  canSeeCloseDetail: boolean;
  /**
   * Fase 4 del rediseño de Caja (2026-09-22) — **arqueo ciego** de la sucursal (config `blindCount`).
   *
   * Con el ciego prendido, quien **no** audita (el cajero) no ve la diferencia: el conteo se sella y el
   * arqueo lo lee el dueño. Quien audita la sigue viendo aunque el ciego esté prendido (es su trabajo).
   * Por defecto `true`: si un llamador se olvida del flag, el error cae del lado de no mostrar plata.
   */
  blindCount?: boolean;
  onOpen: (counts: CashCountRow[]) => void;
}) {
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();
  const [countValues, setCountValues] = React.useState<CashCountValues>({});
  const expectedByCurrency = Object.entries(closedShift?.expectedByCurrency ?? {});

  return (
    <section
      aria-label="Caja del local"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Abrir la caja</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          Efectivo en córdobas
        </p>
      </div>

      <p className="text-st-body text-ink-secondary">
        Sin caja abierta en este local: contá con cuánto abrís.
      </p>

      <CashCountGrid
        currencies={countConfig.currencies}
        denominations={countConfig.denominations}
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
          onClick={() => onOpen(toCashCountRows(countValues, countConfig.currencies, countConfig.denominations))}
        >
          {busy ? "Guardando…" : "Abrir caja"}
        </Button>
      </div>

      {/*
        Tareas 5 y 6 del brief del POS (2026-09-17) — qué ve quien acaba de cerrar: el operario ve
        «Cierre registrado», el id del turno y la diferencia; quien audita ve además el arqueo completo.
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
            ) : null}
            {/*
              Fase 4 del rediseño de Caja (2026-09-22) — arqueo ciego: con `blindCount` prendido, quien no
              audita ve que el cierre quedó registrado y **sellado**, sin el número de la diferencia. Quien
              audita la sigue viendo aunque el ciego esté prendido (es su trabajo).
            */}
            {blindCount && !canSeeCloseDetail ? (
              <> · conteo sellado</>
            ) : (
              <>
                {" · "}
                {closedShift.difference === 0
                  ? "sin diferencia"
                  : `diferencia ${formatCurrency(closedShift.difference ?? 0, currency)}`}
              </>
            )}
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
                        {formatCurrency(
                          expected,
                          code.toUpperCase() === settings.currencyCode.toUpperCase()
                            ? currency
                            : { symbol: `${code.toUpperCase()} `, locale: settings.locale },
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
