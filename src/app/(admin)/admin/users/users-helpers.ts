import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";

import type { AdminUser, LocationOption } from "./user-row";

/** El mensaje de error del backend, si viene con la forma esperada. */
export function getErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}

/**
 * Lo que alcanza cada cuenta, en una línea: es lo que el owner necesita leer de un vistazo.
 *
 * El dueño ve todo por definición; sin sucursales asignadas el backend resuelve "ve todas"; y si una
 * asignación quedó apuntando a una sucursal que ya no está, se dice sin inventar el nombre.
 */
export function describeAssignedLocations(
  user: Pick<AdminUser, "role" | "locationIds">,
  locations: LocationOption[],
): string {
  if (user.role === ADMIN_ROLES.owner) return "Ve todas las sucursales";
  if (user.locationIds.length === 0) return "Sin asignar · ve todas";

  const names = user.locationIds
    .map((id) => locations.find((location) => location.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? `Asignado a: ${names.join(", ")}` : "Asignado a una sucursal";
}
