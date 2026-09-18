"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readKitchenMode, writeKitchenMode } from "./kitchen-mode";

/**
 * B3/B6 · Punto 3 (2026-09-18) — el modo cocina y la vuelta al panel.
 *
 * El tablero se abría **a pantalla completa** por defecto (sin la barra lateral del panel) y el shell
 * cambiaba de forma según la vista. Desde el layout unificado (opción (a) del owner, 2026-09-18) el
 * chrome **se ve siempre**: Órdenes tiene barra lateral y encabezado igual que el resto del panel, y
 * esconderlos es un modo explícito —el de cocina— que se prende a propósito y se sale con «Salir».
 *
 * La clase vive en `<html>` porque la barra lateral la dibuja el shell del panel, fuera de esta página,
 * y se limpia al desmontar: nadie queda sin navegación en el resto del panel.
 *
 * El modo es **del dispositivo** (`kitchen-mode.ts`): una tablet de pared queda en modo cocina y el
 * mostrador no. Se restaura al montar y se guarda al cambiar, así que sobrevive a recargar y a cambiar
 * de pestaña.
 */

export const COMANDA_VIEW_CLASS = "comandas-view";

export function useComandaView(): {
  /** `true` = modo cocina: solo los carriles, sin barra lateral ni encabezado. */
  immersive: boolean;
  setImmersive: (value: boolean) => void;
} {
  const [immersive, setImmersive] = useState(false);
  /**
   * La elección **explícita** de esta sesión. Mientras nadie toque el modo, el estado es «todavía no
   * sé»: guardarlo apenas monta borraría la preferencia del dispositivo antes de leerla (bug que
   * encontró el E2E: se apagaba sola al recargar). Así, lo que se persiste es siempre una decisión.
   */
  const hasChosenRef = useRef(false);

  /**
   * Se restaura **después de montar**, no en el estado inicial: leer el `localStorage` durante el
   * render haría que el HTML del servidor y el del cliente no coincidan. El costo es un parpadeo de un
   * cuadro en la tablet de cocina, y a cambio la primera pintura es la misma para todos.
   */
  useEffect(() => {
    setImmersive((current) => current || readKitchenMode());
  }, []);

  useEffect(() => {
    if (hasChosenRef.current) writeKitchenMode(immersive);
  }, [immersive]);

  const chooseImmersive = useCallback((value: boolean) => {
    hasChosenRef.current = true;
    setImmersive(value);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (immersive) root.classList.add(COMANDA_VIEW_CLASS);
    else root.classList.remove(COMANDA_VIEW_CLASS);

    return () => {
      root.classList.remove(COMANDA_VIEW_CLASS);
    };
  }, [immersive]);

  return { immersive, setImmersive: chooseImmersive };
}

