"use client";

import * as React from "react";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el **estado de servidor** del turno, en un solo lugar.
 *
 * La pantalla de Caja pasó a tener cuatro estados (*cargando*, *error*, *sin turno*, *turno abierto*) y el
 * que sabe en cuál está es este hook: la vista no hace `fetch` ni guarda el turno por su cuenta.
 *
 * Tres decisiones que importan:
 *
 * 1. **Los dos errores están separados.** `error` es el de la **lectura** del turno y manda la pantalla al
 *    estado *error*; `actionError` es el de una **acción** (abrir o cerrar) y se muestra al lado de lo que
 *    se estaba haciendo. Mezclarlos haría que un cierre rechazado —un aviso de negocio— se viera como una
 *    pantalla rota.
 * 2. **El refresco de fondo no pisa lo que se está viendo.** El estado puede cambiar en otra terminal
 *    (la caja se cierra desde otra pestaña), así que se relee cada `REFRESH_MS`; si esa lectura falla, se
 *    mantiene el último dato bueno en vez de tapar la pantalla con un error cada 15 segundos. El que
 *    decide mostrar el error es el primer intento (o un reintento explícito).
 * 3. **Una lectura fallida no es «sin caja abierta»** (A-44): se mira `response.ok` y se propaga el mensaje
 *    del servidor, porque un 401 dibujado como «Sin caja abierta en este local» le miente al operario.
 *
 * Sin librería de estado: el patrón es el del repo (`useState` + `useCallback` + `useEffect`), como
 * `orders/use-comanda-view.ts` y `pos/use-pos-draft.ts`.
 */

/** El turno abierto, tal como lo devuelve `GET /api/admin/pos/shift`. */
export type CashShift = {
  id: string;
  openedAt: string;
  openingAmount: number;
};

/** El resumen del cierre recién hecho (lo que devuelve `POST /api/admin/pos/shift/close`). */
export type ClosedCashShift = {
  id?: string;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  expectedByCurrency?: Record<string, number>;
};

/** Una fila del conteo: la pantalla manda lo contado, el servidor deriva el fondo y el esperado. */
export type CashCountRow = { currency: string; denomination: number; quantity: number };

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — una fila del **cuadre por banco** tal como se escribe en el
 * modal. Los montos viajan como texto hasta que se mandan (es lo que el input tiene) y se convierten a
 * número en el cierre; `key` es de la pantalla (una fila por banco y moneda puede repetirse al agregar).
 */
export type BankCloseDraft = {
  key: string;
  bankId: string;
  currency: string;
  declaredAmount: string;
  lote: string;
  terminalLabel: string;
  notes: string;
};

export type CashShiftStatus = "loading" | "ready" | "error";

const REFRESH_MS = 15000;
const READ_ERROR = "No se pudo leer el estado de la caja: revisá la conexión.";

/**
 * Fase 6 del rediseno de Caja (2026-09-23) — el estado de la caja es **por terminal**: dos cajas del mismo
 * local se leen, se abren y se cierran por separado. Sin terminal (`null`) es la caja sin terminal: la
 * sucursal de una sola caja, que es como se comporta un local sin terminales cargadas.
 */
