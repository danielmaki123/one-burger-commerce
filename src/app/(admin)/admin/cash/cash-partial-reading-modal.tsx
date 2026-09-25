"use client";

import * as React from "react";

import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { printLines } from "@/shared/lib/print-lines";
import { buildShiftXSheet } from "@/shared/lib/shift-x-sheet";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";

import { formatShiftDateTime } from "./cash-shift-helpers";

/**
 * Fase 5 del rediseño de Caja (2026-09-23) — la **lectura parcial** (1.12 del roadmap), en un modal.
 *
 * Qué cambia respecto de la Fase 1a: la lectura parcial era un botón que **imprimía** (y solo el dueño
 * podía: el papel lo saca él). Ahora el número se ve en pantalla —el cajero también, porque es su caja— y el
 * papel es la salida del modal, no la única puerta.
 *
 * Tres reglas:
 *
 * 1. **Los montos son del servidor**: se piden al corte X (`GET /api/admin/pos/shift/x`, la misma cuenta que
 *    el cierre). La pantalla no suma nada y no guarda nada: es una lectura.
 * 2. **El arqueo ciego manda**: con el ciego prendido y sin permiso de auditoría la lectura va **sellada**
 *    (se ve lo que entró y no el esperado del sistema), igual que el resumen del cierre.
 * 3. **La imprenta es del dueño** (§8.e, Fase 4): sin `canPrint` no se ofrece el botón.
 */

/**
 * Lo que llega del corte X. Con arqueo ciego el servidor **no manda** el esperado ni sus sumandos
 * (TASK-AUD-003): por eso son opcionales y la pantalla no los dibuja para el cajero.
 */
type ShiftXArqueo = {
  shiftId: string;
  locationId: string;
  openedAt: string;
  generatedAt: string;
  openingAmount: number;
  expectedAmount?: number;
  expectedByCurrency?: Record<string, number>;
  cashSalesAmount?: number;
  cashMovementsAmount?: number;
  refundsAmount?: number;
};

