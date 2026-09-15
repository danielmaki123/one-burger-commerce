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
      // El HTML crudo es la única regla que no aplica a los primitivos: ahí el `<button>` es el
      // componente, no una violación.
      if (rule.id === "raw-html-control" && path.startsWith("src/shared/ui/")) continue;

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
