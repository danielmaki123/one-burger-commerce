import type { AdminOrderRow } from "@/modules/orders/ports/order-repository";
import type { OrderPaymentStatus } from "@/modules/payments/domain/order-financial-status";

import {
  classifyPosOperational,
  isPosOperationalScheduled,
  type PosOperationalOrder,
  type PosOperationalSummary,
} from "@/modules/orders/domain/pos-operational-orders";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` — **`PosOperationalOrdersProjection`**: la proyección mínima de `orders`
 * orientada al cajero.
 *
 * Es la traducción de una fila leída (`AdminOrderRow`, la misma fila mínima que usa el listado
 * administrativo) al contrato del POS. Reutiliza la lectura y **no** la reconstruye: lo que cambia es qué se
 * proyecta y con qué pregunta.
 *
 * Lo que esta proyección **no** deja pasar, a propósito (brief §11): items, modificadores, historial
 * completo, facturas, GPS, tokens de seguimiento, devoluciones y cualquier campo administrativo que el
 * cajero no use para decidir su próxima acción. Tampoco el WhatsApp del cliente: no está en el contrato del
 * POS y el panel no lo dibuja.
 */

/** El estado financiero que `payments` produjo, reducido a los cuatro números que el POS muestra. */
export type PosOperationalFinancialProjection = Pick<
  OrderPaymentStatus,
  "status" | "paidAmount" | "outstandingAmount" | "unresolvedAmount"
>;

export type PosOperationalProjectionInput = {
  row: AdminOrderRow;
  locationName: string | null;
  /** La moneda base vigente, resuelta por el borde con `money`. */
  baseCurrencyCode: string;
  financial: PosOperationalFinancialProjection;
};

export function projectPosOperationalOrder(
  input: PosOperationalProjectionInput,
): PosOperationalOrder {
  const { row, financial } = input;

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    source: row.source ?? null,
    customerName: row.customerName,
    locationId: row.locationId,
    locationName: input.locationName,
    status: row.status,
    pickupTime: row.pickupTime,
    pickupScheduled: row.pickupScheduled,
    currencyCode: row.currencyCode,
    total: row.total,
    financialState: {
      status: financial.status,
      paidAmount: financial.paidAmount,
      outstandingAmount: financial.outstandingAmount,
      unresolvedAmount: financial.unresolvedAmount,
      // Una fila legacy sin moneda de pedido se informa con la base vigente: es la moneda en la que
      // `payments` expresó el estado, y cambiar la base no reinterpreta ningún cobro (`D-018`).
      baseCurrencyCode: input.baseCurrencyCode,
    },
  };
}

/**
 * El orden del feed: **los programados primero, por hora prometida**, y el resto por «hace cuánto está en
 * esta etapa», con lo más reciente arriba.
 *
 * Por qué no se ordena todo por `pickupTime`: un pedido sin programar puede tener una `pickupTime` que el
 * servidor calculó para que Cocina sepa cuándo arrancar (brief §6), así que ordenar por esa hora mezclaría
 * compromisos del cliente con estimaciones del sistema. Los programados son los únicos con una promesa que
 * el cajero tiene que respetar en un orden concreto.
 */
export function sortPosOperationalOrders(
  orders: readonly PosOperationalOrder[],
  stageChangedAtById: ReadonlyMap<string, string>,
): PosOperationalOrder[] {
  return [...orders].sort((a, b) => {
    /**
     * Un programado **sin hora** no es un programado (`isPosOperationalScheduled`): no entra a la primera
     * banda ni se compara por una hora que no existe. Comparar `null` como `""` lo haría ganar el primer
     * lugar, que es exactamente el error que este test fija.
     */
    const aScheduled = isPosOperationalScheduled(a);
    const bScheduled = isPosOperationalScheduled(b);

    if (aScheduled && bScheduled) {
      const byPickup = (a.pickupTime ?? "").localeCompare(b.pickupTime ?? "");
      if (byPickup !== 0) return byPickup;
    } else if (aScheduled !== bScheduled) {
      return aScheduled ? -1 : 1;
    }

    const aStage = stageChangedAtById.get(a.id) ?? "";
    const bStage = stageChangedAtById.get(b.id) ?? "";

    return bStage.localeCompare(aStage);
  });
}

/**
 * ¿Este pedido entra al feed operacional?
 *
 * El caso de uso ya lo resolvió en la lectura (`POS_OPERATIONAL_FEED_STATUSES` como filtro de estados),
 * pero la proyección lo vuelve a declarar para que un doble o una fila fuera de la lista no puedan
 * colarse: la regla es del dominio y el filtro de SQL es su traducción, no su definición.
 */
export function isOperationalFeedStatus(order: { status: PosOperationalOrder["status"] }): boolean {
  return !["picked_up", "closed", "cancelled", "delivered", "served"].includes(order.status);
}

/** Reexportado para que el caso de uso y sus tests compartan la clasificación sin depender del dominio. */
export { classifyPosOperational };
export type { PosOperationalOrder, PosOperationalSummary };
