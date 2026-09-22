"use client";

import * as React from "react";
import Link from "next/link";

import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

import type { CashCountConfig } from "@/modules/cash-config/domain/cash-config.types";

import { CashCountGrid, toCashCountRows, type CashCountValues } from "../pos/cash-count-grid";
import CashShiftHandoverPanel from "./cash-shift-handover-panel";
import type { CashCountRow, CashShift } from "./use-cash-shift";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **turno abierto**.
 *
 * Es el trabajo del mostrador: cómo va la caja, el conteo para cerrarla y las acciones del turno. El
 * esperado y la diferencia **no** se calculan acá: los deriva el servidor del conteo, igual que el cierre.
 *
 * La lectura parcial y el traspaso siguen viviendo en su panel (Fase 5 los lleva a un modal y decide el
 * destino de la firma de custodia), y el enlace al detalle del turno se muestra **solo** a quien puede
 * verlo: el detalle redirige a Órdenes a quien no audita (A-40), así que ofrecerlo sería un enlace que
 * rebota.
 */
export default function CashTurnSection({
  locationId,
  locationName,
  actorName,
  countConfig,
  busy,
  shift,
  actionError,
  canSeeShiftDetail,
  onClose,
}: {
  locationId: string;
  /** Nombre del local, para el papel del traspaso (el dueño lee el papel, no el id). */
  locationName: string;
  /** Quién entrega la caja: el nombre de la sesión que firma el traspaso. */
  actorName: string | null;
  countConfig: CashCountConfig;
  busy: boolean;
  shift: CashShift;
  /** Error de la última acción (cerrar), no de la lectura. */
  actionError: string | null;
  /** `true` = puede ver el detalle del turno (`/admin/cash/history/[id]`). */
  canSeeShiftDetail: boolean;
  onClose: (counts: CashCountRow[]) => void;
}) {
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();
  const [countValues, setCountValues] = React.useState<CashCountValues>({});

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

      <p className="text-st-body text-ink-secondary">
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
      </p>

      <p className="text-st-body text-ink-secondary">
        Contá lo que hay en la caja para cerrarla.
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
          onClick={() => onClose(toCashCountRows(countValues, countConfig.currencies, countConfig.denominations))}
        >
          {busy ? "Guardando…" : "Cerrar caja"}
        </Button>

        {/*
          A-40 — el detalle del turno redirige a Órdenes a quien no puede verlo
          (`cash/history/[id]/page.tsx`), así que el enlace se muestra solo a quien sí puede: ofrecerlo al
          cajero era un enlace que rebota.
        */}
        {canSeeShiftDetail ? (
          <Link
            href={`/admin/cash/history/${shift.id}`}
            className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
          >
            Ver el turno abierto
          </Link>
        ) : null}
      </div>

      <CashShiftHandoverPanel
        locationId={locationId}
        locationName={locationName}
        actorName={actorName}
      />

      {actionError ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
