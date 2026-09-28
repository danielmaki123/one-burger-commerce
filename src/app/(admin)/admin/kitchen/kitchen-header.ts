import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";

/**
 * Los textos de la **cabecera** de Cocina: de qué local es el turno y qué hora es.
 *
 * Viven fuera de `page.tsx` porque una página de Next no puede exportar nada más que la página
 * (`next build --webpack` falla si no) y porque así se prueban solos.
 */

/**
 * El local del turno: el nombre cuando hay **una** sucursal a la vista, y «Todas las sucursales» cuando
 * hay más de una.
 *
 * No elige un local por su cuenta: con dos cocinas y sin filtro, mostrar el nombre de una sería mentir
 * sobre el tablero —y los umbrales de esa cabecera ya rigen por el default justamente por eso—.
 */
export function describeKitchenLocation(
  orders: readonly { id: string; name: string | null; pickupLeadMinutes: number | null }[],
): string {
  const named = orders.filter((order) => order.name);
  const distinct = [...new Set(named.map((order) => order.name))];

  return distinct.length === 1 ? (distinct[0] as string) : "Todas las sucursales";
}

/** El reloj de la cabecera, en la zona del negocio. Una hora ilegible no rompe la cabecera. */
export function formatKitchenClock(nowIso: string, timeZone: string): string {
  return formatTimeInTimeZone(nowIso, timeZone) || "--:--";
}
