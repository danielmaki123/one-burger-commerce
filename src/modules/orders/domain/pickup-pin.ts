/**
 * PIN de retiro (T13).
 *
 * El mock muestra "PIN de Retiro 4821 · Díctalo en caja". Es un **código corto
 * para dictar**, no un identificador ni un secreto: el identificador del pedido
 * sigue siendo `orderNumber` y el acceso al pedido sigue pidiendo el token o el
 * WhatsApp. Por eso no autoriza nada.
 *
 * Este módulo es puro a propósito (no importa `crypto`): lo consume también la
 * pantalla de confirmación, que corre en el cliente.
 */

/** Cuántos dígitos tiene el PIN. Cuatro se dictan sin errores ni pausas. */
export const PICKUP_PIN_LENGTH = 4;

/**
 * Arma el PIN desde un entero.
 *
 * Se separa del azar para que el generador real viva del lado del servidor y los
 * tests no dependan de un número random.
 */
export function formatPickupPin(value: number): string {
  const modulo = 10 ** PICKUP_PIN_LENGTH;
  const normalized = Math.abs(Math.trunc(value)) % modulo;

  return String(normalized).padStart(PICKUP_PIN_LENGTH, "0");
}

/**
 * Genera el PIN usando una fuente de azar inyectada.
 *
 * El caso de uso le pasa `randomInt` de `node:crypto` (el mismo patrón que el
 * generador del token de seguimiento), así los tests son deterministas.
 */
export function generatePickupPin(randomInt: (max: number) => number): string {
  return formatPickupPin(randomInt(10 ** PICKUP_PIN_LENGTH));
}

/** Un PIN válido son exactamente cuatro dígitos. */
export function isValidPickupPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}
