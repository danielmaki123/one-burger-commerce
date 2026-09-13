import { AuthError } from "@/modules/auth/domain/auth-errors";
import {
  canAccessOrderLocation,
  type OrderLocationScope,
} from "@/modules/orders/domain/order-visibility";

/**
 * A — el alcance por sucursal en los caminos de un pedido puntual (detalle y cambio de estado).
 *
 * Vive acá, en la capa de composición, porque depende de la sesión: el dominio de pedidos solo
 * sabe resolver el alcance, no quién es el usuario. 403 y no 404: es personal autenticado del
 * propio negocio, así que el mensaje honesto ayuda más que ocultar que el pedido existe.
 */
export const OUT_OF_SCOPE_MESSAGE =
  "Este pedido es de otra sucursal: tu usuario no tiene acceso a ese local";

export function assertOrderInScope(scope: OrderLocationScope, locationId: string): void {
  if (canAccessOrderLocation(scope, locationId)) return;

  throw new AuthError(403, "FORBIDDEN", OUT_OF_SCOPE_MESSAGE);
}
