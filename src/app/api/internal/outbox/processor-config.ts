/**
 * Configuración del procesador del outbox, leída del entorno.
 *
 * Estaba dentro del `route.ts`, que está en su **tope de 155 líneas** (deuda congelada): se movió acá tal
 * cual para poder sumar el barrido de alertas al handler. Refactor puro, sin cambio de comportamiento.
 */
export function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;

  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function parseAllowedEventTypes(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;

  const eventTypes = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return eventTypes.length > 0 ? eventTypes : undefined;
}

export function parseMinCreatedAt(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("OUTBOX_PROCESSOR_MIN_CREATED_AT_INVALID");
  }

  return date.toISOString();
}
