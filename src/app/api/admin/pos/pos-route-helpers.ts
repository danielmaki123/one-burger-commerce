import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";

/**
 * TASK-305b — lo que comparten las rutas del punto de venta.
 *
 * El permiso se resuelve igual en todas (cocina no entra) y el repo tiene un tope de 50 líneas por
 * `route.ts`: tener el chequeo en un solo lugar evita repetir el `if` y el JSON de 403 en cada ruta.
 */
export function assertCanUsePos(role: AdminRole): void {
  if (!canUsePOS(role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }
}
