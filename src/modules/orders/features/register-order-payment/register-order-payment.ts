import type {
  OrderRecord,
  PaymentMethodKind,
  PaymentMethodType,
  PaymentRecord,
} from "@/modules/orders/domain/order.types";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import { sumPaymentTotals, type PaymentMetric } from "@/modules/payments/domain/payment-totals";
import {
  validateExactSettlement,
  type ExactSettlementFailureReason,
} from "@/modules/payments/domain/order-settlement";
import {
  buildPaymentSnapshot,
  assertIdempotencyKey,
  PaymentSnapshotError,
  type PaymentSnapshot,
} from "@/modules/payments/domain/payment-snapshot";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §26–§31, §34) — **el cobro de un pedido que ya existe**, como
 * **liquidación comercial completa**.
 *
 * El caso de uso nació en el hallazgo N3 (2026-09-23) con el shape mínimo que necesitaba la **factura**: un
 * `Payment` por request. Ese shape servía para «cobrar la deuda» pero no para el **mostrador**, que necesita
 * partir el cobro entre medios y liquidar el saldo entero en una sola operación. Esta TASK lo adapta; la ruta
 * sigue siendo **la única** (`POST /api/admin/orders/[id]/payment`): no nace un segundo flujo financiero
 * (brief §26).
 *
 * Cuatro reglas, y las cuatro son la razón de que esto sea un caso de uso propio:
 *
 * 1. **Una llamada = una liquidación.** El payload trae la lista de medios y `Σ equivalente == saldo`. Ni
 *    menos —**no existe el abono comercial**: el POS no ofrece «cobrá C$300 y dejá C$700»— ni más —el
 *    sobrecobro de un cobro partido (`A-93`) se rechaza antes de escribir—. La igualdad la decide
 *    `validateExactSettlement`, que es su dueño.
 * 2. **Todo o nada, en una transacción.** `lockOrder` → leer el saldo canónico dentro del lock → liquidar →
 *    construir todos los snapshots → `lockShift` → insertar **N** `Payment` → `COMMIT`. Si cualquiera falla,
 *    `ROLLBACK` completo: **cero** cobros parciales por fallo técnico intermedio (brief §29).
 * 3. **La idempotencia es de la liquidación**, no de cada fila (brief §51). El cliente manda **una** clave y
 *    cada `Payment` conserva la suya derivada (`<clave>:<índice>`), que es lo que la base garantiza con su
 *    índice único parcial. Un reintento devuelve el hecho que ya existe.
 * 4. **Sin caja abierta no se cobra** (brief §36). Se exige el mismo turno que protege la venta rápida y se
 *    comprueba **dentro de la transacción** que siga abierto: un cobro firmado por un turno cerrado no
 *    entraría a ningún arqueo.
 *
 * `unresolvedAmount > 0` **bloquea** el cobro normal (brief §32): si hay plata cuyo equivalente no se puede
 * demostrar, primero hay que resolver esa equivalencia con datos persistidos (`D-020`) y eso no es cobrar.
 */

export type RegisterOrderPaymentLineInput = {
  /** El medio comercial configurado que el cajero eligió. Es **el** dato que identifica la selección. */
  paymentMethodId?: string | null;
  /** El enum histórico, cuando el cobro no nombra un medio del catálogo. */
  method: PaymentMethodType;
  /** Lo que se cobró (no lo que el cliente puso sobre el mostrador). */
  amount: number;
  currency: string;
  reference?: string | null;
  /** `D-017` — la entidad de cobro, resuelta por el servidor contra el catálogo. */
  entityId?: string | null;
  /** `D-017` — el tipo canónico, resuelto por el servidor. */
  methodKind?: PaymentMethodKind;
  /**
   * `A-85` — el medio configurado **ya resuelto y validado** contra el catálogo del local.
   *
   * Entra por acá y no se resuelve adentro porque la lectura del catálogo y la del contexto monetario son
   * de la **composición** (borde), no del caso de uso: el dominio no toca Prisma. Cuando no viene, el cobro
   * se firma con el enum histórico y el `methodKind` que resolvió el borde.
   */
  configuredMethod?: { id: string; entityId: string | null; methodKind: PaymentMethodKind } | null;
};

