"use client";

import * as React from "react";

import { mustCloseShiftBeforeCharging } from "@/modules/pos/domain/shift-close-policy";

import type { PosLocationOption, PosShift } from "../pos-types";

/**
 * La **caja** del mostrador: el turno de la terminal elegida y si se puede cobrar con él.
 *
 * El POS **lee** la caja (es lo que habilita cobrar) y muestra su estado, pero no la administra: abrir y
 * cerrar se hace en «Caja». Sale de `pos-client.tsx` (deuda con techo congelado) al rediseñar la venta
 * rápida, con los dos avisos que la pantalla ya tenía:
 *
 * 1. **Caja cerrada**: no se cobra (un cobro sin turno no entra a ningún arqueo).
 * 2. **Cierre obligatorio pendiente**: si el local exige cerrar todos los días y la caja abierta es de otro
 *    día del negocio, el motivo lo arma la regla pura (`shift-close-policy`, con la zona del negocio) y el
 *    botón queda bloqueado.
 *
 * Un error de lectura deja el POS en «sin caja abierta» (no se puede cobrar) sin romper la pantalla: el
 * cajero ve el aviso y el enlace a Caja, que es donde se arregla.
 */

export const CLOSE_SHIFT_FIRST_MESSAGE =
  "Este local exige cerrar la caja todos los días y la caja quedó abierta de otro día: cerrala en «Caja» y volvé a cobrar.";

export function usePosShift({
  locationId,
  terminalId,
  locations,
  timezone,
}: {
  locationId: string;
  /** La terminal elegida: la caja que se mira es la de **esa** estación. */
  terminalId: string | null;
  locations: PosLocationOption[];
  /** La zona del negocio: la regla de cierre obligatorio compara por día del negocio, no por UTC. */
  timezone: string;
}) {
  const [shift, setShift] = React.useState<PosShift | null>(null);
  const [shiftLoading, setShiftLoading] = React.useState(true);
  const [shiftActionBusy, setShiftActionBusy] = React.useState(false);
  const [shiftActionError, setShiftActionError] = React.useState<string | null>(null);

  const loadShift = React.useCallback(
    async (targetLocationId: string, options: { silent?: boolean } = {}) => {
      if (targetLocationId === "") {
        setShiftLoading(false);
        return;
      }

      if (!options.silent) {
        setShiftLoading(true);
      }

      try {
        const response = await fetch(
          // Fase 6 del rediseno de Caja: la caja que el POS mira es la de **su** terminal. Sin el
          // `terminalId`, con dos terminales cargadas esta lectura devolvia la caja «sin terminal» (que no
          // existe) y el POS se quedaba en «sin caja abierta» con el boton de cobrar apagado.
          `/api/admin/pos/shift?locationId=${encodeURIComponent(targetLocationId)}${terminalId ? `&terminalId=${encodeURIComponent(terminalId)}` : ""}`,
        );
        const body = (await response.json()) as {
          data?: PosShift | null;
          error?: { message?: string };
        };

        if (!response.ok) throw new Error(body.error?.message ?? "No se pudo leer la caja.");
        setShift(body.data ?? null);
      } catch {
        if (options.silent) return;

        setShift(null);
      } finally {
        if (!options.silent) setShiftLoading(false);
      }
    },
    [terminalId],
  );

  React.useEffect(() => {
    void loadShift(locationId);
  }, [locationId, loadShift]);

  /** El refresco de fondo: la caja puede abrirla o cerrarla otra terminal. */
  const refreshShift = React.useCallback(
    () => loadShift(locationId, { silent: true }),
    [loadShift, locationId],
  );

  const shiftOverdue = mustCloseShiftBeforeCharging({
    requireShiftClose:
      locations.find((location) => location.id === locationId)?.requireShiftClose ?? false,
    openedAt: shift?.openedAt ?? null,
    now: new Date(),
    timezone,
  });

  /**
   * La acción de caja desde el checkout (`SCREEN-POS-QUICK-SALE-001.1` §5): **abrir** cuando no hay turno.
   *
   * Cerrar no vive acá: el cierre firma el arqueo (conteo, bancos, diferencia) y esa capacidad es de la
   * pantalla de Caja, que es su dueña. Un cierre «a medias» desde el POS sería una segunda implementación del
   * mismo flujo —lo que la ley de *one canonical flow* prohíbe—, así que el POS **enlaza** a Caja.
   */
  const openShift = React.useCallback(async () => {
    if (shiftActionBusy) return;

    setShiftActionBusy(true);
    setShiftActionError(null);

    try {
      const response = await fetch("/api/admin/pos/shift/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          ...(terminalId ? { terminalId } : {}),
          counts: [],
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok) {
        setShiftActionError(
          body.error?.fields?.locationId ??
            body.error?.message ??
            "No se pudo abrir la caja de este local.",
        );
        return;
      }

      await loadShift(locationId);
    } catch {
      setShiftActionError("No se pudo abrir la caja: revisá la conexión.");
    } finally {
      setShiftActionBusy(false);
    }
  }, [loadShift, locationId, shiftActionBusy, terminalId]);

  return {
    shift,
    shiftLoading,
    refreshShift,
    /** Por qué no se puede cobrar aunque haya caja (`null` cuando no hay nada que avisar). */
    blockedReason: shiftOverdue ? CLOSE_SHIFT_FIRST_MESSAGE : null,
    /** `true` cuando hay caja abierta: es lo que habilita el cobro. */
    canCharge: Boolean(shift),
    /** `true` cuando ya se sabe que no hay caja abierta (el aviso no parpadea mientras carga). */
    needsOpenShift: !shift && !shiftLoading,
    /**
     * Qué acción de caja corresponde: `open` (nada que hacer), `no-shift` (abrir), `pending-close` (cerrar el
     * turno anterior) o `loading` (todavía no se sabe).
     */
    cashActionState: (shiftLoading
      ? "loading"
      : shift
        ? shiftOverdue
          ? "pending-close"
          : "open"
        : "no-shift") as "loading" | "open" | "no-shift" | "pending-close",
    openShift,
    shiftActionBusy,
    shiftActionError,
  };
}
