import type {
  OverviewBucket,
  OverviewPeriod,
  OverviewRange,
  OverviewRanges,
} from "./admin-overview.types";

export const OVERVIEW_TIME_ZONE = "America/Managua";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OVERVIEW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: OVERVIEW_TIME_ZONE,
  timeZoneName: "longOffset",
});

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

function getOffsetMilliseconds(date: Date): number {
  const offset = offsetFormatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (offset === "GMT") {
    return 0;
  }

  const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new RangeError(
      `Unable to resolve ${OVERVIEW_TIME_ZONE} offset for ${date.toISOString()}`,
    );
  }

  const [, sign, hours, minutes] = match;
  const magnitude = (Number(hours) * 60 + Number(minutes)) * 60_000;
  return sign === "+" ? magnitude : -magnitude;
}

function localDateTimeToUtc(localDate: string, hour = 0): Date {
  const { year, month, day } = parseLocalDate(localDate);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour);
  const firstOffset = getOffsetMilliseconds(new Date(wallClockAsUtc));
  const firstCandidate = new Date(wallClockAsUtc - firstOffset);
  const resolvedOffset = getOffsetMilliseconds(firstCandidate);

  return new Date(wallClockAsUtc - resolvedOffset);
}

function buildRange(localStartDate: string, localEndDate: string): OverviewRange {
  return {
    localStartDate,
    localEndDate,
    utcStart: localDateTimeToUtc(localStartDate),
    utcEnd: localDateTimeToUtc(addLocalDays(localEndDate, 1)),
  };
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function formatManaguaDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("Invalid date");
  }

  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function buildOverviewRanges(
  period: OverviewPeriod,
  now: Date,
): OverviewRanges {
  const today = formatManaguaDate(now);
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
      current: buildRange(currentStart, today),
      previous: buildRange(
        formatDateParts(previousYear, previousMonth, 1),
        formatDateParts(previousYear, previousMonth, previousEndDay),
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
    current: buildRange(currentStart, today),
    previous: buildRange(previousStart, previousEnd),
  };
}

export function buildOverviewBucketKeys(
  ranges: OverviewRanges,
): OverviewBucket[] {
  if (ranges.bucketUnit === "hour") {
    return Array.from({ length: 24 }, (_, hour) => {
      const nextHour = hour + 1;
      const utcEnd =
        nextHour === 24
          ? localDateTimeToUtc(addLocalDays(ranges.current.localStartDate, 1))
          : localDateTimeToUtc(ranges.current.localStartDate, nextHour);

      return {
        key: `${ranges.current.localStartDate}T${hour
          .toString()
          .padStart(2, "0")}`,
        label: `${hour.toString().padStart(2, "0")}:00`,
        unit: "hour",
        localDate: ranges.current.localStartDate,
        utcStart: localDateTimeToUtc(ranges.current.localStartDate, hour),
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
      utcStart: localDateTimeToUtc(localDate),
      utcEnd: localDateTimeToUtc(addLocalDays(localDate, 1)),
    });
    localDate = addLocalDays(localDate, 1);
  }

  return buckets;
}
