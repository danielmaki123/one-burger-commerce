import { listFiles, readRepoFile } from "./contract-files";
import {
  DESIGN_GUARDRAIL_ALLOW_COMMENT,
  type DesignGuardrailAllowList,
} from "./design-guardrails-allow";

/**
 * Medición de los guardrails de UI de C1-2 (`plan2uiux.md`).
 *
 * Vive acá y no dentro del test porque la usan dos: el contrato que falla y el script que regenera
 * los techos iniciales (`scripts/update-design-guardrails.mjs`). Una sola definición de "violación"
 * para los dos, que es la regla de `AGENTS.md` ("una sola fuente por cálculo").
 */

/** Dónde se mide. Los archivos de test y las carpetas ignoradas quedan afuera por definición. */
const MEASURED_DIRECTORIES = ["src/app", "src/shared/ui"] as const;

const MEASURED_EXTENSIONS = /\.(ts|tsx|css)$/;

function isMeasuredFile(repoPath: string): boolean {
  if (/\.test\.(ts|tsx)$/.test(repoPath)) return false;
  if (repoPath.endsWith(".d.ts")) return false;
  return MEASURED_EXTENSIONS.test(repoPath);
}

/** Una regla: qué busca, por qué, y con qué patrón. El `message` es el que lee quien la rompe. */
export interface DesignGuardrailRule {
  id: string;
  message: string;
  pattern: RegExp;
  /**
   * Archivos donde la regla **no aplica** porque ahí el valor crudo es el **dato**, no un estilo. Se evalúa
   * por regla y por ruta: la fuente de tokens y las herramientas de color del negocio nunca son deuda.
   */
  skipFile?: (repoPath: string) => boolean;
}

/**
 * La **fuente de tokens**: es el único lugar donde un color se declara como token, así que ahí un valor
 * crudo no es deuda (es la definición). Misma ruta que usa `ui-contract.test.ts`.
 */
export const DESIGN_GUARDRAIL_TOKEN_SOURCE = "src/app/globals.css";

/**
 * Archivos donde el color **es el dato**: la paleta que el owner elige en `/admin/settings` y las
 * herramientas que la validan (contraste) o la derivan (color de categoría). Es la misma lista que declara
 * `ui-contract.test.ts` para el `#hex`: mover un color de acá a la UI es el error que estos contratos evitan.
 */
export const DESIGN_GUARDRAIL_COLOR_DATA_FILES = new Set([
  "src/modules/business-settings/domain/color-presets.ts",
  "src/modules/business-settings/domain/business-settings-defaults.ts",
  "src/modules/business-settings/domain/business-settings.schema.ts",
  "src/modules/business-settings/domain/color-contrast.ts",
  "src/modules/menu/domain/category-color.ts",
]);

function isColorData(repoPath: string): boolean {
  return repoPath === DESIGN_GUARDRAIL_TOKEN_SOURCE || DESIGN_GUARDRAIL_COLOR_DATA_FILES.has(repoPath);
}

/**
 * Las ocho reglas de C1-2 (las siete del plan más el control HTML crudo, que ya tenía techo en
 * `ui-contract.test.ts` y acá queda con el mismo criterio por archivo).
 *
 * Notas de precisión, para que el guardrail no mienta:
 *
 * - **Paleta cruda**: se listan las familias que el design system prohíbe, con `-600`/`-700`/etc. para
 *   no matchear palabras sueltas (`text-red-500` sí, `border-red-flag` no).
 * - **`fontFamily` inline**: solo cuando el valor es un literal de familia; un `var(--font-heading)`
 *   no es una violación.
 * - **HTML crudo**: solo en `src/app` (`<button`, `<input`, `<select`, `<textarea>`); en
 *   `src/shared/ui` los primitivos **son** esos elementos y no cuentan.
 * - **`rounded-full` NO está en la lista, a propósito**: en este repo es legítimo para las piezas
 *   circulares (el sello de marca, el pulgar del `Toggle`, los puntos de estado) y prohibirlo en
 *   bloque dejaría el guardrail tapando trabajo válido. Lo que sí se prohíbe es el radio **arbitrario**
 *   (`rounded-[Npx]`), que es el defecto medido.
 */
