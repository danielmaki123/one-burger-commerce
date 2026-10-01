import type { OrderListFinancialState } from "@/modules/orders/features/list-admin-orders/order-list-projection";
import {
  resolveFinancialStateLabel,
  type AdminOrderFinancialLabel,
} from "@/modules/orders/domain/admin-order-filters";
import type { OrderSource, OrderStatus } from "@/modules/orders/domain/order.types";

/**
 * `TASK-ORDERS-RUNTIME-5B` — los tipos del **listado** tal como los recibe la pantalla.
 *
 * Son la forma de lo que devuelve `GET /api/admin/orders` (el `OrderListProjection` serializado). Viven en
 * su propio archivo —igual que los del detalle— para que la página y sus componentes compartan el contrato
 * sin importarlo de React.
 */
export type OrderListRow = {
  id: string;
  orderNumber: string;
  source: OrderSource | null;
  customerName: string;
  customerWhatsapp: string;
  locationName: string | null;
  pickupTime: string | null;
  pickupScheduled: boolean;
  status: OrderStatus;
  stageChangedAt: string;
  total: number;
  currencyCode: string | null;
  financialState: OrderListFinancialState;
};

export type OrderListMeta = { page: number; pageSize: number; total: number };

export type OrderListKpi = {
  total: number;
  active: number;
  pendingPayment: number;
  scheduled: number;
};

export type OrderListResponse = {
  data: OrderListRow[];
  meta: OrderListMeta & { locationScope?: string[] | null };
  kpi: OrderListKpi;
};

/**
 * El rótulo del estado financiero, resuelto **una sola vez** con la regla del dominio. La pantalla no vuelve
 * a decidir qué es «parcial»: consume `resolveFinancialStateLabel`, que es la que sabe que
 * `PARCIAL · REVISAR` existe cuando hay plata que no se puede demostrar.
 */
export function financialLabel(row: OrderListRow): AdminOrderFinancialLabel {
  return resolveFinancialStateLabel({
    state: row.financialState.status,
    unresolvedAmount: row.financialState.unresolvedAmount,
  });
}

/** Las clases del rótulo financiero, con los tokens del sistema (nunca un color suelto). */
export const FINANCIAL_TONE_CLASSES: Record<AdminOrderFinancialLabel["tone"], string> = {
  pending: "text-status-pending-text",
  partial: "text-status-prep-text",
  review: "text-status-sla-text",
  paid: "text-status-ready-text",
};

/** El canal por el que entró el pedido, etiquetado para la fila. `null` = no declarado. */
export const SOURCE_LABELS: Record<OrderSource, string> = {
  menu: "MENÚ",
  pos: "POS",
};

/** Los canales que la referencia pinta distinto: `POS` en ámbar, `MENÚ` en el color de marca. */
export const SOURCE_TONE_CLASSES: Record<OrderSource, string> = {
  menu: "bg-brand-primary-muted text-brand-primary",
  pos: "bg-status-pending-bg text-status-pending-text",
};
