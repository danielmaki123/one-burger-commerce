import type { OrderRecord, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **registrar el cobro de un pedido que ya existe**.
 *
 * Hasta acá el sistema solo sabía cobrar **creando** una venta de mostrador: un pedido del menú público (que
 * se paga al retirar y por eso no tiene ningún `Payment`) no podía cobrarse nunca, y sin cobros **no se
 * puede facturar** (`emit-invoice` corta con 409). Esto cierra ese hueco: se registra el cobro sobre el
 * pedido y recién ahí la factura se puede emitir.
 *
 * Tres guardas, que son las que evitan los errores caros del mostrador:
 *
 * 1. **Un pedido cancelado no se cobra** (no hay nada que entregar).
 * 2. **Un pedido ya cobrado no se cobra dos veces** (la plata entraría dos veces al arqueo).
 * 3. **Un cobro que pasa el total se rechaza**: cobrar de más es un error de tipeo, no una propina.
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
};

export type RegisterOrderPaymentDependencies = {
  orderRepository: Pick<OrderRepository, "findOrderById">;
  paymentRepository: Pick<
    PaymentRepository,
    "listPaymentsByOrder" | "createPayment" | "getPaymentSummary"
  >;
  /** El turno abierto de esa terminal (o del local, sin terminal). */
  findOpenShift?: (
    locationId: string,
    terminalId?: string | null,
  ) => Promise<{ id: string } | null>;
  /**
   * TASK-AUD-005 — el **límite atómico** de este cobro: el mismo lock de la fila del turno que piden la
   * venta del mostrador y el cierre. Es el **segundo** camino que le firma el turno a un `Payment`; sin
   * esto, un cobro que entra justo cuando la caja se cierra quedaba firmado por un turno cerrado y su plata
   * fuera de todo arqueo (el corte X del turno siguiente tampoco lo lee: solo ve los cobros atribuidos).
   */
  runInOrderPaymentTransaction: <T>(
    work: (scope: OrderPaymentScope) => Promise<T>,
  ) => Promise<T>;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
};

/** El alcance del cobro: el repositorio de cobros y el lock del turno, con el mismo cliente de base. */
export type OrderPaymentScope = {
  paymentRepository: Pick<PaymentRepository, "createPayment">;
  lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
};

export async function registerOrderPayment(
  input: RegisterOrderPaymentInput,
  deps: RegisterOrderPaymentDependencies,
): Promise<{ data: PaymentRecord; order: OrderRecord }> {
  const orderId = input.orderId?.trim();
  if (!orderId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", { orderId: "Requerido" });
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
      amount: "Tiene que ser mayor que cero.",
    });
  }

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

  const summary = await deps.paymentRepository.getPaymentSummary(order.id);
  const alreadyPaid = roundCurrency(summary.totalAmount);

  if (alreadyPaid >= order.total) {
    throw new OrderError(409, "CONFLICT", "Ese pedido ya está cobrado.", {
      order: "Ese pedido ya está cobrado.",
    });
  }

  const amount = roundCurrency(input.amount);

  if (roundCurrency(alreadyPaid + amount) > order.total) {
    throw new OrderError(
      409,
      "CONFLICT",
      `El cobro pasa el total del pedido (${(order.total - alreadyPaid).toFixed(2)} pendiente).`,
      { amount: "El cobro pasa el total del pedido: revisá el monto." },
    );
  }

  const openShift = deps.findOpenShift
    ? await deps.findOpenShift(order.locationId, input.terminalId ?? null)
    : null;

  const payment = await deps.runInOrderPaymentTransaction(async (scope) => {
    /**
     * TASK-AUD-005 — con el turno bloqueado se comprueba que **siga** abierto. El cobro de un pedido que ya
     * existe no es la venta del mostrador: si no hay caja abierta se registra igual y sin turno (perder la
     * venta sería peor). Pero si **había** una caja y se cerró en el medio, el cobro se rechaza en vez de
     * firmarse con un turno cerrado: esa plata no entraría a ningún arqueo y el documento firmado no la
     * explicaría. El cajero abre la caja de nuevo y cobra.
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
      amount,
      currency: input.currency.trim().toUpperCase(),
      // El vuelto no se registra acá: el mostrador carga lo que **cobró**, no lo que el cliente puso sobre
      // el mostrador (esa cuenta es de la venta del POS, que sí pide «con cuánto paga»).
      changeAmount: 0,
      ...(input.reference ? { reference: input.reference } : {}),
      shiftId: openShift?.id ?? null,
    });
  });

  return { data: payment, order };
}
