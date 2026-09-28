import type { OrderRecord, PaymentMethodKind, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import { sumPaymentTotals, type PaymentMetric } from "@/modules/payments/domain/payment-totals";
import {
  buildPaymentSnapshot,
  assertIdempotencyKey,
  PaymentSnapshotError,
} from "@/modules/payments/domain/payment-snapshot";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `A-72`/`D-020` — **de dónde sale el equivalente de un cobro legacy**.
 *
 * La regla es que sólo se resuelve cuando **datos persistidos existentes** lo demuestran: el snapshot de un
 * cierre que ya congeló el esperado en ambas monedas, un cobro hermano del mismo hecho, una devolución con
 * su moneda y su monto. Se resuelve **explícito y por caso**; nunca con la tasa vigente.
 *
 * Es una interfaz de **puerto**, no una regla: el único lugar por donde puede entrar esa evidencia. Si no
 * hay, el monto va a `unresolvedAmount` y el pedido no alcanza `paid`.
 */
export interface LegacyPaymentEquivalence {
  demonstratedBaseAmount(payment: PaymentMetric): number | null;
}

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **registrar el cobro de un pedido que ya existe**.
 *
 * Hasta acá el sistema solo sabía cobrar **creando** una venta de mostrador: un pedido del menú público (que
 * se paga al retirar y por eso no tiene ningún `Payment`) no podía cobrarse nunca, y sin cobros **no se
 * puede facturar**. Esto cierra ese hueco.
 *
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` le cambió cuatro cosas, y las cuatro son defectos medidos:
 *
 * 1. **`A-68`** — el tope se compara contra el **equivalente en moneda base** de cada cobro, no contra la
 *    suma cruda. Un pedido de C$365 aceptaba `US$10` como «10 pagados» y dejaba cobrar otros C$355.
 * 2. **`A-71`** — el cobro tiene **clave de idempotencia**. El reintento de un cobro **parcial** registraba
 *    la misma plata dos veces mientras la suma no alcanzara el total.
 * 3. **`A-75`** — el tope se compara contra el total **leído dentro del lock**: antes se leía el pedido
 *    fuera de la transacción y el total que devolvía el lock se descartaba.
 * 4. **`D-020`** — el cobro **congela su snapshot** (monto, moneda, moneda base, tasa y equivalente). Sin
 *    esos cinco campos el dominio no lo firma: son los que explican el hecho para siempre.
 *
 * El cobro se **atribuye al turno abierto** de la terminal desde la que se cobra (`Payment.shiftId`), así
 * entra al arqueo que corresponde; sin caja abierta se registra igual y sin turno —perder la venta sería
 * peor— y el cierre de ese día lo lee por ventana como cualquier cobro sin turno.
 */

export type RegisterOrderPaymentInput = {
  orderId: string;
  method: PaymentMethodType;
  /** Lo que se cobró (no lo que el cliente puso sobre el mostrador). */
  amount: number;
  currency: string;
  reference?: string | null;
  /** Fase 6 — la terminal del POS que cobra, para atribuir el cobro a **su** caja. */
  terminalId?: string | null;
  /** `A-71` — la clave de idempotencia del cobro. La manda el cliente; el servidor no la inventa. */
  idempotencyKey: string;
  /** `D-017` — el medio comercial configurable. Sin dato queda `null` (el cobro viejo no lo tenía). */
  paymentMethodId?: string | null;
  /** `D-017` — la entidad de cobro contra la que se liquida. `null` = no aplica. */
  entityId?: string | null;
};

/** La fila monetaria de un cobro: lo que el saldo necesita para explicar su equivalente. */
export type { PaymentMetric } from "@/modules/payments/domain/payment-totals";

export type RegisterOrderPaymentDependencies = {
  orderRepository: {
    findOrderById: (orderId: string) => Promise<OrderRecord | null>;
  };
  paymentRepository: Pick<PaymentRepository, "createPayment" | "getPaymentSummary">;
  /** El turno abierto de esa terminal (o del local, sin terminal). */
  findOpenShift?: (
    locationId: string,
    terminalId?: string | null,
  ) => Promise<{ id: string } | null>;
  /**
   * TASK-AUD-005 — el **límite atómico** de este cobro: el mismo lock de la fila del turno que piden la
   * venta del mostrador y el cierre.
   */
  runInOrderPaymentTransaction: <T>(
    work: (scope: OrderPaymentScope) => Promise<T>,
  ) => Promise<T>;
  /** La moneda base vigente **del negocio**. */
  baseCurrencyCode: string;
  /** `D-019` — la tasa por moneda, resuelta por `money` con la vigencia de **este momento**. */
  rates: Record<string, number | null | undefined>;
  /** `D-017` — el tipo canónico del medio elegido, congelado en el hecho. */
  paymentMethodKind: PaymentMethodKind;
  /** `A-72`/`D-020` — la evidencia persistida de un cobro legacy. Sin ella, su equivalente no se demuestra. */
  legacyEquivalence?: LegacyPaymentEquivalence;
};

/** El alcance del cobro: el repositorio de cobros y los locks, con el mismo cliente de base. */
export type OrderPaymentScope = {
  paymentRepository: Pick<PaymentRepository, "createPayment" | "listPaymentsByOrder">;
  /**
   * `A-71` — busca un cobro por su clave de idempotencia. Se consulta **antes** de escribir y **dentro** de
   * la transacción, así el reintento devuelve el cobro que ya existe en vez de registrar la misma plata dos
   * veces. La unicidad la garantiza la base (índice único parcial); esta lectura es la que hace que el
   * segundo request no llegue a chocar.
   */
  findPaymentByIdempotencyKey: (key: string) => Promise<PaymentRecord | null>;
  /**
   * TASK-AUD-055 — bloquea la fila del pedido y devuelve su **total bloqueado**. Es la garantía real de que
   * dos cobros simultáneos no superen el saldo pendiente, y el número contra el que se compara el tope
   * (`A-75`: antes el total que devolvía el lock se descartaba).
   */
  lockOrder: (orderId: string) => Promise<{ id: string; total: number } | null>;
  lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
};

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
): Promise<{ data: PaymentRecord; order: OrderRecord }> {
  const orderId = input.orderId?.trim();

  if (!orderId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", { orderId: "Requerido" });
  }

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

  const snapshot = resolveSnapshot(input, deps);
  const baseCurrencyCode = currencyKey(deps.baseCurrencyCode);

  const openShift = deps.findOpenShift
    ? await deps.findOpenShift(order.locationId, input.terminalId ?? null)
    : null;

  const payment = await runWithIdempotencyRecovery(
    () =>
      deps.runInOrderPaymentTransaction(async (scope) => {
        /**
         * TASK-AUD-055 — **primero el lock del pedido**, y recién después el cupo y la clave.
         *
         * `A-75`: el total contra el que se compara el tope es el que devuelve **este** lock, no el que se
         * leyó fuera de la transacción.
         *
         * `A-71`: **el orden importa y es parte de la corrección.** El chequeo de la clave va **después** del
         * lock, no antes: dos requests simultáneos con la misma clave pasaban los dos el chequeo previo
         * porque ninguno había commiteado, y el segundo terminaba chocando con el índice único. Lo encontró
         * el CI, no el doble en memoria: es una carrera real. Con el lock adelante, el segundo espera a que
         * el primero commitee y **encuentra** su cobro.
         */
        const lockedOrder = await scope.lockOrder(order.id);

        if (!lockedOrder) {
          throw new OrderError(404, "NOT_FOUND", "Ese pedido no existe.", {
            order: "Ese pedido no existe.",
          });
        }

        const replayed = await scope.findPaymentByIdempotencyKey(idempotencyKey);
        if (replayed) return replayed;

        const existing = await scope.paymentRepository.listPaymentsByOrder(order.id);
    const balance = sumPaymentTotals({
      payments: existing.map(toMetric),
      baseCurrencyCode,
      ...(deps.legacyEquivalence
        ? { demonstratedBaseAmount: (payment) => deps.legacyEquivalence!.demonstratedBaseAmount(payment as never) }
        : {}),
    });

    const orderTotal = roundCurrency(lockedOrder.total);

    if (balance.paidAmount >= orderTotal) {
      throw new OrderError(409, "CONFLICT", "Ese pedido ya está cobrado.", {
        order: "Ese pedido ya está cobrado.",
      });
    }

    if (roundCurrency(balance.paidAmount + snapshot.baseAmount) > orderTotal) {
      throw new OrderError(
        409,
        "CONFLICT",
        `El cobro pasa el total del pedido (${roundCurrency(orderTotal - balance.paidAmount).toFixed(2)} pendiente).`,
        { amount: "El cobro pasa el total del pedido: revisá el monto." },
      );
    }

    /**
     * TASK-AUD-005 — con el turno bloqueado se comprueba que **siga** abierto. Si **había** una caja y se
     * cerró en el medio, el cobro se rechaza en vez de firmarse con un turno cerrado: esa plata no entraría
     * a ningún arqueo. El cajero abre la caja de nuevo y cobra.
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

    return scope.paymentRepository.createPayment({
      orderId: order.id,
      method: input.method,
      amount: snapshot.amount,
      currency: snapshot.currency,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      exchangeRate: snapshot.exchangeRate,
      baseAmount: snapshot.baseAmount,
      methodKind: snapshot.methodKind,
      paymentMethodId: input.paymentMethodId ?? null,
      entityId: input.entityId ?? null,
      idempotencyKey,
      // El vuelto no se registra acá: el mostrador carga lo que **cobró**, no lo que el cliente puso sobre
      // el mostrador (esa cuenta es de la venta del POS, que sí pide «con cuánto paga»).
      changeAmount: 0,
      ...(input.reference ? { reference: input.reference } : {}),
      shiftId: openShift?.id ?? null,
    });
      }),
    idempotencyKey,
  );

  return { data: payment, order };
}

/**
 * `A-71` — **la red de seguridad del choque de índice único**.
 *
 * Aun con el chequeo después del lock, dos cobros **simultáneos** con la misma clave pueden llegar los dos
 * al `INSERT` (el lock serializa, pero el chequeo del segundo puede haber corrido en una transacción que
 * empezó antes del commit del primero bajo `READ COMMITTED`). Ahí el que gana es el **índice único parcial**
 * de la base, y el perdedor recibe `P2002`.
 *
 * La recuperación **no puede correr adentro de la transacción** (un `P2002` la aborta con `25P02`): se
 * devuelve el conflicto, se **rehace** la transacción desde afuera y en el intento nuevo la lectura encuentra
 * la fila antes de escribir. Es exactamente el procedimiento que fija
 * `.agents/skills/money-change/SKILL.md` § CONCURRENCIA, y el mismo que usa la venta del mostrador
 * (`TASK-AUD-004`).
 *
 * El reintento es **uno solo**: si el segundo intento también choca, algo más está mal y devolver el error es
 * más honesto que insistir. El `find` de la recuperación es la consulta por clave del adaptador raíz —no la
 * del alcance transaccional—, porque la transacción que chocó ya no existe.
 */
async function runWithIdempotencyRecovery(
  work: () => Promise<PaymentRecord>,
  idempotencyKey: string,
): Promise<PaymentRecord> {
  try {
    return await work();
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const existing = await new PrismaPaymentRepository().findPaymentByIdempotencyKey(idempotencyKey);

    if (!existing) throw error;

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

/** La clave de idempotencia, con el error de la ruta si falta: sin ella, un reintento cobra dos veces. */
export function resolveIdempotencyKey(key: string | null | undefined): string {
  try {
    return assertIdempotencyKey(key);
  } catch (error) {
    throw toOrderError(error);
  }
}

/** El snapshot del cobro nuevo, con el error de la ruta si falta alguno de los cinco campos (`D-020`). */
export function resolveSnapshot(
  input: Pick<RegisterOrderPaymentInput, "amount" | "currency">,
  deps: Pick<RegisterOrderPaymentDependencies, "baseCurrencyCode" | "rates" | "paymentMethodKind">,
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
      methodKind: deps.paymentMethodKind,
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
