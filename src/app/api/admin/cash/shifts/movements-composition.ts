import { cashMovementAudit } from "@/app/api/admin/audit-action-helpers";
import type { CashMovementPayload } from "@/app/api/admin/cash/shifts/movements-payload";
import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { registerCashMovement } from "@/modules/orders/features/cash-movement/register-cash-movement/register-cash-movement";

/**
 * Bloque 2.3 + 13.1 del roadmap del POS (Fase 2) — mover plata de la caja y firmar quién lo hizo.
 *
 * Registrar el movimiento y dejar su asiento son **una sola operación**: un retiro sin asiento deja el
 * arqueo sin explicación. Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas; la
 * ruta se queda con lo suyo (sesión, permiso, turno) y la composición con el adaptador y el log.
 */
export async function registerShiftMovement(input: {
  actorUserId: string;
  shiftId: string;
  payload: CashMovementPayload;
}) {
  const result = await registerCashMovement(
    { ...input.payload, shiftId: input.shiftId, userId: input.actorUserId },
    {
      shiftRepository: new PrismaShiftRepository(),
      cashMovementRepository: new PrismaCashMovementRepository(),
    },
  );

  await cashMovementAudit({
    actorUserId: input.actorUserId,
    movementId: result.data.id,
    shiftId: input.shiftId,
    kind: input.payload.kind,
    amount: input.payload.amount,
    currency: input.payload.currency,
  });

  return result.data;
}
