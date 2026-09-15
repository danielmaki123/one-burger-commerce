/**
 * Techos por archivo de las violaciones de UI que todavía **no** tienen guardrail.
 *
 * Cómo se usa (decisión del owner, 2026-09-15, C1-2 de `plan2uiux.md`):
 *
 * - Se mide el código real (`src/app/**` y `src/shared/ui/**`, sin archivos de test) y el número de
 *   cada archivo queda **congelado** acá como techo.
 * - Un techo **nunca sube**. Si un archivo baja sus violaciones, se actualiza el número en el mismo
 *   commit (el test lo pide con el valor exacto).
 * - Si aparece un archivo con violaciones que no está en la lista, el test falla: no se agregan filas
 *   nuevas, se arregla el archivo.
 * - Al terminar la Capa 1.9 (oleadas completas), **todos los techos tienen que ser 0**.
 *
 * El archivo lo lee `design-guardrails-contract.test.ts`. Editar los números "a mano para que pase"
 * es exactamente lo que el contrato detecta.
 */
export interface DesignGuardrailAllowList {
  $comment?: string;
  version: number;
  updated: string;
  /** Regla → techo por archivo. Un archivo ausente de una regla tiene techo 0. */
  rules: Record<string, Record<string, number>>;
}

export const DESIGN_GUARDRAIL_ALLOW_PATH = "src/shared/config/design-tokens.allow.json";

export const DESIGN_GUARDRAIL_ALLOW_COMMENT =
  "Techos por archivo de las violaciones de UI (C1-2 de plan2uiux.md). Un techo NUNCA sube: si un archivo suma violaciones, el contrato falla. Si baja, se baja el numero aca en el mismo commit. Al terminar la Capa 1.9 todas las tablas quedan vacias (techos en 0). Lo verifica src/shared/contracts/design-guardrails-contract.test.ts.";