export function useCashShift(locationId: string, terminalId: string | null = null) {
  const [status, setStatus] = React.useState<CashShiftStatus>("loading");
  const [shift, setShift] = React.useState<CashShift | null>(null);
  const [closedShift, setClosedShift] = React.useState<ClosedCashShift | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(
    async (target: string, options: { silent?: boolean } = {}) => {
      if (!target) {
        setStatus("ready");
        setShift(null);
        return;
      }

      if (!options.silent) {
        setStatus("loading");
        setError(null);
      }

      try {
        const response = await fetch(
          `/api/admin/pos/shift?locationId=${encodeURIComponent(target)}${terminalId ? `&terminalId=${encodeURIComponent(terminalId)}` : ""}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as {
          data?: CashShift | null;
          error?: { message?: string };
        };

        // A-44: una lectura fallida **no** es «sin caja abierta». Un 401 (sesión vencida), un 403 o un 500
        // se dicen como son; antes este `fetch` no miraba el estado y la pantalla afirmaba que no había
        // caja abierta.
        if (!response.ok) {
          throw new Error(body.error?.message ?? READ_ERROR);
        }

        setShift(body.data ?? null);
        setError(null);
        setStatus("ready");
      } catch (caught) {
        if (options.silent) return;

        setError(caught instanceof Error ? caught.message : READ_ERROR);
        setStatus("error");
      }
    },
    // Fase 6 del rediseño de Caja: la terminal entra en las dependencias porque la lectura la usa en la URL.
    // Sin esto, `load` se queda con la terminal del primer render y cambiar de POS seguiría leyendo la caja
    // de la terminal anterior (el bug que este test cazó).
    [terminalId],
  );

  React.useEffect(() => {
    setClosedShift(null);
    setActionError(null);
    void load(locationId);
    // Fase 6: cambiar de terminal (o de local) vuelve a leer la caja que corresponde.
  }, [locationId, terminalId, load]);

  // El estado puede cambiar en otra terminal: se relee sin mover la pantalla de estado.
  React.useEffect(() => {
    if (!locationId) return;

    const timer = setInterval(() => void load(locationId, { silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [locationId, terminalId, load]);

  /** Reintento explícito de la lectura: sí vuelve al estado *cargando* y sí limpia el error. */
  const refresh = React.useCallback(() => {
    void load(locationId);
  }, [load, locationId]);

  const move = React.useCallback(
    async (
      action: "open" | "close",
      counts: CashCountRow[],
      bankCloses?: readonly BankCloseDraft[],
    ) => {
      setBusy(true);
      setActionError(null);

      try {
        const response = await fetch(`/api/admin/pos/shift/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            // Fase 6: la terminal con la que se abre o se cierra **esta** caja.
            terminalId,
            counts,
            // Fase 3 del rediseño de Caja: el cuadre por banco viaja con el conteo. El monto se
            // convierte acá (el input lo tiene como texto) y el servidor valida y suma.
            ...(bankCloses
              ? {
                  bankCloses: bankCloses.map((row) => ({
                    bankId: row.bankId,
                    currency: row.currency,
                    declaredAmount: Number(row.declaredAmount) || 0,
                    lote: row.lote.trim() || null,
                    terminalLabel: row.terminalLabel.trim() || null,
                    notes: row.notes.trim() || null,
                  })),
                }
              : {}),
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          data?: (CashShift & ClosedCashShift) | null;
          meta?: { expectedByCurrency?: Record<string, number> };
          error?: { message?: string };
        };

        if (!response.ok || !body.data) {
          setActionError(
            body.error?.message ??
              (action === "open" ? "No se pudo abrir la caja." : "No se pudo cerrar la caja."),
          );
          return { ok: false };
        }

        if (action === "open") {
          setShift({
            id: body.data.id,
            openedAt: body.data.openedAt,
            openingAmount: body.data.openingAmount,
          });
          setClosedShift(null);
          return { ok: true };
        }

        setShift(null);
        setClosedShift({
          ...body.data,
          // A-45: al cajero el servidor no le manda el esperado ni la diferencia (cuenta a ciegas). La
          // pantalla los lee como «no hay número» (`null`), no como cero: `undefined` se dibujaba como
          // «sobra C$ 0.00» sobre una caja que en realidad nunca se comparó.
          expectedAmount: body.data.expectedAmount ?? null,
          difference: body.data.difference ?? null,
          expectedByCurrency: body.meta?.expectedByCurrency ?? {},
        });
        return { ok: true };
      } catch {
        setActionError(
          action === "open"
            ? "No se pudo abrir la caja: revisá la conexión."
            : "No se pudo cerrar la caja: revisá la conexión.",
        );
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [locationId, terminalId],
  );

  const openShift = React.useCallback(
    (counts: CashCountRow[]) => move("open", counts),
    [move],
  );
  const closeShift = React.useCallback(
    (counts: CashCountRow[], bankCloses?: readonly BankCloseDraft[]) =>
      move("close", counts, bankCloses),
    [move],
  );

  return {
    status,
    shift,
    closedShift,
    error,
    actionError,
    busy,
    refresh,
    openShift,
    closeShift,
  };
}
