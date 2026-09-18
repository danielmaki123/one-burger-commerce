"use client";

import * as React from "react";

import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { invoiceSheetLines, type InvoiceSheetLine } from "@/shared/lib/invoice-sheet";
import { printLines } from "@/shared/lib/print-lines";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Factura simple (2026-09-18) — el documento del pedido, en el detalle de la orden.
 *
 * **No es una factura fiscal**: es el papel que el cliente se lleva. Tres decisiones de la pantalla:
 *
 * 1. **La emite quien cobra.** El `GET` dice si esta sesión puede (`canEmit`); cocina ve el documento si ya
 *    existe, pero no lo emite, y cuando no hay factura y no puede emitirla la sección no se dibuja: ningún
 *    control que el servidor vaya a rechazar.
 * 2. **Una vez emitida, no se edita.** Se muestra congelada (número, fecha, datos y montos) y solo se puede
 *    volver a imprimir: es el papel que ya está en la mano del cliente.
 * 3. **Se imprime con la hoja del sistema** y el navegador la guarda como PDF, la misma decisión que la hoja
 *    de cierre (1.6): sin dependencias nuevas ni generador de PDF en el servidor.
 */

type OrderInvoicePanelProps = {
  orderId: string;
  /** Las líneas del pedido, tal como quedaron (el documento no las recalcula). */
  lines: InvoiceSheetLine[];
  currency: CurrencyFormat;
  /** Moneda del negocio: una factura en otra moneda se imprime con su código. */
  businessCurrencyCode: string;
  locationName?: string | null;
};

export default function OrderInvoicePanel({
  orderId,
  lines,
  currency,
  businessCurrencyCode,
  locationName = null,
}: OrderInvoicePanelProps) {
  const [invoice, setInvoice] = React.useState<InvoiceRecord | null>(null);
  const [canEmit, setCanEmit] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [legalName, setLegalName] = React.useState("");
  const [taxId, setTaxId] = React.useState("");

  const url = `/api/admin/orders/${encodeURIComponent(orderId)}/invoice`;

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = (await response.json()) as {
          data?: { invoice: InvoiceRecord | null; canEmit: boolean };
          error?: { message?: string };
        };

        if (!active) return;
        if (!response.ok || !body.data) {
          setError(body.error?.message ?? "No se pudo leer la factura.");
          return;
        }

        setInvoice(body.data.invoice);
        setCanEmit(body.data.canEmit);
      } catch {
        if (active) setError("No se pudo leer la factura: revisá la conexión.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [url]);

  const emit = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalName.trim() === "" ? null : legalName,
          taxId: taxId.trim() === "" ? null : taxId,
        }),
      });
      const body = (await response.json()) as {
        data?: { invoice: InvoiceRecord };
        error?: { message?: string };
      };

      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "No se pudo emitir la factura.");
        return;
      }

      setInvoice(body.data.invoice);
    } catch {
      setError("No se pudo emitir la factura: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    if (!invoice) return;

    printLines(invoiceSheetLines({ invoice, lines, currency, businessCurrencyCode, locationName }));
  };

  if (loading) {
    return <p className="text-st-body text-ink-secondary">Leyendo la factura…</p>;
  }

  // Sin factura y sin permiso para emitirla no hay nada que mostrar (cocina no entrega documentos).
  if (!invoice && !canEmit) {
    return error ? (
      <p className="text-st-body font-medium text-status-sla-text">{error}</p>
    ) : (
      <p className="text-st-body text-ink-secondary">
        La factura la emite quien cobra el pedido.
      </p>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-3">
        <p className="text-st-body text-ink-secondary">
          Factura simple, no fiscal: el documento que se lleva el cliente con lo que pagó.
        </p>
        <Input
          label="Razón social del cliente (opcional)"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
        <Input
          label="RUC del cliente (opcional)"
          value={taxId}
          onChange={(event) => setTaxId(event.target.value)}
        />
        <Button
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={() => void emit()}
        >
          {busy ? "Emitiendo…" : "Emitir factura"}
        </Button>
        {error ? <p className="text-st-body font-medium text-status-sla-text">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="space-y-1 text-st-body">
        <div className="flex items-baseline justify-between">
          <dt className="text-ink-secondary">Número</dt>
          <dd className="font-mono tabular-nums text-ink">{invoice.number}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-ink-secondary">Emitida</dt>
          <dd className="font-mono tabular-nums text-ink">
            {new Date(invoice.issuedAt).toLocaleString(currency.locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-ink-secondary">Cliente</dt>
          <dd className="text-ink">
            {invoice.customerLegalName ?? invoice.customerName}
            {invoice.customerTaxId ? ` · RUC ${invoice.customerTaxId}` : ""}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-ink-secondary">Total</dt>
          <dd className="font-mono text-st-body font-bold tabular-nums text-ink">
            {formatCurrency(invoice.total, currency)}
          </dd>
        </div>
      </dl>

      <Button type="button" variant="outline" className="min-h-11" onClick={print}>
        Imprimir o guardar PDF
      </Button>

      {error ? <p className="text-st-body font-medium text-status-sla-text">{error}</p> : null}
    </div>
  );
}
