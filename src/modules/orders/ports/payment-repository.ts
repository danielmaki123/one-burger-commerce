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
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — el **turno** al que entra este cobro (la caja de la terminal
   * donde se cobró). Sin dato queda `null`: los cobros del sitio público y los de antes de esta fase no
   * tienen turno, y el arqueo los lee por ventana de tiempo.
   */
  shiftId?: string | null;
};

export type PaymentSummary = {
  /** Cuántos cobros tiene el pedido. Un pago mixto tiene más de uno. */
  count: number;
  totalAmount: number;
  totalTip: number;
};

/** TASK-AUD-059 — lo que se guarda al **anular** un cobro: el motivo y quién lo firma. */
export type VoidPaymentInput = {
  /** Por qué se anula. Obligatorio y ya validado por el dominio (`validatePaymentVoidReason`). */
  reason: string;
  actorUserId: string;
  voidedAt: string;
};

/**
 * Los cobros (`Payment`) de un pedido y del local.
 *
 * TASK-AUD-059 — **las consultas de lista no devuelven cobros anulados**: un cobro anulado no cuenta para
 * el arqueo del turno, ni para el saldo del pedido, ni para la conciliación, ni para los documentos que se
 * imprimen. La única lectura que sí lo devuelve —con su marca— es `findPaymentById`, que es la de quien
 * tiene que **decidir** sobre él (anularlo o devolverlo).
 */
export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  /**
   * Bloque 3 del POS (Fase 2) — un cobro por su id, para devolverlo.
   *
   * La devolución necesita el **medio** y la **moneda originales**: devolver en efectivo algo que se
   * cobró con tarjeta no sale del cajón y no puede descontarse del arqueo.
   */
  findPaymentById(id: string): Promise<PaymentRecord | null>;
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
   * TASK-AUD-054 — los cobros del local dentro de una ventana que **no tienen turno** (`shiftId IS NULL`).
   *
   * Son los que entraron sin caja abierta (el cobro de un pedido del menú se registra igual: perder la venta
   * sería peor) y los de antes de la Fase 6. El arqueo de un turno los suma **además** de los suyos: sin
   * esto, un cobro sin turno no entraba al arqueo de nadie y la plata quedaba en el cajón sin documento que
   * la explicara. Filtrar por `shiftId IS NULL` es lo que permite que dos cajas abiertas del mismo local no
   * se cuenten la plata de la otra: los cobros de la otra terminal **sí** están atribuidos.
   */
  listUnattributedPaymentsInRange(
    locationId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentRecord[]>;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — los cobros **de un turno**, por su `shiftId`.
   *
   * Es la consulta del arqueo cuando el local tiene más de una caja abierta (dos terminales): leer por
   * ventana de tiempo haría que las dos cajas se contaran la misma plata. Los cobros de antes de esta fase
   * (sin `shiftId`) no aparecen acá y el arqueo los busca por ventana — ver `calculateExpectedAmount`.
   */
  listPaymentsByShift(shiftId: string): Promise<PaymentRecord[]>;
  /**
   * Totales del pedido sin traer las filas. Es lo que necesita el arqueo de caja (§TASK-104/305)
   * para no sumar en memoria lo que la base puede sumar.
   */
  getPaymentSummary(orderId: string): Promise<PaymentSummary>;
  /**
   * TASK-AUD-059 — **anula** un cobro: lo marca con cuándo, quién y por qué y lo saca de todo lo que sume
   * plata. No lo borra ni lo edita: la fila queda con su monto y su medio.
   *
   * `null` si el cobro no existe **o si ya estaba anulado**. La guarda es el `voidedAt: null` en el
   * `WHERE`: dos anulaciones simultáneas no pueden pisarse la firma (la segunda afecta 0 filas).
   */
  voidPayment(id: string, input: VoidPaymentInput): Promise<PaymentRecord | null>;
}
