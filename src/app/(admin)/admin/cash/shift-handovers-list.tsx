"use client";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";

import { formatShiftDateTime } from "./cash-shift-helpers";

/**
 * Tarea 7 del brief (2026-09-17) — la lista de **traspasos de caja** del turno (1.13).
 *
 * La usan los dos lugares donde el dato importa: la pantalla de caja mientras la caja está abierta (para
 * ver a quién se le entregó y cuándo) y el detalle del cierre, cuando el turno ya terminó y hay que
 * reconstruir quién tenía la plata. Es puro dibujo: los traspasos y el formato llegan como datos.
 *
 * Los montos van en `font-mono` con `tabular-nums` (regla del sistema: los números no tiemblan) y el
 * entregado es el esperado **congelado** al firmar, no un recálculo de hoy.
 */

export type ShiftHandoverRow = {
  id: string;
  handedByName: string | null;
  receivedByName: string;
  expectedAmount: number;
  expectedByCurrency: Record<string, number> | null;
  createdAt: string;
};

export default function ShiftHandoversList({
  handovers,
  emptyLabel,
  currency,
  timezone,
  locale,
}: {
  handovers: ShiftHandoverRow[];
  /** Qué decir cuando el turno no cambió de manos (cambia el texto según la pantalla). */
  emptyLabel: string;
  currency: CurrencyFormat;
  timezone: string;
  locale: string;
}) {
  if (handovers.length === 0) {
    return <p className="text-st-body text-ink-secondary">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {handovers.map((handover) => (
        <li
          key={handover.id}
          className="border-b border-line-subtle pb-2 text-st-body text-ink-secondary last:border-b-0"
        >
          Recibió <span className="font-semibold text-ink">{handover.receivedByName}</span>
          {handover.handedByName ? <> de {handover.handedByName}</> : null} · entregado{" "}
          <span className="font-mono tabular-nums text-ink">
            {formatCurrency(handover.expectedAmount, currency)}
          </span>{" "}
          ·{" "}
          <span className="font-mono tabular-nums">
            {formatShiftDateTime(handover.createdAt, { timezone, locale })}
          </span>
        </li>
      ))}
    </ul>
  );
}
