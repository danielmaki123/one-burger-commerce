export function getHomePageShellClassName() {
  return "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-10 pt-4 xl:px-6";
}

export function getHomeHeroFrameClassName() {
  return "relative h-[320px] w-full overflow-hidden rounded-[28px] bg-coal sm:h-[420px] lg:h-[460px]";
}

export function getHomeHeroLoadingClassName() {
  return "flex h-[320px] items-center justify-center rounded-[28px] border border-border bg-card/60 sm:h-[420px] lg:h-[460px]";
}

export function getHomeHeroTitleClassName() {
  // Escala del mock (T1.3): 30 px en celular y 40 px en escritorio, con su
  // interlineado y su peso. Antes eran tres tamaños sueltos en la clase.
  return "max-w-full break-words text-display text-white sm:max-w-[16ch] lg:text-display-lg";
}

/** Nombre del negocio en el encabezado: paso `headline` de la escala del mock. */
export function getHomeBrandNameClassName() {
  return "text-headline text-ink-green";
}

export function normalizeHomeHeroDescription(description: string) {
  return description.replace(
    "Para disfrutar mas la mesa",
    "Para disfrutar más la mesa",
  );
}

export function getHomePopularCtaClassName() {
  return "flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground";
}