export default function CashPartialReadingModal({
  open,
  locationId,
  locationName,
  actorName,
  canPrint,
  canSeeArqueo,
  onClose,
}: {
  open: boolean;
  locationId: string;
  /** Nombre del local, para el papel. */
  locationName: string;
  /** Quién lee: el papel del corte lo dice (el dueño lee el papel, no el id). */
  actorName: string | null;
  /** Fase 4 — `canPrintCashDocuments`: el papel lo saca el dueño. */
  canPrint: boolean;
  /** `false` = arqueo ciego sin permiso de auditoría: el esperado va sellado. */
  canSeeArqueo: boolean;
  onClose: () => void;
}) {
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  const [arqueo, setArqueo] = React.useState<ShiftXArqueo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [printed, setPrinted] = React.useState<string | null>(null);

  const sheetOptions = React.useMemo(
    () => ({
      businessName: settings.name,
      timezone: settings.timezone,
      locale: settings.locale,
      currencyCode: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
    }),
    [settings],
  );

  React.useEffect(() => {
    if (!open) {
      setArqueo(null);
      setError(null);
      setPrinted(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPrinted(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/pos/shift/x?locationId=${encodeURIComponent(locationId)}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as {
          data?: ShiftXArqueo | null;
          error?: { message?: string };
        };

        if (cancelled) return;

        if (!response.ok || !body.data) {
          setError(body.error?.message ?? "No hay una caja abierta en este local.");
          return;
        }

        setArqueo(body.data);
      } catch {
        if (!cancelled) setError("No se pudo leer la caja: revisá la conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, locationId]);

  function print() {
    if (!arqueo) return;

    const ok = printLines(
      buildShiftXSheet(
        {
          ...arqueo,
          // El papel lo saca el dueño (`canPrint`): a él el servidor sí le manda el arqueo completo. Los
          // `?? 0` son para el tipo, que ahora los declara opcionales porque al cajero no le llegan.
          expectedAmount: arqueo.expectedAmount ?? 0,
          expectedByCurrency: arqueo.expectedByCurrency ?? {},
          cashSalesAmount: arqueo.cashSalesAmount ?? 0,
          cashMovementsAmount: arqueo.cashMovementsAmount ?? 0,
          refundsAmount: arqueo.refundsAmount ?? 0,
          locationName,
          handedByName: actorName,
          receivedByName: null,
        },
        sheetOptions,
      ),
    );

    setPrinted(
      ok
        ? "Lectura enviada a imprimir."
        : "El navegador bloqueó la ventana de impresión: permití las ventanas emergentes de este sitio.",
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Lectura parcial">
      <div className="space-y-4">
        <p className="text-st-body text-ink-secondary">
          Así va la caja ahora mismo: no cierra el turno ni cambia nada.
        </p>

        {loading ? (
          <p role="status" className="text-st-body text-ink-secondary">
            Leyendo la caja…
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-st-body font-medium text-status-sla-text">
            {error}
          </p>
        ) : null}

        {arqueo ? (
          <dl className="grid grid-cols-2 gap-3" aria-label="Arqueo de la lectura parcial">
            <Reading label="Abierta" value={formatShiftDateTime(arqueo.openedAt, { timezone: settings.timezone, locale: settings.locale })} />
            <Reading label="Leída" value={formatShiftDateTime(arqueo.generatedAt, { timezone: settings.timezone, locale: settings.locale })} />
            <Reading label="Fondo" value={formatCurrency(arqueo.openingAmount, currency)} />
            {/*
              TASK-AUD-003 — con arqueo ciego estos tres **no** se dibujan: son los sumandos del esperado
              (`fondo + efectivo del turno + movimientos + devoluciones`), así que mostrarlos dejaría el
              ciego a una suma de distancia. El servidor tampoco los manda.
            */}
            {canSeeArqueo ? (
              <>
                <Reading label="Efectivo del turno" value={formatCurrency(arqueo.cashSalesAmount ?? 0, currency)} />
                <Reading
                  label="Movimientos"
                  value={
                    arqueo.cashMovementsAmount === 0
                      ? "sin movimientos"
                      : `${(arqueo.cashMovementsAmount ?? 0) > 0 ? "+" : "−"}${formatCurrency(Math.abs(arqueo.cashMovementsAmount ?? 0), currency)}`
                  }
                />
                <Reading label="Devoluciones" value={formatCurrency(arqueo.refundsAmount ?? 0, currency)} />
              </>
            ) : null}
          </dl>
        ) : null}

        {arqueo && canSeeArqueo ? (
          <div className="space-y-1 rounded-stitch-md bg-surface-raised p-3">
            <p className="text-st-body font-semibold text-ink">
              Esperado en la caja:{" "}
              <span className="font-mono tabular-nums">
                {formatCurrency(arqueo.expectedAmount ?? 0, currency)}
              </span>
            </p>

            {Object.entries(arqueo.expectedByCurrency ?? {}).length > 0 ? (
              <ul className="space-y-1 text-st-body text-ink-secondary">
                {Object.entries(arqueo.expectedByCurrency ?? {}).map(([code, expected]) => (
                  <li key={code}>
                    {code}: esperado{" "}
                    <span className="font-mono tabular-nums">
                      {formatCurrency(expected, formatFor(code, settings.currencyCode, currency))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {arqueo && !canSeeArqueo ? (
          <p className="text-st-body text-ink-secondary">
            Con el arqueo ciego esta lectura va sellada: se ve lo que entró y no el esperado del sistema.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {canPrint && arqueo ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={print}>
              Imprimir lectura parcial
            </Button>
          ) : null}

          <Button type="button" className="min-h-11" onClick={onClose}>
            Volver a la caja
          </Button>

          {printed ? (
            <p role="status" className="text-st-caption text-ink-secondary">
              {printed}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="font-mono text-st-body tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** Una moneda que no es la del negocio se escribe con **su** código (`USD 20.00`), no con el símbolo local. */
function formatFor(code: string, businessCurrencyCode: string, format: CurrencyFormat): CurrencyFormat {
  return code.toUpperCase() === businessCurrencyCode.toUpperCase()
    ? format
    : { symbol: `${code.toUpperCase()} `, locale: format.locale };
}
