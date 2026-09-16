const overviewDeltaFormatter = new Intl.NumberFormat("es-NI", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

const overviewIntegerFormatter = new Intl.NumberFormat("es-NI", {
  maximumFractionDigits: 0,
});

const overviewDateFormatter = new Intl.DateTimeFormat("es-NI", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatOverviewDelta(changePercent: number | null): string {
  if (changePercent === null) {
    return "Sin base de comparación";
  }

  return `${overviewDeltaFormatter.format(changePercent)} % vs. período anterior`;
}

export function formatOverviewInteger(value: number): string {
  return overviewIntegerFormatter.format(value);
}

export function formatOverviewCount(
  value: number,
  singular: string,
  plural: string,
): string {
  return `${formatOverviewInteger(value)} ${value === 1 ? singular : plural}`;
}

export function formatOverviewPeriodRange(
  localStartDate: string,
  localEndDate: string,
): string {
  const start = new Date(`${localStartDate}T00:00:00.000Z`);
  const end = new Date(`${localEndDate}T00:00:00.000Z`);

  return `${overviewDateFormatter.format(start)} – ${overviewDateFormatter.format(end)}`;
}
