import { HEX_COLOR_PATTERN } from "@/modules/business-settings/domain/business-settings.types";

/**
 * Color del texto que va **sobre** el color de marca (botones primarios).
 *
 * Espeja el token `--brand-foreground` de `globals.css`: no es configurable
 * (solo lo son `--brand`, `--accent`, `--background`, `--foreground` y `--card`),
 * pero igual se controla el contraste para avisar si un color de marca claro
 * deja el botón ilegible. Hay un test de contrato que verifica que coincidan.
 */
export const BRAND_FOREGROUND_COLOR = "#f7fafc";

/** Mínimos de WCAG 2.1 AA: 4.5:1 para texto, 3:1 para elementos de interfaz. */
export const TEXT_CONTRAST_MIN = 4.5;
const UI_CONTRAST_MIN = 3;

export type ContrastWarning = {
  /** Identificador estable, para tests y para la UI. */
  id: string;
  /** Qué combinación falló, en español. */
  label: string;
  ratio: number;
  required: number;
};

export type BusinessSettingsColors = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  surfaceColor: string;
};

/** Luminancia relativa de un color hex. `null` si el hex no es válido. */
export function relativeLuminance(hex: string): number | null {
  const normalized = hex.trim().toLowerCase();
  if (!HEX_COLOR_PATTERN.test(normalized)) return null;

  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Ratio de contraste WCAG entre dos colores. `null` si alguno no es válido. */
export function contrastRatio(a: string, b: string): number | null {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);

  if (luminanceA === null || luminanceB === null) return null;

  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);

  return (lighter + 0.05) / (darker + 0.05);
}

function evaluate(
  id: string,
  label: string,
  foreground: string,
  background: string,
  required: number,
): ContrastWarning | null {
  const ratio = contrastRatio(foreground, background);

  // Un color inválido lo rechaza la validación del formulario: acá no se avisa.
  if (ratio === null) return null;
  if (ratio >= required) return null;

  return { id, label, ratio: Math.round(ratio * 100) / 100, required };
}

/**
 * Avisos de contraste de la configuración. **No bloquea el guardado**: es un
 * aviso para que el owner vea el riesgo antes de publicar.
 */
export function checkBusinessSettingsContrast(
  settings: BusinessSettingsColors,
): ContrastWarning[] {
  return [
    evaluate(
      "foreground-background",
      "El texto principal sobre el fondo del sitio",
      settings.foregroundColor,
      settings.backgroundColor,
      TEXT_CONTRAST_MIN,
    ),
    evaluate(
      "foreground-surface",
      "El texto principal sobre las tarjetas",
      settings.foregroundColor,
      settings.surfaceColor,
      TEXT_CONTRAST_MIN,
    ),
    evaluate(
      "brand-foreground-brand",
      "El texto de los botones sobre el color de marca",
      BRAND_FOREGROUND_COLOR,
      settings.primaryColor,
      TEXT_CONTRAST_MIN,
    ),
    evaluate(
      "brand-background",
      "El color de marca sobre el fondo del sitio",
      settings.primaryColor,
      settings.backgroundColor,
      UI_CONTRAST_MIN,
    ),
    evaluate(
      "accent-foreground",
      "El texto sobre el color de acento",
      settings.foregroundColor,
      settings.accentColor,
      UI_CONTRAST_MIN,
    ),
  ].filter((warning): warning is ContrastWarning => warning !== null);
}
