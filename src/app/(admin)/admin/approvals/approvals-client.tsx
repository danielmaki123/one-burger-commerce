"use client";

import * as React from "react";

import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

/**
 * Bloque 3.6 del roadmap del POS (Fase 2) — la cola de devoluciones pendientes, con su resolución.
 *
 * Cada devolución se aprueba o se rechaza **con motivo** (el rechazo sin razón deja al cajero sin saber
 * qué hacer con la plata). Al resolverse, la lista se vuelve a pedir al servidor: la pantalla muestra
 * lo que quedó guardado, no lo que creyó mandar.
 */

export type PendingRefund = {
  id: string;
  orderId: string;
  kind: "full" | "partial";
  method: string;
  amount: number;
  currency: string;
  reason: string;
  requestedByUserId: string | null;
  createdAt: string;
  orderNumber?: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  mixed: "Mixto",
  other: "Otro",
};

export default function ApprovalsClient({ initialRefunds }: { initialRefunds: PendingRefund[] }) {
  const currency = useCurrencyFormat();
  const [refunds, setRefunds] = React.useState(initialRefunds);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const response = await fetch("/api/admin/approvals", { cache: "no-store" });
    const body: { data?: PendingRefund[] } = await response.json();
    setRefunds(body.data ?? []);
  }, []);

  async function resolve(refundId: string, decision: "approved" | "rejected", reason?: string) {
    setBusyId(refundId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/approvals/${refundId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reason ?? null }),
      });
      const body: { error?: { message?: string; fields?: Record<string, string> } } =
        await response.json();

      if (!response.ok) {
        setError(body.error?.fields?.note ?? body.error?.message ?? "No se pudo resolver.");
        return;
      }

      setRejectingId(null);
      setNote("");
      await reload();
    } catch {
      setError("No se pudo resolver la devolución: revisá la conexión.");
    } finally {
      setBusyId(null);
    }
  }

  if (refunds.length === 0) {
    return (
      <p className="rounded-stitch-lg border border-dashed border-line-subtle bg-surface-low/40 p-8 text-center text-st-body text-ink-secondary">
        Nada pendiente de aprobación.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}

      <ul aria-label="Devoluciones pendientes" className="space-y-3">
        {refunds.map((refund) => (
          <li
            key={refund.id}
            className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {refund.kind === "full" ? "Devolución total" : "Devolución parcial"} ·{" "}
                  {METHOD_LABELS[refund.method] ?? refund.method}
                </p>
                <p className="text-st-body text-ink-secondary">{refund.reason}</p>
              </div>
              <p className="font-mono text-st-body tabular-nums font-semibold text-ink">
                {formatCurrency(refund.amount, currency)}
              </p>
            </div>

            {rejectingId === refund.id ? (
              <div className="space-y-2">
                <Textarea
                  label="Por qué la rechazás"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    disabled={busyId === refund.id}
                    onClick={() => {
                      setRejectingId(null);
                      setNote("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-11"
                    disabled={busyId === refund.id || note.trim().length === 0}
                    onClick={() => void resolve(refund.id, "rejected", note)}
                  >
                    Confirmar rechazo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={busyId === refund.id}
                  onClick={() => void resolve(refund.id, "approved")}
                >
                  {busyId === refund.id ? "Resolviendo…" : "Aprobar y devolver"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busyId === refund.id}
                  onClick={() => setRejectingId(refund.id)}
                >
                  Rechazar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