export type RegisterOrderPaymentInput = {
  orderId: string;
  /** Los medios de **esta** liquidación. Uno solo es el caso de «cobrar todo con un medio». */
  payments: RegisterOrderPaymentLineInput[];
  /** Fase 6 — la terminal del POS que cobra, para atribuir el cobro a **su** caja. */
  terminalId?: string | null;
  /** `A-71` — la clave de idempotencia de **la liquidación**. La manda el cliente; el servidor no la inventa. */
  idempotencyKey: string;
};

/** Las dependencias: el borde inyecta repositorios, el contexto monetario y el límite atómico. */
export type RegisterOrderPaymentDependencies = {
  orderRepository: {
    findOrderById: (orderId: string) => Promise<OrderRecord | null>;
  };
  paymentRepository: Pick<PaymentRepository, "createPayment">;
  /** El turno abierto de esa terminal (o del local, sin terminal). Obligatorio para cobrar (brief §36). */
  findOpenShift?: (
    locationId: string,
    terminalId?: string | null,
  ) => Promise<{ id: string } | null>;
  /**
   * El **límite atómico** del cobro: el mismo lock de la fila del pedido y del turno que piden la venta del
   * mostrador y el cierre.
   */
  runInOrderPaymentTransaction: <T>(
    work: (scope: OrderPaymentScope) => Promise<T>,
  ) => Promise<T>;
  /** La moneda base vigente **del negocio**, resuelta por `money`. */
  baseCurrencyCode: string;
  /** `D-019` — la tasa por moneda, resuelta por `money` con la vigencia de **este momento**. */
  rates: Record<string, number | null | undefined>;
  /** El `methodKind` del cobro que **no** nombra un medio del catálogo. */
  paymentMethodKind: PaymentMethodKind;
};

/** El alcance del cobro: el repositorio de cobros y los locks, con el mismo cliente de base. */
export type OrderPaymentScope = {
  paymentRepository: Pick<PaymentRepository, "createPayment" | "listPaymentsByOrder">;
  /** `A-71` — los cobros de una liquidación, por la clave base. Se consulta dentro de la transacción. */
  findSettlementPayments: (idempotencyKey: string) => Promise<PaymentRecord[]>;
  /** Bloquea la fila del pedido y devuelve su **total bloqueado** (la garantía real contra la carrera). */
  lockOrder: (orderId: string) => Promise<{ id: string; total: number } | null>;
  lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
};

/**
 * Cómo se compone la clave de cada `Payment` de una liquidación: `<clave base>:<índice>`.
 *
 * La clave de idempotencia de la liquidación es **una sola**, la que manda el cliente; el sufijo es lo que
 * permite que los N cobros de la misma liquidación convivan sin chocar con el índice único parcial de la
 * base. Se exporta porque el test de PostgreSQL tiene que poder buscar el hecho que ya existe sin
 * reimplementar el formato.
 */
export function settlementPaymentKey(idempotencyKey: string, index: number): string {
  return `${idempotencyKey}:${index}`;
}

function toMetric(payment: PaymentRecord): PaymentMetric {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    baseCurrencyCode: payment.baseCurrencyCode ?? null,
    baseAmount: payment.baseAmount ?? null,
    method: payment.method,
    voidedAt: payment.voidedAt,
  };
}

