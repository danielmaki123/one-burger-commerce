"use client";

import * as React from "react";

import Link from "next/link";

import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
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
 * 3. **Se imprime en la hoja A4 del sistema** (`/admin/orders/[id]/invoice/print`): HTML real con el logo,
 *    los datos del negocio y los de la sucursal, que el navegador guarda como PDF. Es la misma decisión que
 *    la hoja de cierre (1.6): sin dependencias nuevas ni generador de PDF en el servidor.
 */

type OrderInvoicePanelProps = {
  orderId: string;
  /** El formato de la moneda del negocio (símbolo y locale). */
  currency: CurrencyFormat;
};

export default function OrderInvoicePanel({ orderId, currency }: OrderInvoicePanelProps) {
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

  const printHref = `/admin/orders/${encodeURIComponent(orderId)}/invoice/print`;

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

      <p className="text-st-body text-ink-secondary">
        La factura simple se imprime en una hoja de 80 mm (impresora térmica del mostrador), con el logo, los datos del negocio y los de la sucursal
        donde se retiró el pedido.
      </p>
      <Link
        href={printHref}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center rounded-stitch-md border border-border px-4 text-st-body font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Imprimir o guardar PDF
      </Link>

      {error ? <p className="text-st-body font-medium text-status-sla-text">{error}</p> : null}
    </div>
  );
}
