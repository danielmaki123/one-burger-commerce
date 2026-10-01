import { z } from "zod";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { canCollectPayment } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { lockOrderRow, PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { lockShiftRow, PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import {
  registerOrderPayment,
  settlementPaymentKey,
  type OrderPaymentScope,
  type RegisterOrderPaymentLineInput,
} from "@/modules/orders/features/register-order-payment/register-order-payment";
import {
  paymentMethodUnavailability,
  resolveConfiguredPaymentMethod,
  type PaymentMethodConfigRecord,
} from "@/modules/payments/domain/payment-method-availability";
import { paymentMethodKindFor } from "@/modules/payments/domain/payment-method-kind";
import { createProductionConfiguredPaymentMethods } from "@/modules/pos/adapters/production-configured-payment-methods";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §26–§28, §37–§39) — la puerta y el payload de **cobrar un pedido
 * que ya existe**.
 *
 * La ruta sigue siendo **la única** (`POST /api/admin/orders/[id]/payment`): un endpoint paralelo
 * (`/api/admin/pos/pay-order` y equivalentes) está prohibido por el brief §26 y sería un segundo flujo
 * financiero para la misma operación.
 *
 * Cuatro guardas antes de tocar la plata:
 *
 * 1. **Puede cobrar quien tiene la capacidad de cobrar** — `canCollectPayment`, que es nominal y deja a
 *    cocina afuera.
 * 2. **El pedido tiene que estar en el alcance de la sesión**: se le pasa al guardián del POS el local del
 *    pedido, así un cajero de otra sucursal no puede cobrar un pedido que no ve.
 * 3. **Cada medio se resuelve contra el catálogo del local** (`A-85`, brief §38): el payload trae el
 *    `paymentMethodId` que el cajero eligió y el **servidor** decide el tipo canónico, la entidad y si pide
 *    referencia. Un `kind` o un `entityId` mandado por React **no** se usa: el schema ni los acepta.
 * 4. **El cobro viaja como una liquidación** —varios medios, una sola clave de idempotencia (`A-71`)— y
 *    congela el snapshot de cada uno (`D-020`).
 */

const paymentLineSchema = z.object({
  /**
   * `D-017`/`A-85` — el medio comercial configurado que el cajero eligió. Es el dato que el servidor
   * resuelve; los demás campos del medio **no** se aceptan del cliente.
   */
  paymentMethodId: z.string().trim().min(1, "Elegí el medio de pago."),
  method: z.enum(["cash", "card", "transfer", "other"], {
    message: "Elegí el medio de pago.",
  }),
  amount: z.number().positive("Tiene que ser mayor que cero."),
  currency: z.string().trim().min(1, "Falta la moneda").max(12, "Ese código de moneda es muy largo"),
  reference: z.string().trim().max(80).nullable().optional(),
});

const paymentSchema = z.object({
  /**
   * Los medios de **esta** liquidación. Uno solo es el caso de «cobrar todo con un medio»; varios son el
   * cobro partido. La suma tiene que liquidar el saldo exacto (brief §31).
   */
  payments: z.array(paymentLineSchema).min(1, "Registrá al menos un medio de pago.").max(10),
  /** Fase 6 — la terminal del POS que cobra (para atribuir el cobro a su caja). */
  terminalId: z.string().trim().min(1).nullable().optional(),
  /**
   * `A-71` — **la clave de idempotencia de la liquidación**. La manda la pantalla: el servidor no la
   * inventa, porque una clave inventada por el servidor no deduplica nada.
   */
  idempotencyKey: z
    .string()
    .trim()
    .min(1, "Falta la clave de idempotencia del cobro.")
    .max(80, "La clave de idempotencia es muy larga."),
});

export type ParsedOrderPaymentPayload = {
  payments: Array<{
    paymentMethodId: string;
    method: "cash" | "card" | "transfer" | "other";
    amount: number;
    currency: string;
    reference: string | null;
  }>;
  terminalId: string | null;
  idempotencyKey: string;
};

export function parseOrderPaymentPayload(body: unknown): ParsedOrderPaymentPayload {
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    throw new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  return {
    payments: parsed.data.payments.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency.toUpperCase(),
      reference: payment.reference ?? null,
    })),
    terminalId: parsed.data.terminalId ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  };
}

/**
 * `A-85` (brief §38, §39) — **cada medio del payload, resuelto por el servidor contra el catálogo del local**.
 *
 * El payload trae sólo el `paymentMethodId`; el **tipo canónico**, la **entidad** y si **pide referencia**
 * salen de acá. Un medio apagado, fuera de la sucursal, de otra moneda o inexistente **rechaza la
 * liquidación entera** antes de escribir: cobrar igual con un medio que el negocio no ofrece sería peor que
 * no cobrar.
 *
 * La referencia requerida también se valida acá y no en React (brief §39): la UI decide **mostrar** el
 * campo, el servidor decide **exigirlo**.
 */