export async function registerOrderPayment(
  input: RegisterOrderPaymentInput,
  deps: RegisterOrderPaymentDependencies,
): Promise<{ data: PaymentRecord[]; order: OrderRecord; appliedAmount: number }> {
  const orderId = input.orderId?.trim();

  if (!orderId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", { orderId: "Requerido" });
  }

  assertSettlementHasLines(input.payments);

  const idempotencyKey = resolveIdempotencyKey(input.idempotencyKey);

  const order = await deps.orderRepository.findOrderById(orderId);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Ese pedido no existe.", {
      order: "Ese pedido no existe.",
    });
  }

  if (order.status === "cancelled") {
    throw new OrderError(409, "CONFLICT", "Un pedido cancelado no se cobra.", {
      order: "Un pedido cancelado no se cobra.",
    });
  }

  /**
   * Los snapshots se construyen **antes** de la transacción, con las otras validaciones: la autoridad
   * monetaria se lee una vez, una moneda sin tasa vigente rechaza con **su** error, y el número que se
   * valida contra el saldo es exactamente el que se persiste.
   */
  const snapshots = input.payments.map((payment) => resolveLineSnapshot(payment, deps));

  const openShift = deps.findOpenShift
    ? await deps.findOpenShift(order.locationId, input.terminalId ?? null)
    : null;

  // Bloque 9.2 (brief §36) — sin caja abierta no se cobra: el cobro no tendría arqueo que lo explique.
  if (deps.findOpenShift && !openShift) {
    throw new OrderError(409, "CONFLICT", "Abrí la caja antes de cobrar.", {
      shift: "No hay una caja abierta en este local.",
    });
  }

  const baseCurrencyCode = currencyKey(deps.baseCurrencyCode);

  const settlement = await runWithIdempotencyRecovery(
    () =>
      deps.runInOrderPaymentTransaction(async (scope) => {
        /**
         * **Primero el lock del pedido.** El saldo se lee **dentro** del lock: leer fuera y escribir después
         * no es una protección, es una carrera con apariencia de control.
         */
        const lockedOrder = await scope.lockOrder(order.id);

        if (!lockedOrder) {
          throw new OrderError(404, "NOT_FOUND", "Ese pedido no existe.", {
            order: "Ese pedido no existe.",
          });
        }

        // `A-71` — el chequeo de la clave va **después** del lock: dos requests simultáneos con la misma
        // clave pasarían los dos un chequeo previo, porque ninguno commiteó.
        const replayed = await scope.findSettlementPayments(idempotencyKey);
        if (replayed.length > 0) return replayed;

        const existing = await scope.paymentRepository.listPaymentsByOrder(order.id);
        const balance = sumPaymentTotals({
          payments: existing.map(toMetric),
          baseCurrencyCode,
        });

        const orderTotal = roundCurrency(lockedOrder.total);
        const outstanding = roundCurrency(Math.max(0, orderTotal - balance.paidAmount));

        /**
         * `unresolvedAmount > 0` **saca al pedido del flujo normal** (brief §32): hay plata cobrada cuyo
         * equivalente no se puede demostrar, y resolverlo es decidir —no cobrar—. Se rechaza explícitamente
         * en vez de dejar que la igualdad falle por un número que nadie entiende.
         */
        if (balance.unresolvedAmount > 0) {
          throw new OrderError(
            409,
            "CONFLICT",
            `Este pedido tiene ${roundCurrency(balance.unresolvedAmount).toFixed(2)} sin equivalente demostrable: hay que revisarlo antes de cobrar.`,
            { order: "El pedido tiene plata sin equivalente demostrable: revisalo antes de cobrar." },
          );
        }

        const settlementResult = validateExactSettlement({
          outstandingAmount: outstanding,
          payments: snapshots.map((snapshot) => ({ baseAmount: snapshot.baseAmount })),
        });

        if (!settlementResult.ok) {
          throw settlementError(settlementResult.reason, {
            outstanding,
            appliedAmount: settlementResult.appliedAmount,
            difference: settlementResult.difference,
          });
        }

        /**
         * Con el turno bloqueado se comprueba que **siga** abierto. Si **había** una caja y se cerró en el
         * medio, el cobro se rechaza en vez de firmarse con un turno cerrado: esa plata no entraría a ningún
         * arqueo.
         */
        if (openShift) {
          const locked = await scope.lockShift(openShift.id);

          if (!locked || locked.status !== "open") {
            throw new OrderError(
              409,
              "CONFLICT",
              "La caja se cerró mientras cobrabas: abrí la caja y volvé a cobrar.",
              { shift: "La caja de este local se cerró." },
            );
          }
        }

        /**
         * Los **N** cobros, dentro de la misma transacción. Un fallo en cualquiera revierte los anteriores:
         * no quedan `Payment` parciales de una liquidación que no se completó (brief §29).
         */
        const created: PaymentRecord[] = [];

        for (const [index, snapshot] of snapshots.entries()) {
          const line = input.payments[index];

          created.push(
            await scope.paymentRepository.createPayment({
              orderId: order.id,
              method: line.method,
              amount: snapshot.amount,
              currency: snapshot.currency,
              baseCurrencyCode: snapshot.baseCurrencyCode,
              exchangeRate: snapshot.exchangeRate,
              baseAmount: snapshot.baseAmount,
              methodKind: snapshot.methodKind,
              paymentMethodId: snapshot.paymentMethodId ?? null,
              entityId: snapshot.entityId ?? null,
              idempotencyKey: settlementPaymentKey(idempotencyKey, index),
              // El vuelto no se registra acá: el mostrador carga lo que **cobró**, no lo que el cliente puso
              // sobre el mostrador (esa cuenta es de la venta del POS, que sí pide «con cuánto paga»).
              changeAmount: 0,
              ...(line.reference ? { reference: line.reference } : {}),
              shiftId: openShift?.id ?? null,
            }),
          );
        }

        return created;
      }),
    idempotencyKey,
  );

  return {
    data: settlement,
    order,
    appliedAmount: roundCurrency(
      settlement.reduce((sum, payment) => sum + (payment.baseAmount ?? 0), 0),
    ),
  };
}

