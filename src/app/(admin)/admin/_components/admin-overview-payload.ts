import { z } from "zod";

import type {
  AdminOverviewOperationsResponse,
  AdminOverviewPerformanceResponse,
} from "@/modules/dashboard/domain/admin-overview.types";

const finiteNumberSchema = z.number().finite();
const countSchema = finiteNumberSchema.int().nonnegative();

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

function isRealLocalDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function isRenderableUtcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.padEnd(3, "0")),
  );
  const date = new Date(timestamp);

  return (
    Number.isFinite(timestamp) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second) &&
    date.getUTCMilliseconds() === Number(fraction.padEnd(3, "0"))
  );
}

const localDateSchema = z.string().refine(isRealLocalDate);
const utcTimestampSchema = z.string().refine(isRenderableUtcTimestamp);

const metricComparisonSchema = z.object({
  current: finiteNumberSchema,
  previous: finiteNumberSchema,
  changePercent: finiteNumberSchema.nullable(),
});

const countComparisonSchema = z.object({
  current: countSchema,
  previous: countSchema,
  changePercent: finiteNumberSchema.nullable(),
});

const jsonRangeSchema = z.object({
  localStartDate: localDateSchema,
  localEndDate: localDateSchema,
  utcStart: utcTimestampSchema,
  utcEnd: utcTimestampSchema,
}).superRefine((range, context) => {
  if (
    isRealLocalDate(range.localStartDate) &&
    isRealLocalDate(range.localEndDate) &&
    range.localStartDate > range.localEndDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["localEndDate"],
      message: "localEndDate must not precede localStartDate",
    });
  }

  if (
    isRenderableUtcTimestamp(range.utcStart) &&
    isRenderableUtcTimestamp(range.utcEnd) &&
    Date.parse(range.utcStart) >= Date.parse(range.utcEnd)
  ) {
    context.addIssue({
      code: "custom",
      path: ["utcEnd"],
      message: "utcEnd must be later than utcStart",
    });
  }
});

const operationsPayloadSchema = z.object({
  data: z.object({
    openOrders: countSchema,
    ordersPendingAction: countSchema,
    reservationsToday: countSchema,
    reservationsPendingAction: countSchema,
  }),
  meta: z.object({
    generatedAt: utcTimestampSchema,
    timeZone: z.literal("America/Managua"),
    localDate: localDateSchema,
  }),
});

const performancePayloadSchema = z.object({
  data: z.object({
    metrics: z.object({
      completedOrderValue: metricComparisonSchema,
      completedOrderCount: countComparisonSchema,
      averageTicket: metricComparisonSchema,
      activeReservations: countComparisonSchema,
    }),
    series: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        completedOrderValue: finiteNumberSchema,
        completedOrderCount: countSchema,
      }),
    ),
    reservations: z.object({
      requestsReceived: countSchema,
      active: countSchema,
      byStatus: z.object({
        requested: countSchema,
        approved: countSchema,
        rejected: countSchema,
        seated: countSchema,
        cancelled: countSchema,
        no_show: countSchema,
      }),
    }),
    topProducts: z.array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        units: countSchema,
        completedOrderValue: finiteNumberSchema,
      }),
    ),
  }),
  meta: z.object({
    generatedAt: utcTimestampSchema,
    timeZone: z.literal("America/Managua"),
    period: z.enum(["today", "7d", "30d", "month"]),
    channel: z.enum(["all", "delivery", "pickup"]),
    ranges: z.object({
      current: jsonRangeSchema,
      previous: jsonRangeSchema,
    }),
  }),
});

export function isAdminOverviewOperationsPayload(
  value: unknown,
): value is AdminOverviewOperationsResponse {
  return operationsPayloadSchema.safeParse(value).success;
}

export function isAdminOverviewPerformancePayload(
  value: unknown,
): value is AdminOverviewPerformanceResponse {
  return performancePayloadSchema.safeParse(value).success;
}
