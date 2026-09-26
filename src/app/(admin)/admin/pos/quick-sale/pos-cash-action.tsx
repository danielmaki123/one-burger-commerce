"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

/**
 * La **acción de caja** dentro del checkout: abrir la caja cuando no hay turno, cerrarla cuando el turno es
 * de un día operativo anterior.
 *
 * `SCREEN-POS-QUICK-SALE-001.1` §5 y §11: el POS **no** mantiene enlaces ni explicaciones permanentes a Caja
 * en la barra operativa. La caja se muestra como **estado** (`● Caja abierta`) y la acción aparece **donde el
 * cobro está bloqueado** —el checkout—, que es donde el cajero la necesita.
 *
 * Tres decisiones:
 *
 * 1. **Un solo caso por vez.** Con un turno viejo abierto la acción es **cerrarlo**: ofrecer «Abrir caja» ahí
 *    sería ofrecer algo que el servidor rechaza (el local ya tiene su caja de ese día).
 * 2. **Estado, no solo color.** El bloque dice el título, el motivo y el verbo de la acción; el tono de alerta
 *    acompaña, no comunica solo (la ley visual del panel, §10).
 * 3. **La acción la ejecuta la pantalla.** Acá no se llama a la API: el caso de uso y su validación viven en
 *    Caja, y esta pieza solo dispara (`onAction`) y muestra el resultado (`busy` / `error`).
 */

export type PosCashActionState = "open" | "no-shift" | "pending-close";

/** El estado que la barra y el checkout comparten: `loading` es «todavía no se sabe». */
export type PosCashState = PosCashActionState | "loading";

export default function PosCashAction({
  state,
  loading,
  busy,
  error,
  onAction,
  closeHref = "/admin/cash",
}: {
  state: PosCashState;
  /** Se está leyendo la caja: no se afirma que esté cerrada. */
  loading: boolean;
  /** La acción está corriendo (abrir/cerrar). */
  busy: boolean;
  /** El motivo del fallo de la acción, si falló. */
  error: string | null;
  onAction: () => void;
  /** Dónde se cierra la caja. El cierre firma el arqueo: es de Caja, acá se enlaza. */
  closeHref?: string;
}) {
  if (loading) {
    return <p className="text-st-body text-ink-secondary">Leyendo la caja…</p>;
  }

  if (state === "open") return null;

  const pending = state === "pending-close";

  return (
    <div
      role="status"
      className="space-y-2 rounded-stitch-lg border-2 border-brand-amber bg-brand-amber/10 px-3 py-3"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
        <div className="space-y-1">
          {/* El título del bloque es un encabezado real: nombra la situación, no decora. */}
          <p role="heading" aria-level={3} className="text-st-h3 text-brand-amber">
            {pending ? "Cierre pendiente" : "Caja cerrada"}
          </p>
          <p className="text-st-body text-ink">
            {pending ? "La caja pertenece al turno anterior." : "Abrí una caja para cobrar."}
          </p>
        </div>
      </div>

      {/*
        Con un turno viejo abierto la acción es **cerrarlo** (el cierre firma el arqueo, así que vive en Caja y
        acá se enlaza); sin turno, abrirlo desde acá. Nunca las dos: ofrecer «Abrir caja» con una caja de otro
        día abierta es ofrecer algo que el servidor rechaza.
      */}
      {pending ? (
        <Link
          href={closeHref}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-st-body font-medium text-foreground transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
        >
          Cerrar caja
        </Link>
      ) : (
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onAction}>
          {busy ? "Abriendo…" : "Abrir caja"}
        </Button>
      )}

      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
