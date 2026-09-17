import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { CashMovementRepository } from "@/modules/orders/ports/cash-movement-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * Bloque 2 del roadmap del POS (Fase 2) — registrar un movimiento de caja.
 *
 * Un movimiento es plata que entra o sale del cajón **sin ser un cobro**: un pago al proveedor, el
 * cambio que se trae, un retiro a bóveda. Tres reglas, todas de control interno:
 *
 * 1. El **motivo es obligatorio**: un retiro sin razón escrita no se puede auditar.
 * 2. El **monto es positivo** y el signo lo da el tipo (`withdrawal` resta, `deposit` suma): así el
 *    formulario no puede declarar un retiro que en realidad suma.
 * 3. Solo se mueve plata de una caja **abierta**. Sobre un turno cerrado cambiaría un arqueo ya
 *    firmado y el `difference` que se guardó dejaría de coincidir con sus propios movimientos.
 */

export type CashMovementInput = {
  shiftId: string;
  userId: string;
  kind: "withdrawal" | "deposit";
  category: "supplier" | "change_fund" | "vault" | "expense" | "other";
  amount: number;
  currency: string;
  reason: string;
  /**
   * Tarea 2 del brief (2026-09-17) — el límite de retiro configurado. **No bloquea nada**: se guarda con
   * el movimiento (congelado) para que el historial pueda marcar los que lo superan, que es lo que decidió
   * el owner en vez de una aprobación del supervisor.
   */
  withdrawalLimit?: number | null;
};

export async function registerCashMovement(
  input: CashMovementInput,
  {
    shiftRepository,
    cashMovementRepository,
  }: {
    shiftRepository: ShiftRepository;
    cashMovementRepository: CashMovementRepository;
  },
) {
  const shiftId = input.shiftId?.trim();
  if (!shiftId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { shiftId: "Requerido" });
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Escribí por qué se mueve la plata.", {
      reason: "El motivo es obligatorio.",
    });
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ShiftError(422, "VALIDATION_ERROR", "El monto tiene que ser mayor que cero.", {
      amount: "El monto tiene que ser mayor que cero.",
    });
  }

  const currency = input.currency?.trim().toUpperCase();
  if (!currency) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { currency: "Requerido" });
  }

  const shift = await shiftRepository.findShiftById(shiftId);
  if (!shift) {
    throw new ShiftError(404, "NOT_FOUND", "No encontramos ese turno de caja.");
  }

  if (shift.status !== "open") {
    throw new ShiftError(409, "CONFLICT", "La caja ya está cerrada: no se le pueden mover movimientos.", {
      shiftId: "La caja ya está cerrada.",
    });
  }

  const movement = await cashMovementRepository.create({
    shiftId,
    kind: input.kind,
    category: input.category,
    amount: input.amount,
    currency,
    reason,
    userId: input.userId,
    // Solo un retiro puede quedar «sobre el límite»; el límite se guarda igual para dejar el contexto.
    withdrawalLimitAmount: input.kind === "withdrawal" ? (input.withdrawalLimit ?? null) : null,
  });

  return { data: movement };
}
