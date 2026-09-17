import type { CashMovementKind } from "@/modules/orders/domain/order.types";

/**
 * Tarea 2 del brief (2026-09-17) — ¿este movimiento está por encima del límite de retiro?
 *
 * El owner decidió que el límite sea **configurable en Personalización y sin aprobación del supervisor**:
 * la regla entonces no bloquea ni pide firma, **marca** el movimiento para que se vea en el historial y en
 * el cierre. Es la diferencia entre «acá se fue mucha plata» y «acá hay un control que nadie mira».
 *
 * Tres precisiones que valen la pena: es un límite de **retiro** (un ingreso grande no es plata que se va),
 * la comparación es **estricta** («mayor a», no «mayor o igual») y el límite que se usa es el que quedó
 * guardado con el movimiento —el vigente cuando se registró—, no el de hoy: cambiar el límite no reescribe
 * lo que ya pasó.
 */
export function isOverWithdrawalLimit(movement: {
  kind: CashMovementKind;
  amount: number;
  withdrawalLimitAmount: number | null;
}): boolean {
  if (movement.kind !== "withdrawal") return false;
  if (movement.withdrawalLimitAmount === null) return false;

  return movement.amount > movement.withdrawalLimitAmount;
}