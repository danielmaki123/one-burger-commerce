"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addPosHold,
  createPosHoldId,
  parsePosHolds,
  posHoldsFull,
  removePosHold,
  serializePosHolds,
  type PosHeldSale,
} from "@/modules/pos/domain/pos-holds";

/**
 * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — las ventas en espera de **este** dispositivo.
 *
 * «Guardar en espera» libera el mostrador cuando el cliente no está listo todavía y «Retomar» lo trae de
 * vuelta completo. Las esperas viven en `localStorage`, igual que el borrador (Bloque 12.3) y por el mismo
 * motivo: todavía **no son pedidos** y no pueden depender de la red. La clave del intento de cobro viaja con
 * cada espera (tarea 11): retomar la venta que quedó a medias y volver a cobrarla sigue siendo el mismo
 * intento para el servidor.
 *
 * Tres detalles que no son obvios (son los mismos tres del borrador, y por los mismos bugs):
 *
 * 1. La lectura va en un efecto y no en el `useState` inicial: el POS también se renderiza en el servidor y
 *    ahí no hay `localStorage`.
 * 2. El guardado **no corre hasta que la lectura terminó** (`hydrated`): guardar el estado vacío inicial
 *    encima de lo guardado es exactamente el bug que tuvo el carrito del cliente.
 * 3. La lista y su **clave de guardado viajan juntas** en un solo estado (`store`). Con la lista suelta, el
 *    render que cambia de local tiene la lista vieja y la clave nueva, y el efecto de guardado escribía las
 *    esperas de la sucursal anterior bajo la clave de la nueva. Guardar solo cuando la clave del estado es
 *    la de la pantalla lo hace imposible.
 *
 * Una lista vacía **borra** el guardado: una espera descartada no puede reaparecer al recargar.
 */

export const POS_HOLDS_STORAGE_PREFIX = "one-burger-pos-holds";

/** Lo que la pantalla tiene que aportar para dejar una venta en espera: el id y la fecha son del hook. */
export type NewPosHeldSale = Omit<PosHeldSale, "id" | "savedAt">;

type HoldsStore = {
  /** La clave de `localStorage` a la que pertenece lo que hay acá abajo. */
  key: string;
  locationId: string;
  holds: PosHeldSale[];
};

function storageKey(locationId: string, currencyCode: string): string {
  return `${POS_HOLDS_STORAGE_PREFIX}:${locationId}:${currencyCode}`;
}

export function usePosHolds(
  locationId: string,
  currencyCode: string,
): {
  holds: PosHeldSale[];
  /** Deja la venta en espera. Con la lista llena no hace nada: la pantalla bloquea el botón antes. */
  hold: (sale: NewPosHeldSale) => void;
  discard: (id: string) => void;
  /** `true` cuando ya no entra otra espera (el tope es de `MAX_POS_HELDS`). */
  full: boolean;
} {
  const key = storageKey(locationId, currencyCode);
  const [store, setStore] = useState<HoldsStore>(() => ({ key, locationId, holds: [] }));
  const [hydrated, setHydrated] = useState(false);

  // Recuperar las esperas guardadas (una vez, al montar).
  useEffect(() => {
    setStore({ key, locationId, holds: parsePosHolds(localStorage.getItem(key), locationId) });
    setHydrated(true);
    // Solo al montar: si el local cambia, lo resuelve el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambiar de local (o de moneda) muestra **otra** lista: la de la sucursal anterior queda guardada.
  useEffect(() => {
    setStore((current) =>
      current.key === key
        ? current
        : { key, locationId, holds: parsePosHolds(localStorage.getItem(key), locationId) },
    );
  }, [key, locationId]);

  // Guardar cada cambio, ya con la lectura hecha y solo si lo que hay es de esta clave.
  useEffect(() => {
    if (!hydrated || store.key !== key) return;

    if (store.holds.length === 0) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, serializePosHolds(store.locationId, store.holds));
  }, [store, hydrated, key]);

  const hold = useCallback((sale: NewPosHeldSale) => {
    setStore((current) =>
      posHoldsFull(current.holds)
        ? current
        : {
            ...current,
            holds: addPosHold(current.holds, {
              ...sale,
              id: createPosHoldId(),
              savedAt: new Date().toISOString(),
            }),
          },
    );
  }, []);

  const discard = useCallback((id: string) => {
    setStore((current) => ({ ...current, holds: removePosHold(current.holds, id) }));
  }, []);

  return { holds: store.holds, hold, discard, full: posHoldsFull(store.holds) };
}
