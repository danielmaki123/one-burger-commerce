import { ShiftError } from "@/modules/orders/domain/shift-errors";
import { DEFAULT_CASH_DENOMINATIONS } from "@/modules/cash-config/domain/cash-config-defaults";
import {
  bankClosesTotalByCurrency,
  bankDifferenceByCurrency,
  nonCashTotalsByCurrency,
  validateShiftBankCloses,
  type ShiftBankCloseConfig,
  type ShiftBankCloseInput,
} from "@/modules/orders/domain/shift-bank-close";
import {
  cashCountsTotalInBusinessCurrency,
  cashMovementsTotalInBusinessCurrency,
  cashPaymentsTotalInBusinessCurrency,
  expectedCashByCurrency,
  validateShiftCashCounts,
  type ShiftCashCountConfig,
  type ShiftCashCountInput,
} from "@/modules/orders/domain/shift-cash";
import { refundsTotalByCurrency, refundsTotalInBusinessCurrency } from "@/modules/orders/domain/shift-refund";
import { emptyShiftPaymentMix, summarizeShiftPayments, type ShiftPaymentMix } from "@/modules/orders/domain/shift-payment-mix";
import type { BankRepository } from "@/modules/banks/ports/bank-repository";
import type { CashMovementRepository } from "@/modules/orders/ports/cash-movement-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import { convertToBusinessCurrency } from "@/shared/lib/money-conversion";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * TASK-AUD-005 — el **límite atómico** del cierre: el turno bloqueado, su arqueo (leído después del
 * bloqueo) y el documento firmado, todo junto.
 *
 * El cierre no puede ser «leer los cobros y después cerrar»: en el medio entra una venta. Con el turno
 * bloqueado desde el principio, o la venta commiteó antes (y su cobro entra al arqueo) o llega después (y
 * la rechaza el propio cobro, que también pide el lock). El alcance lo arma el adaptador: acá no hay Prisma.
 */
export type CloseShiftScope = {
  /**
   * Bloquea la fila del turno y devuelve su estado **después** de esperar a quien la tuviera tomada.
   * `null` si el turno no existe.
   */
  lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
  shiftRepository: ShiftRepository;
  paymentRepository: PaymentRepository;
  cashMovementRepository?: CashMovementRepository;
  refundRepository?: Pick<RefundRepository, "listByShift">;
};

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
    /**
     * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco**: lo que declaró cada banco con
     * el lote de su terminal. Si no viene, el turno se cierra sin cuadre por banco (la diferencia queda
     * en `null`: no es lo mismo «no se declaró» que «cuadró»).
     */
    bankCloses?: ShiftBankCloseInput[];
    notes?: string | null;
  },
  {
    runInShiftTransaction,
    bankRepository,
    businessCurrencyCode,
    usdExchangeRate,
    cashCountConfig,
  }: {
    /** TASK-AUD-005 — el límite atómico del cierre (lo implementa el adaptador con `$transaction`). */
    runInShiftTransaction: <T>(work: (scope: CloseShiftScope) => Promise<T>) => Promise<T>;
    /**
     * Fase 3 del rediseño de Caja (2026-09-23) — el catálogo de bancos de la sucursal. Sin él, un cierre
     * no puede declarar lote: se rechaza en vez de guardar un banco que no se puede verificar.
     */
    bankRepository?: BankRepository;
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
    /**
     * Fase 2 del rediseño de Caja (2026-09-22) — la config del conteo de este local (monedas y billetes).
     * Sin ella se validan los defaults del módulo.
     */
    cashCountConfig?: ShiftCashCountConfig;
  },
) {
  const shiftId = input.shiftId?.trim();
  if (!shiftId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { shiftId: "Requerido" });
  }

  // Las validaciones del payload son puras: se hacen **antes** de abrir la transacción para no tenerla
  // tomando una conexión y el lock de la fila por un conteo mal armado.
  const countProblems = validateShiftCashCounts(input.closingCounts ?? [], cashCountConfig);
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

  const bankCloses = input.bankCloses ?? [];

  return runInShiftTransaction((scope) =>
    closeLockedShift({
      scope,
      input,
      closingAmount,
      bankCloses,
      bankRepository,
      businessCurrencyCode,
      usdExchangeRate,
      cashCountConfig,
    }),
  );
}

/**
 * El cierre, ya adentro del límite atómico y **con el turno bloqueado**: se lee el turno, se valida el
 * cuadre contra los bancos de su sucursal, se arma el arqueo con los cobros que ya no pueden cambiar y se
 * firma el documento. Nada de esto se puede separar del bloqueo (TASK-AUD-005).
 */
