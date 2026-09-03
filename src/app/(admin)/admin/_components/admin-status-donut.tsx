"use client";

const CHART_COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type DonutSlice = {
  label: string;
  value: number;
};

type AdminStatusDonutProps = {
  title: string;
  slices: DonutSlice[];
};

const SIZE = 120;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AdminStatusDonut({ title, slices }: AdminStatusDonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <div
          className="rounded-full border-[16px] border-muted"
          style={{ width: SIZE, height: SIZE }}
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Sin datos de {title.toLowerCase()}.</p>
      </div>
    );
  }

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 -rotate-90" role="img" aria-label={title}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        {slices.map((slice, index) => {
          if (slice.value === 0) return null;
          const fraction = slice.value / total;
          const dash = fraction * CIRCUMFERENCE;
          const dashArray = `${dash} ${CIRCUMFERENCE - dash}`;
          const circle = (
            <circle
              key={slice.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={CHART_COLOR_VARS[index % CHART_COLOR_VARS.length]}
              strokeWidth={STROKE}
              strokeDasharray={dashArray}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return circle;
        })}
        <text
          x={SIZE / 2}
          y={SIZE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 fill-foreground text-[22px] font-bold"
          style={{ transformOrigin: "center", transformBox: "fill-box" }}
        >
          {total}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLOR_VARS[index % CHART_COLOR_VARS.length] }}
                aria-hidden="true"
              />
              <span className="truncate text-muted-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-foreground">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
