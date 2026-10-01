import { businessDate, businessDayRange, shiftBusinessDays } from "@/shared/lib/business-days";
import type { OrderStatus } from "@/modules/orders/domain/order.types";
import type { OrderPaymentStatusValue } from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **los filtros del listado de Pedidos**, en el dominio de `orders`.
 *
 * Viven acá y no en la pantalla por la misma razón que la búsqueda (`order-search.ts`): lo que decide qué
 * pedidos entran al listado es una regla del pedido, no una decisión de presentación. La pantalla traduce
 * un control a un valor y lo escribe en la URL; **el servidor** es el que filtra.
 *
 * Tres reglas y ninguna se negocia:
 *
 * 1. **La zona horaria es la del negocio** y entra por parámetro: «hoy» es el día del local, no el del
 *    navegador ni el del servidor (`A-63`). El rango se arma con `businessDayRange`, que es la misma
 *    función que usa el cierre del día.
 * 2. **El grupo de estados** del `<select>` traduce el vocabulario del negocio («Nuevos», «En proceso»,
 *    «Listos», «Completados», «Cancelados») a estados del esquema, y ningún estado cae en dos grupos.
 * 3. **El estado de pago no se recalcula.** `partial` es «todavía no está pago» —tiene saldo o tiene plata
 *    no demostrable— y por eso entra en «Pendientes»: la precedencia la fija `payments` (`D-020`) y acá
 *    sólo se consume el valor que esa proyección devolvió.
 */

/** Los cuatro rangos aprobados por el owner, en el orden en que se ofrecen. */
export const ADMIN_ORDER_DATE_PRESETS = ["today", "yesterday", "7d", "30d"] as const;

export type AdminOrderDatePreset = (typeof ADMIN_ORDER_DATE_PRESETS)[number];

export function isAdminOrderDatePreset(value: unknown): value is AdminOrderDatePreset {
  return (
    typeof value === "string" &&
    (ADMIN_ORDER_DATE_PRESETS as readonly string[]).includes(value)
  );
}

/** «¿Es un preset válido?». Un valor raro de la URL **no** abre el historial entero: se descarta. */
export function parseAdminOrderDatePreset(value: unknown): AdminOrderDatePreset | null {
  return isAdminOrderDatePreset(value) ? value : null;
}

/**
 * Los días **hacia atrás** que abarca cada preset, contando el día de hoy.
 *
 * `today` y `yesterday` son de un día; `7d`/`30d` son ventanas de N días que terminan hoy. Se expresa así
 * para que el rango se arme con una sola cuenta (`shiftBusinessDays`) y no con cinco casos.
 */
const PRESET_DAYS_BACK: Record<Exclude<AdminOrderDatePreset, "yesterday">, number> = {
  today: 0,
  "7d": 6,
  "30d": 29,
};

export type AdminOrderRange = { from: string | undefined; to: string | undefined };

/**
 * El rango ISO de un preset, en la zona del negocio. Sin preset (`null`) devuelve el rango **abierto**: la
 * pantalla no inventa un día que el usuario no eligió.
 */
export function resolveAdminOrderRange(input: {
  preset: AdminOrderDatePreset | null;
  timeZone: string;
  /** El instante de referencia. Entra por parámetro para poder probar la medianoche del negocio. */
  now: Date;
}): AdminOrderRange {
  const today = businessDate(input.now, input.timeZone);

  if (input.preset === null) return { from: undefined, to: undefined };

  if (input.preset === "yesterday") {
    return businessDayRange(shiftBusinessDays(today, -1), input.timeZone);
  }

  const firstDay = shiftBusinessDays(today, -PRESET_DAYS_BACK[input.preset]);
  const start = businessDayRange(firstDay, input.timeZone).from;
  const end = businessDayRange(today, input.timeZone).to;

  return { from: start, to: end };
}

/**
 * Los grupos de estado del control, en el orden aprobado.
 *
 * «En proceso» empieza en `confirmed`: un pedido aceptado todavía no se está cocinando (la spec de Cocina
 * lo dice: `confirmed` espera en ENTRADA), pero para el negocio ya no es «nuevo» —alguien lo tomó—.
 */
export const ADMIN_ORDER_STATUS_GROUPS = [
  "all",
  "new",
  "process",
  "ready",
  "closed",
  "cancelled",
] as const;

export type AdminOrderStatusGroup = (typeof ADMIN_ORDER_STATUS_GROUPS)[number];

