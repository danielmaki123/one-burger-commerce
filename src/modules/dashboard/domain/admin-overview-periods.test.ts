import { describe, expect, it } from "vitest";

import {
  buildOverviewBucketKeys,
  buildOverviewRanges,
  formatBusinessDate,
} from "./admin-overview-periods";

const NOW = new Date("2026-07-22T18:30:00.000Z");
const MANAGUA = "America/Managua";

describe("buildOverviewRanges", () => {
  it("construye hoy como el día calendario completo del negocio", () => {
    const ranges = buildOverviewRanges("today", NOW, MANAGUA);

    expect(ranges.current).toMatchObject({
      localStartDate: "2026-07-22",
      localEndDate: "2026-07-22",
    });
    expect(ranges.current.utcStart.toISOString()).toBe(
      "2026-07-22T06:00:00.000Z",
    );
    expect(ranges.current.utcEnd.toISOString()).toBe(
      "2026-07-23T06:00:00.000Z",
    );
    expect(ranges.previous).toMatchObject({
      localStartDate: "2026-07-21",
      localEndDate: "2026-07-21",
    });
  });

  it("construye siete fechas actuales y las siete anteriores sin solaparlas", () => {
    const ranges = buildOverviewRanges("7d", NOW, MANAGUA);

    expect(ranges.current).toMatchObject({
      localStartDate: "2026-07-16",
      localEndDate: "2026-07-22",
    });
    expect(ranges.previous).toMatchObject({
      localStartDate: "2026-07-09",
      localEndDate: "2026-07-15",
    });
  });

  it("construye treinta fechas inclusivas terminando en la fecha local actual", () => {
    const ranges = buildOverviewRanges("30d", NOW, MANAGUA);

    expect(ranges.current).toMatchObject({
      localStartDate: "2026-06-23",
      localEndDate: "2026-07-22",
    });
    expect(ranges.previous).toMatchObject({
      localStartDate: "2026-05-24",
      localEndDate: "2026-06-22",
    });
    expect(buildOverviewBucketKeys(ranges, MANAGUA)).toHaveLength(30);
  });

  it("compara el mes hasta el mismo ordinal de día", () => {
    const ranges = buildOverviewRanges("month", NOW, MANAGUA);

    expect(ranges.current).toMatchObject({
      localStartDate: "2026-07-01",
      localEndDate: "2026-07-22",
    });
    expect(ranges.previous).toMatchObject({
      localStartDate: "2026-06-01",
      localEndDate: "2026-06-22",
    });
  });

  it("limita el ordinal mensual al último día del mes anterior", () => {
    const ranges = buildOverviewRanges(
      "month",
      new Date("2026-03-31T18:30:00.000Z"),
      MANAGUA,
    );

    expect(ranges.previous).toMatchObject({
      localStartDate: "2026-02-01",
      localEndDate: "2026-02-28",
    });
    expect(ranges.previous.utcEnd.toISOString()).toBe(
      "2026-03-01T06:00:00.000Z",
    );
  });

  /**
   * El tablero mostraba el día de Managua aunque el negocio estuviera en otra zona: la zona
   * estaba escrita en el módulo. Ahora la decide la configuración del negocio.
   */
  it("el día del tablero es el del negocio, no una zona fija", () => {
    // 2026-07-22T18:30Z = 22/07 12:30 en Managua y 23/07 03:30 en Tokio.
    const managua = buildOverviewRanges("today", NOW, MANAGUA);
    const tokio = buildOverviewRanges("today", NOW, "Asia/Tokyo");

    expect(managua.current.localStartDate).toBe("2026-07-22");
    expect(tokio.current.localStartDate).toBe("2026-07-23");
    expect(tokio.current.utcStart.toISOString()).toBe("2026-07-22T15:00:00.000Z");
    expect(tokio.current.utcEnd.toISOString()).toBe("2026-07-23T15:00:00.000Z");
  });
});

describe("formatBusinessDate", () => {
  it("devuelve el día natural en la zona que se le pasa", () => {
    expect(formatBusinessDate(NOW, MANAGUA)).toBe("2026-07-22");
    expect(formatBusinessDate(NOW, "Asia/Tokyo")).toBe("2026-07-23");
  });

  it("una fecha inválida no rompe el tablero", () => {
    expect(() => formatBusinessDate(new Date("no-es-fecha"), MANAGUA)).toThrow();
  });
});

describe("buildOverviewBucketKeys", () => {
  it("produce buckets horarios para hoy", () => {
    const buckets = buildOverviewBucketKeys(
      buildOverviewRanges("today", NOW, MANAGUA),
      MANAGUA,
    );

    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toMatchObject({
      key: "2026-07-22T00",
      label: "00:00",
    });
    expect(buckets[23]).toMatchObject({
      key: "2026-07-22T23",
      label: "23:00",
    });
    expect(buckets[0]?.utcStart.toISOString()).toBe(
      "2026-07-22T06:00:00.000Z",
    );
  });

  it("los buckets horarios siguen la zona del negocio", () => {
    const ranges = buildOverviewRanges("today", NOW, "Asia/Tokyo");
    const buckets = buildOverviewBucketKeys(ranges, "Asia/Tokyo");

    // El día local arranca a las 00:00 de Tokio = 15:00Z del día anterior.
    expect(buckets[0]?.utcStart.toISOString()).toBe("2026-07-22T15:00:00.000Z");
    expect(buckets[23]?.utcEnd.toISOString()).toBe("2026-07-23T15:00:00.000Z");
  });

  it.each(["7d", "30d", "month"] as const)(
    "produce buckets diarios para %s",
    (period) => {
      const ranges = buildOverviewRanges(period, NOW, MANAGUA);
      const buckets = buildOverviewBucketKeys(ranges, MANAGUA);

      expect(buckets[0]?.key).toBe(ranges.current.localStartDate);
      expect(buckets.at(-1)?.key).toBe(ranges.current.localEndDate);
      expect(buckets.every((bucket) => bucket.unit === "day")).toBe(true);
    },
  );
});
