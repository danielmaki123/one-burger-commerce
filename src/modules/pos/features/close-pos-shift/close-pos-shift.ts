import { closeShift } from "@/modules/orders/features/shift/close-shift";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import type { ShiftBankCloseInput } from "@/modules/orders/domain/shift-bank-close";
import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import type { BankRepository } from "@/modules/banks/ports/bank-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import { PosError } from "../../domain/pos-errors";

/**
 * TASK-305b — cerrar la caja **de este local**.
 *
 * El cajero sabe de qué local es la caja, no de qué `shiftId`: resolver el turno abierto es trabajo
 * de la composición. Si no hay caja abierta se rechaza con 409 y un motivo, en vez de cerrar un turno
 * que no existe o dejar que la pantalla lo intente de nuevo sin decir nada.
 *
 * Fase 3 del rediseño de Caja (2026-09-23): además del conteo viaja el **cuadre por banco** (el lote de
 * cada terminal). Es opcional: una caja se puede cerrar sin declarar lotes.
 */
export async function closePosShift(
  input: {
    locationId: string;
    counts: ShiftCashCountInput[];
    bankCloses?: ShiftBankCloseInput[];
    notes?: string | null;
  },
  deps: {
    shiftRepository: ShiftRepository;
    paymentRepository: PaymentRepository;
    /** Fase 3 — el catálogo de bancos de la sucursal, para validar el cuadre. */
    bankRepository?: BankRepository;
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
    {
      shiftId: current.id,
      closingCounts: input.counts,
      bankCloses: input.bankCloses,
      notes: input.notes ?? null,
    },
    deps,
  );
}
