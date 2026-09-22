import type { ShiftBankCloseInput } from "@/modules/orders/domain/shift-bank-close";
import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import type { ShiftRecord } from "@/modules/orders/domain/order.types";

export type OpenShiftInput = {
  locationId: string;
  /** Quién abre la caja. */
  userId: string;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — la **terminal** del local donde se abre esta caja. `null` =
   * la sucursal de una sola caja (y los turnos de antes de la fase): el índice único los agrupa en el mismo
   * cubo, así que ahí sigue habiendo una sola caja abierta por local.
   */
  terminalId?: string | null;
  /** Fondo con el que arranca. Sin dato es 0. */
  openingAmount?: number;
  /**
   * TASK-305 — con qué billetes se abre, por moneda. Si viene, el fondo se **deriva** del conteo:
   * el total y los billetes no pueden discrepar.
   */
  openingCounts?: ShiftCashCountInput[];
  notes?: string | null;
};

export type CloseShiftInput = {
  /**
   * Lo que se contó en la caja al cerrar.
   *
   * `null` explícito = cierre **ciego**: se guarda el esperado y la diferencia queda sin calcular
   * hasta que se cuente. Es una decisión de operación, no un dato que falte.
   */
  closingAmount: number | null;
  /** Lo que el sistema esperaba según los cobros, congelado al cerrar. */
  expectedAmount: number;
  /**
   * Bloque 1.1 del POS (Fase 2) — el esperado **por moneda**, calculado en el mismo momento que el
   * total. Se guarda porque recomputar un cierre viejo usaría la tasa de cambio de hoy.
   *
   * Opcional en el tipo para no romper llamadores viejos, pero **el caso de uso siempre lo manda**:
   * un cierre nuevo sin este dato pierde el detalle por moneda, que es justo lo que se está
   * arreglando.
   */
  expectedByCurrency?: Record<string, number>;
  /**
   * Bloque 1.2 del POS (Fase 2) — el efectivo que entró en el turno, en la moneda del negocio.
   * Misma nota que `expectedByCurrency`: el caso de uso siempre lo manda.
   */
  cashSalesAmount?: number;
  /**
   * Tarea 1.2 del roadmap (2026-09-17) — el **desglose por medio** del turno, en la moneda del negocio.
   * Misma nota que los anteriores: el caso de uso siempre los manda (`paymentMix` del arqueo).
   */
  cardSalesAmount?: number;
  transferSalesAmount?: number;
  otherSalesAmount?: number;
  /** Propinas del turno (van dentro de cada medio; se guardan aparte como detalle). */
  tipsAmount?: number;
  /**
   * Bloque 2 del POS (Fase 2) — el neto de los movimientos del turno (retiros e ingresos) en la
   * moneda del negocio. Misma nota: el caso de uso siempre lo manda.
   */
  cashMovementsAmount?: number;
  /**
   * Bloque 3 del POS (Fase 2) — el neto de las devoluciones en efectivo aprobadas del turno, en
   * moneda del negocio (negativo o 0: la plata salió del cajón).
   */
  refundsAmount?: number;
  /** TASK-305 — con qué billetes se cerró, por moneda (se guarda el conteo, no solo el total). */
  closingCounts?: ShiftCashCountInput[];
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco**: lo que declaró cada banco para
   * este turno (monto, moneda, lote y terminal). Se guarda con el arqueo: es parte del documento.
   */
  bankCloses?: ShiftBankCloseInput[];
  /**
   * Fase 3 — la diferencia del cuadre por banco en la moneda del negocio, congelada. `null` = no hubo
   * cuadre por banco (el turno no declaró ningún lote).
   */
  bankDifferenceAmount?: number | null;
  notes?: string | null;
};

/** Bloque 1.10 — la firma de la reapertura: quién la pidió y por qué. */
export type ReopenShiftInput = {
  /** Quién reabre (id del usuario del panel). */
  userId: string;
  /** Motivo, obligatorio y no vacío. */
  reason: string;
};

export interface ShiftRepository {
  /**
   * Abre un turno. El índice único parcial de la base es el que impide dos turnos abiertos en el
   * mismo local: si dos cajas lo intentan a la vez, una sola gana y la otra recibe el error de
   * índice único, que la capa de arriba traduce a conflicto.
   */
  openShift(input: OpenShiftInput): Promise<ShiftRecord>;
  /**
   * El turno abierto del local, o `null` si la caja está cerrada.
   *
   * Fase 6 del rediseño de Caja (2026-09-23) — con `terminalId` es el turno abierto **de esa terminal**;
   * sin él, el turno **sin** terminal (una sola caja por local, que es como se comporta una sucursal sin
   * terminales cargadas).
   */
  findOpenShiftByLocation(locationId: string, terminalId?: string | null): Promise<ShiftRecord | null>;
  findShiftById(id: string): Promise<ShiftRecord | null>;
  /**
   * Cierra un turno y devuelve el turno cerrado. `null` si no existe o si **ya estaba cerrado**
   * (cerrar dos veces no puede pisar el arqueo del primero).
   */
  closeShift(id: string, input: CloseShiftInput): Promise<ShiftRecord | null>;
  /** Turnos de un local, del más nuevo al más viejo. */
  listShifts(locationId: string): Promise<ShiftRecord[]>;
  /**
   * Bloque 1.10 del POS (Fase 2) — reabre un turno cerrado, firmando quién y por qué.
   *
   * `null` si el turno no existe o si **ya está abierto** (no hay nada que reabrir). Si el local ya
   * tiene otra caja abierta, el índice único parcial de la base rechaza la operación y el adaptador
   * lo traduce a `CONFLICT`: no puede haber dos turnos abiertos en el mismo local.
   *
   * Fase 3 del rediseño de Caja (2026-09-23): la reapertura **borra la firma del aviso**
   * (`differenceNotifiedAt`), porque el próximo cierre vuelve a avisar y la fecha vieja diría que ese
   * turno ya se avisó cuando el número que se avisó ya no existe.
   */
  reopenShift(id: string, input: ReopenShiftInput): Promise<ShiftRecord | null>;
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — firma que el aviso del cierre salió a la cola del outbox,
   * que es donde viaja la diferencia al grupo del dueño. Sin esto no se puede saber si el número se
   * avisó o quedó solo en la base (el aviso es **best-effort**: el cierre no depende de él).
   */
  markDifferenceNotified(id: string, notifiedAt: string): Promise<void>;
}
