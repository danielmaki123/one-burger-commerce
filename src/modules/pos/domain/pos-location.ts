import type { OrderLocationScope } from "@/modules/orders/domain/order-visibility";

import { PosError } from "./pos-errors";

/**
 * TASK-302 — de qué local es la venta.
 *
 * Reusa el alcance por sucursal que ya existe (`resolveOrderLocationScope`, A) y lo traduce a la
 * pregunta del mostrador. Que el alcance sea una regla compartida importa: si el POS tuviera la
 * suya, un cajero con una sola sucursal asignada podría terminar vendiendo en otra.
 */
export function resolvePosLocationId(input: {
  requested: string;
  scope: OrderLocationScope;
}): string {
  const requested = input.requested.trim();

  if (requested === "") {
    throw new PosError(400, "BAD_REQUEST", "Elegí el local del punto de venta.", {
      locationId: "Elegí el local del punto de venta.",
    });
  }

  if (input.scope.kind === "restricted" && !input.scope.locationIds.includes(requested)) {
    throw new PosError(403, "FORBIDDEN", "No tenés acceso a ese local.", {
      locationId: "No tenés acceso a ese local.",
    });
  }

  return requested;
}
