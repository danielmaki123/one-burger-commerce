"use client";

import { useState } from "react";

import { getAdminOrderStatusLabel } from "@/shared/lib/admin-status-labels";
import { getAllowedNextStatuses } from "@/modules/orders/domain/order-workflows";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { DetailPanel, type OrderDetailView } from "../../order-detail-panels";
import { describeOrderActionFailure } from "../../order-action-helpers";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **las acciones administrativas** del detalle.
 *
 * Son las del **mostrador**, no las de cocina: marcar retirado, cerrar y cancelar con motivo. La lista de
 * transiciones válidas sale de `order-workflows.ts` —la misma regla que valida el servidor—, así que la
 * pantalla no puede ofrecer un cambio que la API rechace.
 *
 * **No hay acciones de cocina**: aceptar, iniciar preparación y marcar listo viven en `/admin/kitchen`. Y
 * **no se cobra** desde acá: el cobro de un pedido existente es del POS (orden 6).
 *
 * El motivo es **obligatorio** al cancelar, y el servidor lo vuelve a exigir: la validación de la pantalla es
 * una ayuda, no la puerta.
 */
export function OrderDetailActions({
  order,
  onDone,
}: {
  order: OrderDetailView;
  onDone: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitions = getAllowedNextStatuses(order.type, order.status).filter(
    (status) => status !== "cancelled",
  );
  const canCancel = getAllowedNextStatuses(order.type, order.status).includes("cancelled");

  if (transitions.length === 0 && !canCancel) {
    return (
      <DetailPanel title="Acciones">
        <p className="text-st-body text-ink-secondary">
          Este pedido no tiene acciones administrativas disponibles en su estado actual.
        </p>
      </DetailPanel>
    );
  }

  async function apply(status: string, requiresNote: boolean) {
    if (requiresNote && !note.trim()) {
      setError("Escribí el motivo de la cancelación.");

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || null }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? describeOrderActionFailure(response.status));

        return;
      }

      setNote("");
      onDone(`Pedido ${order.orderNumber} ${getAdminOrderStatusLabel(status).toLowerCase()}.`);
    } catch {
      setError(describeOrderActionFailure(0));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DetailPanel title="Acciones">
      <div className="space-y-2">
        {transitions.map((status) => (
          <Button
            key={status}
            className="min-h-11 w-full"
            disabled={submitting}
            onClick={() => void apply(status, false)}
          >
            {ACTION_LABELS[status] ?? `Avanzar a ${getAdminOrderStatusLabel(status)}`}
          </Button>
        ))}

        {canCancel ? (
          <div className="space-y-2 border-t border-line-subtle pt-2">
            <Input
              label="Motivo de la cancelación"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Por qué se cancela (obligatorio)"
            />
            <Button
              variant="outline"
              className="min-h-11 w-full border-danger-strong/40 text-danger-foreground hover:bg-danger"
              disabled={submitting}
              onClick={() => void apply("cancelled", true)}
            >
              {submitting ? "Cancelando…" : "Cancelar pedido"}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-st-body text-danger-foreground">
            {error}
          </p>
        ) : null}
      </div>
    </DetailPanel>
  );
}

/** El texto de la acción del mostrador. Lo que no está acá usa el rótulo del estado. */
const ACTION_LABELS: Record<string, string> = {
  picked_up: "Marcar retirado",
  closed: "Cerrar pedido",
};
