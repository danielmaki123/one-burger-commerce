"use client";

import Link from "next/link";
import { Store } from "lucide-react";

import type { LocationRecord } from "@/modules/locations/domain/location.types";
import { Button } from "@/shared/ui/button";

import {
  describeLocationAddress,
  describeLocationHours,
  LOCATION_STATUS_LABELS,
  locationStatus,
} from "./location-helpers";

const STATUS_TONES = {
  active: "bg-status-ready-bg text-status-ready-text",
  inactive: "bg-status-inactive-bg text-status-inactive-text",
} as const;

type LocationRowProps = {
  location: LocationRecord;
  now: Date | null;
  timeZone: string;
  saving: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
};

/**
 * Fila de un local (referencia de Locales): nombre, estado, dónde se retira, el horario de hoy y las
 * acciones a la derecha.
 *
 * La fila **no** es un botón gigante: la referencia pone acciones explícitas por local y así el
 * alcance táctil de cada una queda medible (44 px). El detalle de la dirección no es tocable a
 * propósito: editar el local es una decisión, no un roce accidental en el mostrador.
 */
export function LocationRow({
  location,
  now,
  timeZone,
  saving,
  onEdit,
  onToggleActive,
}: LocationRowProps) {
  const status = locationStatus(location);

  return (
    <article className="flex flex-col gap-2 border-t border-line-subtle px-3 py-3 first:border-t-0 md:flex-row md:items-center md:justify-between md:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md ${
            location.isActive
              ? "bg-brand-primary-muted text-brand-primary"
              : "bg-surface-low text-ink-muted"
          }`}
        >
          <Store className="h-5 w-5" strokeWidth={2} />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-st-body-lg font-semibold ${
                location.isActive ? "text-ink" : "text-ink-muted"
              }`}
            >
              {location.name}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-st-caption font-bold uppercase tracking-wide before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${STATUS_TONES[status]}`}
            >
              {LOCATION_STATUS_LABELS[status]}
            </span>
            {location.isAcceptingOrders ? null : (
              <span className="inline-flex items-center rounded-full bg-status-pending-bg px-2.5 py-0.5 text-st-caption font-bold uppercase tracking-wide text-status-pending-text">
                No recibe pedidos
              </span>
            )}
          </div>

          <p className="mt-0.5 text-st-body text-ink-secondary">
            {describeLocationAddress(location)}
          </p>

          <p className="mt-0.5 text-st-caption leading-5 text-ink-muted">
            {now ? `${describeLocationHours(location, timeZone, now)} · ` : ""}
            preparación{" "}
            <span className="font-mono font-bold tabular-nums text-ink-secondary">
              {location.pickupLeadMinutes}
            </span>{" "}
            min
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
        <Button
          type="button"
          variant="outline"
          size="pill"
          disabled={saving}
          aria-label={`Editar local ${location.name}`}
          onClick={onEdit}
        >
          Editar
        </Button>

        <Button
          type="button"
          variant="outline"
          size="pill"
          disabled={saving}
          aria-label={`${location.isActive ? "Apagar" : "Activar"} ${location.name}`}
          onClick={onToggleActive}
        >
          {location.isActive ? "Apagar" : "Activar"}
        </Button>

        {/* Los precios y la disponibilidad por local viven en su propia pantalla: el sheet del local
            ya es largo y esto es otra tarea. */}
        <Link
          href={`/admin/locations/${location.id}`}
          aria-label={`Catálogo de ${location.name}`}
          className="inline-flex min-h-11 items-center rounded-full border border-line-control px-4 text-st-body font-semibold text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none"
        >
          Catálogo
        </Link>
      </div>
    </article>
  );
}
