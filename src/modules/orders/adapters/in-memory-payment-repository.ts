import type { PaymentRecord } from "@/modules/orders/domain/order.types";
import type {
  CreatePaymentInput,
  PaymentRepository,
  PaymentSummary,
} from "@/modules/orders/ports/payment-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/** Doble de test del puerto de cobros. La lógica es la misma que la del adaptador de Prisma. */
export class InMemoryPaymentRepository implements PaymentRepository {
  payments: PaymentRecord[] = [];

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

  async listPaymentsByOrder(orderId: string): Promise<PaymentRecord[]> {
    return this.payments
      .filter((payment) => payment.orderId === orderId)
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
