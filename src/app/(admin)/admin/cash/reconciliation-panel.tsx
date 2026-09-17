"use client";

import * as React from "react";

import type { PaymentRecord } from "@/modules/orders/domain/order.types";
import type { ReconciliationSummary } from "@/modules/orders/domain/payment-reconciliation";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { downloadTextFile } from "@/shared/lib/download-file";
import { formatCurrency } from "@/shared/lib/format-currency";
import {
  buildReconciliationCsv,
  buildReconciliationCsvFileName,
} from "@/shared/lib/payment-reconciliation-csv";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/**
 * Tarea 10 del brief (2026-09-17) — la **conciliación de tarjeta y transferencia** (11.1/11.2), en Caja
 * del día.
 *
 * El efectivo se cuadra con el arqueo del cajón; esta plata se cuadra **afuera**: contra el lote de la
 * terminal y el extracto del banco. La pantalla muestra lo que el sistema cobró ese día por esas dos vías y
 * baja el **CSV** con una fila por cobro (con la referencia, que es lo que se busca en el lote).
 *
 * Dos cosas a propósito: los totales son los que devuelve el **servidor** (la pantalla no suma plata) y lo
 * que entró por otra vía sin ser efectivo se **informa aparte**, porque esconderlo dejaría plata del día
 * sin explicar. El día es el del **negocio**, no el del navegador.
 */

type ReconciliationPayload = {
  date: string;
  locationId: string;
  payments: PaymentRecord[];
  summary: ReconciliationSummary;
};

const METHOD_LABELS = { card: "Tarjeta", transfer: "Transferencia" } as const;

export default function ReconciliationPanel({
  locations,
  defaultDate,
}: {
  locations: { id: string; name: string }[];
  /** El día del negocio de hoy, resuelto por la pantalla (el navegador tiene otra zona). */
  defaultDate: string;
}) {
  const settings = useBusinessSettings();
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [date, setDate] = React.useState(defaultDate);
  const [payload, setPayload] = React.useState<ReconciliationPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (target: string, day: string) => {
    if (!target || !day) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/cash/reconciliation?locationId=${encodeURIComponent(target)}&date=${encodeURIComponent(day)}`,
        { cache: "no-store" },
      );
      const body: { data?: ReconciliationPayload; error?: { message?: string } } =
        await response.json();

      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? "No se pudo leer la conciliación del día.");
      }

      setPayload(body.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo leer la conciliación del día.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(locationId, date);
  }, [date, load, locationId]);

  /** Un total por moneda: el dólar se muestra en dólares (su símbolo sería un número falso). */
  function formatByCurrency(byCurrency: Record<string, number>): string {
    const entries = Object.entries(byCurrency);

    if (entries.length === 0) return formatCurrency(0, currencyFormatFor(settings.currencyCode));

    return entries
      .map(([code, amount]) => formatCurrency(amount, currencyFormatFor(code)))
      .join(" · ");
  }

  function currencyFormatFor(code: string) {
    return code.toUpperCase() === settings.currencyCode.toUpperCase()
      ? { symbol: settings.currencySymbol, locale: settings.locale }
      : { symbol: `${code.toUpperCase()} `, locale: settings.locale };
  }

  const locationName = locations.find((location) => location.id === locationId)?.name ?? locationId;
  const payments = payload?.payments ?? [];

  const downloadCsv = () => {
    downloadTextFile({
      fileName: buildReconciliationCsvFileName(locationName, payload?.date ?? date),
      content: buildReconciliationCsv(payments, {
        locationName,
        baseCurrencyCode: settings.currencyCode,
        timezone: settings.timezone,
        locale: settings.locale,
      }),
      mimeType: "text/csv;charset=utf-8",
    });
  };

  return (
    <section
      aria-label="Conciliación de tarjeta y transferencia"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Conciliación</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          Contra el lote y el banco
        </p>
      </div>

      <p className="text-st-body text-ink-secondary">
        Lo que entró por tarjeta y por transferencia en el día, para cuadrarlo contra el lote de la
        terminal y el extracto del banco. El efectivo se cuadra en el arqueo de la caja.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        {locations.length > 1 ? (
          <Select
            label="Local"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
          />
        ) : null}

        <Input
          label="Día"
          type="date"
          value={date}
          max={defaultDate}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      {loading ? (
        <p role="status" className="text-st-body text-ink-secondary">
          Leyendo los cobros del día…
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}

      {!loading && !error && payload ? (
        <>
          <ul aria-label="Cobros del día por medio" className="space-y-2">
            {payload.summary.methods.map((method) => (
              <li
                key={method.method}
                className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line-subtle pb-2 text-st-body text-ink-secondary last:border-b-0"
              >
                <span>
                  <span className="font-semibold text-ink">{METHOD_LABELS[method.method]}</span> ·{" "}
                  {method.count} {method.count === 1 ? "cobro" : "cobros"}
                </span>
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {formatByCurrency(method.byCurrency)}
                </span>
              </li>
            ))}
          </ul>

          {/* Lo que no es tarjeta ni transferencia y tampoco efectivo: se dice, no se esconde. */}
          {payload.summary.others.count > 0 ? (
            <p className="text-st-body text-status-prep-text">
              Otras formas (fuera del export): {payload.summary.others.count} ·{" "}
              <span className="font-mono tabular-nums">
                {formatByCurrency(payload.summary.others.byCurrency)}
              </span>
            </p>
          ) : null}

          {payments.length === 0 ? (
            <p className="text-st-body text-ink-secondary">
              Ese día no entró nada por tarjeta ni transferencia.
            </p>
          ) : (
            <Button type="button" variant="outline" className="min-h-11" onClick={downloadCsv}>
              Descargar CSV
            </Button>
          )}
        </>
      ) : null}
    </section>
  );
}
