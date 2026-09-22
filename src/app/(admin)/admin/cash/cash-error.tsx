import { Button } from "@/shared/ui/button";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **error** de la pantalla (A-44).
 *
 * El mensaje es el del servidor cuando lo hay (permiso, sesión vencida, 500) y el de conexión cuando no.
 * El botón reintenta la lectura: antes, una lectura fallida se veía como «Sin caja abierta en este local»
 * y no había forma de volver a intentar sin recargar la página.
 */
export default function CashError({
  message,
  onRetry,
}: {
  message: string;
  /** Vuelve a leer el estado del turno (deja la pantalla en *cargando*). */
  onRetry: () => void;
}) {
  return (
    <section
      aria-label="Caja del local"
      className="space-y-3 rounded-stitch-lg border border-status-sla-border bg-status-sla-bg p-4"
    >
      <p role="alert" className="text-st-body font-semibold text-status-sla-text">
        {message}
      </p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
        Reintentar
      </Button>
    </section>
  );
}
