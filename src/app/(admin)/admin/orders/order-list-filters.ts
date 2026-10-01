import {
  isAdminOrderDatePreset,
  parseAdminOrderPaymentFilter,
  parseAdminOrderStatusGroup,
  type AdminOrderDatePreset,
  type AdminOrderPaymentFilter,
  type AdminOrderStatusGroup,
} from "@/modules/orders/domain/admin-order-filters";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **los filtros del listado en la URL** (`A-62`).
 *
 * La spec lo pide y la bandeja vieja no lo cumplía: el filtro de estado vivía en el estado de React, así
 * que recargar o compartir el enlace lo perdía. Acá **todos** los filtros viven en la URL (`search`, `date`,
 * `location`, `status`, `payment`, `scheduled` y `page`) y este archivo es el único que sabe leerlos y
 * escribirlos.
 *
 * Los valores válidos salen del **dominio** (`admin-order-filters`): un valor raro en la URL se descarta en
 * vez de viajar y volver como 400. La página `1` no se escribe: es el default.
 */

export type OrderListFilters = {
  search: string;
  date: AdminOrderDatePreset;
  locationId: string;
  status: AdminOrderStatusGroup;
  payment: AdminOrderPaymentFilter;
  scheduledOnly: boolean;
  page: number;
};

/** El valor del control de sucursal cuando no hay filtro. **No es un id de local.** */
export const ALL_LOCATIONS = "all";

export const DEFAULT_ORDER_LIST_FILTERS: OrderListFilters = {
  search: "",
  date: "today",
  locationId: ALL_LOCATIONS,
  status: "all",
  payment: "all",
  scheduledOnly: false,
  page: 1,
};

/** La fecha por defecto es **Hoy**: la bandeja del día es el caso de uso más frecuente. */
export function readOrderListFilters(search: string): OrderListFilters {
  const params = new URLSearchParams(search);
  const preset = params.get("date");
  const page = Number.parseInt(params.get("page") ?? "1", 10);

  return {
    search: params.get("search")?.trim() ?? "",
    date: isAdminOrderDatePreset(preset) ? preset : DEFAULT_ORDER_LIST_FILTERS.date,
    locationId: params.get("locationId")?.trim() || ALL_LOCATIONS,
    status: parseAdminOrderStatusGroup(params.get("status")),
    payment: parseAdminOrderPaymentFilter(params.get("payment")),
    scheduledOnly: params.get("scheduled") === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * Escribe los filtros en la URL. Un valor por defecto **no se escribe**: así el enlace «limpio» del listado
 * es `/admin/orders` y no una cadena de parámetros que no dicen nada.
 */
export function writeOrderListFilters(base: string, filters: OrderListFilters): string {
  const params = new URLSearchParams(base);

  const setOrDelete = (key: string, value: string | null) => {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  };

  setOrDelete("search", filters.search.trim());
  setOrDelete("date", filters.date === DEFAULT_ORDER_LIST_FILTERS.date ? null : filters.date);
  setOrDelete(
    "locationId",
    filters.locationId === ALL_LOCATIONS ? null : filters.locationId,
  );
  setOrDelete("status", filters.status === "all" ? null : filters.status);
  setOrDelete("payment", filters.payment === "all" ? null : filters.payment);
  setOrDelete("scheduled", filters.scheduledOnly ? "1" : null);
  setOrDelete("page", filters.page > 1 ? String(filters.page) : null);

  const query = params.toString();

  return query ? `?${query}` : "";
}
