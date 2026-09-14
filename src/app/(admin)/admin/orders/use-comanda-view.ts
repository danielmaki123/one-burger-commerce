"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * B3/B6 — la vista de comandas y la vuelta al panel.
 *
 * El tablero se abre **a pantalla completa** (sin la barra lateral del panel): es lo que la cocina
 * quiere en el tablet de pared, y era el diseño acordado. Pero el primer intento la escondía sin
 * salida: el owner entró con una cuenta de sucursal, tocó «Volver al panel» y volvió a la misma
 * pantalla, sin manera de recuperar el chrome del panel.
 *
 * Ahora es un **modo que se sale**, no una puerta que se cierra: `immersive` arranca encendido y la
 * barra del turno ofrece «Ver el panel», que devuelve la barra lateral —donde están la navegación y la
 * sesión— sin cerrar sesión. Eso es lo que hace falta cuando cada tablet tiene su sección (comandas,
 * POS, inventario) y la persona necesita volver a elegir.
 *
 * La clase vive en `<html>` porque la barra lateral la dibuja el shell del panel, fuera de esta página,
 * y se limpia al desmontar: nadie queda sin navegación en el resto del panel.
 */

export const COMANDA_VIEW_CLASS = "comandas-view";

export function useComandaView(): {
  /** `true` = tablero a pantalla completa (sin barra lateral). */
  immersive: boolean;
  setImmersive: (value: boolean) => void;
} {
  const [immersive, setImmersive] = useState(true);

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
