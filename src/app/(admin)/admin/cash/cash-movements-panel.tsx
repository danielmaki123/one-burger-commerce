"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";

import { formatCurrency } from "@/shared/lib/format-currency";
import type { CurrencyFormat } from "@/shared/lib/format-currency";

import { isOverWithdrawalLimit } from "@/modules/orders/domain/cash-movement-limit";
import { formatShiftDateTime } from "./cash-shift-helpers";
import CashMovementSheet from "./cash-movement-sheet";

/**
 * Bloque 2.3 del roadmap del POS (Fase 2) — el historial de movimientos del turno, con su alta.
 *
 * El **historial** sale del servidor (el detalle del cierre ya leyó el turno) y el alta se hace contra
 * la API: cuando un movimiento entra, se vuelve a pedir el historial para que la lista muestre lo que
 * el servidor guardó y no lo que la pantalla creyó mandar. La caja tiene que estar **abierta** para
 * registrar: un movimiento sobre un turno cerrado cambiaría un arqueo ya firmado.
 *
 * Recibe **datos** (zona horaria, idioma, formato de moneda), no funciones: cruzar una función de un
 * server component a uno de cliente es un 500 en runtime que el build no atrapa.
 */

export type CashMovementRow = {
  id: string;
  kind: "withdrawal" | "deposit";
  category: string;
  amount: number;
  currency: string;
  reason: string;
  userId: string;
  /** Tarea 2 del brief: el límite de retiro vigente al registrar (`null` = no había límite). */
  withdrawalLimitAmount?: number | null;
  createdAt: string;
};

/** El movimiento con su límite ya resuelto: la fila puede no traerlo (turnos viejos). */
function limitOf(movement: CashMovementRow) {
  return {
    kind: movement.kind,
    amount: movement.amount,
    withdrawalLimitAmount: movement.withdrawalLimitAmount ?? null,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  supplier: "Proveedor",
  change_fund: "Cambio",
  vault: "Bóveda",
  expense: "Gasto",
  other: "Otro",
};

export default function CashMovementsPanel({
  shiftId,
  initialMovements,
  currencies,
  shiftIsOpen,
  currency,
  timezone,
  locale,
}: {
  shiftId: string;
  initialMovements: CashMovementRow[];
  currencies: string[];
  shiftIsOpen: boolean;
  currency: CurrencyFormat;
  timezone: string;
  locale: string;
}) {
  const [movements, setMovements] = React.useState(initialMovements);
  const [error, setError] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(`/api/admin/cash/shifts/${shiftId}/movements`, {
        cache: "no-store",
      });
      const body: { data?: CashMovementRow[]; error?: { message?: string } } =
        await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "No se pudo leer los movimientos.");
        return;
      }

      setMovements(body.data ?? []);
    } catch {
      setError("No se pudo leer los movimientos: revisá la conexión.");
    }
  }, [shiftId]);

  return (
    <section
      aria-label="Movimientos de caja"
      className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <h2 className="text-st-h2 text-ink">Movimientos de caja</h2>

      {error ? (
        <div role="alert" className="space-y-2">
          <p className="text-st-body font-medium text-status-sla-text">{error}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {movements.length === 0 ? (
        <p className="text-st-body text-ink-secondary">
          Este turno no tuvo retiros ni ingresos.
        </p>
      ) : (
        <ul className="space-y-2">
          {movements.map((movement) => (
            <li
              key={movement.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-subtle pb-2 last:border-b-0"
            >
              <span className="min-w-0">
                <span className="font-semibold text-ink">
                  {movement.kind === "withdrawal" ? "Retiro" : "Ingreso"} ·{" "}
                  {CATEGORY_LABELS[movement.category] ?? movement.category}
                </span>
                {/* Tarea 2 del brief: un retiro por encima del límite configurado queda a la vista. No hay
                    aprobación (decisión del owner): el límite avisa, no bloquea. */}
                {isOverWithdrawalLimit(limitOf(movement)) ? (
                  <span className="ml-2 rounded-full border border-status-sla-border bg-status-sla-bg px-2 py-0.5 text-st-caption font-semibold text-status-sla-text">
                    Sobre el límite de{" "}
                    <span className="font-mono tabular-nums">
                      {formatCurrency(movement.withdrawalLimitAmount ?? 0, currency)}
                    </span>
                  </span>
                ) : null}
                <span className="block text-st-body text-ink-secondary">
                  {movement.reason} ·{" "}
                  <span className="font-mono tabular-nums">
                    {formatShiftDateTime(movement.createdAt, { timezone, locale })}
                  </span>
                </span>
              </span>
              <span
                className={`font-mono text-st-body tabular-nums font-semibold ${
                  movement.kind === "withdrawal" ? "text-status-sla-text" : "text-status-ready-text"
                }`}
              >
                {movement.kind === "withdrawal" ? "−" : "+"}
                {formatCurrency(movement.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/*
        Fase 5 del rediseño de Caja (2026-09-23) — el alta se hace en una **hoja**, con una fila por moneda:
        el motivo se escribe una vez y cada moneda con monto es su propio movimiento.
      */}
      {shiftIsOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="min-h-11" onClick={() => setSheetOpen(true)}>
            Registrar movimiento
          </Button>
        </div>
      ) : (
        <p className="text-st-body text-ink-secondary">
          La caja está cerrada: para mover plata hay que reabrirla.
        </p>
      )}

      <CashMovementSheet
        open={sheetOpen}
        shiftId={shiftId}
        currencies={currencies}
        onRegistered={() => void reload()}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  );
}
