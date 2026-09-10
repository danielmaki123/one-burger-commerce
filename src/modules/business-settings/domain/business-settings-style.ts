import type { CSSProperties } from "react";

import type { BusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings.types";

/** Campos de la configuración que se traducen a tokens CSS. */
export type BusinessSettingsAppearance = Pick<
  BusinessSettingsRecord,
  | "primaryColor"
  | "accentColor"
  | "backgroundColor"
  | "foregroundColor"
  | "surfaceColor"
  | "headingFont"
  | "bodyFont"
>;

/**
 * Tokens CSS que aplican la apariencia configurada sin inyectar HTML.
 *
 * Vive en el dominio (y no junto al provider cliente) porque la llama el layout
 * raíz, que es un componente de servidor: exportarla desde un módulo con
 * `"use client"` rompe el render con "Attempted to call ... from the server".
 */
export function businessSettingsStyleVariables(
  settings: BusinessSettingsAppearance,
): CSSProperties {
  return {
    "--brand": settings.primaryColor,
    "--accent": settings.accentColor,
    "--background": settings.backgroundColor,
    "--foreground": settings.foregroundColor,
    "--card": settings.surfaceColor,
    // Solo se puede elegir entre las tipografías incluidas en el build.
    "--font-heading": `var(--font-${settings.headingFont})`,
    "--font-body": `var(--font-${settings.bodyFont})`,
  } as CSSProperties;
}