async function closeLockedShift({
  scope,
  input,
  closingAmount,
  bankCloses,
  bankRepository,
  businessCurrencyCode,
  usdExchangeRate,
  cashCountConfig,
}: {
  scope: CloseShiftScope;
  input: { shiftId: string; closingCounts?: ShiftCashCountInput[]; notes?: string | null };
  closingAmount: number | null;
  bankCloses: ShiftBankCloseInput[];
  bankRepository?: BankRepository;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
  cashCountConfig?: ShiftCashCountConfig;
}) {
  const shiftId = input.shiftId.trim();
  const locked = await scope.lockShift(shiftId);

  if (!locked || locked.status !== "open") {
    // Ya cerrado (o no existe): no se pisa el arqueo del primero.
    return { data: null, meta: emptyCloseMeta() };
  }

  const shift = await scope.shiftRepository.findShiftById(shiftId);
  if (!shift) {
    return { data: null, meta: emptyCloseMeta() };
  }

  const bankConfig: ShiftBankCloseConfig = {
    currencies: cashCountConfig?.currencies ?? Object.keys(DEFAULT_CASH_DENOMINATIONS),
    // Los bancos que la sucursal liquida y que siguen **activos**: la pantalla solo ofrece esos, y el
    // servidor rechaza el que llegue armado a mano (el cuadre es contra un banco concreto).
    bankIds: await listLocationBankIds(bankRepository, shift.locationId),
  };

  const bankProblems = validateShiftBankCloses(bankCloses, bankConfig);
  if (Object.keys(bankProblems).length > 0) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Revisá el cuadre por banco.", bankProblems);
  }

  const closedAt = new Date();
  const arqueo = await calculateExpectedAmount(
    {
      shiftId: shift.id,
      locationId: shift.locationId,
      openedAt: shift.openedAt,
      closedAt: closedAt.toISOString(),
      // Fase 6: con terminal, el arqueo lee solo los cobros de esta caja.
      terminalId: shift.terminalId ?? null,
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
    scope.paymentRepository,
    scope.cashMovementRepository,
    scope.refundRepository,
  );

  const bank = calculateBankDifference({
    closes: bankCloses,
    chargedByCurrency: arqueo.nonCashByCurrency,
    businessCurrencyCode,
    usdExchangeRate,
  });

  const closed = await scope.shiftRepository.closeShift(shiftId, {
    closingAmount,
    expectedAmount: arqueo.expectedAmount,
    expectedByCurrency: arqueo.expectedByCurrency,
    cashSalesAmount: arqueo.cashSalesAmount,
    // Tarea 1.2 del roadmap: el desglose por medio se congela con el resto del arqueo (es un documento).
    cardSalesAmount: arqueo.paymentMix.card,
    transferSalesAmount: arqueo.paymentMix.transfer,
    otherSalesAmount: arqueo.paymentMix.other,
    tipsAmount: arqueo.paymentMix.tips,
    cashMovementsAmount: arqueo.cashMovementsAmount,
    refundsAmount: arqueo.refundsAmount,
    closingCounts: input.closingCounts ?? [],
    // Fase 3 del rediseño de Caja: el cuadre por banco queda congelado con el arqueo. La diferencia se
    // calcula contra lo que el sistema cobró **fuera del cajón** en la ventana del turno.
    bankCloses,
    bankDifferenceAmount: bank.amount,
    notes: input.notes ?? shift.notes,
  });

  return {
    data: closed,
    meta: {
      expectedByCurrency: arqueo.expectedByCurrency,
      paymentMix: arqueo.paymentMix,
      bankDeclaredByCurrency: bank.declaredByCurrency,
      bankChargedByCurrency: arqueo.nonCashByCurrency,
      bankDifferenceByCurrency: bank.differenceByCurrency,
      bankDifferenceAmount: bank.amount,
    },
  };
}

/**
 * La diferencia del cuadre por banco, en la moneda del negocio: **lo declarado menos lo cobrado con
 * tarjeta y transferencia**. Se convierte la diferencia **por moneda** (no el total) para que un lote en
 * dólares no se mezcle con los córdobas antes de tiempo.
 *
 * `null` cuando no se declaró ningún banco: no es lo mismo «no se cuadró» que «cuadró».
 */
