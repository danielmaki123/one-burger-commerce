import { execFileSync } from "node:child_process";

import ts from "typescript";

/**
 * TASK-AUD-001 — ratchet de las **allowlists** de los contratos.
 *
 * El repo congela deuda histórica en listas de excepciones (`tdd-contract`, `route-contract`,
 * `module-contract`, `ui-contract`). Cada una de esas listas tiene un test que detecta **filas muertas**
 * (la deuda que ya no existe), pero **ninguna** detecta una fila **nueva**: agregar una excepción era una
 * forma silenciosa de apagar un guardrail.
 *
 * Ese es el hueco que cierra este módulo, con la invariante de AUD-001:
 *
 * > Un test o excepción nuevos no pueden reducir silenciosamente la capacidad del repositorio de detectar
 * > una regresión.
 *
 * Dos mecanismos, complementarios:
 *
 * 1. **Inventario congelado** (`test-integrity-baseline.json`, determinista): la allowlist real tiene que
 *    coincidir con el inventario. Cualquier cambio exige tocar el inventario en el mismo commit.
 * 2. **Comparación contra la rama base** (git): el inventario no puede **crecer** respecto de `main`.
 *    Cubre el caso de alguien que agrega la fila *y* actualiza el inventario.
 *
 * La extracción es sintáctica (AST) y **no ejecuta** el archivo: una allowlist se lee, no se importa.
 */

export type AllowanceSource = {
  /** Archivo del repo que declara la allowlist. */
  file: string;
  /** Nombre del `const` que la declara. */
  symbol: string;
  /** Para qué sirve, en el mensaje de error. */
  purpose: string;
};

export type Allowance = {
  /** Claves ordenadas (filas de la allowlist). */
  keys: string[];
  /** Techos numéricos por clave, cuando la allowlist es `Record<string, number>`. */
  ceilings: Record<string, number>;
};

export type AllowanceDiff = {
  added: string[];
  removed: string[];
  raised: Array<{ key: string; from: number; to: number }>;
  lowered: Array<{ key: string; from: number; to: number }>;
};

/**
 * Las allowlists que este ratchet vigila.
 *
 * **`design-tokens.allow.json` no está acá a propósito**: sus techos ya tienen su propio ratchet en
 * `design-guardrails-contract.test.ts` («no sube el techo» / «si baja, lo baja en el mismo commit»).
 * Repetirlo sería una segunda fuente de verdad para la misma regla.
 */
export const ALLOWANCE_SOURCES: readonly AllowanceSource[] = [
  {
    file: "src/shared/contracts/tdd-contract.test.ts",
    symbol: "EXCEPTIONS",
    purpose: "deuda de TDD congelada (ruta, caso de uso o primitivo sin test)",
  },
  {
    file: "src/shared/contracts/route-contract.test.ts",
    symbol: "LEGACY_ROUTE_LINES",
    purpose: "route handlers que todavía pasan las 50 líneas",
  },
  {
    file: "src/shared/contracts/route-contract.test.ts",
    symbol: "LEGACY_ROUTE_PRISMA",
    purpose: "route handlers que todavía instancian Prisma",
  },
  {
    file: "src/shared/contracts/module-contract.test.ts",
    symbol: "LEGACY_PARTIAL_MODULES",
    purpose: "módulos sin las cuatro capas",
  },
  {
    file: "src/shared/contracts/ui-contract.test.ts",
    symbol: "LEGACY_RAW_CONTROLS",
    purpose: "controles HTML crudos donde ya hay primitivo",
  },
  {
    file: "src/shared/contracts/ui-contract.test.ts",
    symbol: "LEGACY_HEX",
    purpose: "#hex fuera de los tokens",
  },
];

/** Clave estable de una allowlist dentro del inventario: archivo + símbolo. */
export function allowanceKey(source: AllowanceSource): string {
  return `${source.file}::${source.symbol}`;
}

