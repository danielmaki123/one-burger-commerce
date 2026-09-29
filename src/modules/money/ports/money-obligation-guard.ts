/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`D-023`) — **la guarda del cambio de moneda base**.
 *
 * Cambiar la unidad en la que el sistema **expresa y compara** la plata es una operación de **período
 * cerrado**: si hay obligaciones vivas —un turno con el arqueo abierto, pedidos que todavía deben plata— el
 * cambio las dejaría expresadas en la base vieja y el saldo que se les exige pasaría a significar otra cosa.
 *
 * La consulta vive en este puerto, que **`money` define y otro módulo implementa** (el adaptador de pedidos y
 * turnos). Es la dirección correcta de la dependencia: el dueño de la moneda dice *qué* necesita saber y no
 * conoce la forma de `Order` ni de `Shift`; quien tiene los hechos contesta. `money` no puede importar el
 * adaptador: sería el dominio dependiendo de la infraestructura de otro módulo.
 */
export type OpenMoneyObligations = {
  /** Turnos con la caja abierta. Cambiar la base con uno abierto deja su arqueo a medio explicar. */
  openShifts: number;
  /**
   * Pedidos cuya deuda está **viva** (`pending`/`partial`): el saldo que se les exige está expresado en la
   * base que rige hoy. Un pedido ya `paid` no bloquea: su deuda está saldada.
   */
  pendingObligations: number;
};

export interface MoneyObligationGuard {
  /**
   * Cuenta las obligaciones vivas que impiden el cambio de base **en este momento**.
   *
   * Es una lectura, no una decisión: el caso de uso es el que decide si el número alcanza para rechazar la
   * operación, y el mensaje que ve el dueño sale de ahí.
   */
  countOpenObligations(): Promise<OpenMoneyObligations>;
}
