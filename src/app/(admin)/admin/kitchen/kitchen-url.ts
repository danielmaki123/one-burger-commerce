/**
 * El estado de la toolbar de **Cocina** en la URL, igual que en la bandeja de Pedidos.
 *
 * Buscar una comanda y compartir el enlace es una necesidad real de cocina («el pedido de Ana»), y al
 * recargar no se puede perder lo que se estaba mirando. Lo que la pantalla no entiende se ignora: una URL
 * vieja no puede dejar el tablero en blanco.
 *
 * La URL se maneja con el mismo criterio que la de Pedidos (`?search=…&late=1`), sin un segundo formato.
 */

export type KitchenUrlFilters = {
  search: string;
  lateOnly: boolean;
};

const DEFAULT_FILTERS: KitchenUrlFilters = { search: "", lateOnly: false };

export function readKitchenUrlFilters(search: string): KitchenUrlFilters {
  const params = new URLSearchParams(search);

  return {
    search: (params.get("search") ?? "").trim(),
    lateOnly: params.get("late") === "1",
  };
}

/** Los valores por defecto **se sacan** de la URL: la query dice sólo lo que está puesto. */
export function writeKitchenUrlFilters(search: string, filters: KitchenUrlFilters): string {
  const params = new URLSearchParams(search);

  if (filters.search.trim()) params.set("search", filters.search.trim());
  else params.delete("search");

  if (filters.lateOnly) params.set("late", "1");
  else params.delete("late");

  const rest = params.toString();

  return rest ? `?${rest}` : "";
}

export { DEFAULT_FILTERS as DEFAULT_KITCHEN_URL_FILTERS };