/** Al menos un medio: una liquidación vacía no liquida nada. */
function assertSettlementHasLines(payments: readonly RegisterOrderPaymentLineInput[]): void {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
      payments: "Registrá al menos un medio de pago.",
    });
  }
}

/**
 * El snapshot de una línea: el medio configurado manda si vino resuelto, y si no se traduce el enum
 * histórico. En los dos casos el `baseAmount` lo produce `buildPaymentSnapshot`, una sola vez.
 */
function resolveLineSnapshot(
  line: RegisterOrderPaymentLineInput,
  deps: Pick<RegisterOrderPaymentDependencies, "baseCurrencyCode" | "rates" | "paymentMethodKind">,
): PaymentSnapshot {
  const identity = line.configuredMethod
    ? {
        methodKind: line.configuredMethod.methodKind,
        paymentMethodId: line.configuredMethod.id,
        entityId: line.configuredMethod.entityId,
      }
    : {
        methodKind: line.methodKind ?? deps.paymentMethodKind,
        ...(line.paymentMethodId ? { paymentMethodId: line.paymentMethodId } : {}),
        ...(line.entityId !== undefined ? { entityId: line.entityId } : {}),
      };

  return resolveSnapshot({ amount: line.amount, currency: line.currency }, { ...deps, ...identity });
}

/**
 * El error de una liquidación que no cierra, con **cuánto** falta o sobra.
 *
 * El mensaje importa: «faltan C$500» deja al cajero corregir el monto, «monto inválido» no. El código es
 * 409 —no 422— porque el problema es el estado del pedido contra lo que se está cobrando, no la forma del
 * payload.
 */
function settlementError(
  reason: ExactSettlementFailureReason,
  context: { outstanding: number; appliedAmount: number; difference: number },
): OrderError {
  const outstanding = context.outstanding.toFixed(2);
  const difference = context.difference.toFixed(2);

  switch (reason) {
    case "nothing-outstanding":
      return new OrderError(409, "CONFLICT", "Ese pedido ya está cobrado.", {
        order: "Ese pedido ya está cobrado.",
      });
    case "no-payments":
      return new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
        payments: "Registrá al menos un medio de pago.",
      });
    case "underpayment":
      return new OrderError(
        409,
        "CONFLICT",
        `La liquidación no cubre el saldo: faltan ${difference} de ${outstanding}.`,
        { amount: `Faltan ${difference} para cubrir el saldo de ${outstanding}.` },
      );
    default:
      return new OrderError(
        409,
        "CONFLICT",
        `La liquidación pasa el saldo por ${difference}: el saldo es ${outstanding} y se aplicaron ${context.appliedAmount.toFixed(2)}.`,
        { amount: `El cobro pasa el saldo del pedido por ${difference}.` },
      );
  }
}

