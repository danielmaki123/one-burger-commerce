import { cashMovementAudit } from "@/app/api/admin/audit-action-helpers";
import type { CashMovementPayload } from "@/app/api/admin/cash/shifts/movements-payload";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { registerCashMovement } from "@/modules/orders/features/cash-movement/register-cash-movement/register-cash-movement";

/**
 * Bloque 2.3 + 13.1 + tarea 2 del brief (2026-09-17) — mover plata de la caja, firmar quién lo hizo y
 * guardar el límite vigente.
 *
 * Registrar el movimiento y dejar su asiento son **una sola operación**: un retiro sin asiento deja el
 * arqueo sin explicación. Además el caso de uso recibe el **límite de retiro configurado**, que queda
 * congelado con el movimiento: el owner decidió que no haya aprobación del supervisor, así que el límite
 * solo marca lo que lo supera (y mover el número después no reescribe la historia).
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas; la ruta se queda con lo suyo
 * (sesión, permiso, turno) y la composición con el adaptador, el log y la configuración.
 */
export async function registerShiftMovement(input: {
  actorUserId: string;
  shiftId: string;
  payload: CashMovementPayload;
}) {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });

  const result = await registerCashMovement(
    {
      ...input.payload,
      shiftId: input.shiftId,
      userId: input.actorUserId,
      withdrawalLimit: settings.withdrawalLimit,
    },
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
