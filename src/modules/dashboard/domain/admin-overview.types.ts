import type {
  OrderStatus,
  OrderType,
} from "@/modules/orders/domain/order.types";
import type { ReservationStatus } from "@/modules/reservations/domain/reservation.types";

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
  statusHistory: CompletionHistoryItem[];
  items: OverviewOrderItemInput[];
};

export type OverviewReservationPerformanceInput = {
  status: ReservationStatus;
  serviceDate: string;
  createdAt: Date | string;
};

export type AggregateOverviewInput = {
  channel: OverviewChannel;
  ranges: OverviewRanges;
  buckets: OverviewBucket[];
  orders: OverviewOrderPerformanceInput[];
  reservations: OverviewReservationPerformanceInput[];
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

export type OverviewReservationSummary = {
  requestsReceived: number;
  active: number;
  byStatus: Record<ReservationStatus, number>;
};

export type OverviewPerformanceData = {
  metrics: {
    completedOrderValue: OverviewMetricComparison;
    completedOrderCount: OverviewMetricComparison;
    averageTicket: OverviewMetricComparison;
    activeReservations: OverviewMetricComparison;
  };
  series: OverviewSeriesPoint[];
  reservations: OverviewReservationSummary;
  topProducts: OverviewTopProduct[];
};

export type AdminOverviewOperationsData = {
  openOrders: number;
  ordersPendingAction: number;
  reservationsToday: number;
  reservationsPendingAction: number;
};

export type AdminOverviewOperationsResponse = {
  data: AdminOverviewOperationsData;
  meta: {
    generatedAt: string;
    timeZone: string;
    localDate: string;
  };
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
