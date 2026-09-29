import { OrderError } from "@/modules/orders/domain/order-errors";
import type { PaymentRecord, RefundRecord } from "@/modules/orders/domain/order.types";
import type { CreateRefundInput } from "@/modules/orders/ports/refund-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import type { MoneyContext } from "@/modules/money/domain/money-context";
import { paymentMethodKindFor } from "@/modules/payments/domain/payment-method-kind";
import { buildRefundSnapshotFor } from "@/modules/payments/domain/payment-snapshot";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — pedir una devolución sobre un cobro.
 *
 * Tres controles de plata:
 *
 * 1. **No se devuelve más de lo que se cobró.** Se suman las devoluciones del cobro **sin contar las
 *    rechazadas** (lo que no salió no consume cupo) y lo pedido no puede pasarse.
 * 2. **Parcial y total se distinguen**: una parcial no puede cubrir todo el cobro (para eso está la
 *    total) y una total tiene que cubrirlo entero. Así una devolución «total» que en realidad deja
 *    plata a favor no se puede registrar como total.
 * 3. **Nadie aprueba su propia devolución**: quien tiene el permiso la deja aprobada, pero si es la
 *    suya queda pendiente de otro par de ojos. Es la regla conservadora y la que evita el
 *    autoservicio.
 *
 * La devolución queda atada al **turno abierto** del local cuando hay uno: es lo que permite que el
 * arqueo la descuente. Sin caja abierta queda sin turno (no se rechaza: el cobro pudo ser de otro
 * momento y el motivo es lo que importa).
 */
