import type { BusinessSettingsColors } from "@/modules/business-settings/domain/color-contrast";

export type ColorPreset = {
  id: string;
  label: string;
  description: string;
  colors: BusinessSettingsColors;
};

/**
 * Esquemas de color curados.
 *
 * Todos pasan el control de contraste (`color-contrast.test.ts` falla si alguno
 * deja de cumplir WCAG AA): el objetivo es que el owner pueda cambiar la paleta
 * sin poder dejar el sitio ilegible de un click.
 */
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "actual",
    label: "Actual",
    description: "El esquema actual del negocio.",
    colors: {
      primaryColor: "#2b6c96",
      accentColor: "#eaf1f6",
      backgroundColor: "#fbf9f5",
      foregroundColor: "#23303a",
      surfaceColor: "#ffffff",
    },
  },
  {
    id: "brasa",
    label: "Brasa",
    description: "Rojo de parrilla sobre lienzo cálido.",
    colors: {
      primaryColor: "#a8321f",
      accentColor: "#f7e6e0",
      backgroundColor: "#fdf8f4",
      foregroundColor: "#2e211d",
      surfaceColor: "#ffffff",
    },
  },
  {
    id: "bosque",
    label: "Bosque",
    description: "Verde profundo, tono natural.",
    colors: {
      primaryColor: "#1f6f45",
      accentColor: "#e6f1e8",
      backgroundColor: "#f8faf7",
      foregroundColor: "#1d2b23",
      surfaceColor: "#ffffff",
    },
  },
  {
    id: "carbon",
    label: "Carbón",
    description: "Gris carbón neutro, minimalista.",
    colors: {
      primaryColor: "#2f3a45",
      accentColor: "#eceff2",
      backgroundColor: "#fafafa",
      foregroundColor: "#1f262d",
      surfaceColor: "#ffffff",
    },
  },
  {
    id: "noche",
    label: "Noche",
    description: "Azul noche con acento dorado.",
    colors: {
      primaryColor: "#1b3a5c",
      accentColor: "#f4ecd8",
      backgroundColor: "#fbfaf6",
      foregroundColor: "#1c2733",
      surfaceColor: "#ffffff",
    },
  },
  {
    id: "morado",
    label: "Uva",
    description: "Violeta urbano sobre blanco.",
    colors: {
      primaryColor: "#5b3fa8",
      accentColor: "#ede8f8",
      backgroundColor: "#fbfaff",
      foregroundColor: "#241d38",
      surfaceColor: "#ffffff",
    },
  },
];
