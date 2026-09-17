"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createPosDraft, type PosDraft } from "@/modules/pos/domain/pos-draft";
import { parsePosDraft, serializePosDraft } from "@/modules/pos/domain/pos-draft-storage";

/**
 * Bloque 12.3 del roadmap del POS (Fase 2) — la venta en curso, guardada en el dispositivo.
 *
 * El cajero arma la venta tocando productos: si se recarga la pantalla, se corta la luz o se va la red a
 * mitad del armado, perder el borrador es volver a empezar con el cliente adelante. Este hook guarda el
 * borrador en `localStorage` (no en el servidor: todavía no es un pedido) y lo **recupera al montar**.
 *
 * Tres detalles que no son obvios:
 *
 * 1. La lectura va en un efecto y no en el `useState` inicial: la pantalla también se renderiza en el
 *    servidor y ahí no hay `localStorage`.
 * 2. El guardado **no corre hasta que la lectura terminó** (`hydrated`): es el mismo bug que tuvo el
 *    carrito del cliente —guardar el estado inicial vacío encima de lo guardado antes de leerlo—.
 * 3. Un borrador vacío **borra** lo guardado: si el cajero vacía la venta a propósito, no puede
 *    reaparecer al recargar.
 */
export const POS_DRAFT_STORAGE_PREFIX = "one-burger-pos-draft";

function storageKey(locationId: string, currencyCode: string): string {
  return `${POS_DRAFT_STORAGE_PREFIX}:${locationId}:${currencyCode}`;
}

export function usePosDraft(
  locationId: string,
  currencyCode: string,
): {
  draft: PosDraft;
  setDraft: React.Dispatch<React.SetStateAction<PosDraft>>;
  /** `true` cuando la venta que se ve se recuperó del dispositivo (para avisarlo en pantalla). */
  restored: boolean;
} {
  const key = storageKey(locationId, currencyCode);
  const [draft, setDraft] = useState<PosDraft>(() => createPosDraft(locationId));
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const activeKey = useRef(key);

  // Recuperar la venta en curso (una vez, al montar).
  useEffect(() => {
    const saved = parsePosDraft(localStorage.getItem(key), locationId);

    if (saved) {
      setDraft(saved);
      setRestored(true);
    }

    setHydrated(true);
    // Solo al montar: si el local cambia, lo resuelve el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambiar de local (o de moneda) empieza una venta nueva: el borrador lleva el local y sus precios.
  useEffect(() => {
    if (activeKey.current === key) return;

    activeKey.current = key;
    setDraft(createPosDraft(locationId));
    setRestored(false);
  }, [key, locationId]);

  // Guardar cada cambio, ya con la lectura hecha.
  useEffect(() => {
    if (!hydrated) return;

    if (draft.lines.length === 0) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, serializePosDraft(draft));
  }, [draft, hydrated, key]);

  const setDraftAndForgetRestore = useCallback<React.Dispatch<React.SetStateAction<PosDraft>>>(
    (value) => {
      setRestored(false);
      setDraft(value);
    },
    [],
  );

  return { draft, setDraft: setDraftAndForgetRestore, restored };
}