export async function requestRefund(
  input: {
    paymentId: string;
    kind: "full" | "partial";
    amount: number;
    reason: string;
    requestedByUserId: string;
    /**
     * Tarea 9 del brief (2026-09-17) — ya **no** se usa: la devolución nace pendiente y la firma el
     * dueño en `/admin/approvals`. Se deja en el tipo, opcional, para no romper llamadores viejos.
     */
    canApprove?: boolean;
    locationId: string;
    /** `A-73` — clave de idempotencia del **pedido** de devolución. La manda el cliente. */
    idempotencyKey?: string;
  },
  {
    shiftRepository,
    runInRefundRequestTransaction,
    readMoney,
  }: {
    /**
     * Lo único que se resuelve **fuera** de la transacción: el turno abierto del local. Es una lectura que no
     * decide el cupo (el arqueo la usa para atribuir la devolución), así que no necesita el lock.
     */
    shiftRepository: Pick<ShiftRepository, "findOpenShiftByLocation">;
    /**
     * `A-73` — **el límite atómico de la devolución**: el cupo del cobro se lee y la devolución se escribe
     * dentro de una transacción que primero **bloquea la fila del cobro** (`lockPaymentRow`).
     *
     * Sin esto, «no se devuelve más de lo cobrado» era un `if` sobre una lectura: dos requests simultáneos
     * leían el mismo cupo, los dos pasaban y los dos insertaban. Con el lock, el segundo espera a que el
     * primero commitee y lee el cupo ya consumido.
     */
    runInRefundRequestTransaction: <T>(
      work: (scope: RefundRequestScope) => Promise<T>,
    ) => Promise<T>;
    /**
     * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-82`, `A-69`) — **el contexto monetario del
     * momento**, leído de `money`.
     *
     * Reemplaza al `businessCurrencyCode` suelto que había antes: además de resolver el `null` de
     * `Payment.currency` sin escribir un `"NIO"`, trae la moneda base vigente y **las tasas**, que es lo que
     * la devolución necesita para congelar su equivalente. Sin esa tasa, una columna nueva quedaba
     * permanentemente `null` en el camino productivo.
     */
    readMoney: () => Promise<MoneyContext>;
  },
) {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new OrderError(422, "VALIDATION_ERROR", "Escribí por qué devolvés la plata.", {
      reason: "El motivo es obligatorio.",
    });
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "El monto tiene que ser mayor que cero.", {
      amount: "El monto tiene que ser mayor que cero.",
    });
  }

  const paymentId = input.paymentId?.trim();
  if (!paymentId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Falta el cobro a devolver.", {
      payment: "Falta el cobro a devolver.",
    });
  }

  const idempotencyKey = input.idempotencyKey?.trim() || null;
  const openShift = await shiftRepository.findOpenShiftByLocation(input.locationId);

  const refund = await runInRefundRequestTransaction(async (scope) => {
    /**
     * `A-73` — **el reintento devuelve la devolución que ya existe**, con la misma clave, sin volver a
     * consumir el cupo. Es la mitad secuencial de la idempotencia; la simultánea la garantiza el índice
     * único parcial de la base.
     */
    if (idempotencyKey) {
      const replayed = await scope.findRefundByIdempotencyKey(idempotencyKey);
      if (replayed) return replayed;
    }

    /** Primero el lock: leer el cupo y después escribir sin bloquear la fila es una carrera. */
    const locked = await scope.lockPayment(paymentId);
    if (!locked) {
      throw new OrderError(404, "NOT_FOUND", "No encontramos ese cobro.");
    }

    const payment = await scope.findPaymentById(paymentId);
    if (!payment) {
      throw new OrderError(404, "NOT_FOUND", "No encontramos ese cobro.");
    }

    /**
     * TASK-AUD-059 — un cobro **anulado** no existe para la plata: no se le pide una devolución.
     *
     * Anular ya sacó el cobro del arqueo; devolverlo además restaría dos veces. Para corregir un cobro mal
     * cargado con una devolución encima, primero se rechaza la devolución y después se anula el cobro.
     */
    if (payment.voidedAt !== null) {
      throw new OrderError(409, "CONFLICT", "Ese cobro está anulado: no hay nada que devolver.", {
        payment: "Ese cobro está anulado.",
      });
    }

    const existing = await scope.listRefundsByPayment(payment.id);
    const alreadyRefunded = roundCurrency(
      existing
        .filter((refund) => refund.status !== "rejected")
        .reduce((sum, refund) => sum + refund.amount, 0),
    );
    const remaining = roundCurrency(payment.amount - alreadyRefunded);

    if (input.amount > remaining) {
      throw new OrderError(
        422,
        "VALIDATION_ERROR",
        `Ese cobro tiene ${remaining} disponible para devolver.`,
        { amount: `No podés devolver más de ${remaining}.` },
      );
    }

    if (input.kind === "partial" && input.amount >= payment.amount) {
      throw new OrderError(422, "VALIDATION_ERROR", "Una devolución parcial no cubre todo el cobro.", {
        amount: "Para devolver todo, usá «total».",
      });
    }

    if (input.kind === "full" && input.amount !== remaining) {
      throw new OrderError(
        422,
        "VALIDATION_ERROR",
        "La devolución total tiene que cubrir lo que queda del cobro.",
        { amount: `Quedan ${remaining} por devolver.` },
      );
    }

    /**
     * Tarea 9 del brief (2026-09-17) — la devolución nace **siempre pendiente**.
     *
     * Antes, quien tenía el permiso de devolver la dejaba aprobada de una; el owner decidió que solo él
     * firma («nadie la propia»), así que pedir y aprobar son dos actos distintos y separados en el tiempo:
     * el que pide deja el motivo y el dueño resuelve en `/admin/approvals`.
     */
    /**
     * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-82`, `D-020`) — **el snapshot de la devolución**,
     * construido con la moneda base vigente y **su** tasa.
     *
     * El contexto se lee acá adentro, con el cobro ya bloqueado: la tasa que se congela es la que rige en el
     * momento de la devolución, y leerla antes de la transacción dejaría una ventana en la que un cambio de
     * tasa produciría un equivalente que nunca existió.
     *
     * El tipo canónico lo hereda del cobro: la plata sale por el mismo medio por el que entró.
     */
    const money = await readMoney();
    const currency = (payment.currency ?? money.baseCurrencyCode).toUpperCase();
    const snapshot = buildRefundSnapshotFor(
      {
        amount: roundCurrency(input.amount),
        currency,
        methodKind: payment.methodKind ?? paymentMethodKindFor(payment.method),
      },
      money,
    );

    return scope.createRefund({
      paymentId: payment.id,
      orderId: payment.orderId,
      shiftId: openShift?.id ?? null,
      kind: input.kind,
      method: payment.method,
      amount: snapshot.amount,
      /**
       * `A-69` — un cobro viejo sin moneda declarada se devuelve en **la moneda base vigente**, que es lo
       * que el arqueo asume. La resolución del `null` la hace `money`; acá entra como dato, sin un `"NIO"`
       * escrito en el camino del dinero.
       */
      currency: snapshot.currency,
      reason,
      status: "pending",
      requestedByUserId: input.requestedByUserId,
      approvedByUserId: null,
      approvedAt: null,
      idempotencyKey,
      /** `A-82` — el snapshot congelado, con la misma ley que el cobro. */
      baseCurrencyCode: snapshot.baseCurrencyCode,
      exchangeRate: snapshot.exchangeRate,
      baseAmount: snapshot.baseAmount,
    });
  });

  return { data: refund };
}

/** El alcance transaccional de la devolución: el cobro bloqueado y la creación, con el mismo cliente. */
export type RefundRequestScope = {
  findPaymentById: (id: string) => Promise<PaymentRecord | null>;
  listRefundsByPayment: (paymentId: string) => Promise<RefundRecord[]>;
  createRefund: (input: CreateRefundInput) => Promise<RefundRecord>;
  findRefundByIdempotencyKey: (key: string) => Promise<RefundRecord | null>;
  lockPayment: (paymentId: string) => Promise<{ id: string } | null>;
};
