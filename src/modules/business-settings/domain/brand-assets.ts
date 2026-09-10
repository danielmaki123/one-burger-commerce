import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

/** Tipo mínimo que necesitan los resolvers: sirve para el registro y para el draft. */
export type BrandAssets = {
  name: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
};

/**
 * Favicon que sembró la migración inicial.
 *
 * No cuenta como elección del owner: mientras siga ahí, el favicon sigue al
 * isotipo. Si no, el valor sembrado taparía el logo que el owner configuró y su
 * pestaña seguiría mostrando el ícono viejo.
 */
export const LEGACY_DEFAULT_FAVICON_URL = DEFAULT_BUSINESS_SETTINGS.faviconUrl;

export type BrandImageVariant = "mark" | "full";

/**
 * Logo a mostrar. `mark` es el isotipo (header, admin) y `full` el logo completo
 * (footer, confirmaciones); cada uno cae al otro si solo hay uno configurado.
 *
 * Devuelve `null` cuando no hay ningún logo: el consumidor usa las iniciales.
 */
export function resolveBrandImageUrl(
  assets: Pick<BrandAssets, "logoUrl" | "logoMarkUrl">,
  variant: BrandImageVariant,
): string | null {
  if (variant === "full") {
    return assets.logoUrl ?? assets.logoMarkUrl;
  }

  return assets.logoMarkUrl ?? assets.logoUrl;
}

/** Favicon efectivo: el elegido a mano, o el isotipo, o el asset de respaldo. */
export function resolveFaviconUrl(
  assets: Pick<BrandAssets, "logoMarkUrl"> & { faviconUrl: string | null },
): string | null {
  const explicit = assets.faviconUrl;

  if (explicit && explicit !== LEGACY_DEFAULT_FAVICON_URL) {
    return explicit;
  }

  return assets.logoMarkUrl ?? explicit ?? LEGACY_DEFAULT_FAVICON_URL;
}