function calculateBankDifference(input: {
  closes: readonly ShiftBankCloseInput[];
  chargedByCurrency: Record<string, number>;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): {
  declaredByCurrency: Record<string, number>;
  differenceByCurrency: Record<string, number>;
  amount: number | null;
} {
  const declaredByCurrency = bankClosesTotalByCurrency(input.closes);
  const differenceByCurrency = bankDifferenceByCurrency({
    declared: declaredByCurrency,
    charged: input.chargedByCurrency,
  });

  if (input.closes.length === 0) {
    return { declaredByCurrency: {}, differenceByCurrency: {}, amount: null };
  }

  return {
    declaredByCurrency,
    differenceByCurrency,
    amount: roundCurrency(
      Object.entries(differenceByCurrency).reduce(
        (sum, [currency, amount]) =>
          sum +
          convertToBusinessCurrencyOrThrow({
            amount,
            currency,
            businessCurrencyCode: input.businessCurrencyCode,
            usdExchangeRate: input.usdExchangeRate,
          }),
        0,
      ),
    ),
  };
}

/** La conversión del cuadre, con el fallo traducido al error del turno (igual que el resto del arqueo). */
function convertToBusinessCurrencyOrThrow(input: {
  amount: number;
  currency: string;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  const converted = convertToBusinessCurrency(input);

  if (!converted.ok) {
    throw new ShiftError(
      422,
      "VALIDATION_ERROR",
      converted.reason === "missing-rate"
        ? "Cargá el tipo de cambio del dólar en Configuración para cerrar una caja con dólares."
        : `Todavía no se cuenta en ${converted.currency}.`,
      {
        bankCloses:
          converted.reason === "missing-rate"
            ? "Cargá el tipo de cambio del dólar en Configuración."
            : `Todavía no se cuenta en ${converted.currency}.`,
      },
    );
  }

  return converted.amount;
}

/**
 * Los cobros que le tocan a este turno.
 *
 * Fase 6 del rediseño de Caja (2026-09-23) — desde que un local puede tener **dos cajas abiertas** (una por
 * terminal), leer por ventana de tiempo haría que las dos se contaran la misma plata: primero se leen los
 * cobros **del turno** (`Payment.shiftId`).
 *
 * TASK-AUD-054 — a esos se les suman los cobros de la ventana que **no tienen turno**: los que entraron sin
 * caja abierta (el cobro de un pedido del menú se registra igual, a propósito) y los de antes de la Fase 6.
 * Antes, un turno **con terminal** leía solo los suyos, así que un cobro sin turno no entraba al arqueo de
 * nadie: la plata quedaba en el cajón y ningún cierre la explicaba. Filtrar por «sin turno» (y no por toda la
 * ventana) es lo que mantiene la propiedad de las dos cajas: la plata de la otra terminal está atribuida.
 */
async function listShiftPayments(
  window: {
    shiftId: string;
    locationId: string;
    openedAt: string;
    closedAt: string;
    /** Fase 6: la terminal del turno. `null` = turno sin terminal (el mundo de una caja por local). */
    terminalId?: string | null;
  },
  paymentRepository: PaymentRepository,
): Promise<Awaited<ReturnType<PaymentRepository["listPaymentsInRange"]>>> {
  const attributed = await paymentRepository.listPaymentsByShift(window.shiftId);
  const unattributed = await paymentRepository.listUnattributedPaymentsInRange(window.locationId, {
    from: window.openedAt,
    to: window.closedAt,
  });

  return [...attributed, ...unattributed].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Los bancos activos que liquida la sucursal. Sin repositorio no hay bancos: el cuadre se rechaza. */
async function listLocationBankIds(
  bankRepository: BankRepository | undefined,
  locationId: string,
): Promise<string[]> {
  if (!bankRepository) return [];

  const [banks, assignments] = await Promise.all([
    bankRepository.listBanks(),
    bankRepository.listAssignments(),
  ]);
  const active = new Set(banks.filter((bank) => bank.isActive).map((bank) => bank.id));

  return assignments
    .filter(
      (assignment) =>
        assignment.locationId === locationId && assignment.isActive && active.has(assignment.bankId),
    )
    .map((assignment) => assignment.bankId);
}

/** El `meta` de un cierre que no se pudo hacer (turno inexistente o ya cerrado), con la misma forma. */
function emptyCloseMeta() {
  return {
    expectedByCurrency: {},
    paymentMix: emptyShiftPaymentMix(),
    bankDeclaredByCurrency: {},
    bankChargedByCurrency: {},
    bankDifferenceByCurrency: {},
    bankDifferenceAmount: null,
  };
}

/**
 * Lo que debería haber en la caja: el fondo **contado** (o el monto con el que se abrió) más el
 * efectivo del turno convertido a la moneda del negocio, menos los vueltos que salieron, **más los
 * movimientos de caja** (retiros restan, ingresos suman) y **menos las devoluciones aprobadas en
 * efectivo** (Bloque 3: la plata que se le devolvió al cliente salió del cajón). La tarjeta se cuenta
 * aparte y no entra acá: no está en el cajón.
 */
/**
 * El arqueo de un turno para una **ventana** de tiempo, sin cerrarlo.
 *
 * Tarea 7 del brief (2026-09-17) — se exporta para el **corte X** (1.12): una lectura parcial del turno
 * abierto usa exactamente esta cuenta, así el papel del corte y el del cierre no pueden discrepar. El
 * cierre la llama con `closedAt = ahora`; el corte X, con la misma ventana.
 */
export async function calculateExpectedAmount(
  window: {
    shiftId: string;
    locationId: string;
    openedAt: string;
    closedAt: string;
    /** Fase 6 del rediseno de Caja: la terminal del turno (`null` = una sola caja por local). */
    terminalId?: string | null;
    openingAmount: number;
    openingCounts: ShiftCashCountInput[];
    businessCurrencyCode: string;
    usdExchangeRate: number | null;
  },
  paymentRepository: PaymentRepository,
  cashMovementRepository?: CashMovementRepository,
  refundRepository?: Pick<RefundRepository, "listByShift">,
): Promise<{
  expectedAmount: number;
  expectedByCurrency: Record<string, number>;
  cashSalesAmount: number;
  cashMovementsAmount: number;
  refundsAmount: number;
  /** Tarea 1.2 — el desglose por método del turno, de los **mismos** cobros que el arqueo. */
  paymentMix: ShiftPaymentMix;
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — lo que entró **sin pasar por el cajón** (tarjeta y
   * transferencia) por moneda. Es el otro lado del cuadre por banco: lo que declara el lote se compara
   * contra esto, no contra el total del día (el efectivo tiene su propio arqueo).
   */
  nonCashByCurrency: Record<string, number>;
}> {
  const payments = await listShiftPayments(window, paymentRepository);

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

  // Bloque 2: los movimientos del turno, también por moneda. Un retiro sale del cajón y un ingreso
  // entra: sin esto, sacar plata para el proveedor parecía un faltante del cajero.
  const movements = cashMovementRepository
    ? await cashMovementRepository.listByShift(window.shiftId)
    : [];
  const cashMovementsAmount = cashMovementsTotalInBusinessCurrency({
    movements,
    businessCurrencyCode: window.businessCurrencyCode,
    usdExchangeRate: window.usdExchangeRate,
  });

  // Bloque 3: las devoluciones **aprobadas en efectivo** del turno. La plata que se le devolvió al
  // cliente salió del cajón: sin esto, devolver con motivo parecía un faltante del cajero. Las
  // pendientes y las rechazadas no restan (no salieron) y las de tarjeta tampoco (no estaban acá).
  const refunds = refundRepository ? await refundRepository.listByShift(window.shiftId) : [];
  const refundsAmount = refundsTotalInBusinessCurrency({
    refunds,
    businessCurrencyCode: window.businessCurrencyCode,
    usdExchangeRate: window.usdExchangeRate,
  });
  const refundsByCurrency = refundsTotalByCurrency(refunds);

  return {
    expectedAmount: roundCurrency(
      openingAmount + cashSalesAmount + cashMovementsAmount + refundsAmount,
    ),
    // Por moneda, para que la pantalla pueda comparar lo esperado con lo contado sin convertir nada.
    // Bloque 1.1: queda congelado en el turno (antes solo viajaba en la respuesta).
    //
    // El fondo se cuenta **contado** (billetes) o, si no hay conteo, como un monto en la moneda del
    // negocio: sin esto el detalle por moneda no cerraba con el total (Bloque 2).
    expectedByCurrency: mergeCurrencyTotals(
      expectedCashByCurrency({
        openingCounts: window.openingCounts,
        openingAmount: window.openingCounts.length ? undefined : openingAmount,
        businessCurrencyCode: window.businessCurrencyCode,
        cashPayments,
        cashMovements: movements.map((movement) => ({
          kind: movement.kind,
          currency: movement.currency,
          amount: movement.amount,
        })),
      }),
      refundsByCurrency,
    ),
    cashSalesAmount,
    cashMovementsAmount,
    refundsAmount,
    // Tarea 1.2 del roadmap: el desglose por método sale de la **misma** lista de cobros que el arqueo,
    // así el mensaje de cierre y el esperado no pueden discrepar.
    paymentMix: summarizeShiftPayments({
      payments,
      businessCurrencyCode: window.businessCurrencyCode,
      usdExchangeRate: window.usdExchangeRate,
    }),
    // Fase 3: el cuadre por banco, por moneda y de la misma lista de cobros.
    nonCashByCurrency: nonCashTotalsByCurrency({
      payments,
      businessCurrencyCode: window.businessCurrencyCode,
    }),
  };
}

/** Suma dos mapas por moneda (el detalle del arqueo con las devoluciones, que ya vienen en negativo). */
function mergeCurrencyTotals(
  base: Record<string, number>,
  extra: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...base };

  for (const [currency, amount] of Object.entries(extra)) {
    merged[currency] = roundCurrency((merged[currency] ?? 0) + amount);
  }

  return merged;
}
