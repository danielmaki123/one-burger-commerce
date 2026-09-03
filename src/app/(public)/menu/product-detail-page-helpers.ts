export const publicProductDetailScaleClasses = {
  hero: "relative h-[18rem] w-full bg-cream sm:h-[20rem] lg:h-[22.5rem]",
  shell: "mx-auto -mt-12 max-w-3xl px-4 sm:-mt-14",
  surfaceCard:
    "rounded-[28px] border border-border bg-card px-4 py-5 shadow-[0_24px_60px_rgba(60,40,20,0.12)] backdrop-blur-sm sm:px-6 sm:py-6",
  heading:
    "text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2rem]",
  bodyCopy: "text-[0.95rem] leading-6 text-muted-foreground",
  surfacePanel: "rounded-[24px] border border-border bg-cream/40 p-4 shadow-sm",
  stepperButton:
    "h-11 w-11 rounded-full border border-border bg-card p-0 text-foreground hover:bg-cream",
  primaryCta: "h-14 rounded-[20px] text-base font-semibold",
} as const;
