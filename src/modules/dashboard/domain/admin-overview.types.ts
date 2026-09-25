import type {
  OrderStatus,
  OrderType,
} from "@/modules/orders/domain/order.types";

export type OverviewPeriod = "today" | "7d" | "30d" | "month";

export type OverviewChannel = "all" | "delivery" | "pickup";

export type OverviewBucketUnit = "hour" | "day";

export type OverviewRange = {
  localStartDate: string;
  localEndDate: string;
  utcStart: Date;
  utcEnd: Date;
};

export type OverviewRanges = {
  period: OverviewPeriod;
  bucketUnit: OverviewBucketUnit;
  current: OverviewRange;
  previous: OverviewRange;
};

export type OverviewBucket = {
  key: string;
  label: string;
  unit: OverviewBucketUnit;
  localDate: string;
  utcStart: Date;
  utcEnd: Date;
};

export type CompletionHistoryItem = {
  status: OrderStatus;
  createdAt: Date | string;
};

export type OverviewOrderItemInput = {
  productId: string;
  productName: string;
  quantity: number;
  lineTotal: number;
};

export type OverviewOrderPerformanceInput = {
  id: string;
  type: OrderType;
  status: OrderStatus;
  total: number;
  /**
   * TASK-AUD-015 (`A-58`) — lo que se **devolvió** (`Refund` aprobado) o se **invalidó** (`Void`/`Reversal`)
   * de este pedido, en moneda del negocio. Es lo que convierte `total` en el **valor neto** del pedido: la
   * única semántica económica del panel (ventas, ticket promedio, series y comparaciones).
   *
   * Sin dato se asume 0 (una venta limpia). Con `refundedAmount >= total` el pedido **no es una venta**.
   */
  refundedAmount?: number;
  statusHistory: CompletionHistoryItem[];
  items: OverviewOrderItemInput[];
};

export type AggregateOverviewInput = {
  channel: OverviewChannel;
  ranges: OverviewRanges;
  buckets: OverviewBucket[];
  orders: OverviewOrderPerformanceInput[];
};

export type OverviewMetricComparison = {
  current: number;
  previous: number;
  changePercent: number | null;
};

export type OverviewSeriesPoint = {
  key: string;
  label: string;
  completedOrderValue: number;
  completedOrderCount: number;
};

export type OverviewTopProduct = {
  productId: string;
  productName: string;
  units: number;
  completedOrderValue: number;
};

export type OverviewPerformanceData = {
  metrics: {
    completedOrderValue: OverviewMetricComparison;
    completedOrderCount: OverviewMetricComparison;
    averageTicket: OverviewMetricComparison;
  };
  series: OverviewSeriesPoint[];
  topProducts: OverviewTopProduct[];
};

export type OverviewJsonRange = {
  localStartDate: string;
  localEndDate: string;
  utcStart: string;
  utcEnd: string;
};

export type AdminOverviewPerformanceResponse = {
  data: OverviewPerformanceData;
  meta: {
    generatedAt: string;
    timeZone: string;
    period: OverviewPeriod;
    channel: OverviewChannel;
    ranges: {
      current: OverviewJsonRange;
      previous: OverviewJsonRange;
    };
  };
};
