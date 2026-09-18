import { canDiscountPosSale, canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { resolvePosLocationId } from "@/modules/pos/domain/pos-location";
import { ensurePosEnabled } from "@/modules/pos/features/ensure-pos-enabled/ensure-pos-enabled";

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

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — **descontar a mano** en una venta de mostrador.
 *
 * Un cupón es una promo cargada (el cajero solo escribe el código); un descuento manual es plata que el
 * cliente deja de pagar porque alguien lo decidió en el momento, y lo autoriza quien administra la caja
 * (`canDiscountPosSale`). La comprobación vive acá, con las otras puertas del POS, y corre **antes** de
 * crear nada: la venta con un descuento que este rol no puede dar no se cobra ni se firma.
 */
export function assertCanDiscountPosSale(
  role: AdminRole,
  manualDiscount: { kind: string; value: number; reason: string } | null | undefined,
): void {
  if (!manualDiscount || canDiscountPosSale(role)) return;

  throw new AuthError(403, "FORBIDDEN", "No tenés permiso para descontar a mano en el mostrador.", {
    discount: "Solo un encargado o el dueño pueden autorizar un descuento manual.",
  });
}

/**
 * TASK-308 — el local del POS, con las tres preguntas en el mismo orden.
 *
 * Rol → alcance por sucursal → **punto de venta prendido en ese local**. El orden importa: primero se
 * dice que no a quien no cobra, después a quien pide una sucursal ajena y recién al final se cuenta si
 * el mostrador está apagado. Devuelve el local ya resuelto para que la ruta no lo vuelva a calcular.
 */
export async function requirePosLocation(input: {
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  requested: string;
}): Promise<string> {
  assertCanUsePos(input.role);

  const locationId = resolvePosLocationId({
    requested: input.requested,
    scope: resolveOrderLocationScope({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
    }),
  });

  await ensurePosEnabled({ locationId }, createProductionPosLocationDependencies());

  return locationId;
}
