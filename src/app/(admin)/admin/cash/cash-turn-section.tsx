"use client";

import * as React from "react";
import Link from "next/link";

import { formatCurrency } from "@/shared/lib/format-currency";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";

import type { CashCountConfig } from "@/modules/cash-config/domain/cash-config.types";

import CashCloseModal from "./cash-close-modal";
import CashPartialReadingModal from "./cash-partial-reading-modal";
import CashShiftHandoverPanel from "./cash-shift-handover-panel";
import type { BankCloseDraft, CashCountRow, CashShift } from "./use-cash-shift";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **turno abierto**.
 *
 * Es el trabajo del mostrador: cómo va la caja y las acciones del turno. El esperado y la diferencia **no**
 * se calculan acá: los deriva el servidor del conteo, igual que el cierre.
 *
 * Fase 3 del rediseño de Caja (2026-09-23) — el conteo y el **cuadre por banco** se hacen en el
 * `CashCloseModal`: acá queda el estado del turno y el botón que lo abre. El modal muestra el consolidado y
 * la diferencia antes de firmar, y **no bloquea** el cierre por una diferencia (el aviso al dueño es lo que
 * la hace visible). Con arqueo ciego (`blindCount`) y sin permiso de auditoría, el cajero declara su lote
 * pero no ve lo cobrado ni la diferencia.
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
  banks,
  busy,
  shift,
  actionError,
  canSeeShiftDetail,
  canSeeCloseDetail,
  blindCount,
  canPrint = false,
  onClose,
}: {
  locationId: string;
  /** Nombre del local, para el papel del traspaso (el dueño lee el papel, no el id). */
  locationName: string;
  /** Quién entrega la caja: el nombre de la sesión que firma el traspaso. */
  actorName: string | null;
  countConfig: CashCountConfig;
  /** Fase 3 — los bancos que liquida esta sucursal (los `LocationBank` activos). */
  banks: { id: string; name: string; code: string | null }[];
  busy: boolean;
  shift: CashShift;
  /** Error de la última acción (cerrar), no de la lectura. */
  actionError: string | null;
  /** `true` = puede ver el detalle del turno (`/admin/cash/history/[id]`). */
  canSeeShiftDetail: boolean;
  /** `true` = ve el arqueo completo del cierre (permiso de auditoría). */
  canSeeCloseDetail: boolean;
  /** Fase 4 — arqueo ciego: el cajero no ve el esperado ni la diferencia. */
  blindCount: boolean;
  /** Fase 4 — imprimir (§8.e): el papel lo saca el dueño. Por defecto no. */
  canPrint?: boolean;
  onClose: (counts: CashCountRow[], bankCloses: BankCloseDraft[]) => void;
}) {
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();
  const [closing, setClosing] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  // Fase 4 — el ciego manda: quien no audita el dinero no ve lo cobrado ni la diferencia del cuadre.
  const canSeeDifference = canSeeCloseDetail || !blindCount;

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
        Cuando termines el turno, contá lo que hay en la caja: el cierre te pide el conteo y —si el local
        liquida con banco— el monto y el lote que reportó cada terminal.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="min-h-11" disabled={busy} onClick={() => setClosing(true)}>
          Cerrar caja
        </Button>

        {/*
          Fase 5 del rediseño de Caja (2026-09-23) — la lectura parcial dejó de ser un botón que imprimía:
          ahora abre un modal donde el número se ve en pantalla (el papel es la salida y lo saca el dueño).
        */}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setReading(true)}
        >
          Lectura parcial
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
        canPrint={canPrint}
      />

      {actionError ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {actionError}
        </p>
      ) : null}

      <CashCloseModal
        open={closing}
        locationId={locationId}
        countConfig={countConfig}
        banks={banks}
        canSeeDifference={canSeeDifference}
        busy={busy}
        onCancel={() => setClosing(false)}
        onClose={(counts, bankCloses) => {
          setClosing(false);
          onClose(counts, bankCloses);
        }}
      />

      <CashPartialReadingModal
        open={reading}
        locationId={locationId}
        locationName={locationName}
        actorName={actorName}
        canPrint={canPrint}
        canSeeArqueo={canSeeDifference}
        onClose={() => setReading(false)}
      />
    </section>
  );
}
