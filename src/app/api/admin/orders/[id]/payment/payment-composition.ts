import { z } from "zod";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
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

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — la puerta y el payload de **cobrar un pedido que
 * ya existe** (el del menú público, que se paga al retirar y sin cobro no se puede facturar).
 *
 * Dos guardas antes de tocar la plata:
 *
 * 1. **Puede cobrar quien opera el POS** (`canUsePOS`: cajero, manager y owner) — es el mismo permiso que la
 *    venta de mostrador.
 * 2. **El pedido tiene que estar en el alcance de la sesión**: se le pasa al guardián del POS el local del
 *    pedido, así un cajero de otra sucursal no puede cobrar un pedido que no ve.
 *
 * No se firma en el log de acciones sensibles: el asiento de un cobro es el `Payment` (con su turno), igual
 * que en la venta de mostrador.
 */
const paymentSchema = z.object({
  method: z.enum(["cash", "card", "transfer", "other"], {
    message: "Elegí el medio de pago.",
  }),
  amount: z.number().positive("Tiene que ser mayor que cero."),
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  reference: z.string().trim().max(80).nullable().optional(),
  /** Fase 6 — la terminal del POS que cobra (para atribuir el cobro a su caja). */
  terminalId: z.string().trim().min(1).nullable().optional(),
});

export function parseOrderPaymentPayload(body: unknown): {
  method: "cash" | "card" | "transfer" | "other";
  amount: number;
  currency: string;
  reference: string | null;
  terminalId: string | null;
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
  };
}

export async function registerOrderPaymentForRoute(input: {
  orderId: string;
  role: Parameters<typeof canUsePOS>[0];
  assignedLocationIds?: readonly string[] | null;
  body: unknown;
}) {
  if (!canUsePOS(input.role)) {
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
      businessCurrencyCode: settings.currencyCode,
      usdExchangeRate: settings.usdExchangeRate,
    },
  );
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
    async (tx) =>
      work({
        paymentRepository: new PrismaPaymentRepository(tx),
        // TASK-AUD-055: el lock del pedido serializa dos cobros simultáneos (el del turno, dos cierres).
        lockOrder: (orderId) => lockOrderRow(tx, orderId),
        lockShift: (shiftId) => lockShiftRow(tx, shiftId),
      }),
    { timeout: 15_000, maxWait: 10_000 },
  );
}
