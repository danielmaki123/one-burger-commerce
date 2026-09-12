/**
 * La fecha de "última actualización" del pedido, en la **zona del negocio**.
 *
 * Estaba fija en `America/Managua`: un negocio en otra zona veía la hora corrida. La zona
 * la pasa la página desde la configuración (`useBusinessSettings`).
 */
export function formatPublicOrderUpdatedAt(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
