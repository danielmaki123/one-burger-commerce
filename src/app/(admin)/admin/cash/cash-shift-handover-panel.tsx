"use client";

import * as React from "react";

import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { printLines } from "@/shared/lib/print-lines";
import { buildShiftXSheet } from "@/shared/lib/shift-x-sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import ShiftHandoversList, { type ShiftHandoverRow } from "./shift-handovers-list";

/**
 * Tarea 7 del brief (2026-09-17) — la **lectura parcial** (1.12) y el **traspaso de caja** (1.13), en la
 * pantalla de caja.
 *
 * Nombres de Fase 1a del rediseño de Caja (2026-09-19): el brief viejo lo llamaba «corte X». En Fase 5 este
 * panel pasa a un modal y la firma de custodia se muda (destino a confirmar con el owner), así que acá solo
 * cambian los textos.
 *
 * Dos cosas del mismo momento: sacar el papel de «cómo va la caja» sin cerrarla, y firmar el traspaso
 * cuando el cajero se va y otro sigue. Las dos leen el mismo número —el del servidor— y las dos imprimen
 * con `printLines` (ventana nueva + `print()`), sin dependencias ni impresora de red.
 *
 * El esperado **no** se calcula acá y tampoco viaja en el POST: lo calcula el servidor con la misma cuenta
 * que el cierre. Al firmar, el papel se arma con el monto que quedó **guardado** (el que los dos
 * firmaron), no con el que la pantalla leyó un segundo antes.
 */

type ShiftXArqueo = {
  shiftId: string;
  locationId: string;
  openedAt: string;
  generatedAt: string;
  openingAmount: number;
  expectedAmount: number;
  expectedByCurrency: Record<string, number>;
  cashSalesAmount: number;
  cashMovementsAmount: number;
  refundsAmount: number;
};

/** Lo que devuelve un traspaso: los montos vienen congelados del servidor. */
export type { ShiftHandoverRow };

export default function CashShiftHandoverPanel({
  locationId,
  locationName,
  actorName,
  canPrint = false,
}: {
  locationId: string;
  /** Nombre del local, para el papel (el dueño lee el papel, no el id). */
  locationName: string;
  /** Quién entrega: el nombre del cajero de la sesión. `null` = no se pudo resolver. */
  actorName: string | null;
  /**
   * Fase 4 del rediseño de Caja (2026-09-22) — **imprimir** (§8.e del brief): el papel del arqueo lo saca
   * el dueño (`canPrintCashDocuments`). Sin permiso la pantalla no ofrece la imprenta; el traspaso se firma
   * igual y queda asentado en la base — lo que no hay es papel.
   *
   * Por defecto `false`: si un llamador se olvida del permiso, el error cae del lado de no imprimir.
   */
  canPrint?: boolean;
}) {
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  const [handovers, setHandovers] = React.useState<ShiftHandoverRow[]>([]);
  const [receiver, setReceiver] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

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

  const loadHandovers = React.useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/pos/shift/handover?locationId=${encodeURIComponent(locationId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as { data?: ShiftHandoverRow[] };

      setHandovers(body.data ?? []);
    } catch {
      // El historial de traspasos es lectura: si falla, no se rompe lo que el cajero vino a hacer.
      setHandovers([]);
    }
  }, [locationId]);

  React.useEffect(() => {
    void loadHandovers();
  }, [loadHandovers]);

  /** El arqueo parcial del servidor: la única fuente del esperado. */
  async function readArqueo(): Promise<ShiftXArqueo | null> {
    const response = await fetch(
      `/api/admin/pos/shift/x?locationId=${encodeURIComponent(locationId)}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as {
      data?: ShiftXArqueo | null;
      error?: { message?: string };
    };

    if (!response.ok) {
      setError(body.error?.message ?? "No se pudo leer el corte de caja.");
      return null;
    }

    return body.data ?? null;
  }

  function print(arqueo: ShiftXArqueo, receivedByName: string | null) {
    const printed = printLines(
      buildShiftXSheet(
        { ...arqueo, locationName, handedByName: actorName, receivedByName },
        sheetOptions,
      ),
    );

    if (!printed) {
      setError(
        "El navegador bloqueó la ventana de impresión: permití las ventanas emergentes de este sitio.",
      );
    }
  }

  /** El corte informativo: cómo va la caja ahora, sin firmar nada. */
  async function printCorte() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const arqueo = await readArqueo();

      if (!arqueo) {
        setNotice("No hay una caja abierta: no hay corte que sacar.");
        return;
      }

      print(arqueo, null);
    } catch {
      setError("No se pudo leer el corte de caja: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  }

  /** El traspaso: se firma con nombre y apellido de quien recibe y queda en el historial del turno. */
  async function registerHandover() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/pos/shift/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, receivedByName: receiver }),
      });
      const body = (await response.json()) as {
        data?: ShiftHandoverRow;
        error?: { message?: string };
      };

      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "No se pudo registrar el traspaso.");
        return;
      }

      const stored = body.data;
      setReceiver("");
      setNotice(`Traspaso registrado · recibe ${stored.receivedByName}`);
      await loadHandovers();

      // El papel se arma con lo que quedó guardado: el esperado firmado es el del servidor, no el que la
      // pantalla leyó un instante antes. Fase 4 — el papel lo saca el dueño (§8.e): sin permiso, el
      // traspaso queda firmado en la base y no se imprime nada.
      if (!canPrint) return;

      const arqueo = await readArqueo();

      if (arqueo) {
        print(
          {
            ...arqueo,
            expectedAmount: stored.expectedAmount,
            expectedByCurrency: stored.expectedByCurrency ?? arqueo.expectedByCurrency,
          },
          stored.receivedByName,
        );
      }
    } catch {
      setError("No se pudo registrar el traspaso: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Lectura parcial y traspaso"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Lectura parcial y traspaso</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          Sin cerrar la caja
        </p>
      </div>

      <p className="text-st-body text-ink-secondary">
        La lectura parcial muestra cómo va la caja ahora y no la cierra. Para pasarle la caja a otro cajero,
        escribí quién la recibe: se firma el traspaso con el monto de este momento y queda en el historial
        del turno.
      </p>

      {/* Fase 4 — el papel lo saca el dueño (§8.e): sin permiso no se ofrece la imprenta. */}
      {canPrint ? (
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void printCorte()}
          >
            {busy ? "Guardando…" : "Imprimir lectura parcial"}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="Recibe la caja"
          value={receiver}
          maxLength={80}
          disabled={busy}
          placeholder="Nombre de quien recibe"
          onChange={(event) => setReceiver(event.target.value)}
          className="sm:max-w-xs"
        />
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || receiver.trim().length === 0}
          onClick={() => void registerHandover()}
        >
          {busy ? "Guardando…" : "Firmar traspaso"}
        </Button>
      </div>

      <ShiftHandoversList
        handovers={handovers}
        emptyLabel="Este turno todavía no cambió de manos."
        currency={currency}
        timezone={settings.timezone}
        locale={settings.locale}
      />

      {notice ? (
        <p role="status" className="text-st-body font-medium text-status-ready-text">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}
    </section>
  );
}
