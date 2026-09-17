import type { PosPaymentMethod } from "@/modules/pos/domain/pos-sale";

/**
 * Los tipos de la pantalla del mostrador. Vivían dentro de `pos-client.tsx` (deuda con techo congelado: no
 * puede crecer); son la forma de lo que la pantalla recibe, cobra y muestra, y no dependen de React.
 */

/** Un local como lo necesita el POS: su nombre y si exige cerrar la caja todos los días. */
export type PosLocationOption = {
  id: string;
  name: string;
  /** Tarea 3 del brief: la sucursal exige cerrar la caja todos los días. */
  requireShiftClose?: boolean;
};

/**
 * Bloque 4 del roadmap del POS (Fase 2) — una fila de cobro del mostrador.
 *
 * El monto vive como **texto** para que el input controlado no pelee con el cajero (mismo patrón que
 * el monto único de TASK-303b); la conversión a número pasa al armar el payload.
 */
export type PosPaymentDraft = {
  id: string;
  method: PosPaymentMethod;
  currency: string;
  amount: string;
  /** Referencia del voucher o de la transferencia (Bloque 4.1). */
  reference?: string;
};

/** La caja abierta del local, como la lee el POS (TASK-305b + tarea 1 del brief). */
export type PosShift = {
  id: string;
  openedAt: string;
  openingAmount: number;
  cashCounts?: { kind: "opening" | "closing"; currency: string; denomination: number; quantity: number }[];
};

/** Lo que el POS muestra después de cobrar (y con lo que rearma el recibo, TASK-307). */
export type PosSaleSummary = {
  orderNumber: string;
  total: number;
  change: number | null;
  /**
   * Tarea 11 del brief (2026-09-17) — `true` cuando el servidor **reconoció** el intento: el pedido ya
   * estaba cobrado con esa clave. La confirmación lo dice para que nadie vuelva a cobrar la venta.
   */
  reused: boolean;
  /** Cuándo se cobró: es la hora que llevan los tickets (no la de la impresión). */
  chargedAt: string;
  /** Lo que hace falta para reimprimir el recibo cuando el cajero lo pide (TASK-307). */
  receipt: {
    customerName: string;
    lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
    subtotal: number;
    packagingAmount: number;
    payments: { methodLabel: string; amount: number; currency: string | null }[];
  };
};
