import { contrastRatio } from "@/modules/business-settings/domain/color-contrast";
import { HEX_COLOR_PATTERN } from "@/modules/business-settings/domain/business-settings.types";

/**
 * Color por categoría (T3.1).
 *
 * El owner elige un color por categoría en `/admin/menu` y la carta pública pinta
 * las tarjetas con él, como el mock. Como el color lo elige una persona y el
 * texto lo ponemos nosotros, acá se decide **qué texto va encima**: el más
 * legible de los dos candidatos. Si ninguno llega a AA, el admin lo avisa (no se
 * bloquea el guardado: es la misma política que la paleta de apariencia).
 */

/** Texto oscuro del sistema, el mismo que usa el lienzo del sitio. */
export const CATEGORY_DARK_TEXT = "#1f1916";
/** Texto claro del sistema (`--brand-foreground`). */
export const CATEGORY_LIGHT_TEXT = "#f7fafc";

/** Mínimo AA para texto normal (WCAG 2.1, 1.4.3). */
export const CATEGORY_TEXT_MIN_CONTRAST = 4.5;

export type CategoryCardColors = {
  backgroundColor: string;
  foregroundColor: string;
};

export type CategoryColorContrastWarning = {
  ratio: number;
  required: number;
};

/** Devuelve el hex normalizado, o `null` si está vacío o no es un color válido. */
export function normalizeCategoryColor(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

function bestForeground(backgroundColor: string): { color: string; ratio: number } {
  const light = contrastRatio(backgroundColor, CATEGORY_LIGHT_TEXT) ?? 0;
  const dark = contrastRatio(backgroundColor, CATEGORY_DARK_TEXT) ?? 0;

  return light >= dark
    ? { color: CATEGORY_LIGHT_TEXT, ratio: light }
    : { color: CATEGORY_DARK_TEXT, ratio: dark };
}

/**
 * Colores de la tarjeta para una categoría.
 *
 * `null` cuando la categoría no tiene color: ahí la tarjeta usa los tokens del
 * sistema, no un color inventado.
 */
export function resolveCategoryCardColors(
  color: string | null | undefined,
): CategoryCardColors | null {
  const normalized = normalizeCategoryColor(color);
  if (!normalized) return null;

  return {
    backgroundColor: normalized,
    foregroundColor: bestForeground(normalized).color,
  };
}

/**
 * Aviso para el admin cuando el mejor texto posible no llega a AA.
 *
 * Que un color sea ilegible no rompe el sitio (siempre se elige el mejor texto),
 * pero el owner tiene que enterarse antes de guardarlo.
 */
export function categoryColorContrastWarning(
  color: string | null | undefined,
): CategoryColorContrastWarning | null {
  const normalized = normalizeCategoryColor(color);
  if (!normalized) return null;

  const { ratio } = bestForeground(normalized);
  if (ratio >= CATEGORY_TEXT_MIN_CONTRAST) return null;

  return {
    ratio: Math.round(ratio * 100) / 100,
    required: CATEGORY_TEXT_MIN_CONTRAST,
  };
}
