import type { StatusTone } from "@/shared/lib/activity-status";

type StatusProgressProps = {
  steps: readonly string[];
  currentIndex: number;
  statusLabel: string;
  tone: StatusTone;
  isTerminalNegative?: boolean;
  className?: string;
};

function toneClasses(tone: StatusTone, isTerminalNegative: boolean) {
  if (isTerminalNegative || tone === "danger") {
    return {
      badge: "bg-danger text-danger-foreground",
      done: "bg-danger-strong/45",
      current: "bg-danger-strong",
    };
  }

  if (tone === "success") {
    return {
      badge: "bg-success text-success-foreground",
      done: "bg-success-strong/45",
      current: "bg-success-strong",
    };
  }

  return {
    badge: "bg-warning text-warning-foreground",
    done: "bg-warning-strong/45",
    current: "bg-warning-strong",
  };
}

export function StatusProgress({
  steps,
  currentIndex,
  statusLabel,
  tone,
  isTerminalNegative = false,
  className = "",
}: StatusProgressProps) {
  const index = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const colors = toneClasses(tone, isTerminalNegative);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className={`rounded-full px-2 py-1 text-xs font-semibold ${colors.badge}`}>{statusLabel}</p>
        <p className="text-xs text-muted-foreground">
          {index + 1}/{steps.length}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {steps.map((step, stepIndex) => {
          const isDone = stepIndex < index;
          const isCurrent = stepIndex === index;
          return (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={`h-2 min-w-[8px] flex-1 rounded-full ${
                  isCurrent ? colors.current : isDone ? colors.done : "bg-border"
                }`}
              />
              <span className="hidden text-[10px] text-muted-foreground sm:inline">{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
