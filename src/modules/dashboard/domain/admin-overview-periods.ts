import type {
  OverviewBucket,
  OverviewPeriod,
  OverviewRange,
  OverviewRanges,
} from "./admin-overview.types";

/**
 * Día y rangos del tablero de operación, en la **zona del negocio**.
 *
 * La zona estaba escrita acá (`America/Managua`) y el día natural, los rangos y los buckets
 * del tablero se calculaban con ella aunque el negocio estuviera en otra: un negocio de otra
 * zona veía el turno del día equivocado. Ahora la pasa quien compone (la configuración del
 * negocio) y es obligatoria, para que olvidarla no compile.
 *
 * Los formateadores de `Intl` se cachean por zona: construirlos en cada llamada es caro y el
 * tablero pide varias conversiones por request.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dateFormatters.set(timeZone, formatter);

  return formatter;
}

function offsetFormatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = offsetFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  offsetFormatters.set(timeZone, formatter);

  return formatter;
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseLocalDate(localDate: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = localDate.split("-").map(Number);

  if (!year || !month || !day) {
    throw new RangeError(`Invalid local date: ${localDate}`);
  }

  return { year, month, day };
}

function addLocalDays(localDate: string, days: number): string {
  const { year, month, day } = parseLocalDate(localDate);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return formatDateParts(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

function getOffsetMilliseconds(date: Date, timeZone: string): number {
  const offset = offsetFormatterFor(timeZone)
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (offset === "GMT") {
    return 0;
  }

  const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new RangeError(
      `Unable to resolve ${timeZone} offset for ${date.toISOString()}`,
    );
  }

  const [, sign, hours, minutes] = match;
  const magnitude = (Number(hours) * 60 + Number(minutes)) * 60_000;
  return sign === "+" ? magnitude : -magnitude;
}

function localDateTimeToUtc(localDate: string, timeZone: string, hour = 0): Date {
  const { year, month, day } = parseLocalDate(localDate);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour);
  const firstOffset = getOffsetMilliseconds(new Date(wallClockAsUtc), timeZone);
  const firstCandidate = new Date(wallClockAsUtc - firstOffset);
  const resolvedOffset = getOffsetMilliseconds(firstCandidate, timeZone);

  return new Date(wallClockAsUtc - resolvedOffset);
}

function buildRange(
  localStartDate: string,
  localEndDate: string,
  timeZone: string,
): OverviewRange {
  return {
    localStartDate,
    localEndDate,
    utcStart: localDateTimeToUtc(localStartDate, timeZone),
    utcEnd: localDateTimeToUtc(addLocalDays(localEndDate, 1), timeZone),
  };
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function formatBusinessDate(date: Date, timeZone: string): string {
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("Invalid date");
  }

  const parts = Object.fromEntries(
    dateFormatterFor(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function buildOverviewRanges(
  period: OverviewPeriod,
  now: Date,
  timeZone: string,
): OverviewRanges {
  const today = formatBusinessDate(now, timeZone);
  const { year, month, day } = parseLocalDate(today);

  if (period === "month") {
    const currentStart = formatDateParts(year, month, 1);
    const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));
    const previousYear = previousMonthDate.getUTCFullYear();
    const previousMonth = previousMonthDate.getUTCMonth() + 1;
    const previousEndDay = Math.min(
      day,
      getLastDayOfMonth(previousYear, previousMonth),
    );

    return {
      period,
      bucketUnit: "day",
      current: buildRange(currentStart, today, timeZone),
      previous: buildRange(
        formatDateParts(previousYear, previousMonth, 1),
        formatDateParts(previousYear, previousMonth, previousEndDay),
        timeZone,
      ),
    };
  }

  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const currentStart = addLocalDays(today, -(days - 1));
  const previousEnd = addLocalDays(currentStart, -1);
  const previousStart = addLocalDays(previousEnd, -(days - 1));

  return {
    period,
    bucketUnit: period === "today" ? "hour" : "day",
    current: buildRange(currentStart, today, timeZone),
    previous: buildRange(previousStart, previousEnd, timeZone),
  };
}

export function buildOverviewBucketKeys(
  ranges: OverviewRanges,
  timeZone: string,
): OverviewBucket[] {
  if (ranges.bucketUnit === "hour") {
    return Array.from({ length: 24 }, (_, hour) => {
      const nextHour = hour + 1;
      const utcEnd =
        nextHour === 24
          ? localDateTimeToUtc(
              addLocalDays(ranges.current.localStartDate, 1),
              timeZone,
            )
          : localDateTimeToUtc(
              ranges.current.localStartDate,
              timeZone,
              nextHour,
            );

      return {
        key: `${ranges.current.localStartDate}T${hour
          .toString()
          .padStart(2, "0")}`,
        label: `${hour.toString().padStart(2, "0")}:00`,
        unit: "hour",
        localDate: ranges.current.localStartDate,
        utcStart: localDateTimeToUtc(
          ranges.current.localStartDate,
          timeZone,
          hour,
        ),
        utcEnd,
      };
    });
  }

  const buckets: OverviewBucket[] = [];
  let localDate = ranges.current.localStartDate;

  while (localDate <= ranges.current.localEndDate) {
    buckets.push({
      key: localDate,
      label: localDate.slice(5),
      unit: "day",
      localDate,
      utcStart: localDateTimeToUtc(localDate, timeZone),
      utcEnd: localDateTimeToUtc(addLocalDays(localDate, 1), timeZone),
    });
    localDate = addLocalDays(localDate, 1);
  }

  return buckets;
}
