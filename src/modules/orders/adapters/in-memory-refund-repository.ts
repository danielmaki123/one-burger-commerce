import type { RefundRecord } from "@/modules/orders/domain/order.types";
import type {
  CreateRefundInput,
  RefundRepository,
} from "@/modules/orders/ports/refund-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — doble de test del puerto de devoluciones.
 *
 * Reproduce la semántica del adaptador de Prisma para que un caso de uso no pueda pasar acá y fallar
 * contra la base: los listados van del más viejo al más nuevo y `resolve` tiene la guarda de estado
 * (una devolución ya resuelta no se vuelve a resolver).
 *
 * `refunds` es público a propósito: los tests de los casos de uso siembran devoluciones viejas
 * (aprobadas, de otro turno) escribiéndolas directo, igual que hace el doble de turnos.
 */
export class InMemoryRefundRepository implements RefundRepository {
  refunds: RefundRecord[] = [];

  private nextId() {
    return `refund_${this.refunds.length + 1}`;
  }

  async create(input: CreateRefundInput): Promise<RefundRecord> {
    const refund: RefundRecord = {
      id: this.nextId(),
      paymentId: input.paymentId,
      orderId: input.orderId,
      shiftId: input.shiftId,
      kind: input.kind,
      method: input.method,
      // Se guarda redondeado, igual que en la base (DECIMAL(10,2)): si el doble guardara 33.333 y
      // Prisma 33.33, los tests de los dos adaptadores mentirían distinto.
      amount: roundCurrency(input.amount),
      currency: input.currency.trim().toUpperCase(),
      reason: input.reason,
      status: input.status,
      requestedByUserId: input.requestedByUserId,
      approvedByUserId: input.approvedByUserId,
      approvedAt: input.approvedAt,
      createdAt: new Date().toISOString(),
    };

    this.refunds.push(refund);
    return refund;
  }

  /** Una devolución por su id, para resolverla. */
  async findById(id: string): Promise<RefundRecord | null> {
    return this.refunds.find((refund) => refund.id === id) ?? null;
  }

  /** Del más viejo al más nuevo, igual que en la base. */
  async listByPayment(paymentId: string): Promise<RefundRecord[]> {
    return this.refunds
      .filter((refund) => refund.paymentId === paymentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listByShift(shiftId: string): Promise<RefundRecord[]> {
    return this.refunds
      .filter((refund) => refund.shiftId === shiftId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** La cola de la bandeja: solo las pendientes, la más vieja primero. */
  async listPending(): Promise<RefundRecord[]> {
    return this.refunds
      .filter((refund) => refund.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Resuelve solo si sigue **pendiente**: si ya estaba resuelta devuelve `null` sin pisar la firma,
   * igual que el `updateMany` con `status: "pending"` en el `WHERE` del adaptador de Prisma.
   *
   * El `reason` de un rechazo, si viene, reemplaza el motivo original (es el motivo por el que **no**
   * se devolvió).
   */
  async resolve(
    id: string,
    input: {
      status: "approved" | "rejected";
      approvedByUserId: string;
      approvedAt: string;
      reason?: string;
    },
  ): Promise<RefundRecord | null> {
    const refund = this.refunds.find((candidate) => candidate.id === id);
    if (!refund || refund.status !== "pending") return null;

    refund.status = input.status;
    refund.approvedByUserId = input.approvedByUserId;
    refund.approvedAt = input.approvedAt;
    if (input.reason !== undefined) refund.reason = input.reason;

    return refund;
  }
}
