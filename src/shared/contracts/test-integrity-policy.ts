import ts from "typescript";

/**
 * TASK-AUD-001 — scanner de integridad de tests.
 *
 * Detecta tres familias de **falsos verdes obvios**, todas por propiedad **objetiva** (sintáctica), nunca
 * por heurística sobre la intención:
 *
 * 1. **Expectativas tautológicas**: `expect(X).toBe(X)` (y `toEqual`/`toStrictEqual`) donde el `actual` y
 *    el `expected` son **la misma expresión**. No hay oráculo: el test pasa siempre.
 * 2. **Tests enfocados** (`.only`, `fit`, `fdescribe`): dejan el resto de la suite sin correr.
 * 3. **Tests salteados** (`.skip`, `xit`, `xdescribe`): se inventarían para poder ratchetearlos.
 *
 * **Qué NO intenta detectar, a propósito** (sería heurística insegura y rompería tests válidos): si un
 * test *prueba lo correcto*, si el `expected` es el valor de negocio correcto, si el mock es demasiado
 * permisivo, si el test se escribió después de la implementación. Eso es semántico y lo cubren la review
 * adversarial y el mutation check.
 *
 * Usa el compilador de TypeScript que **ya** está en el repo (`typescript`) y `ts.createSourceFile`: sólo
 * necesita el AST sintáctico, así que no depende de un `tsconfig`, de tipos ni de historia de git.
 */

export type TestIntegrityFinding = {
  /** Ruta relativa al repo, para que el mensaje diga dónde está. */
  file: string;
  /** Línea 1-based. */
  line: number;
  /** Qué patrón se encontró, en la forma en que se escribe (`expect(...).toBe(...)`, `it.only`, ...). */
  pattern: string;
  /** Explicación para quien lee el error. */
  detail: string;
};

export type SkippedTestFinding = TestIntegrityFinding & {
  /** Identidad estable del skip: el motivo escrito, o el título si el skip es de la forma `it.skip`. */
  reason: string;
  /** `false` cuando el skip no explica por qué (sólo tiene título o no tiene argumentos). */
  hasWrittenReason: boolean;
};

/** Los matchers donde `actual === expected` no prueba nada. `toThrow` y compañía quedan afuera: tienen su propio oráculo. */
const TAUTOLOGICAL_MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual"]);

/** Raíces de la API de tests (vitest y Playwright comparten estos nombres). */
const TEST_DSL_ROOTS = new Set(["it", "test", "describe"]);

/** Formas "focus" sin punto, heredadas de Jasmine y soportadas por vitest. */
const FOCUSED_BARE = new Set(["fit", "fdescribe"]);

/** Formas "skip" sin punto. */
const SKIPPED_BARE = new Set(["xit", "xdescribe"]);

/** Cómo se escribe un motivo que no existe, para que el inventario no quede con un hueco vacío. */
export const MISSING_REASON = "(sin motivo escrito)";

/**
 * Normaliza el texto de una expresión para poder comparar dos por igualdad.
 *
 * Colapsa los espacios y saca los que están pegados a la puntuación, así `calculate( input )` y
 * `calculate(input)` son la misma expresión. **No toca el interior de los literales de texto**: si no,
 * `expect("a b").toBe("ab")` se vería como una tautología cuando en realidad son dos cadenas distintas.
 */
export function normalizeExpression(source: string): string {
  let out = "";
  let quote: string | null = null;
  let escaped = false;
  let pendingSpace = false;

  const PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ",", ".", ":", ";"]);

  for (const char of source) {
    if (quote !== null) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      if (pendingSpace && out.length > 0 && !PUNCTUATION.has(out[out.length - 1])) {
        out += " ";
      }
      pendingSpace = false;
      quote = char;
      out += char;
      continue;
    }

    if (/\s/.test(char)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace) {
      const previous = out[out.length - 1];
      if (out.length > 0 && previous !== undefined && !PUNCTUATION.has(previous) && !PUNCTUATION.has(char)) {
        out += " ";
      }
      pendingSpace = false;
    }

    out += char;
  }

  return out.trim();
}

/**
 * Desarma una expresión en la cadena de nombres que la recorre y su raíz.
 *
 * `expect(a).not.toBe` → `{ root: expect(a), names: ["not", "toBe"] }`
 * `test.describe.only` → `{ root: test, names: ["describe", "only"] }`
 */
function unwrapChain(expression: ts.Expression): { names: string[]; root: ts.Expression } {
  const names: string[] = [];
  let current: ts.Expression = expression;

  while (ts.isPropertyAccessExpression(current)) {
    names.unshift(current.name.text);
    current = current.expression;
  }

  return { names, root: current };
}

