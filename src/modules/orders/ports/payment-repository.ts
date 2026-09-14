import type { PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";

export type CreatePaymentInput = {
  orderId: string;
  method: PaymentMethodType;
  /** Monto cobrado en **este** pago. En un pago mixto, la parte que entró por este medio. */
  amount: number;
  /** Propina cobrada en este pago. Opcional: sin dato es 0. */
  tip?: number;
  /** Referencia externa (voucher, id de transferencia). Sin dato queda vacía. */
  reference?: string | null;
};

export type PaymentSummary = {
  /** Cuántos cobros tiene el pedido. Un pago mixto tiene más de uno. */
  count: number;
  totalAmount: number;
  totalTip: number;
};

export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  listPaymentsByOrder(orderId: string): Promise<PaymentRecord[]>;
  /**
   * Totales del pedido sin traer las filas. Es lo que necesita el arqueo de caja (§TASK-104/305)
   * para no sumar en memoria lo que la base puede sumar.
   */
  getPaymentSummary(orderId: string): Promise<PaymentSummary>;
}
