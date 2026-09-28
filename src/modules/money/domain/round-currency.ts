/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **el único redondeo de dinero**.
 *
 * Vivía en `shared/lib/order-totals.ts` y la auditoría de la fundación midió lo que pasa cuando hay dos:
 * `Number(x.toFixed(2))` en `orders/domain/shift-refund.ts` y `roundCurrency` acá redondeaban **el mismo
 * número** del arqueo y daban distinto (`2.675 → 2.68` contra `2.67`). El algoritmo no cambió: cambió de
 * dueño, y `order-totals` lo importa en vez de tener su propia copia.
 *
 * El `+ Number.EPSILON` compensa el error de representación binaria (2.675 no es exactamente 2.675 en
 * coma flotante): sin él, medio centavo cae para el lado equivocado de forma no determinista.
 *
 * **Se redondea sobre el valor absoluto** para que la regla sea la misma con los dos signos: medio centavo
 * se va **del cero hacia afuera** (`-0.125 → -0.13`, `0.125 → 0.13`). La magnitud no cambia respecto del
 * algoritmo histórico; lo que cambia es el signo, que antes derivaba hacia el cero (`-0.125 → -0.12`). El
 * arqueo usa el signo para decir «faltó» o «sobró plata», así que dos diferencias del mismo tamaño tienen
 * que redondearse igual.
 */
export function roundCurrency(amount: number): number {
  if (!Number.isFinite(amount)) return 0;

  const magnitude = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;

  return amount < 0 ? -magnitude : magnitude;
}
