import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import { normalizeLocationIds } from "@/modules/locations/domain/location-ids";

/**
 * Alcance de pedidos por sucursal (TASK-staff-location-scope, A).
 *
 * Regla acordada con el owner:
 *  - el **dueño** ve todas las sucursales y su asignación se ignora;
 *  - un **gerente o cocina con sucursales asignadas** ve solo esas;
 *  - un **gerente o cocina sin asignar** ve todas, a propósito: el día del deploy no hay ninguna
 *    asignación cargada y nadie puede quedar ciego. El admin lo muestra explícito
 *    ("Sin asignar · ve todas").
 *
 * Es dominio puro: no consulta la base. Que un local asignado siga existiendo lo valida la capa de
 * composición; acá un id que ya no existe simplemente no devuelve pedidos.
 */
export type OrderLocationScope =
  | { kind: "all" }
  | { kind: "restricted"; locationIds: string[] };

export function resolveOrderLocationScope(input: {
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
}): OrderLocationScope {
  if (input.role === ADMIN_ROLES.owner) return { kind: "all" };

  const assigned = normalizeLocationIds(input.assignedLocationIds);
  if (assigned.length === 0) return { kind: "all" };

  return { kind: "restricted", locationIds: assigned };
}

/**
 * La sucursal efectiva del listado.
 *
 * Una sucursal pedida **fuera del alcance se ignora** (se devuelve el alcance completo en vez de la
 * pedida): pedir por query la sucursal ajena nunca puede mostrar sus pedidos, y tampoco es un error
 * de datos que haya que reportar. Devuelve `undefined` cuando no hay que filtrar (todas).
 */
export function resolveOrderListLocationIds(input: {
  scope: OrderLocationScope;
  requestedLocationId?: string | null;
}): string[] | undefined {
  const requested = input.requestedLocationId?.trim();

  if (input.scope.kind === "all") {
    return requested ? [requested] : undefined;
  }

  if (requested && input.scope.locationIds.includes(requested)) {
    return [requested];
  }

  return [...input.scope.locationIds];
}

/** Para los caminos de un pedido puntual (detalle y cambio de estado). */
export function canAccessOrderLocation(scope: OrderLocationScope, locationId: string): boolean {
  if (scope.kind === "all") return true;

  return scope.locationIds.includes(locationId.trim());
}