function lineOf(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function textOf(node: ts.Node, sourceFile: ts.SourceFile): string {
  return normalizeExpression(node.getText(sourceFile));
}

function isFunctionLike(node: ts.Node | undefined): boolean {
  return (
    node !== undefined &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isIdentifier(node))
  );
}

/**
 * Encuentra las expectativas donde `actual` y `expected` son sintácticamente **la misma expresión**.
 *
 * Quedan afuera, a propósito:
 * - `expect(a).not.toBe(a)` (una desigualdad tiene un oráculo: el valor tiene que ser distinto);
 * - matchers que no son de igualdad (`toThrow`, `toHaveBeenCalled`, ...);
 * - `expect(result).toEqual(expectedFixture)`, donde el oráculo es otra cosa;
 * - cualquier cadena que no arranque en la llamada `expect(...)` de la API de aserciones.
 */
export function findTautologicalExpectations(
  file: string,
  source: string,
): TestIntegrityFinding[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: TestIntegrityFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const { names, root } = unwrapChain(node.expression);
      const matcher = names[names.length - 1];

      const isExpectCall =
        ts.isCallExpression(root) &&
        ts.isIdentifier(root.expression) &&
        root.expression.text === "expect";

      if (
        isExpectCall &&
        matcher !== undefined &&
        TAUTOLOGICAL_MATCHERS.has(matcher) &&
        !names.includes("not")
      ) {
        const actual = root.arguments[0];
        const expected = node.arguments[0];

        if (actual !== undefined && expected !== undefined) {
          const actualText = textOf(actual, sourceFile);
          const expectedText = textOf(expected, sourceFile);

          if (actualText.length > 0 && actualText === expectedText) {
            findings.push({
              file,
              line: lineOf(node, sourceFile),
              pattern: `expect(...).${matcher}(...)`,
              detail: `el actual y el esperado son la misma expresión (${actualText}): el test pasa siempre, no prueba nada`,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return findings;
}

/**
 * Encuentra tests enfocados: dejan el resto de la suite sin correr, así que un CI verde con un `.only`
 * adentro es un verde falso. El repo hoy tiene **cero**, y ese es el número que hay que mantener.
 */
export function findFocusedTests(file: string, source: string): TestIntegrityFinding[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: TestIntegrityFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const { names, root } = unwrapChain(node.expression);

      if (ts.isIdentifier(root) && FOCUSED_BARE.has(root.text)) {
        findings.push({
          file,
          line: lineOf(node, sourceFile),
          pattern: root.text,
          detail: `\`${root.text}\` deja el resto de la suite sin correr: un CI verde así no prueba el repo`,
        });
      } else if (
        ts.isIdentifier(root) &&
        TEST_DSL_ROOTS.has(root.text) &&
        names.includes("only")
      ) {
        const pattern = [root.text, ...names].join(".");
        findings.push({
          file,
          line: lineOf(node, sourceFile),
          pattern,
          detail: `\`${pattern}\` deja el resto de la suite sin correr: un CI verde así no prueba el repo`,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return findings;
}

/**
 * Inventaría los tests salteados con su motivo.
 *
 * No se prohíben por dogma —los de `tests/e2e/` se saltean solos cuando el flag de mutaciones está
 * apagado—: se inventan para que el número **no crezca en silencio**. La identidad es archivo + motivo,
 * nunca el número de línea.
 */
export function findSkippedTests(file: string, source: string): SkippedTestFinding[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: SkippedTestFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const { names, root } = unwrapChain(node.expression);

      const isBare = ts.isIdentifier(root) && SKIPPED_BARE.has(root.text);
      const isDotted =
        ts.isIdentifier(root) && TEST_DSL_ROOTS.has(root.text) && names.includes("skip");

      if (isBare || isDotted) {
        const pattern = isBare
          ? (root as ts.Identifier).text
          : [(root as ts.Identifier).text, ...names].join(".");

        const firstString = node.arguments.find((argument) => ts.isStringLiteralLike(argument));
        // `it.skip("título", fn)` es un skip estático: la cadena es el **título**, no un motivo escrito.
        const isTitleForm =
          ts.isStringLiteralLike(node.arguments[0]) &&
          isFunctionLike(node.arguments[1]);

        const reason = firstString ? (firstString as ts.StringLiteralLike).text : MISSING_REASON;

        findings.push({
          file,
          line: lineOf(node, sourceFile),
          pattern,
          detail: `test salteado (${pattern})${firstString ? "" : ": no dice por qué"}`,
          reason,
          hasWrittenReason: firstString !== undefined && !isTitleForm,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return findings;
}

/** Identidad estable de un skip para el inventario: archivo + motivo, nunca la línea. */
export function skipKey(finding: SkippedTestFinding): string {
  return `${finding.file}::${finding.reason}`;
}

export function countSkipsByKey(
  findings: readonly SkippedTestFinding[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const finding of findings) {
    const key = skipKey(finding);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}