const STATUSES_BY_GROUP: Record<Exclude<AdminOrderStatusGroup, "all">, OrderStatus[]> = {
  new: ["new"],
  process: ["confirmed", "accepted", "preparing", "out_for_delivery"],
  ready: ["ready", "ready_for_pickup"],
  closed: ["picked_up", "delivered", "served", "closed"],
  cancelled: ["cancelled"],
};

export function parseAdminOrderStatusGroup(value: unknown): AdminOrderStatusGroup {
  return typeof value === "string" &&
    (ADMIN_ORDER_STATUS_GROUPS as readonly string[]).includes(value)
    ? (value as AdminOrderStatusGroup)
    : "all";
}

/** Los estados que entran en el grupo. `[]` = sin filtro de estado («todos»). */
export function resolveAdminOrderStatusGroup(group: AdminOrderStatusGroup): OrderStatus[] {
  if (group === "all") return [];

  return [...STATUSES_BY_GROUP[group]];
}

/**
 * Los estados que cuentan como **trabajo vivo** para el KPI «N activas».
 *
 * No es el grupo «En proceso»: acá entra también lo nuevo (nadie lo tomó todavía y es trabajo pendiente)
 * y lo listo (el cliente lo está viniendo a buscar). Queda afuera lo que terminó y lo cancelado, que son
 * historia y no trabajo.
 */
export const ADMIN_ORDER_ACTIVE_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "out_for_delivery",
  "ready",
  "ready_for_pickup",
];

/** El filtro por estado de pago aprobado: «Pendientes» y «Pagados». */
export const ADMIN_ORDER_PAYMENT_FILTERS = ["all", "pending", "paid"] as const;

export type AdminOrderPaymentFilter = (typeof ADMIN_ORDER_PAYMENT_FILTERS)[number];

export function parseAdminOrderPaymentFilter(value: unknown): AdminOrderPaymentFilter {
  return typeof value === "string" &&
    (ADMIN_ORDER_PAYMENT_FILTERS as readonly string[]).includes(value)
    ? (value as AdminOrderPaymentFilter)
    : "all";
}

/**
 * ¿Un pedido con este estado financiero entra en el filtro?
 *
 * «Pendientes» = **todo lo que no está pago**, que es exactamente `pending` + `partial`: un parcial con
 * saldo sigue siendo deuda y uno con plata no demostrable necesita que alguien lo mire. «Pagados» = `paid`.
 */
export function matchesAdminOrderPaymentFilter(input: {
  filter: AdminOrderPaymentFilter;
  state: OrderPaymentStatusValue;
}): boolean {
  if (input.filter === "all") return true;
  if (input.filter === "paid") return input.state === "paid";

  return input.state !== "paid";
}

/** El complemento de `paid`: lo que el KPI «N pendientes de pago» cuenta. */
export function isPendingPaymentState(state: OrderPaymentStatusValue): boolean {
  return state !== "paid";
}

export type AdminOrderFinancialTone = "pending" | "partial" | "paid" | "review";

export type AdminOrderFinancialLabel = {
  /** El rótulo aprobado. No se compone en la pantalla: se resuelve acá, una sola vez. */
  label: string;
  tone: AdminOrderFinancialTone;
  /** Si hay que mirarlo: parcial **y** con plata que no se puede demostrar. */
  needsReview: boolean;
};

/**
 * El rótulo del estado financiero (`pending` → `PENDIENTE`, `partial` → `PARCIAL`, `paid` → `PAGADO`).
 *
 * La única variante es **`PARCIAL · REVISAR`**: un parcial con `unresolvedAmount > 0` tiene plata cobrada
 * cuyo equivalente a la moneda base **no se puede demostrar** (un cobro legacy sin snapshot, `D-020`), y el
 * sistema lo declara en vez de tratarlo como cobrado. El monto **no se convierte**: se muestra tal como la
 * proyección de `payments` lo devolvió.
 */
export function resolveFinancialStateLabel(input: {
  state: OrderPaymentStatusValue;
  unresolvedAmount: number;
}): AdminOrderFinancialLabel {
  if (input.state === "paid") return { label: "PAGADO", tone: "paid", needsReview: false };
  if (input.state === "partial") {
    return input.unresolvedAmount > 0
      ? { label: "PARCIAL · REVISAR", tone: "review", needsReview: true }
      : { label: "PARCIAL", tone: "partial", needsReview: false };
  }

  return { label: "PENDIENTE", tone: "pending", needsReview: false };
}
