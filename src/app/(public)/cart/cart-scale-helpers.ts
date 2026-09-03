export const publicCartScaleClasses = {
  shell:
    "mx-auto flex w-full max-w-4xl flex-col gap-5",
  heading:
    "text-[1.75rem] font-semibold tracking-[-0.01em] text-foreground sm:text-[2rem]",
  lineItemsFrame:
    "overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(32,24,16,0.04),0_6px_16px_-12px_rgba(32,24,16,0.10)]",
  lineCard:
    "rounded-none border-0 border-b border-border/70 bg-transparent shadow-none last:border-b-0",
  lineCardContent:
    "grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3 px-3 py-3 sm:px-4 sm:py-3.5",
  stepperButton:
    "h-11 w-11 rounded-full p-0 text-sm text-foreground hover:bg-cream",
  removeButton:
    "rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-cream hover:text-foreground",
  summaryCard: "overflow-hidden rounded-[22px] border border-border bg-card shadow-sm",
  summaryPrimaryCta: "h-12 w-full rounded-xl text-base font-semibold",
} as const;
