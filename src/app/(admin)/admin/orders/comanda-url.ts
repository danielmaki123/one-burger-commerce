/**
 * B4 — el estado del tablero en la URL.
 *
 * Quien atiende el mostrador necesita mandarle a la cocina «el pedido de Ana» con un enlace, y al
 * recargar (o al volver del detalle) no puede perder lo que estaba mirando. Por eso los filtros del
 * tablero viven en la query string: la pantalla los lee al montar y los reescribe cuando cambian.
 *
 * Lo que la pantalla **no** entiende se ignora en vez de romper: una URL vieja o escrita a mano no
 * puede dejar la vista en blanco.
 */

export type OrderPaymentFilter = "all" | "cash" | "card";

export type OrderUrlFilters = {
  search: string;
  paymentMethod: OrderPaymentFilter;
  lateOnly: boolean;
};

const DEFAULT_FILTERS: OrderUrlFilters = { search: "", paymentMethod: "all", lateOnly: false };

/** Lee los filtros de una query string (`?…` o vacía). */
export function readOrderUrlFilters(search: string): OrderUrlFilters {
  const params = new URLSearchParams(search);
  const paymentMethod = params.get("paymentMethod");

  return {
    search: (params.get("search") ?? "").trim(),
    paymentMethod: paymentMethod === "cash" || paymentMethod === "card" ? paymentMethod : "all",
    lateOnly: params.get("late") === "1",
  };
}

/**
 * Escribe los filtros en la query string. Los valores por defecto **se sacan** para que la URL diga
 * solo lo que está puesto, y los parámetros que no son de los filtros se conservan.
 */
export function writeOrderUrlFilters(search: string, filters: OrderUrlFilters): string {
  const params = new URLSearchParams(search);

  if (filters.search.trim()) params.set("search", filters.search.trim());
  else params.delete("search");

  if (filters.paymentMethod === "all") params.delete("paymentMethod");
  else params.set("paymentMethod", filters.paymentMethod);

  if (filters.lateOnly) params.set("late", "1");
  else params.delete("late");

  const rest = params.toString();

  return rest ? `?${rest}` : "";
}

export { DEFAULT_FILTERS as DEFAULT_ORDER_URL_FILTERS };
