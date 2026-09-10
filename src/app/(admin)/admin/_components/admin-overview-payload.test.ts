import { describe, expect, it } from "vitest";

import { isAdminOverviewPerformancePayload } from "./admin-overview-payload";
import { runAdminOverviewRequest } from "./admin-overview-request";

function validPerformancePayload() {
  return {
    data: {
      metrics: {
        completedOrderValue: { current: 500, previous: 400, changePercent: 25 },
        completedOrderCount: { current: 5, previous: 4, changePercent: 25 },
        averageTicket: { current: 100, previous: 100, changePercent: 0 },
      },
      series: [
        {
          key: "2026-07-22",
          label: "22 jul",
          completedOrderValue: 500,
          completedOrderCount: 5,
        },
      ],
      topProducts: [
        {
          productId: "product-1",
          productName: "Café",
          units: 3,
          completedOrderValue: 300,
        },
      ],
    },
    meta: {
      generatedAt: "2026-07-22T15:00:00.000Z",
      timeZone: "America/Managua",
      period: "7d",
      channel: "all",
      ranges: {
        current: {
          localStartDate: "2026-07-16",
          localEndDate: "2026-07-22",
          utcStart: "2026-07-16T06:00:00.000Z",
          utcEnd: "2026-07-23T06:00:00.000Z",
        },
        previous: {
          localStartDate: "2026-07-09",
          localEndDate: "2026-07-15",
          utcStart: "2026-07-09T06:00:00.000Z",
          utcEnd: "2026-07-16T06:00:00.000Z",
        },
      },
    },
  };
}