/**
 * `A-71` — **la red de seguridad del choque de índice único**.
 *
 * Aun con el chequeo después del lock, dos liquidaciones **simultáneas** con la misma clave pueden llegar
 * las dos al `INSERT` (el lock serializa, pero el chequeo del segundo puede haber corrido en una
 * transacción que empezó antes del commit del primero bajo `READ COMMITTED`). Ahí el que gana es el índice
 * único parcial de la base y el perdedor recibe `P2002`.
 *
 * La recuperación **no puede correr adentro de la transacción** (un `P2002` la aborta con `25P02`): se
 * devuelve el conflicto, se **rehace** la transacción desde afuera y en el intento nuevo la lectura
 * encuentra las filas antes de escribir. El reintento es **uno solo**: si el segundo intento también choca,
 * algo más está mal y devolver el error es más honesto que insistir.
 */
async function runWithIdempotencyRecovery(
  work: () => Promise<PaymentRecord[]>,
  idempotencyKey: string,
): Promise<PaymentRecord[]> {
  try {
    return await work();
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const existing = await new PrismaPaymentRepository().listPaymentsBySettlementKey(idempotencyKey);

    if (existing.length === 0) throw error;

    return existing;
  }
}

/**
 * ¿Es el choque con el índice único de la clave? Se reconoce por el `code` de Prisma **y** por el nombre del
 * índice: un choque por otra restricción tiene que seguir subiendo como error, no devolver un cobro ajeno.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { target?: unknown } } | null;

  if (candidate?.code !== "P2002") return false;

  const target = candidate.meta?.target;

  return Array.isArray(target) && target.includes("idempotencyKey");
}

/** La clave de la liquidación, con el error de la ruta si falta: sin ella, un reintento cobra dos veces. */
export function resolveIdempotencyKey(key: string | null | undefined): string {
  try {
    return assertIdempotencyKey(key);
  } catch (error) {
    throw toOrderError(error);
  }
}

/** El snapshot inline de una línea, con el error de la ruta si falta alguno de los cinco campos (`D-020`). */
export function resolveSnapshot(
  input: { amount: number; currency: string },
  deps: Pick<RegisterOrderPaymentDependencies, "baseCurrencyCode" | "rates" | "paymentMethodKind"> & {
    methodKind?: PaymentMethodKind;
    paymentMethodId?: string | null;
    entityId?: string | null;
  },
) {
  const currency = currencyKey(input.currency ?? "");
  const baseCurrencyCode = currencyKey(deps.baseCurrencyCode ?? "");
  /**
   * Un cobro **en la moneda base** no necesita una tasa configurada: la tasa es 1, porque no hay nada que
   * convertir. Pedirle una fila de `ExchangeRate` al par `NIO → NIO` sería inventar un dato para una
   * identidad.
   */
  const exchangeRate =
    currency === baseCurrencyCode ? 1 : (deps.rates[currency] ?? Number.NaN);

  try {
    return buildPaymentSnapshot({
      amount: input.amount,
      currency,
      baseCurrencyCode,
      exchangeRate,
      methodKind: deps.methodKind ?? deps.paymentMethodKind,
      ...(deps.paymentMethodId ? { paymentMethodId: deps.paymentMethodId } : {}),
      ...(deps.entityId !== undefined ? { entityId: deps.entityId } : {}),
    });
  } catch (error) {
    if (error instanceof PaymentSnapshotError) {
      // `missing-rate` es un 409 —no una validación del payload— porque se arregla registrando la tasa, no
      // corrigiendo el formulario. El resto son datos del cobro.
      if (error.field === "exchangeRate") {
        throw new OrderError(409, "CONFLICT", error.message, { currency: error.message });
      }

      throw new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", { [error.field]: error.message });
    }

    throw error;
  }
}

function toOrderError(error: unknown): OrderError {
  if (error instanceof PaymentSnapshotError) {
    return new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", { [error.field]: error.message });
  }

  return error instanceof OrderError
    ? error
    : new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {});
}
