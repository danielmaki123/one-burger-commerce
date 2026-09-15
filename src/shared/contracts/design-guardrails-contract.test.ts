import { describe, expect, it } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { fileExists, readRepoFile, repoRoot } from "./contract-files";
import {
  DESIGN_GUARDRAIL_ALLOW_PATH,
  type DesignGuardrailAllowList,
} from "./design-guardrails-allow";
import {
  DESIGN_GUARDRAIL_RULES,
  buildAllowList,
  measureDesignGuardrails,
  violationsByRule,
} from "./design-guardrails";

/**
 * C1-2 de `plan2uiux.md` — los guardrails que faltaban, con **techo por archivo que solo baja**.
 *
 * Qué cambia contra `ui-contract.test.ts`: ese contrato ya cubre el HTML crudo y el `#hex` con techo
 * por archivo, pero los tres defectos que el design system tenía marcados como "todavía sin guardrail
 * automático" seguían dependiendo de la revisión a ojo: la **paleta cruda** de Tailwind, los
 * **`fontFamily` inline** y los **radios/sombras/tamaños arbitrarios**. Acá se congelan, junto con
 * `window.confirm` y los `role="dialog"`/`role="switch"` a mano.
 *
 * Las cuatro reglas del contrato (decisión del owner, 2026-09-15):
 *
 * 1. **Un techo nunca sube.** Si un archivo suma violaciones, el test falla.
 * 2. **Un archivo que baja su techo lo baja en el mismo commit**: el test lo pide con el número exacto.
 * 3. **Un archivo con violaciones que no está en la lista falla**: no se agregan filas, se arregla.
 * 4. **Una fila muerta falla**: si el archivo ya no existe o llegó a 0, la fila se borra.
 *
 * La meta de la CAPA 1.9 es que **todas** las tablas queden vacías (todos los techos en 0).
 */

function loadAllowList(): DesignGuardrailAllowList {
  return JSON.parse(readRepoFile(DESIGN_GUARDRAIL_ALLOW_PATH)) as DesignGuardrailAllowList;
}

/**
 * Bootstrap: si la lista de techos todavía no existe, se escribe con la medición actual.
 *
 * Se hace acá y no en un script aparte para no duplicar la definición de "violación": la medición es
 * la misma que usa el contrato. Corre **una sola vez** (cuando el archivo no está) y queda versionado.
 */
if (!fileExists(DESIGN_GUARDRAIL_ALLOW_PATH)) {
  const generated = buildAllowList(measureDesignGuardrails(), {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
  });

  writeFileSync(
    path.join(repoRoot, DESIGN_GUARDRAIL_ALLOW_PATH),
    `${JSON.stringify(generated, null, 2)}\n`,
    "utf8",
  );
}

describe("contrato · los guardrails de UI con techo por archivo (C1-2)", () => {
  it("no sube el techo de ningún archivo", () => {
    const allowList = loadAllowList();
    const measured = violationsByRule(measureDesignGuardrails());

    const offenders: string[] = [];

    for (const rule of DESIGN_GUARDRAIL_RULES) {
      const ceiling = allowList.rules[rule.id] ?? {};

      for (const [file, count] of Object.entries(measured[rule.id] ?? {})) {
        const allowed = ceiling[file] ?? 0;

        if (count > allowed) {
          offenders.push(
            `${file}: ${count} × ${rule.id} (techo ${allowed}). ${rule.message}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("un archivo que bajó su techo lo baja en el mismo commit", () => {
    const allowList = loadAllowList();
    const measured = violationsByRule(measureDesignGuardrails());

    const outdated: string[] = [];

    for (const rule of DESIGN_GUARDRAIL_RULES) {
      const ceiling = allowList.rules[rule.id] ?? {};

      for (const [file, allowed] of Object.entries(ceiling)) {
        const count = measured[rule.id]?.[file] ?? 0;

        if (count < allowed) {
          outdated.push(
            `${rule.id} · ${file}: techo ${allowed} → ${count} (${count === 0 ? "borrá la fila" : "bajá el número"})`,
          );
        }
      }
    }

    expect(
      outdated,
      "el techo solo baja: actualizá src/shared/config/design-tokens.allow.json en este commit",
    ).toEqual([]);
  });

  it("no deja filas muertas: el archivo existe y todavía tiene esa violación", () => {
    const allowList = loadAllowList();

    const dead: string[] = [];

    for (const [rule, files] of Object.entries(allowList.rules)) {
      for (const file of Object.keys(files)) {
        if (!existsSync(path.join(repoRoot, file))) {
          dead.push(`${rule} · ${file}: el archivo ya no existe`);
        }
      }
    }

    expect(dead).toEqual([]);
  });

  it("la lista de techos está versionada y declara su forma", () => {
    const allowList = loadAllowList();

    expect(allowList.version).toBe(1);
    expect(allowList.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const unknownRules = Object.keys(allowList.rules).filter(
      (rule) => !DESIGN_GUARDRAIL_RULES.some((known) => known.id === rule),
    );

    expect(unknownRules, "una regla que ya no existe deja su tabla colgada").toEqual([]);
  });
});
