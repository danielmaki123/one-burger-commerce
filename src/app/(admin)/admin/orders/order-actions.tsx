"use client";

import { useId, useState } from "react";
import { Check, X } from "lucide-react";

import type { OrderStatus, OrderType } from "@/modules/orders/domain/order.types";
import { Button } from "@/shared/ui/button";

import {
  buildStatusUpdateBody,
  canRejectOrder,
  isRejectNoteValid,
  resolvePrimaryOrderAction,
} from "./order-action-helpers";

const GENERIC_FAILURE = "No se pudo cambiar el estado del pedido. Probá de nuevo.";
const NOTE_REQUIRED = "Escribí el motivo del rechazo.";

type OrderActionsProps = {
  order: {
    id: string;
    orderNumber: string;
    type: OrderType;
    status: OrderStatus;
  };
  /** Devuelve una promesa que **rechaza con un `Error` legible** cuando el cambio no pasó. */
  onUpdateStatus: (status: OrderStatus, note?: string | null) => Promise<void>;
  /** Sin conexión (o sin permiso) las acciones se apagan, pero se explica por qué. */
  disabled?: boolean;
  disabledReason?: string;
  /** `card` ocupa todo el ancho (comanda); `row` es la versión compacta de la bandeja. */
  layout?: "row" | "card";
};

/**
 * B2 — las acciones del flujo sobre una comanda: una primaria grande y, cuando corresponde, rechazar
 * separado y en color de peligro.
 *
 * Dos cuidados que importan en una cocina: no se puede tocar dos veces mientras guarda (una tablet
 * con el dedo mojado manda el cambio duplicado) y el rechazo **no sale sin motivo**, que es lo que
 * después explica por qué se canceló un pedido.
 *
 * La acción primaria sale del flujo del dominio (`order-action-helpers`), así que acá no se decide
 * qué es válido: si el servidor dice que ya no aplica, se muestra su motivo y la lista se refresca.
 */
export function OrderActions({
  order,
  onUpdateStatus,
  disabled = false,
  disabledReason,
  layout = "row",
}: OrderActionsProps) {
  const primary = resolvePrimaryOrderAction(order);
  const rejectable = canRejectOrder(order);
  const noteId = useId();

  const [submitting, setSubmitting] = useState<OrderStatus | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const busy = submitting !== null;
  const blocked = disabled || busy;
  const fullWidth = layout === "card" ? "w-full" : "";

  async function submit(status: OrderStatus, reason?: string) {
    if (busy) return;

    setFailure(null);
    setNoteError(null);
    setSubmitting(status);

    try {
      await onUpdateStatus(status, buildStatusUpdateBody(status, reason).note);
      setRejecting(false);
      setNote("");
    } catch (cause) {
      setFailure(cause instanceof Error && cause.message ? cause.message : GENERIC_FAILURE);
    } finally {
      setSubmitting(null);
    }
  }

  function confirmRejection() {
    if (!isRejectNoteValid(note)) {
      setNoteError(NOTE_REQUIRED);
      return;
    }

    void submit("cancelled", note);
  }

  if (!primary && !rejectable) return null;

  return (
    <div
      className="flex flex-col gap-2"
      data-order-actions={order.id}
      /* El grupo nombra la orden: en una lista de veinte comandas, veinte botones «Aceptar» sueltos
         no dicen de qué pedido son. */
      role="group"
      aria-label={`Acciones de la orden ${order.orderNumber}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {primary ? (
          <Button
            variant="primary"
            className={`min-h-11 ${fullWidth} ${layout === "row" ? "px-5" : ""}`}
            aria-busy={submitting === primary.status}
            disabled={blocked}
            onClick={() => void submit(primary.status)}
          >
            <Check aria-hidden="true" className="mr-2 h-4 w-4" />
            {submitting === primary.status ? "Guardando…" : primary.label}
          </Button>
        ) : null}

        {rejectable ? (
          <Button
            variant="outline"
            className={`min-h-11 gap-2 border-danger/40 text-danger-foreground hover:bg-danger/10 ${layout === "card" ? "w-full" : ""}`}
            aria-expanded={rejecting}
            aria-controls={rejecting ? noteId : undefined}
            disabled={blocked}
            onClick={() => {
              setFailure(null);
              setNoteError(null);
              setRejecting((open) => !open);
            }}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Rechazar
          </Button>
        ) : null}
      </div>

      {rejecting ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <label htmlFor={noteId} className="block text-sm font-medium text-foreground">
            Motivo del rechazo (obligatorio)
          </label>
          <textarea
            id={noteId}
            value={note}
            rows={2}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${noteId}-error` : undefined}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            placeholder="Ej.: se acabó el pan, el cliente pidió cancelar…"
            disabled={blocked}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteError(null);
            }}
          />
          {noteError ? (
            <p id={`${noteId}-error`} role="alert" className="text-sm font-medium text-danger-foreground">
              {noteError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11 border-danger/40 text-danger-foreground hover:bg-danger/10"
              aria-busy={submitting === "cancelled"}
              disabled={blocked}
              onClick={confirmRejection}
            >
              {submitting === "cancelled" ? "Guardando…" : "Confirmar rechazo"}
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setRejecting(false);
                setNoteError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El pedido queda cancelado y el historial se conserva.
          </p>
        </div>
      ) : null}

      {failure ? (
        <p role="alert" className="text-sm font-medium text-danger-foreground">
          {failure}
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
