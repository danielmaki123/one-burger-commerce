import type { CashMovementRecord } from "@/modules/orders/domain/order.types";

/** Lo que se guarda al registrar un movimiento (Bloque 2 del roadmap del POS, Fase 2). */
export type CreateCashMovementInput = {
  shiftId: string;
  kind: "withdrawal" | "deposit";
  category: "supplier" | "change_fund" | "vault" | "expense" | "other";
  /** Monto positivo: el signo lo da el `kind`. */
  amount: number;
  currency: string;
  reason: string;
  userId: string;
  /**
   * Tarea 2 del brief (2026-09-17) — el límite de retiro vigente al registrar. Se guarda congelado para
   * que cambiar la configuración después no reescriba la historia.
   */
  withdrawalLimitAmount?: number | null;
};

export interface CashMovementRepository {
  create(input: CreateCashMovementInput): Promise<CashMovementRecord>;
  /** Los movimientos de un turno, del más viejo al más nuevo (el orden en que pasaron). */
  listByShift(shiftId: string): Promise<CashMovementRecord[]>;
}
