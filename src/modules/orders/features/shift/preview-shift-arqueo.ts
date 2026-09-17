import type { CashMovementRepository } from "@/modules/orders/ports/cash-movement-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { calculateExpectedAmount } from "./close-shift";

/**
 * Tarea 7 del brief (2026-09-17) — el **corte X** (1.12): cuánto hay en la caja **ahora**, sin cerrar.
 *
 * Es una **lectura**: no cierra el turno, no guarda arqueo y no cambia nada. Sirve para dos cosas del
 * negocio: saber cómo va la caja a mitad del turno (sin esperar al cierre) y dejar constancia en el
 * **handover** entre cajeros de con cuánto se entrega.
 *
 * Usa la **misma** cuenta que el cierre (`calculateExpectedAmount`, con la ventana abierta→ahora), así el
 * papel del corte y el del cierre no pueden decir números distintos: si difirieran, el que firma el
 * traspaso estaría firmando algo que no es.
 */
export async function previewShiftArqueo(
  input: { shiftId: string; now: Date },
  {
    shiftRepository,
    paymentRepository,
    cashMovementRepository,
    refundRepository,
    businessCurrencyCode,
    usdExchangeRate,
  }: {
    shiftRepository: ShiftRepository;
    paymentRepository: PaymentRepository;
    cashMovementRepository?: CashMovementRepository;
    refundRepository?: Pick<RefundRepository, "listByShift">;
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
  },
) {
  const shiftId = input.shiftId?.trim();
  if (!shiftId) return { data: null };

  const shift = await shiftRepository.findShiftById(shiftId);

  // Un turno cerrado tiene su arqueo propio (el del cierre): leerse como corte sería un número nuevo
  // sobre un documento ya firmado.
  if (!shift || shift.status !== "open") return { data: null };

  const arqueo = await calculateExpectedAmount(
    {
      shiftId: shift.id,
      locationId: shift.locationId,
      openedAt: shift.openedAt,
      closedAt: input.now.toISOString(),
      openingAmount: shift.openingAmount,
      openingCounts: (shift.cashCounts ?? [])
        .filter((count) => count.kind === "opening")
        .map((count) => ({
          currency: count.currency,
          denomination: count.denomination,
          quantity: count.quantity,
        })),
      businessCurrencyCode,
      usdExchangeRate,
    },
    paymentRepository,
    cashMovementRepository,
    refundRepository,
  );

  return {
    data: {
      shiftId: shift.id,
      locationId: shift.locationId,
      openedAt: shift.openedAt,
      generatedAt: input.now.toISOString(),
      openingAmount: shift.openingAmount,
      ...arqueo,
    },
  };
}
