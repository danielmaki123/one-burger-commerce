import { formatBusinessHoursSummary } from "@/modules/business-settings/domain/business-hours-format";
import { locationDirectionsHref } from "@/modules/locations/domain/location-links";
import { formatPickupAddress } from "@/modules/locations/domain/location-rules";
import type { PublicLocation } from "@/modules/locations/features/list-public-locations/list-public-locations";

type PublicLocationsListProps = {
  /** Locales activos, tal como los devuelve `GET /api/locations` (ya ordenados). */
  locations: PublicLocation[];
  /**
   * `list` para el bloque de la home (todas las sucursales, una debajo de otra) y `compact`
   * para el footer de escritorio. Los datos son los mismos; cambia la densidad.
   */
  variant?: "list" | "compact";
  /** Clases del contenedor, para que cada superficie controle su layout. */
  className?: string;
};

/**
 * A-07 — la información de **cada sucursal**.
 *
 * Antes la home y el footer mostraban la dirección y el horario de la configuración del
 * negocio. Con más de un local eso no le dice al cliente dónde retira, así que acá se lista
 * cada local activo con su propia dirección, su horario de hoy y su "Cómo llegar".
 *
 * Sale todo de `GET /api/locations`: nada del negocio hardcodeado y sin exponer el teléfono
 * ni el WhatsApp internos del local. Sin locales no dibuja nada (el respaldo sigue siendo el
 * bloque de la configuración), y un local sin dirección no deja un enlace muerto.
 */
export function PublicLocationsList({
  locations,
  variant = "list",
  className,
}: PublicLocationsListProps) {
  if (locations.length === 0) return null;

  const isCompact = variant === "compact";
  const containerClassName =
    className ??
    (isCompact ? "flex flex-col gap-3" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3");

  return (
    <ul className={containerClassName}>
      {locations.map((location) => {
        const address = formatPickupAddress(location);
        const directions = locationDirectionsHref(location);
        const hoursSummary = formatBusinessHoursSummary(location.businessHours);

        return (
          <li
            key={location.id}
            className={
              isCompact
                ? "text-sm text-muted-foreground"
                : "flex flex-col gap-2 rounded-card border border-border bg-card p-3 shadow-card"
            }
          >
            <p
              className={
                isCompact
                  ? "font-semibold text-foreground"
                  : "text-label text-foreground"
              }
            >
              {location.name}
            </p>
            {address ? <p className="text-caption text-muted-foreground">{address}</p> : null}
            <p className="text-caption text-muted-foreground">{hoursSummary}</p>
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className={
                  isCompact
                    ? "inline-flex min-h-11 items-center text-caption font-semibold text-brand underline-offset-4 hover:underline"
                    : "mt-auto inline-flex min-h-11 w-fit items-center gap-1.5 rounded-card border border-border bg-card px-3 text-label-sm text-foreground transition active:scale-95"
                }
              >
                <span aria-hidden="true">🗺️</span> Cómo llegar
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