function propertyNameOf(node: ts.PropertyAssignment): string | null {
  const name = node.name;

  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

/**
 * Extrae una allowlist de un archivo, por AST.
 *
 * Soporta las dos formas que usa el repo:
 * - `const X: Record<string, string | number> = { "clave": ... }` → claves (y techos si el valor es numérico);
 * - `const X = new Set([ "a", "b" ])` → miembros.
 *
 * Devuelve `null` cuando el símbolo no existe: el contrato lo trata como error, no como lista vacía
 * (una allowlist que desaparece no puede hacer pasar el gate en silencio).
 */
export function extractAllowance(source: string, symbol: string): Allowance | null {
  const sourceFile = ts.createSourceFile("allowance.ts", source, ts.ScriptTarget.Latest, true);
  let found: Allowance | null = null;

  const visit = (node: ts.Node): void => {
    if (found !== null) {
      return;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === symbol &&
      node.initializer !== undefined
    ) {
      const initializer = node.initializer;

      if (ts.isObjectLiteralExpression(initializer)) {
        const keys: string[] = [];
        const ceilings: Record<string, number> = {};

        for (const property of initializer.properties) {
          if (!ts.isPropertyAssignment(property)) {
            continue;
          }

          const name = propertyNameOf(property);
          if (name === null) {
            continue;
          }

          keys.push(name);

          if (ts.isNumericLiteral(property.initializer)) {
            ceilings[name] = Number(property.initializer.text);
          }
        }

        found = { keys: keys.sort(), ceilings };
        return;
      }

      if (
        ts.isNewExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === "Set" &&
        initializer.arguments !== undefined &&
        initializer.arguments.length === 1 &&
        ts.isArrayLiteralExpression(initializer.arguments[0])
      ) {
        const keys = initializer.arguments[0].elements
          .filter((element): element is ts.StringLiteralLike => ts.isStringLiteralLike(element))
          .map((element) => element.text)
          .sort();

        found = { keys, ceilings: {} };
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return found;
}

/** Compara la allowlist real contra el inventario congelado (o contra el de la rama base). */
export function compareAllowances(actual: Allowance, baseline: Allowance): AllowanceDiff {
  const actualKeys = new Set(actual.keys);
  const baselineKeys = new Set(baseline.keys);

  const raised: AllowanceDiff["raised"] = [];
  const lowered: AllowanceDiff["lowered"] = [];

  for (const [key, value] of Object.entries(actual.ceilings)) {
    const before = baseline.ceilings[key];

    if (before === undefined) {
      continue;
    }

    if (value > before) {
      raised.push({ key, from: before, to: value });
    } else if (value < before) {
      lowered.push({ key, from: before, to: value });
    }
  }

  return {
    added: actual.keys.filter((key) => !baselineKeys.has(key)),
    removed: baseline.keys.filter((key) => !actualKeys.has(key)),
    raised,
    lowered,
  };
}

/** `true` cuando el diff empeora la capacidad del repo de detectar una regresión. */
export function isWorsening(diff: AllowanceDiff): boolean {
  return diff.added.length > 0 || diff.raised.length > 0;
}

/**
 * Resuelve la rama base contra la que comparar.
 *
 * Se prefiere el **merge-base** con `origin/main`: comparar contra el tip de `main` castigaría a la rama
 * por cambios que hizo `main` después de que la rama nació. Devuelve `null` cuando no hay historia
 * disponible (clon superficial): el llamador decide, y en CI el job `contracts` trae la historia completa.
 */
export function resolveBaseRef(): string | null {
  const attempts: string[][] = [
    ["merge-base", "HEAD", "origin/main"],
    ["rev-parse", "--verify", "origin/main"],
    ["rev-parse", "--verify", "main"],
  ];

  for (const args of attempts) {
    try {
      const out = execFileSync("git", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (out.length > 0) {
        return out;
      }
    } catch {
      // Se prueba la siguiente forma; si ninguna resuelve, no hay base.
    }
  }

  return null;
}

/** Contenido de un archivo en una revisión concreta, o `null` si no se puede leer. */
export function readFileAtRef(ref: string, file: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}
