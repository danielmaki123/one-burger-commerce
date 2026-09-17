"use client";

import { useEffect, useState } from "react";

/**
 * Bloque 12.4 del roadmap del POS (Fase 2) — ¿hay red?
 *
 * El POS cobra contra el servidor: con la terminal sin red, el botón de cobrar no puede quedar como si
 * todo estuviera bien — el cajero cobraría y el pedido no se registraría. El estado sale del navegador
 * (`navigator.onLine` + los eventos `online`/`offline`), no de un ping propio: es la única fuente que no
 * agrega latencia ni otro pedido al servidor.
 *
 * Arranca en `true` cuando el navegador no expone el dato: es la opción conservadora — no bloquear el
 * cobro por un navegador viejo— y el error real de red se sigue viendo como error al cobrar.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" || typeof navigator.onLine !== "boolean"
      ? true
      : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // El estado puede haber cambiado entre el render y el efecto: se vuelve a leer del navegador.
    setOnline(typeof navigator.onLine === "boolean" ? navigator.onLine : true);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
