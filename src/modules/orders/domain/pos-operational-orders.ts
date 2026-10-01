import type { OrderSource, OrderStatus } from "@/modules/orders/domain/order.types";
import type { OrderPaymentStatusValue } from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (orden 6) — **el read model operacional del POS**.
 *
 * Es una proyección de `orders` distinta de `OrderListProjection` y no una variante suya, porque
 * contestan **preguntas distintas**:
 *
 * - Pedidos (administrativo) pregunta «¿qué pedido quiero **buscar y auditar**?»: historial, ventana de
 *   fechas, búsqueda amplia, paginación.
 * - POS (operacional) pregunta «¿qué necesita hacer el cajero **ahora** en este local?»: qué se está
 *   preparando, qué está listo, qué falta cobrar y qué viene programado.
 *
 * Las cuatro dimensiones del resumen son **superpuestas, no excluyentes**: un pedido programado, listo y
 * sin cobrar cuenta en las **tres**. Forzarlas a ser mutuamente excluyentes obligaría a elegir cuál miente.
 *
 * Lo que **no** viaja, a propósito: items y modificadores completos, el historial completo, facturas, GPS,
 * tokens de seguimiento, devoluciones y cualquier campo administrativo que el cajero no use para decidir su
 * próxima acción. Para abrir un pedido concreto se compone el detalle existente.
 */

/** El estado financiero, **producido por `payments`**. Acá no se recalcula nada. */
export type PosOperationalFinancialState = {
  status: OrderPaymentStatusValue;
  /** Lo cobrado demostrable, en moneda base. */
  paidAmount: number;
  /** `max(0, total − paidAmount)`. Es el número que el checkout tiene que liquidar exacto. */
  outstandingAmount: number;
  /** Plata cobrada cuyo equivalente **no se puede demostrar**. `> 0` saca al pedido del flujo normal. */
  unresolvedAmount: number;
  baseCurrencyCode: string;
};

export type PosOperationalOrder = {
  id: string;
  orderNumber: string;
  /** Canal de origen (`MENÚ`/`POS`); `null` en un pedido anterior a la columna (`D-015`). */
  source: OrderSource | null;
  customerName: string;
  locationId: string;
  /** Nombre del local; `null` si el local ya no existe. */
  locationName: string | null;
  status: OrderStatus;
  /** Hora prometida del retiro; `null` = «lo antes posible» (el POS no promete hora). */
  pickupTime: string | null;
  pickupScheduled: boolean;
  /** La moneda congelada del pedido (`D-022`); `null` en un pedido legacy. */
  currencyCode: string | null;
  total: number;
  financialState: PosOperationalFinancialState;
};

/**
 * El resumen operacional: los cuatro contadores de la banda del encabezado.
 *
 * Se calcula **en el servidor** sobre el conjunto operacional completo del local. Calcularlo sobre las
 * filas que la pantalla tiene dibujadas —o con cuatro requests separados agregados en React— haría que el
 * número dependiera del viewport, que es exactamente lo que un KPI no puede hacer.
 */
export type PosOperationalSummary = {
  /** Estados de producción `new` · `confirmed` · `preparing`. No incluye `ready_for_pickup`. */
  inProcess: number;
  /** `status === ready_for_pickup`: listo y **todavía no entregado** (`picked_up` ya no es este estado). */
  ready: number;
  /** Estado financiero canónico distinto de `paid`: `pending` **y** `partial`. */
  pendingPayment: number;
  /** `pickupScheduled && pickupTime != null` y el pedido sigue vivo. */
  scheduled: number;
};

export type PosOperationalFeed = {
  /** Todos los pedidos operativos del local, ordenados para operar (ver `list-pos-operational-orders`). */
  orders: PosOperationalOrder[];
  summary: PosOperationalSummary;
};

/**
 * El detalle del eje financiero que la banda tiene que poder distinguir.
 *
 * «Por cobrar» **no** es una sola cosa: un `partial` con plata no demostrable se muestra como `REVISAR` y
 * sale del flujo normal de cobro (no se convierte con la tasa vigente ni se trata como cobrable).
 */
export type PosOperationalPaymentState = {
  needsReview: boolean;
  /** Si el cajero puede liquidarlo con el checkout normal. `false` cuando hay que revisarlo. */
  chargeable: boolean;
};

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §6, §7, §8) — **los cuatro KPI operacionales**, en el dominio.
 *
 * Viven acá —y no en el caso de uso ni en React— porque son una regla de negocio: qué cuenta como «en
 * proceso», qué como «listo» y qué como «por cobrar» no depende de la pantalla. El servidor los calcula
 * sobre el **conjunto operacional completo del local**; la banda del POS sólo dibuja el resultado.
 *
 * Tres decisiones que estos contadores fijan:
 *
 * 1. **Son dimensiones superpuestas.** Un pedido programado, listo e impago cuenta en las tres. Forzarlas
 *    a ser mutuamente excluyentes obligaría a elegir cuál de las tres preguntas del cajero no se contesta.
 * 2. **«En proceso» es producción, no el grupo del listado admin.** El grupo «En proceso» de Pedidos
 *    incluye `out_for_delivery` y «Listos» incluye `ready` porque ahí la pregunta es de **búsqueda**; acá
 *    la pregunta es «qué está cocinándose ahora» y usa los estados equivalentes a `new`/`confirmed`/
 *    `preparing` (los mismos carriles de Cocina). Mezclarlos haría que el número del POS y el de Cocina no
 *    coincidan nunca.
 * 3. **«Por cobrar» sale del estado financiero canónico**, nunca de una suma propia: `pending` y `partial`
 *    son deuda; `paid` no. Y un `partial` con `unresolvedAmount > 0` cuenta igual —es plata sin cobrar—
 *    pero el panel lo manda a **REVISAR** en vez de al checkout normal (brief §32).
 */

