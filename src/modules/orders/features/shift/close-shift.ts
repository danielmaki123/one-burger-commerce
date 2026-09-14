import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Cierra la caja de un turno y deja el arqueo.
 *
 * El **esperado lo calcula el servidor**: fondo con el que se abrió + todo lo que entró en cobros
 * entre que se abrió y se cerró. El mostrador solo manda lo que contó. Si pudiera declarar su propio
 * esperado, la diferencia no significaría nada.
 *
 * `closingAmount: null` es un cierre **ciego**: se guarda el esperado y la diferencia queda sin
 * calcular hasta que alguien cuente. Cerrar dos veces devuelve `null` en vez de pisar el conteo que
 * ya estaba firmado.
 */
export async function closeShift(
  input: { shiftId: string; closingAmount: number | null; notes?: string | null },
  {
    shiftRepository,
    paymentRepository,
  }: {
    shiftRepository: ShiftRepository;
    paymentRepository: PaymentRepository;
  },
) {
  const shiftId = input.shiftId?.trim();
  if (!shiftId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { shiftId: "Requerido" });
  }

  if (input.closingAmount !== null) {
    if (!Number.isFinite(input.closingAmount) || input.closingAmount < 0) {
      throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
        closingAmount: "Tiene que ser 0 o más",
      });
    }
  }

  const shift = await shiftRepository.findShiftById(shiftId);
  if (!shift) {
    return { data: null };
  }
  if (shift.status !== "open") {
    // Ya cerrado: no se pisa el arqueo del primero.
    return { data: null };
  }

  const closedAt = new Date();
  const expectedAmount = await calculateExpectedAmount(
    {
      locationId: shift.locationId,
      openedAt: shift.openedAt,
      closedAt: closedAt.toISOString(),
      openingAmount: shift.openingAmount,
    },
    paymentRepository,
  );

  const closed = await shiftRepository.closeShift(shiftId, {
    closingAmount: input.closingAmount,
    expectedAmount,
    notes: input.notes ?? shift.notes,
  });

  return { data: closed };
}

/**
 * Lo que debería haber en la caja: el fondo más los cobros del turno, contando la propina (la
 * propina también entra al cajón cuando se cobra en efectivo).
 */
async function calculateExpectedAmount(
  window: { locationId: string; openedAt: string; closedAt: string; openingAmount: number },
  paymentRepository: PaymentRepository,
): Promise<number> {
  const payments = await paymentRepository.listPaymentsInRange(window.locationId, {
    from: window.openedAt,
    to: window.closedAt,
  });

  const collected = payments.reduce(
    (sum, payment) => sum + payment.amount + payment.tip,
    0,
  );

  return roundCurrency(window.openingAmount + collected);
}
