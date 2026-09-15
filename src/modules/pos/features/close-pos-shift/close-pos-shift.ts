import { closeShift } from "@/modules/orders/features/shift/close-shift";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import { PosError } from "../../domain/pos-errors";

/**
 * TASK-305b — cerrar la caja **de este local**.
 *
 * El cajero sabe de qué local es la caja, no de qué `shiftId`: resolver el turno abierto es trabajo
 * de la composición. Si no hay caja abierta se rechaza con 409 y un motivo, en vez de cerrar un turno
 * que no existe o dejar que la pantalla lo intente de nuevo sin decir nada.
 */
export async function closePosShift(
  input: { locationId: string; counts: ShiftCashCountInput[]; notes?: string | null },
  deps: {
    shiftRepository: ShiftRepository;
    paymentRepository: PaymentRepository;
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
  },
) {
  const { data: current } = await getCurrentShift(
    { locationId: input.locationId },
    { shiftRepository: deps.shiftRepository },
  );

  if (!current) {
    throw new PosError(409, "CONFLICT", "No hay una caja abierta en este local.", {
      locationId: "No hay una caja abierta en este local.",
    });
  }

  return closeShift(
    { shiftId: current.id, closingCounts: input.counts, notes: input.notes ?? null },
    deps,
  );
}
