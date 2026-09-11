export const publicCheckoutScaleClasses = {
  layoutShell:
    "mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start",
  pageHeading:
    "max-w-[11ch] text-[1.75rem] font-bold leading-[1.04] tracking-[-0.01em] text-foreground sm:text-[2rem]",
  formSection:
    "rounded-[24px] border border-white/80 bg-card/92 p-4 shadow-[0_28px_70px_-42px_rgba(41,37,36,0.75)] ring-1 ring-border sm:p-5",
  // El CTA solo se deshabilita mientras se envía, así que la señal de deshabilitado
  // tiene que ser la normal: antes una clase la anulaba y el botón parecía activo.
  primaryCta:
    "h-14 w-full rounded-2xl text-base font-semibold shadow-[0_18px_36px_-24px_rgba(28,25,23,0.85)]",
} as const;

export function getPublicCheckoutMobileActionClassName() {
  return "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-white/60 bg-card/90 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_42px_-30px_rgba(41,37,36,0.9)] backdrop-blur lg:hidden";
}