export function resolveConfiguredPaymentLines(input: {
  payments: ParsedOrderPaymentPayload["payments"];
  locationId: string;
  catalog: readonly PaymentMethodConfigRecord[];
}): RegisterOrderPaymentLineInput[] {
  return input.payments.map((payment) => {
    const method = input.catalog.find((candidate) => candidate.id === payment.paymentMethodId);

    if (!method) {
      throw new OrderError(422, "VALIDATION_ERROR", "Ese medio de pago no existe en el catálogo.", {
        paymentMethodId: "Ese medio de pago no existe en el catálogo.",
      });
    }

    const resolved = resolveConfiguredPaymentMethod(
      { paymentMethodId: payment.paymentMethodId, currency: payment.currency, locationId: input.locationId },
      input.catalog,
    );

    if (!resolved) {
      const message = unavailabilityMessage(
        paymentMethodUnavailability(method, { currency: payment.currency, locationId: input.locationId }),
      );

      throw new OrderError(422, "VALIDATION_ERROR", `${method.name}: ${message}`, {
        paymentMethodId: message,
      });
    }

    if (resolved.requiresReference && !payment.reference?.trim()) {
      throw new OrderError(
        422,
        "VALIDATION_ERROR",
        `${resolved.name}: escribí la referencia del cobro.`,
        { reference: `${resolved.name} necesita una referencia.` },
      );
    }

    return {
      paymentMethodId: resolved.id,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      configuredMethod: {
        id: resolved.id,
        entityId: resolved.entityId,
        methodKind: paymentMethodKindFor(payment.method),
      },
    };
  });
}

/** El texto de cada motivo, en un solo lugar. `null` es el caso del identificador que no existe. */
function unavailabilityMessage(
  reason: "inactive" | "not-offered-here" | "currency-not-admitted" | null,
): string {
  switch (reason) {
    case "inactive":
      return "ese medio está apagado en Finanzas.";
    case "not-offered-here":
      return "ese medio no se ofrece en esta sucursal.";
    case "currency-not-admitted":
      return "ese medio no admite esa moneda.";
    default:
      return "ese medio de pago no existe en el catálogo.";
  }
}

export async function registerOrderPaymentForRoute(input: {
  orderId: string;
  role: Parameters<typeof canCollectPayment>[0];
  assignedLocationIds?: readonly string[] | null;
  body: unknown;
}) {
  if (!canCollectPayment(input.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const payload = parseOrderPaymentPayload(input.body);
  const orderRepository = new PrismaOrderRepository();
  const order = await orderRepository.findOrderById(input.orderId);

  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Ese pedido no existe.", {
      order: "Ese pedido no existe.",
    });
  }

  await requirePosLocation({
    role: input.role,
    assignedLocationIds: input.assignedLocationIds,
    requested: order.locationId,
  });

  const shiftRepository = new PrismaShiftRepository();

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`, `A-69`) — **la autoridad es `money`**: la moneda
   * base y las tasas vigentes salen de ahí, no de `BusinessSettings`.
   */
  const { context: money } = await readProductionMoney();

  const catalog = await createProductionConfiguredPaymentMethods().listPaymentMethods();
  /**
   * Se resuelve contra el catálogo **completo** y no contra los disponibles: el dominio
   * (`resolveConfiguredPaymentMethod`) devuelve `null` para un medio apagado o fuera de la sucursal, y así el
   * error puede decir **por qué** —apagado en Finanzas, no se ofrece acá, moneda no admitida— en vez de un
   * «ese medio no existe» que deja al dueño sin saber dónde mirar.
   */
  const payments = resolveConfiguredPaymentLines({
    payments: payload.payments,
    locationId: order.locationId,
    catalog,
  });

  const result = await registerOrderPayment(
    {
      orderId: input.orderId,
      payments,
      terminalId: payload.terminalId,
      idempotencyKey: payload.idempotencyKey,
    },
    {
      orderRepository,
      paymentRepository: new PrismaPaymentRepository(),
      findOpenShift: async (locationId, terminalId) =>
        (await getCurrentShift({ locationId, terminalId }, { shiftRepository })).data,
      runInOrderPaymentTransaction,
      baseCurrencyCode: money.baseCurrencyCode,
      /**
       * `D-019`/`A-69` — la tasa por moneda, no un escalar del dólar. La moneda del cobro la elige el
       * mostrador, así que el mapa trae **todas** las monedas aceptadas con tasa vigente. Sin entrada para
       * una moneda, el dominio rechaza el cobro (`missing-rate`) en vez de inventar una equivalencia.
       */
      rates: money.rates,
      paymentMethodKind: paymentMethodKindFor(payload.payments[0].method),
    },
  );

  return {
    data: {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      appliedAmount: result.appliedAmount,
      payments: result.data.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        paymentMethodId: payment.paymentMethodId ?? null,
      })),
    },
  };
}

/**
 * El **límite atómico** del cobro de un pedido que ya existe: el mismo lock de la fila del pedido y del
 * turno que piden la venta del mostrador y el cierre del turno. Se exporta para que el test de PostgreSQL
 * use **esta** composición y no una copia: un test que se arma su propio runner no prueba el que corre en
 * producción.
 */
export function runInOrderPaymentTransaction<T>(
  work: (scope: OrderPaymentScope) => Promise<T>,
): Promise<T> {
  return getPrismaClient().$transaction(
    async (tx) => {
      const paymentRepository = new PrismaPaymentRepository(tx);

      return work({
        paymentRepository,
        findSettlementPayments: (key) =>
          new PrismaPaymentRepository(tx).listPaymentsBySettlementKey(key),
        // `A-75`: el `total` sale del lock (llega como `text` de Postgres) y es el número contra el que se
        // compara el saldo, no el que se leyó antes de abrir la transacción.
        lockOrder: async (orderId) => {
          const locked = await lockOrderRow(tx, orderId);

          return locked ? { id: locked.id, total: Number(locked.total) } : null;
        },
        lockShift: (shiftId) => lockShiftRow(tx, shiftId),
      });
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
}

/** Reexportado para el test de PostgreSQL: compone la clave de cada `Payment` de una liquidación. */
export { settlementPaymentKey };
