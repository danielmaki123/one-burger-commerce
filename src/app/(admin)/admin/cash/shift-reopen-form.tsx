"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { Textarea } from "@/shared/ui/textarea";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — reabrir un turno cerrado desde el detalle.
 *
 * El motivo es obligatorio y la acción se confirma en un `Modal` del sistema (no en un
 * `window.confirm`): reabrir una caja ya cerrada es la operación más sensible del arqueo y queda
 * firmada con quién y cuándo. Solo aparece cuando el turno está cerrado.
 */
export default function ShiftReopenForm({ shiftId }: { shiftId: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/cash/shifts/${shiftId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body: { data?: unknown; error?: { message?: string; fields?: Record<string, string> } } =
        await response.json();

      if (!response.ok) {
        setError(
          body.error?.fields?.reason ??
            body.error?.message ??
            "No se pudo reabrir la caja. Reintentá.",
        );
        return;
      }

      setDone(true);
      setOpen(false);
    } catch {
      setError("No se pudo reabrir la caja: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        className="rounded-stitch-lg border border-status-ready-border bg-status-ready-bg px-3 py-2 text-st-body text-status-ready-text"
      >
        Caja reabierta. Volvé a contarla y cerrala desde el POS.
      </p>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        Reabrir la caja
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reabrir la caja"
      >
        <div className="space-y-3">
          <p className="text-st-body text-ink-secondary">
            El turno vuelve a estar abierto y el próximo cierre calcula un arqueo nuevo. Queda
            registrado quién lo reabrió y por qué.
          </p>

          <Textarea
            label="Por qué la reabrís"
            value={reason}
            error={error ?? undefined}
            onChange={(event) => setReason(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={busy || reason.trim().length === 0}
              onClick={() => void confirm()}
            >
              {busy ? "Reabriendo…" : "Reabrir la caja"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
