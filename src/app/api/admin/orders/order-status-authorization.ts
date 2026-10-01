import { canDeliverOrder, canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { isValidStatusTransition } from "@/modules/orders/domain/order-workflows";
import type { OrderStatus, OrderType } from "@/modules/orders/domain/order.types";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §18, §19) — **quién puede firmar un cambio de estado**.
 *
 * La entrega tiene una puerta **nominal** propia (`canDeliverOrder`) porque `canManageOrderOperations` —la
 * capacidad gruesa— **no incluye al `cashier`**: es exactamente quien entrega en el mostrador, así que sin
 * esto no podría cerrar su día desde el POS. Y la excepción no puede ser «el cajero puede cambiar estados»:
 * autorizada así, `canDeliverOrder` le habría dado por efecto secundario **preparar, cancelar y cerrar**, que
 * el brief §19 prohíbe.
 *
 * Por eso hay **dos** comprobaciones y las dos son necesarias:
 *
 * 1. El **rol** tiene la capacidad gruesa (owner, manager, kitchen: el flujo completo del mostrador), **o**
 *    tiene la nominal de entrega.
 * 2. Si el rol **no** tiene la gruesa, la única transición que puede firmar es la **entrega**: el estado pedido
 *    tiene que ser `picked_up` **y** la transición tiene que ser válida para el tipo de pedido —que es la
 *    misma regla del dominio que valida el caso de uso, no una lista paralela—, y el pedido tiene que estar
 *    en `ready_for_pickup`.
 *
 * Vive en la capa de composición y no en el `route.ts` porque el repo tiene un tope de 50 líneas por handler,
 * y no en el dominio porque traduce un rol de sesión a una decisión de HTTP (403).
 */
export function canChangeOrderStatus(role: AdminRole): boolean {
  return canManageOrderOperations(role) || canDeliverOrder(role);
}

/** El 403 de la puerta. Mensaje genérico a propósito: no se filtra qué rol podría. */
export function assertCanChangeOrderStatus(role: AdminRole): void {
  if (canChangeOrderStatus(role)) return;

  throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
}

/**
 * Se llama **después** del alcance por sucursal y con el pedido ya leído: la decisión depende del estado real
 * del pedido, no sólo del estado que pidió el cliente.
 */
export function assertDeliverableByRole(input: {
  role: AdminRole;
  type: OrderType;
  current: OrderStatus;
  next: OrderStatus;
}): void {
  // Quien tiene la capacidad gruesa opera el flujo completo: no se recorta (recortar al dueño sería un
  // defecto, no una autorización).
  if (canManageOrderOperations(input.role)) return;

  if (input.next !== "picked_up" || input.current !== "ready_for_pickup") {
    throw new AuthError(
      403,
      "FORBIDDEN",
      "Tu rol sólo puede entregar un pedido listo para retirar.",
    );
  }

  // La transición la valida el **dominio**, no esta capa: `ready_for_pickup → picked_up` tiene que ser válida
  // para el tipo de pedido (un pedido de mesa no se retira).
  if (!isValidStatusTransition(input.type, input.current, input.next)) {
    throw new AuthError(403, "FORBIDDEN", "Esa transición no es válida para este pedido.");
  }
}
