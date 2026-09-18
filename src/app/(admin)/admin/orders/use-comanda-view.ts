"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * B3/B6 — la vista de comandas y la vuelta al panel.
 *
 * El tablero se abría **a pantalla completa** por defecto (sin la barra lateral del panel) y el shell
 * cambiaba de forma según la vista. Desde el layout unificado (opción (a) del owner, 2026-09-18) el
 * chrome **se ve siempre**: Órdenes tiene barra lateral y encabezado igual que el resto del panel, y
 * esconderlos es un modo explícito —el de cocina— que se prende a propósito y se sale con «Salir».
 *
 * La clase vive en `<html>` porque la barra lateral la dibuja el shell del panel, fuera de esta página,
 * y se limpia al desmontar: nadie queda sin navegación en el resto del panel.
 */

export const COMANDA_VIEW_CLASS = "comandas-view";

export function useComandaView(): {
  /** `true` = modo cocina: solo los carriles, sin barra lateral ni encabezado. */
  immersive: boolean;
  setImmersive: (value: boolean) => void;
} {
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    if (immersive) root.classList.add(COMANDA_VIEW_CLASS);
    else root.classList.remove(COMANDA_VIEW_CLASS);

    return () => {
      root.classList.remove(COMANDA_VIEW_CLASS);
    };
  }, [immersive]);

  return { immersive, setImmersive };
}

type FullscreenElement = Element & {
  requestFullscreen?: () => Promise<void>;
};

export function useFullscreen(): {
  isFullscreen: boolean;
  supported: boolean;
  toggle: () => Promise<void>;
} {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    handleChange();
    document.addEventListener("fullscreenchange", handleChange);

    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const supported =
    typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";

  const toggle = useCallback(async () => {
    const root = document.documentElement as FullscreenElement;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        return;
      }

      if (root.requestFullscreen) await root.requestFullscreen();
    } catch {
      // Un navegador que no lo permite (o un iframe sin permiso) deja la pantalla como estaba: el
      // tablero se sigue usando igual, solo no ocupa el monitor completo.
    }
  }, []);

  return { isFullscreen, supported, toggle };
}
