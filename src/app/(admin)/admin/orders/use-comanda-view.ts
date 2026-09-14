"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * B3 — la vista de comandas y el tablet de pared.
 *
 * La sección de comandas ocupa todo el ancho: la barra lateral del panel se esconde mientras se está
 * acá (§4.1) y la propia barra superior lleva el enlace para volver. Es una clase en `<html>` porque
 * la barra lateral la dibuja el shell del panel, fuera de esta página.
 *
 * El botón de pantalla completa entra al *Fullscreen API* —pensado para el tablet colgado en la
 * pared— y se sale con Esc, con el botón o al desmontar la vista (nadie queda encerrado).
 */

export const COMANDA_VIEW_CLASS = "comandas-view";

/** Mientras esta pantalla está montada, el panel se dibuja a lo ancho. */
export function useComandaView(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(COMANDA_VIEW_CLASS);

    return () => {
      root.classList.remove(COMANDA_VIEW_CLASS);
    };
  }, []);
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
