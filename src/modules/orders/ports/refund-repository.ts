import type { PaymentMethodType, RefundRecord } from "@/modules/orders/domain/order.types";

/** Lo que se guarda al registrar una devolución (Bloque 3 del roadmap del POS, Fase 2). */
export type CreateRefundInput = {
  paymentId: string;
  orderId: string;
  shiftId: string | null;
  kind: "full" | "partial";
  /** Medio original del cobro: una devolución de tarjeta no sale del cajón. */
  method: PaymentMethodType;
  /** Monto **positivo**: lo que se le devuelve al cliente. */
  amount: number;
  currency: string;
  reason: string;
  status: "pending" | "approved";
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
};

export interface RefundRepository {
  create(input: CreateRefundInput): Promise<RefundRecord>;
  /** Una devolución por su id, para resolverla. */
  findById(id: string): Promise<RefundRecord | null>;
  /** Todas las devoluciones de un cobro, para no devolver más de lo que se cobró. */
  listByPayment(paymentId: string): Promise<RefundRecord[]>;
  /** Las devoluciones de un turno (las aprobadas entran al arqueo). */
  listByShift(shiftId: string): Promise<RefundRecord[]>;
  /** La cola de la bandeja de aprobaciones: solo lo que está sin resolver. */
  listPending(): Promise<RefundRecord[]>;
  /**
   * Resuelve una devolución pendiente. `null` si no existe o si ya estaba resuelta (la guarda es el
   * `status: "pending"` en el `WHERE`: dos revisores a la vez no pueden firmar la misma devolución).
   * El `reason` de un rechazo reemplaza el motivo original, que queda en el historial del pedido.
   */
  resolve(
    id: string,
    input: {
      status: "approved" | "rejected";
      approvedByUserId: string;
      approvedAt: string;
      reason?: string;
    },
  ): Promise<RefundRecord | null>;
}