export const DESIGN_GUARDRAIL_RULES: DesignGuardrailRule[] = [
  {
    id: "raw-palette",
    message: "paleta cruda de Tailwind donde hay token (usá bg-brand, text-danger-foreground, …)",
    pattern:
      /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|shadow|accent|caret|placeholder)-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
  },
  {
    id: "inline-font-family",
    message:
      "fontFamily inline que duplica font-heading (usá la clase font-heading o la familia del body)",
    pattern: /fontFamily:\s*(?!var\()['"`]/g,
  },
  {
    id: "arbitrary-radius",
    message: "radio arbitrario (usá rounded-card, rounded-panel o rounded-full del sistema)",
    pattern: /\brounded-\[[^\]]+\]/g,
  },
  {
    id: "arbitrary-text-size",
    message: "tamaño de texto arbitrario (usá la escala: text-display, text-title, text-label, …)",
    pattern: /\btext-\[[^\]]+\]/g,
  },
  {
    id: "arbitrary-shadow",
    message: "sombra arbitraria (usá shadow-card, shadow-raised o shadow-float)",
    pattern: /\bshadow-\[[^\]]+\]/g,
  },
  {
    id: "window-confirm",
    message: "window.confirm (usá el primitivo Modal)",
    pattern: /\bwindow\.confirm\s*\(/g,
  },
  {
    id: "manual-aria-role",
    message: 'role="dialog" o role="switch" a mano (usá Modal o Toggle)',
    pattern: /role="(?:dialog|switch)"/g,
  },
  {
    id: "raw-html-control",
    message: "control HTML crudo donde hay primitivo (Button, Input, Select, Textarea, Toggle, …)",
    pattern: /<(?:button|input|select|textarea)(?=[\s>/])/g,
  },
  {
    /**
     * DS-001 — el `#hex` ya tenía techo (`ui-contract.test.ts`); esto cierra el resto de la ley de color:
     * `rgb()`, `rgba()`, `hsl()` y `hsla()` crudos en un componente son deuda **nueva prohibida**. La deuda
     * vieja queda congelada por archivo (no se obliga a limpiarla) y la fuente de tokens y los archivos de
     * color del negocio quedan excluidos: ahí el valor es el dato, no un estilo.
     *
     * El lookbehind evita falsos positivos dentro de un identificador (`--my-rgba`), y no toca
     * `color-mix(in srgb, …)`, que es derivación de un token y no un color literal.
     */
    id: "raw-color-function",
    message: "color crudo en rgb()/rgba()/hsl()/hsla() (usá un token: bg-surface-card, text-ink-muted, …)",
    pattern: /(?<![\w-])(?:rgba?|hsla?)\s*\(/g,
    skipFile: isColorData,
  },
];

export interface DesignGuardrailViolation {
  rule: string;
  path: string;
  count: number;
}

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

/**
 * Mide todas las reglas sobre el código real y devuelve **solo** lo que tiene al menos una violación,
 * ordenado por regla y ruta para que el JSON sea estable entre corridas.
 */
export function measureDesignGuardrails(): DesignGuardrailViolation[] {
  const sources = MEASURED_DIRECTORIES.flatMap((directory) =>
    listFiles(directory, isMeasuredFile),
  ).sort();

  const violations: DesignGuardrailViolation[] = [];

  for (const rule of DESIGN_GUARDRAIL_RULES) {
    for (const path of sources) {
      // El HTML crudo no aplica a los primitivos: ahí el `<button>` es el componente, no una violación.
      if (rule.id === "raw-html-control" && path.startsWith("src/shared/ui/")) continue;
      // Donde el color es el dato (tokens y paleta del negocio) la regla no mide: no es deuda.
      if (rule.skipFile?.(path)) continue;

      const count = countMatches(readRepoFile(path), rule.pattern);
      if (count > 0) violations.push({ rule: rule.id, path, count });
    }
  }

  return violations;
}

/** Las violaciones agrupadas por regla, que es como se guardan en el JSON de techos. */
export function violationsByRule(
  violations: DesignGuardrailViolation[],
): Record<string, Record<string, number>> {
  const byRule: Record<string, Record<string, number>> = {};

  for (const violation of violations) {
    byRule[violation.rule] = byRule[violation.rule] ?? {};
    byRule[violation.rule][violation.path] = violation.count;
  }

  return byRule;
}

/** El JSON de techos a partir de una medición: es lo que regenera el script de actualización. */
export function buildAllowList(
  violations: DesignGuardrailViolation[],
  { version, updated }: { version: number; updated: string },
): DesignGuardrailAllowList {
  const rules: Record<string, Record<string, number>> = {};

  for (const rule of DESIGN_GUARDRAIL_RULES) {
    const files: Record<string, number> = {};
    for (const violation of violations) {
      if (violation.rule === rule.id) files[violation.path] = violation.count;
    }
    if (Object.keys(files).length > 0) rules[rule.id] = files;
  }

  return { $comment: DESIGN_GUARDRAIL_ALLOW_COMMENT, version, updated, rules };
}
