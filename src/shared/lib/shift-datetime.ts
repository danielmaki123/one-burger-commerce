/**
 * Bloque 13.3 del roadmap del POS (Fase 2) — la fecha y hora de un turno, en la **zona del negocio**.
 *
 * Vivía en los helpers de la pantalla de caja, pero ahora también la imprime la hoja de cierre (y el CSV
 * ya la usaba): una sola implementación para que el papel, la pantalla y el export digan la misma hora.
 *
 * El día de caja es el del negocio (misma regla que el tablero de «Hoy»): un cierre de las 23:40 en
 * Managua no puede leerse como del día siguiente porque el cajero abrió la pantalla en Madrid.
 */
export function formatShiftDateTime(
  iso: string | null,
  options: { timezone: string; locale: string },
): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