describe("admin overview payload validation", () => {
  it.each([
    ["empty data", { data: {} }],
    [
      "partial metrics",
      {
        ...validPerformancePayload(),
        data: {
          ...validPerformancePayload().data,
          metrics: {
            completedOrderValue:
              validPerformancePayload().data.metrics.completedOrderValue,
          },
        },
      },
    ],
    [
      "partial series point",
      {
        ...validPerformancePayload(),
        data: {
          ...validPerformancePayload().data,
          series: [{ key: "2026-07-22", label: "22 jul" }],
        },
      },
    ],
    [
      "partial top product",
      {
        ...validPerformancePayload(),
        data: {
          ...validPerformancePayload().data,
          topProducts: [{ productId: "product-1", units: 3 }],
        },
      },
    ],
    [
      "partial ranges",
      {
        ...validPerformancePayload(),
        meta: {
          ...validPerformancePayload().meta,
          ranges: { current: validPerformancePayload().meta.ranges.current },
        },
      },
    ],
  ])("rejects a performance response with %s", (_case, payload) => {
    expect(isAdminOverviewPerformancePayload(payload)).toBe(false);
  });

  it("accepts the complete performance response and rejects invalid enums/non-finite metrics", () => {
    expect(isAdminOverviewPerformancePayload(validPerformancePayload())).toBe(true);
    expect(
      isAdminOverviewPerformancePayload({
        ...validPerformancePayload(),
        meta: { ...validPerformancePayload().meta, period: "year" },
      }),
    ).toBe(false);
    expect(
      isAdminOverviewPerformancePayload({
        ...validPerformancePayload(),
        data: {
          ...validPerformancePayload().data,
          metrics: {
            ...validPerformancePayload().data.metrics,
            averageTicket: {
              ...validPerformancePayload().data.metrics.averageTicket,
              current: Number.NaN,
            },
          },
        },
      }),
    ).toBe(false);
  });

  it.each([
    ["completedOrderCount", "current", -1],
    ["completedOrderCount", "current", 1.5],
    ["completedOrderCount", "previous", -1],
    ["completedOrderCount", "previous", 1.5],
  ] as const)(
    "rejects %s.%s when the count comparison value is %s",
    (metricKey, comparisonKey, invalidValue) => {
      const payload = validPerformancePayload();

      expect(
        isAdminOverviewPerformancePayload({
          ...payload,
          data: {
            ...payload.data,
            metrics: {
              ...payload.data.metrics,
              [metricKey]: {
                ...payload.data.metrics[metricKey],
                [comparisonKey]: invalidValue,
              },
            },
          },
        }),
      ).toBe(false);
    },
  );

  it("preserves finite signed and fractional monetary comparisons", () => {
    const payload = validPerformancePayload();
    payload.data.metrics.completedOrderValue = {
      current: -10.5,
      previous: 2.25,
      changePercent: -625.5,
    };
    payload.data.metrics.averageTicket = {
      current: 12.75,
      previous: -3.5,
      changePercent: -464.25,
    };

    expect(isAdminOverviewPerformancePayload(payload)).toBe(true);
  });

  it.each([
    ["completedOrderCount", "current", -1],
    ["completedOrderCount", "current", 1.5],
    ["completedOrderCount", "previous", -1],
    ["completedOrderCount", "previous", 1.5],
  ] as const)(
    "isolates invalid %s.%s=%s to the performance onError callback",
    async (metricKey, comparisonKey, invalidValue) => {
      const performancePayload = validPerformancePayload();
      performancePayload.data.metrics[metricKey] = {
        ...performancePayload.data.metrics[metricKey],
        [comparisonKey]: invalidValue,
      };
      const performanceEvents: string[] = [];
      const signal = new AbortController().signal;

      await runAdminOverviewRequest({
        signal,
        request: async () => Response.json(performancePayload),
        isPayload: isAdminOverviewPerformancePayload,
        onData: () => performanceEvents.push("data"),
        onError: () => performanceEvents.push("error"),
        onRedirect: () => performanceEvents.push("redirect"),
      });

      expect(performanceEvents).toEqual(["error"]);
    },
  );

  it.each([
    ["empty local range date", "localStartDate", ""],
    ["impossible local range date", "localEndDate", "2026-02-31"],
    ["invalid UTC range timestamp", "utcStart", "2026-07-16 06:00:00"],
    ["non-renderable UTC range timestamp", "utcEnd", "2026-02-31T06:00:00.000Z"],
  ])("rejects performance metadata with %s", (_case, field, value) => {
    const payload = validPerformancePayload();

    expect(
      isAdminOverviewPerformancePayload({
        ...payload,
        meta: {
          ...payload.meta,
          ranges: {
            ...payload.meta.ranges,
            current: { ...payload.meta.ranges.current, [field]: value },
          },
        },
      }),
    ).toBe(false);
  });

  it("rejects an invalid performance generation timestamp", () => {
    expect(
      isAdminOverviewPerformancePayload({
        ...validPerformancePayload(),
        meta: { ...validPerformancePayload().meta, generatedAt: "" },
      }),
    ).toBe(false);
  });

  it("rejects an unexpected performance timezone", () => {
    expect(
      isAdminOverviewPerformancePayload({
        ...validPerformancePayload(),
        meta: { ...validPerformancePayload().meta, timeZone: "" },
      }),
    ).toBe(false);
  });

  it.each(["current", "previous"] as const)(
    "rejects an inverted local %s range",
    (rangeKey) => {
      const payload = validPerformancePayload();
      const range = payload.meta.ranges[rangeKey];

      expect(
        isAdminOverviewPerformancePayload({
          ...payload,
          meta: {
            ...payload.meta,
            ranges: {
              ...payload.meta.ranges,
              [rangeKey]: {
                ...range,
                localStartDate: range.localEndDate,
                localEndDate: range.localStartDate,
              },
            },
          },
        }),
      ).toBe(false);
    },
  );

  it.each(["current", "previous"] as const)(
    "rejects an inverted or empty UTC %s interval",
    (rangeKey) => {
      const payload = validPerformancePayload();
      const range = payload.meta.ranges[rangeKey];

      for (const utcEnd of [range.utcStart, "2026-01-01T00:00:00.000Z"]) {
        expect(
          isAdminOverviewPerformancePayload({
            ...payload,
            meta: {
              ...payload.meta,
              ranges: {
                ...payload.meta.ranges,
                [rangeKey]: { ...range, utcEnd },
              },
            },
          }),
        ).toBe(false);
      }
    },
  );

});