/**
 * Los estados de producción del KPI «En proceso»: el brief §6 los enumera como «equivalentes a `new`,
 * `confirmed`, `preparing`». Son los mismos carriles que Cocina dibuja.
 */
export const POS_OPERATIONAL_IN_PROCESS_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
];

/**
 * Los estados que el feed operacional **considera**.
 *
 * Es la unión de los estados vivos más los dos carriles de preparación de mesa/delivery que el esquema
 * conserva: un pedido en cualquiera de ellos sigue siendo trabajo del local. Lo terminal
 * (`picked_up`, `delivered`, `served`, `closed`) y `cancelled` quedan **afuera**: son historia, y el POS
 * tiene que mostrar lo que el cajero puede hacer ahora.
 */
export const POS_OPERATIONAL_FEED_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
];

export function isPosOperationalInProcess(status: OrderStatus): boolean {
  return (POS_OPERATIONAL_IN_PROCESS_STATUSES as readonly string[]).includes(status);
}

/**
 * «Listos» es **exactamente** `ready_for_pickup`.
 *
 * No incluye `ready` (que en el esquema es el carril de delivery, fuera del MVP) ni `picked_up` (ya se
 * entregó). El brief §6 es literal en las dos cosas.
 */
export function isPosOperationalReady(status: OrderStatus): boolean {
  return status === "ready_for_pickup";
}

/** «Por cobrar» = el estado financiero canónico no es `paid`. `partial` incluido. */
export function isPosOperationalPendingPayment(status: OrderPaymentStatusValue): boolean {
  return status !== "paid";
}

/**
 * «Programado» exige las **dos** señales: la marca del cliente y una hora prometida.
 *
 * Sin `pickupTime` no hay nada que ordenar ni promesa que cumplir; sin `pickupScheduled` la hora es la que
 * el servidor calculó para que Cocina sepa cuándo arrancar (brief §6), no un compromiso del cliente.
 */
export function isPosOperationalScheduled(order: {
  pickupScheduled: boolean;
  pickupTime: string | null;
}): boolean {
  return order.pickupScheduled && order.pickupTime !== null && order.pickupTime !== "";
}

/** Cómo cae un pedido en cada dimensión, más el detalle financiero que el panel necesita. */
export type PosOperationalClassification = {
  inProcess: boolean;
  ready: boolean;
  pendingPayment: boolean;
  scheduled: boolean;
  /** `partial` con plata no demostrable: se muestra como REVISAR y sale del cobro normal. */
  needsReview: boolean;
  /** Si el cajero puede liquidarlo con el checkout normal. */
  chargeable: boolean;
};

/** Lo mínimo que hay que saber de un pedido para contarlo. No es el pedido: es su clasificación. */
export type PosOperationalClassifiable = {
  status: OrderStatus;
  pickupScheduled: boolean;
  pickupTime: string | null;
  /** El estado que devolvió `payments`. Acá no se recalcula. */
  financialStatus: OrderPaymentStatusValue;
  /** Plata cobrada cuyo equivalente no se puede demostrar (`D-020`). */
  unresolvedAmount: number;
};

export function classifyPosOperational(
  order: PosOperationalClassifiable,
): PosOperationalClassification {
  const pendingPayment = isPosOperationalPendingPayment(order.financialStatus);
  const needsReview = order.financialStatus === "partial" && order.unresolvedAmount > 0;

  return {
    inProcess: isPosOperationalInProcess(order.status),
    ready: isPosOperationalReady(order.status),
    pendingPayment,
    scheduled: isPosOperationalScheduled(order),
    needsReview,
    // Un `partial` sin plata no demostrable sí se puede completar: es una liquidación a medias. Uno con
    // `unresolvedAmount` no: primero hay que resolver la equivalencia, y eso no es cobrar.
    chargeable: pendingPayment && !needsReview,
  };
}

/**
 * El resumen de un conjunto **ya clasificado**: la puerta que usa el caso de uso.
 *
 * Se calcula una sola vez sobre el feed operacional completo del local, nunca sobre las filas que la
 * pantalla tiene dibujadas.
 */
export function summarizePosOperationalOrders(
  classified: readonly PosOperationalClassification[],
): PosOperationalSummary {
  const summary: PosOperationalSummary = {
    inProcess: 0,
    ready: 0,
    pendingPayment: 0,
    scheduled: 0,
  };

  for (const item of classified) {
    if (item.inProcess) summary.inProcess += 1;
    if (item.ready) summary.ready += 1;
    if (item.pendingPayment) summary.pendingPayment += 1;
    if (item.scheduled) summary.scheduled += 1;
  }

  return summary;
}

/** El resumen de pedidos operacionales: clasifica y cuenta. */
export function countPosOperationalSummary(
  orders: readonly PosOperationalClassifiable[],
): PosOperationalSummary {
  return summarizePosOperationalOrders(orders.map(classifyPosOperational));
}
