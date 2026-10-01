import { canViewOrderFinancials } from "@/modules/auth/domain/admin-permissions";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { PrismaInvoiceRepository } from "@/modules/invoices/adapters/prisma-invoice-repository";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { getOrder } from "@/modules/orders/features/get-order/get-order";
import {
  projectOrderDetail,
  type OrderDetailProjection,
} from "@/modules/orders/features/get-order/order-detail-projection";
import { getOrderPaymentStatus } from "@/modules/payments/features/get-order-payment-status/get-order-payment-status";

import { assertOrderInScope } from "../order-scope";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **la composición del detalle de un pedido**.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas y porque esto es composición:
 * arma las dependencias, resuelve el estado financiero con `payments` y proyecta con el **recorte que le
 * corresponde al rol**.
 *
 * El recorte es **de servidor**: sin `canViewOrderFinancials` la proyección no incluye un solo campo
 * financiero. No se devuelven en `null` para que React los esconda: no viajan. Es la diferencia entre
 * autorizar y ocultar (`A-60`).
 */
export async function loadOrderDetail(input: {
  orderId: string;
  role: AdminRole;
  /** El origen del request, para armar la URL de la hoja de la factura. */
  origin: string;
}): Promise<OrderDetailProjection> {
  const orderRepository = new PrismaOrderRepository();
  const detail = await getOrder(input.orderId, {
    repository: orderRepository,
    locationRepository: new PrismaLocationRepository(),
    paymentRepository: new PrismaPaymentRepository(),
  });

  const canViewFinancials = canViewOrderFinancials(input.role);

  const financial = canViewFinancials
    ? await resolveFinancialState({
        orderId: detail.data.id,
        total: detail.data.total,
        payments: detail.data.payments,
      })
    : null;

  const invoice = canViewFinancials
    ? await new PrismaInvoiceRepository().findByOrderId(detail.data.id)
    : null;

  // El historial firma cada cambio con el **nombre** del usuario: el id solo no responde «quién aceptó
  // esto». Una sola lectura de nombres para todos los eventos del pedido.
  const actors = await new PrismaAdminAuthRepository().listUserNames();

  return projectOrderDetail(
    {
      order: detail.data,
      pickupLocation: detail.data.pickupLocation,
      payments: detail.data.payments,
      history: detail.data.history,
      actorNames: new Map(actors.map((actor) => [actor.id, actor.name])),
      financial,
      invoice: invoice
        ? {
            id: invoice.id,
            number: invoice.number,
            issuedAt: invoice.issuedAt,
            currencyCode: invoice.currencyCode,
            total: invoice.total,
            voidedAt: invoice.voidedAt,
          }
        : null,
    },
    { canViewFinancials, internalBaseUrl: `${input.origin}/admin` },
  );
}

/**
 * La puerta y el alcance **antes** de proyectar.
 *
 * El orden importa: si el pedido es de otra sucursal, se rechaza con 403 sin resolver su estado financiero,
 * sin leer su factura y sin resolver un solo nombre. La ruta no puede olvidarse de la comprobación porque
 * este es el único camino al detalle.
 */
export async function loadOrderDetailForSession(input: {
  orderId: string;
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  origin: string;
}): Promise<OrderDetailProjection> {
  const orderRepository = new PrismaOrderRepository();
  const order = await orderRepository.findOrderById(input.orderId);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  assertOrderInScope(
    resolveOrderLocationScope({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
    }),
    order.locationId,
  );

  return loadOrderDetail(input);
}

/**
 * El estado financiero canónico del pedido, con la moneda base de `money` y **el snapshot de cada cobro**.
 *
 * Es exactamente lo que hace la factura: no se convierte nada con la tasa vigente —el equivalente de un
 * cobro nuevo ya está escrito— y un cobro legacy sin snapshot queda como no demostrable (`D-020`).
 */
async function resolveFinancialState(input: {
  orderId: string;
  total: number;
  payments: Awaited<ReturnType<PrismaPaymentRepository["listPaymentsByOrder"]>>;
}) {
  const money = await readProductionMoney();
  const status = await getOrderPaymentStatus({
    orderId: input.orderId,
    total: input.total,
    baseCurrencyCode: money.context.baseCurrencyCode,
    payments: input.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      baseCurrencyCode: payment.baseCurrencyCode ?? null,
      exchangeRate: payment.exchangeRate ?? null,
      baseAmount: payment.baseAmount ?? null,
      method: payment.method,
      createdAt: payment.createdAt,
      voidedAt: payment.voidedAt,
    })),
  });

  return {
    status: status.status,
    paidAmount: status.paidAmount,
    outstandingAmount: status.outstandingAmount,
    unresolvedAmount: status.unresolvedAmount,
    baseCurrencyCode: status.baseCurrencyCode,
  };
}
