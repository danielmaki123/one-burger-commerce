import { canViewHistory } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import {
  resolveOrderListLocationIds,
  resolveOrderLocationScope,
} from "@/modules/orders/domain/order-visibility";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Punto 2 del roadmap (2026-09-18) — la puerta de la sección **Historial**.
 *
 * Las dos consultas (cierres y facturas) comparten el mismo permiso y el mismo alcance por sucursal, y
 * el mismo criterio que la caja: **el cajero no audita su propio turno** y cocina no maneja plata. El
 * manager entra, pero solo ve las facturas de sus sucursales y no puede anular.
 */

export function assertCanViewHistory(role: AdminRole): void {
  if (!canViewHistory(role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

/**
 * Anular es del **dueño**, no de quien administra el historial: es un documento que ya salió del
 * negocio. La ruta lo comprueba antes de tocar nada y el caso de uso lo vuelve a comprobar —la regla
 * vive en un solo lugar (`voidInvoice`)—; acá se corta temprano para no abrir una transacción al pedo.
 */
export function assertCanVoidInvoice(role: AdminRole): void {
  if (role !== "owner") {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

/**
 * Las sucursales que esta sesión puede mirar en el Historial: `undefined` = todas (dueño, o un manager
 * sin asignar), y una sucursal pedida **fuera del alcance se ignora** en vez de filtrar por ella.
 */
export function resolveHistoryLocationIds(input: {
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  requestedLocationId?: string | null;
}): string[] | undefined {
  return resolveOrderListLocationIds({
    scope: resolveOrderLocationScope({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
    }),
    requestedLocationId: input.requestedLocationId,
  });
}

/** La respuesta de error de las rutas del Historial, sin repetir el `no-store` en cada handler. */
export function historyErrorResponse(error: unknown) {
  const response = createErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
