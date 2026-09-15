import type { PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";

export type CreatePaymentInput = {
  orderId: string;
  method: PaymentMethodType;
  /** Monto cobrado en **este** pago. En un pago mixto, la parte que entró por este medio. */
  amount: number;
  /**
   * TASK-303b — moneda del cobro (el cliente puede pagar en dólares). Sin dato, la moneda del
   * negocio: es lo que asumen los cobros anteriores a esta tarea.
   */
  currency?: string | null;
  /**
   * TASK-305 — vuelto que se le devolvió al cliente con este cobro, en moneda del negocio. Sin dato
   * es 0 (no hubo vuelto). Es un hecho del momento y el arqueo lo descuenta del cajón.
   */
  changeAmount?: number;
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
  /**
   * Cobros de un pedido, del más viejo al más nuevo.
   *
   * El rango es opcional y lo usa el arqueo del turno (TASK-104/305): los cobros que entraron entre
   * que se abrió y se cerró la caja.
   */
  listPaymentsByOrder(
    orderId: string,
    range?: { from?: string; to?: string },
  ): Promise<PaymentRecord[]>;
  /**
   * Todos los cobros del **local** dentro de una ventana de tiempo.
   *
   * Es la consulta del arqueo: un turno no cobra un pedido, cobra todo lo que entró por esa caja
   * entre que se abrió y se cerró. El local sale del pedido (no hay `locationId` en `Payment`: sería
   * dato duplicado que puede quedar viejo si el pedido se mueve de local).
   */
  listPaymentsInRange(
    locationId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentRecord[]>;
  /**
   * Totales del pedido sin traer las filas. Es lo que necesita el arqueo de caja (§TASK-104/305)
   * para no sumar en memoria lo que la base puede sumar.
   */
  getPaymentSummary(orderId: string): Promise<PaymentSummary>;
}
