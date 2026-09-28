/**
 * Punto 3 del roadmap (2026-09-18) — la preferencia del **modo cocina**, en el dispositivo.
 *
 * El modo cocina es **presentación**: los mismos datos, la misma API, los mismos filtros. Lo único que
 * cambia es que se esconden la barra lateral y el encabezado y quedan los carriles. Por eso la
 * preferencia vive en el `localStorage` del navegador y no en la cuenta: una tablet de pared queda en
 * modo cocina y el mostrador no, sin que nadie configure nada por usuario.
 *
 * Se lee al montar y se escribe al cambiar. Un valor ilegible —o un navegador que niega el
 * almacenamiento, como Safari en modo privado— se lee como apagado: el panel nunca se queda sin
 * navegación por un dato del dispositivo.
 */

export const KITCHEN_MODE_STORAGE_KEY = "one-burger:comanda-view";

export function readKitchenMode(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(KITCHEN_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeKitchenMode(enabled: boolean): void {
  if (typeof window === "undefined") return;

  try {
    if (enabled) window.localStorage.setItem(KITCHEN_MODE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(KITCHEN_MODE_STORAGE_KEY);
  } catch {
    // Sin almacenamiento el modo sigue funcionando en esta pestaña: solo no sobrevive a recargar.
  }
}
