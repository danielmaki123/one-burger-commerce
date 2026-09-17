import { OrderError } from "@/modules/orders/domain/order-errors";
import { resolveHandoverReceiver } from "@/modules/orders/domain/shift-handover";
import type { CashMovementRepository } from "@/modules/orders/ports/cash-movement-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";
import type { ShiftHandoverRepository } from "@/modules/orders/ports/shift-handover-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { previewShiftArqueo } from "./preview-shift-arqueo";

/**
 * Tarea 7 del brief (2026-09-17) — **registrar el traspaso de caja entre cajeros** (1.13).
 *
 * El traspaso **no cierra** el turno: la caja sigue siendo la misma y el arqueo sigue corriendo. Lo que
 * hace es dejar firmado quién tenía la plata hasta ese momento y quién la recibe, con el **corte X**
 * congelado —el esperado que los dos vieron en el papel— para que después se pueda reconstruir qué se
 * entregó.
 *
 * El esperado sale de `previewShiftArqueo`, la misma cuenta que el cierre y el corte: el papel que se
 * firma y el número guardado no pueden diferir.
 */
export async function registerShiftHandover(
  input: {
    locationId: string;
    receivedByName: string;
    /** Quién entrega: el usuario de la sesión que firma. */
    handedByUserId: string | null;
    handedByName: string | null;
    notes?: string | null;
    now: Date;
  },
  {
    shiftRepository,
    handoverRepository,
    paymentRepository,
    cashMovementRepository,
    refundRepository,
    businessCurrencyCode,
    usdExchangeRate,
  }: {
    shiftRepository: ShiftRepository;
    handoverRepository: ShiftHandoverRepository;
    paymentRepository: PaymentRepository;
    cashMovementRepository?: CashMovementRepository;
    refundRepository?: Pick<RefundRepository, "listByShift">;
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
  },
) {
  const receivedByName = resolveHandoverReceiver({
    receivedByName: input.receivedByName,
    handedByName: input.handedByName,
  });

  const shift = await shiftRepository.findOpenShiftByLocation(input.locationId);
  if (!shift) {
    throw new OrderError(409, "CONFLICT", "No hay una caja abierta que traspasar en este local.");
  }

  const { data: arqueo } = await previewShiftArqueo(
    { shiftId: shift.id, now: input.now },
    {
      shiftRepository,
      paymentRepository,
      cashMovementRepository,
      refundRepository,
      businessCurrencyCode,
      usdExchangeRate,
    },
  );

  if (!arqueo) {
    throw new OrderError(409, "CONFLICT", "No hay una caja abierta que traspasar en este local.");
  }

  const handover = await handoverRepository.create({
    shiftId: shift.id,
    locationId: shift.locationId,
    handedByUserId: input.handedByUserId,
    handedByName: input.handedByName,
    receivedByName,
    expectedAmount: arqueo.expectedAmount,
    expectedByCurrency: arqueo.expectedByCurrency,
    notes: input.notes?.trim() || null,
  });

  return { data: handover };
}
