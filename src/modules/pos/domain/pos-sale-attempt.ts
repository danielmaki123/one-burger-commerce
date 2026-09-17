/**
 * Tarea 11 del brief (2026-09-17) — la **clave del intento de cobro** del mostrador (12.1/12.2).
 *
 * Cada intento de cobro lleva un **UUID** que viaja con la venta hasta que la operación se resuelve. Si la
 * red se cae justo después de mandar el cobro —el caso del mostrador con conexión mala—, el cajero
 * reintenta y el servidor reconoce **la misma** operación en vez de crear un segundo pedido con su cobro.
 *
 * Es un UUID y no un contador por dos razones: se genera en el dispositivo sin coordinarse con nadie (dos
 * terminales no pueden chocar) y, guardado junto al borrador, **sobrevive a la recarga**: una clave en
 * memoria se pierde justo cuando más hace falta, que es cuando la pantalla se recarga después del corte.
 *
 * El tope de largo es el de la API (`sale-payload.ts`): una clave más larga la rechaza el servidor y el
 * cobro no se podría reintentar.
 */

export const POS_SALE_ATTEMPT_KEY_MAX_LENGTH = 80;

/** Un UUID v4 del dispositivo. En un navegador viejo sin `crypto.randomUUID` cae a un valor armado. */
export function createSaleAttemptKey(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  // Sin `randomUUID` (contexto no seguro, navegador viejo) igual hace falta una clave única: se arma con
  // lo que hay. No es criptográfica y no hace falta que lo sea —no protege nada, solo identifica—.
  return `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Lo mismo que valida la API: texto no vacío y dentro del tope. */
export function isSaleAttemptKey(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const key = value.trim();

  return key.length > 0 && key.length <= POS_SALE_ATTEMPT_KEY_MAX_LENGTH;
}
