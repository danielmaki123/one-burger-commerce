import { getPrismaClient, type DatabaseClient } from "@/infrastructure/database/prisma";
import type {
  MoneyObligationGuard,
  OpenMoneyObligations,
} from "@/modules/money/ports/money-obligation-guard";
import {
  chargedAmountOf,
  SETTLED_ORDER_STATUSES,
} from "@/modules/payments/domain/order-financial-obligations";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`D-023`) — **las obligaciones vivas de producción**.
 *
 * Contesta la pregunta que `money` necesita para decidir si el cambio de base es seguro, sin que `money`
 * conozca la forma de `Order` ni de `Shift`. Es un adaptador porque instancia Prisma: el puerto lo define el
 * módulo dueño de la moneda y lo implementa quien tiene los hechos.
 *
 * Qué cuenta como obligación viva, y por qué:
 *
 * 1. **Un turno con la caja abierta**: su arqueo se está construyendo ahora. Cambiar la base dejaría el
 *    esperado a medio explicar y el cierre firmaría contra una moneda distinta de la que vio el cajero.
 * 2. **Un pedido que todavía debe plata y no está terminado**: el total está expresado en la base que rige
 *    hoy y el cliente todavía lo va a pagar. Si la base cambia, ese saldo pasa a significar otra cosa. Un
 *    pedido **cobrado** no bloquea (su deuda está saldada) y uno **terminado o cancelado** tampoco.
 *
 * La lista de estados terminados y la suma de lo cobrado viven en `payments`
 * (`order-financial-obligations.ts`): la regla se escribe una vez y la guarda sólo la consume.
 */
export class PrismaMoneyObligationGuard implements MoneyObligationGuard {
  constructor(private readonly client: DatabaseClient = getPrismaClient()) {}

  async countOpenObligations(): Promise<OpenMoneyObligations> {
    const [openShifts, candidateOrders] = await Promise.all([
      this.client.shift.count({ where: { status: "open" } }),
      this.client.order.findMany({
        where: {
          total: { gt: 0 },
          status: { notIn: [...SETTLED_ORDER_STATUSES] as never },
        },
        select: {
          total: true,
          payments: {
            // `A-59`: un cobro anulado no existió nunca para la plata.
            where: { voidedAt: null },
            select: { amount: true },
          },
        },
      }),
    ]);

    const pendingObligations = candidateOrders.filter(
      (order) => chargedAmountOf(order.payments) < Number(order.total),
    ).length;

    return { openShifts, pendingObligations };
  }
}
