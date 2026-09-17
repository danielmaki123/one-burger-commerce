/**
 * Decisión del owner (2026-09-17) — «Hace 2 h» para el historial de envíos de las alertas.
 *
 * Es un texto para leer de reojo: minutos, horas y días alcanzan, y no se muestran segundos ni decimales
 * («hace 1,5 horas» no lo dice nadie). Los dos instantes entran por parámetro —el del envío y el de
 * ahora— para que se pueda probar sin relojes falsos y para que el que llama decida qué es «ahora»
 * (en el navegador, el cliente; nada de calcular tiempo en el servidor y compararlo con el del teléfono).
 */
export function formatRelativeTime(fromIso: string, toIso: string): string {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();

  if (!Number.isFinite(from) || !Number.isFinite(to)) return "";

  const minutes = Math.floor((to - from) / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.floor(hours / 24);

  return days === 1 ? "Ayer" : `Hace ${days} días`;
}
