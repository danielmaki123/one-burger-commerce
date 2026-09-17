import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import { previewShiftArqueo } from "@/modules/orders/features/shift/preview-shift-arqueo";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";

/**
 * Tarea 7 del brief (2026-09-17) — el cableado del **corte X** (1.12).
 *
 * Tres pasos: el turno abierto del local, el arqueo parcial con la cuenta del cierre y nada más. Vive acá
 * y no en el `route.ts` porque el handler tiene un tope de 50 líneas y porque el traspaso de caja (1.13)
 * necesita exactamente el mismo número —el que se firma— desde el caso de uso, no desde la ruta.
 */
export async function previewOpenShiftArqueo(input: { locationId: string; now: Date }) {
  const { shiftRepository, paymentRepository, businessCurrencyCode, usdExchangeRate } =
    await createProductionPosShiftDependencies();

  const { data: shift } = await getCurrentShift(
    { locationId: input.locationId },
    { shiftRepository },
  );

  if (!shift) return { data: null };

  return previewShiftArqueo(
    { shiftId: shift.id, now: input.now },
    {
      shiftRepository,
      paymentRepository,
      cashMovementRepository: new PrismaCashMovementRepository(),
      refundRepository: new PrismaRefundRepository(),
      businessCurrencyCode,
      usdExchangeRate,
    },
  );
}
