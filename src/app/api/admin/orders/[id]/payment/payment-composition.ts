import { z } from "zod";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { canCollectPayment } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { lockOrderRow, PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { lockShiftRow, PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import {
  registerOrderPayment,
  type OrderPaymentScope,
} from "@/modules/orders/features/register-order-payment/register-order-payment";
import { PrismaPaymentLookup } from "@/modules/payments/adapters/prisma-payment-lookup";
import { paymentMethodKindFor } from "@/modules/payments/domain/payment-method-kind";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — la puerta y el payload de **cobrar un pedido que
 * ya existe** (el del menú público, que se paga al retirar y sin cobro no se puede facturar).
 *
 * Tres guardas antes de tocar la plata:
 *
 * 1. **Puede cobrar quien tiene la capacidad de cobrar** — `TASK-MONEY-PAYMENTS-RUNTIME-001` reemplazó
 *    `canUsePOS` (la puerta gruesa del mostrador) por `canCollectPayment`, que es **nominal**: registrar un
 *    cobro sobre un pedido que ya existe es una capacidad propia, aunque hoy responda lo mismo.
 * 2. **El pedido tiene que estar en el alcance de la sesión**: se le pasa al guardián del POS el local del
 *    pedido, así un cajero de otra sucursal no puede cobrar un pedido que no ve.
 * 3. **El cobro viaja con su clave de idempotencia** (`A-71`) y **congela su snapshot** (`D-020`): el
 *    payload exige la clave y la composición resuelve la moneda base y la tasa vigente antes de cobrar.
 */
const paymentSchema = z.object({
  method: z.enum(["cash", "card", "transfer", "other"], {
    message: "Elegí el medio de pago.",
  }),
  amount: z.number().positive("Tiene que ser mayor que cero."),
  currency: z.string().trim().min(1, "Falta la moneda").max(12, "Ese código de moneda es muy largo"),
  reference: z.string().trim().max(80).nullable().optional(),
  /** Fase 6 — la terminal del POS que cobra (para atribuir el cobro a su caja). */
  terminalId: z.string().trim().min(1).nullable().optional(),
  /**
   * `A-71` — **la clave de idempotencia del cobro**. La manda la pantalla: el servidor no la inventa, porque
   * una clave inventada por el servidor no deduplica nada (cada request tendría una distinta).
   */
  idempotencyKey: z
    .string()
    .trim()
    .min(1, "Falta la clave de idempotencia del cobro.")
    .max(80, "La clave de idempotencia es muy larga."),
  /** `D-017` — el medio comercial configurable, si la pantalla lo conoce. */
  paymentMethodId: z.string().trim().min(1).nullable().optional(),
  /** `D-017` — la entidad de cobro contra la que se liquidó, si aplica. */
  entityId: z.string().trim().min(1).nullable().optional(),
});

export function parseOrderPaymentPayload(body: unknown): {
  method: "cash" | "card" | "transfer" | "other";
  amount: number;
  currency: string;
  reference: string | null;
  terminalId: string | null;
  idempotencyKey: string;
  paymentMethodId: string | null;
  entityId: string | null;
} {
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    throw new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  return {
    method: parsed.data.method,
    amount: parsed.data.amount,
    currency: parsed.data.currency.toUpperCase(),
    reference: parsed.data.reference ?? null,
    terminalId: parsed.data.terminalId ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
    paymentMethodId: parsed.data.paymentMethodId ?? null,
    entityId: parsed.data.entityId ?? null,
  };
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

  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const shiftRepository = new PrismaShiftRepository();

  return registerOrderPayment(
    { orderId: input.orderId, ...payload },
    {
      orderRepository,
      paymentRepository: new PrismaPaymentRepository(),
      findOpenShift: async (locationId, terminalId) =>
        (await getCurrentShift({ locationId, terminalId }, { shiftRepository })).data,
      runInOrderPaymentTransaction,
      baseCurrencyCode: settings.currencyCode,
      /**
       * `D-019`/`A-69` — la tasa por moneda, no un escalar del dólar. La moneda del cobro la elige el
       * mostrador, así que el mapa se arma con las monedas que el negocio acepta. Sin entrada para una
       * moneda, el dominio rechaza el cobro (`missing-rate`) en vez de inventar una equivalencia.
       */
      rates: buildRates(settings.currencyCode, settings.usdExchangeRate),
      paymentMethodKind: paymentMethodKindFor(payload.method),
    },
  );
}

/**
 * Las tasas vigentes que el cobro necesita, por moneda.
 *
 * Vive acá mientras `/admin/finance` no esté desplegada: la autoridad de la tasa pasa a `money` (con su
 * historial) y esta composición va a pedírsela a ese caso de uso. Mientras tanto traduce la configuración
 * que **hoy** existe —la moneda base y su tasa del dólar— a la forma nueva, en **un solo lugar**: ninguna
 * superficie vuelve a leer los dos campos de dinero por su cuenta (`A-69`).
 */
export function buildRates(
  businessCurrencyCode: string,
  usdExchangeRate: number | null,
): Record<string, number | null> {
  const base = businessCurrencyCode.trim().toUpperCase();

  return base === "USD" ? { NIO: null } : { USD: usdExchangeRate };
}

/**
 * TASK-AUD-005 — el **límite atómico** del cobro de un pedido que ya existe: el mismo lock de la fila del
 * turno que piden la venta del mostrador y el cierre del turno, así un cobro no puede quedar firmado por un
 * turno cerrado (su plata no entraría a ningún arqueo).
 *
 * Se exporta para que el test de PostgreSQL use **esta** composición y no una copia: un test que se arma su
 * propio runner no prueba el que corre en producción.
 */
export function runInOrderPaymentTransaction<T>(
  work: (scope: OrderPaymentScope) => Promise<T>,
): Promise<T> {
  return getPrismaClient().$transaction(
    async (tx) => {
      const paymentRepository = new PrismaPaymentRepository(tx);
      const paymentLookup = new PrismaPaymentLookup(tx);

      return work({
        paymentRepository,
        findPaymentByIdempotencyKey: (key) => paymentLookup.findPaymentByIdempotencyKey(key),
        // TASK-AUD-055: el lock del pedido serializa dos cobros simultáneos (el del turno, dos cierres).
        // `A-75`: el `total` sale del lock (llega como `text` de Postgres) y es el número contra el que se
        // compara el tope, no el que se leyó antes de abrir la transacción.
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
