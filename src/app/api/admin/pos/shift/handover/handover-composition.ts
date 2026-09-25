import { shiftHandoverAudit } from "@/app/api/admin/audit-action-helpers";
import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { PrismaShiftHandoverRepository } from "@/modules/orders/adapters/prisma-shift-handover-repository";
import { listShiftHandovers } from "@/modules/orders/features/shift/list-shift-handovers";
import { registerShiftHandover } from "@/modules/orders/features/shift/register-shift-handover";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";

import { filterArqueoForRole } from "../shift-arqueo-role-filter";

/**
 * Tarea 7 del brief (2026-09-17) — el cableado del **traspaso de caja** (1.13).
 *
 * Firmar un traspaso son dos cosas: guardar el corte X con los dos nombres (el caso de uso) y dejar el
 * asiento en el log de auditoría. Las dependencias de la caja ya existen (`production-pos-shift`) y acá se
 * les suman el repositorio de traspasos y las devoluciones, que son parte del esperado.
 *
 * **TASK-AUD-003**: el traspaso devolvía el arqueo completo —con el esperado— por una puerta que es la del
 * mostrador, así que el cajero lo leía sin pasar por el corte X. Ahora la respuesta se filtra por rol igual
 * que el corte y el cierre; el **asiento de auditoría sigue guardando el esperado completo**, que es del
 * lado del servidor y sólo lee el dueño.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas.
 */
export async function registerPosShiftHandover(input: {
  locationId: string;
  receivedByName: string;
  notes?: string | null;
  actorUserId: string;
  actorName: string | null;
  role: string;
  now?: Date;
}) {
  const shiftDependencies = await createProductionPosShiftDependencies();

  const result = await registerShiftHandover(
    {
      locationId: input.locationId,
      receivedByName: input.receivedByName,
      handedByUserId: input.actorUserId,
      handedByName: input.actorName,
      notes: input.notes ?? null,
      now: input.now ?? new Date(),
    },
    {
      ...shiftDependencies,
      handoverRepository: new PrismaShiftHandoverRepository(),
      cashMovementRepository: new PrismaCashMovementRepository(),
      refundRepository: new PrismaRefundRepository(),
    },
  );

  await shiftHandoverAudit({
    actorUserId: input.actorUserId,
    handoverId: result.data.id,
    shiftId: result.data.shiftId,
    locationId: result.data.locationId,
    handedByName: result.data.handedByName,
    receivedByName: result.data.receivedByName,
    expectedAmount: result.data.expectedAmount,
  });

  return filterArqueoForRole(result, input.role);
}

/** Los traspasos del turno abierto (o de uno puntual, cuando el detalle de un cierre viejo los pide). */
export async function listPosShiftHandovers(input: {
  locationId: string;
  shiftId?: string | null;
  role: string;
}) {
  const { shiftRepository } = await createProductionPosShiftDependencies();

  const result = await listShiftHandovers(
    { locationId: input.locationId, shiftId: input.shiftId },
    { shiftRepository, handoverRepository: new PrismaShiftHandoverRepository() },
  );

  // Cada traspaso lista el corte X con el que se firmó: para el cajero, sin el esperado.
  return filterArqueoForRole(result, input.role);
}
