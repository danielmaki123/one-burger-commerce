import { ShiftError } from "@/modules/orders/domain/shift-errors";
import {
  cashCountsTotalInBusinessCurrency,
  cashPaymentsTotalInBusinessCurrency,
  expectedCashByCurrency,
  validateShiftCashCounts,
  type ShiftCashCountInput,
} from "@/modules/orders/domain/shift-cash";
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
 * TASK-305 corrige tres cosas que hacían que el número no sirviera:
 * 1. **La tarjeta no entra al cajón**: antes se sumaban todos los cobros, así que una venta con
 *    tarjeta hacía que la caja "sobrara" por ese monto.
 * 2. **Los dólares se convierten**: antes `US$3` sumaba 3 a una expectativa en córdobas.
 * 3. **El vuelto sale**: se descuenta lo que se le devolvió al cliente (`changeAmount`), porque si no,
 *    un día con vueltos parecería que falta plata.
 *
 * `closingAmount: null` es un cierre **ciego**: se guarda el esperado y la diferencia queda sin
 * calcular hasta que alguien cuente. Cerrar dos veces devuelve `null` en vez de pisar el conteo que
 * ya estaba firmado.
 */
export async function closeShift(
  input: {
    shiftId: string;
    closingAmount?: number | null;
    /** TASK-305 — con qué billetes se cerró, por moneda. Si viene, el total sale del conteo. */
    closingCounts?: ShiftCashCountInput[];
    notes?: string | null;
  },
  {
    shiftRepository,
    paymentRepository,
    businessCurrencyCode,
    usdExchangeRate,
  }: {
    shiftRepository: ShiftRepository;
    paymentRepository: PaymentRepository;
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
  },
) {
  const shiftId = input.shiftId?.trim();
  if (!shiftId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { shiftId: "Requerido" });
  }

  const countProblems = validateShiftCashCounts(input.closingCounts ?? []);
  if (Object.keys(countProblems).length > 0) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Revisá el conteo de la caja.", countProblems);
  }

  const closingAmount = input.closingCounts?.length
    ? cashCountsTotalInBusinessCurrency({
        counts: input.closingCounts,
        businessCurrencyCode,
        usdExchangeRate,
      })
    : (input.closingAmount ?? null);

  if (closingAmount !== null) {
    if (!Number.isFinite(closingAmount) || closingAmount < 0) {
      throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
        closingAmount: "Tiene que ser 0 o más",
      });
    }
  }

  const shift = await shiftRepository.findShiftById(shiftId);
  if (!shift) {
    return { data: null, meta: { expectedByCurrency: {} } };
  }
  if (shift.status !== "open") {
    // Ya cerrado: no se pisa el arqueo del primero.
    return { data: null, meta: { expectedByCurrency: {} } };
  }

  const closedAt = new Date();
  const arqueo = await calculateExpectedAmount(
    {
      locationId: shift.locationId,
      openedAt: shift.openedAt,
      closedAt: closedAt.toISOString(),
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
  );

  const closed = await shiftRepository.closeShift(shiftId, {
    closingAmount,
    expectedAmount: arqueo.expectedAmount,
    expectedByCurrency: arqueo.expectedByCurrency,
    cashSalesAmount: arqueo.cashSalesAmount,
    closingCounts: input.closingCounts ?? [],
    notes: input.notes ?? shift.notes,
  });

  return { data: closed, meta: { expectedByCurrency: arqueo.expectedByCurrency } };
}

/**
 * Lo que debería haber en la caja: el fondo **contado** (o el monto con el que se abrió) más el
 * efectivo del turno convertido a la moneda del negocio, menos los vueltos que salieron. La tarjeta
 * se cuenta aparte y no entra acá: no está en el cajón.
 */
async function calculateExpectedAmount(
  window: {
    locationId: string;
    openedAt: string;
    closedAt: string;
    openingAmount: number;
    openingCounts: ShiftCashCountInput[];
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
  },
  paymentRepository: PaymentRepository,
): Promise<{
  expectedAmount: number;
  expectedByCurrency: Record<string, number>;
  cashSalesAmount: number;
}> {
  const payments = await paymentRepository.listPaymentsInRange(window.locationId, {
    from: window.openedAt,
    to: window.closedAt,
  });

  const cashPayments = payments
    .filter((payment) => payment.method === "cash")
    .map((payment) => ({
      currency: payment.currency ?? window.businessCurrencyCode,
      amount: payment.amount,
      // La propina en efectivo también entra al cajón.
      tip: payment.tip,
      changeAmount: payment.changeAmount,
    }));

  const openingAmount = window.openingCounts.length
    ? cashCountsTotalInBusinessCurrency({
        counts: window.openingCounts,
        businessCurrencyCode: window.businessCurrencyCode,
        usdExchangeRate: window.usdExchangeRate,
      })
    : window.openingAmount;

  // Bloque 1.2: el efectivo del turno sale de la **misma** lista de cobros que el esperado, así el
  // número que se guarda y el que se usa para el arqueo no pueden discrepar.
  const cashSalesAmount = cashPaymentsTotalInBusinessCurrency({
    cashPayments,
    businessCurrencyCode: window.businessCurrencyCode,
    usdExchangeRate: window.usdExchangeRate,
  });

  return {
    expectedAmount: roundCurrency(openingAmount + cashSalesAmount),
    // Por moneda, para que la pantalla pueda comparar lo esperado con lo contado sin convertir nada.
    // Bloque 1.1: queda congelado en el turno (antes solo viajaba en la respuesta).
    expectedByCurrency: expectedCashByCurrency({
      openingCounts: window.openingCounts,
      cashPayments,
      businessCurrencyCode: window.businessCurrencyCode,
    }),
    cashSalesAmount,
  };
}
