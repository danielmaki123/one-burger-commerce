"use client";

import * as React from "react";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import { buildPickupPreview } from "./pickup-preview-helpers";

/**
 * Fase 2 del checkout — "así lo ve el cliente", dentro de `/admin/settings`.
 *
 * El owner escribe 25 minutos de preparación y no ve que eso significa "última orden
 * 21:35". Este panel compone las mismas funciones del checkout con la configuración que
 * se está editando, así que muestra exactamente los turnos y el copy que vería el
 * cliente, sin guardar nada.
 *
 * `now` se puede inyectar (lo usan los tests). Sin él se resuelve **después de montar**:
 * en el servidor y en el cliente daría horas distintas y el HTML no coincidiría al
 * hidratar, que es el mismo motivo por el que el checkout lo hace así.
 */
export function PickupPreviewPanel({
  businessHours,
  timezone,
  pickupLeadMinutes,
  pickupMaxMinutes,
  now: injectedNow,
}: {
  businessHours: BusinessHours;
  timezone: string;
  pickupLeadMinutes: number;
  pickupMaxMinutes: number | null;
  now?: Date;
}) {
  const [mountedNow, setMountedNow] = React.useState<Date | null>(injectedNow ?? null);

  React.useEffect(() => {
    if (injectedNow) return;
    setMountedNow(new Date());
  }, [injectedNow]);

  if (!mountedNow) {
    return (
      <section
        aria-label="Vista previa del retiro"
        className="rounded-stitch-md border border-line-subtle bg-surface-low/40 p-4"
      >
        <p className="text-st-caption font-semibold uppercase tracking-wide text-brand">
          Así lo ve el cliente
        </p>
        <p className="mt-1 text-st-body text-ink-secondary">Calculando turnos…</p>
      </section>
    );
  }

  const preview = buildPickupPreview({
    businessHours,
    timezone,
    pickupLeadMinutes,
    pickupMaxMinutes,
    now: mountedNow,
  });

  return (
    <section
      aria-label="Vista previa del retiro"
      className="rounded-stitch-md border border-line-subtle bg-surface-low/40 p-4"
    >
      <p className="text-st-caption font-semibold uppercase tracking-wide text-brand">
        Así lo ve el cliente
      </p>

      <p className="mt-1.5 text-st-body text-ink">
        Lo antes posible · {preview.soonestLabel}
      </p>

      {preview.slots.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Turnos de retiro de hoy">
          {preview.slots.map((slot) => (
            <li
              key={slot.value}
              className="rounded-full bg-surface-card px-3 py-1 text-st-caption font-medium text-ink"
            >
              {slot.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-st-body text-ink-secondary">{preview.notice}</p>
      )}

      <p className="mt-3 text-st-body text-ink">
        Hasta qué hora entra un pedido hoy:{" "}
        <strong className="font-semibold">{preview.lastOrderLabel ?? "—"}</strong>
      </p>
      <p className="mt-1 text-st-caption leading-5 text-ink-secondary">
        Nada de esto se guarda: es la configuración que tenés en pantalla. El precio y la hora
        definitivos los calcula el servidor cuando el cliente confirma.
      </p>
    </section>
  );
}
