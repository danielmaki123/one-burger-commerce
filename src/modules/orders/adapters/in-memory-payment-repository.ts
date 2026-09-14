import type { PaymentRecord } from "@/modules/orders/domain/order.types";
import type {
  CreatePaymentInput,
  PaymentRepository,
  PaymentSummary,
} from "@/modules/orders/ports/payment-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/** Ventana de tiempo de un turno. Sin extremos, no filtra. */
function inRange(
  createdAt: string,
  range?: { from?: string; to?: string },
): boolean {
  if (!range) return true;
  if (range.from && createdAt < range.from) return false;
  if (range.to && createdAt > range.to) return false;

  return true;
}

/** Doble de test del puerto de cobros. La lógica es la misma que la del adaptador de Prisma. */
export class InMemoryPaymentRepository implements PaymentRepository {
  payments: PaymentRecord[] = [];

  /**
   * A qué local pertenece cada pedido. Existe porque `Payment` no guarda el local: lo sabe el pedido
   * (igual que en la base, donde el adaptador lo resuelve por la relación).
   */
  orderLocations: Record<string, string> = {};

  seedOrderLocation(orderId: string, locationId: string) {
    this.orderLocations[orderId] = locationId;
  }

  private nextId() {
    return `pay_${this.payments.length + 1}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id: this.nextId(),
      orderId: input.orderId,
      method: input.method,
      // El monto y la propina se guardan redondeados, igual que en la base (DECIMAL(10,2)): si el
      // doble guardara 33.333 y Prisma 33.33, los tests de los dos adaptadores mentirían distinto.
      amount: roundCurrency(input.amount),
      tip: roundCurrency(input.tip ?? 0),
      reference: input.reference ?? null,
      createdAt: new Date().toISOString(),
    };

    this.payments.push(payment);
    return payment;
  }

  async listPaymentsByOrder(
    orderId: string,
    range?: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    return this.payments
      .filter((payment) => payment.orderId === orderId)
      .filter((payment) => inRange(payment.createdAt, range))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listPaymentsInRange(
    locationId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    // Los cobros no guardan el local: lo sabe el pedido. En el doble de test el mapa se carga con
    // `seedOrderLocation`, así que acá se resuelve igual que en el adaptador de Prisma (que lo mira
    // por la relación con `Order`).
    const orderIdsAtLocation = new Set(
      Object.entries(this.orderLocations)
        .filter(([, location]) => location === locationId)
        .map(([orderId]) => orderId),
    );

    return this.payments
      .filter((payment) => orderIdsAtLocation.has(payment.orderId))
      .filter((payment) => inRange(payment.createdAt, range))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getPaymentSummary(orderId: string): Promise<PaymentSummary> {
    const payments = this.payments.filter((payment) => payment.orderId === orderId);

    return {
      count: payments.length,
      totalAmount: roundCurrency(
        payments.reduce((sum, payment) => sum + payment.amount, 0),
      ),
      totalTip: roundCurrency(payments.reduce((sum, payment) => sum + payment.tip, 0)),
    };
  }
}
