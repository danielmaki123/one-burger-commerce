import { describe, expect, it } from "vitest";

import {
  countSkipsByKey,
  findFocusedTests,
  findSkippedTests,
  findTautologicalExpectations,
  normalizeExpression,
  skipKey,
} from "./test-integrity-policy";

/**
 * TASK-AUD-001 — tests del **scanner** de integridad de tests.
 *
 * El scanner es código de guardrail: si se equivoca, o deja pasar un falso verde o **rompe un test
 * válido** (y un guardrail que obliga a desactivarlo es peor que no tenerlo). Por eso el scanner tiene
 * sus propios tests, con fixtures de los dos lados: lo que **tiene** que marcar y lo que **no**.
 *
 * Los fixtures van como strings a propósito: si fueran código real, el scanner que corre sobre el repo
 * (en `test-integrity-contract.test.ts`) los encontraría a ellos en vez de encontrar el bug.
 */

/** Envuelve un fragmento en un archivo de test válido y lo pasa por el scanner de tautologías. */
function tautologiesIn(body: string) {
  return findTautologicalExpectations("fixture.test.ts", `import { expect, it } from "vitest";\n${body}\n`);
}

describe("scanner de integridad · expectativas tautológicas", () => {
  it("marca `expect(true).toBe(true)`", () => {
    const found = tautologiesIn(`it("x", () => { expect(true).toBe(true); });`);

    expect(found).toHaveLength(1);
    expect(found[0].pattern).toContain("toBe");
    expect(found[0].file).toBe("fixture.test.ts");
    expect(found[0].line).toBe(2);
  });

  it("marca cuando actual y expected son la misma variable", () => {
    const found = tautologiesIn(
      `it("x", () => { const x = result; expect(x).toEqual(x); });`,
    );

    expect(found).toHaveLength(1);
    expect(found[0].pattern).toContain("toEqual");
  });

  it("marca cuando actual y expected son la misma llamada", () => {
    const found = tautologiesIn(
      `it("x", () => { expect(calculate(input)).toStrictEqual(calculate(input)); });`,
    );

    expect(found).toHaveLength(1);
    expect(found[0].pattern).toContain("toStrictEqual");
  });

  it("marca aunque el espaciado o los saltos de línea cambien", () => {
    const found = tautologiesIn(
      `it("x", () => {\n  expect(\n    calculate( input ),\n  ).toEqual(calculate(input));\n});`,
    );

    expect(found).toHaveLength(1);
  });

  it("NO marca un oráculo independiente (`expectedFixture`)", () => {
    expect(tautologiesIn(`it("x", () => { expect(result).toEqual(expectedFixture); });`)).toEqual([]);
  });

  it("NO marca una desigualdad deliberada (`.not`)", () => {
    expect(tautologiesIn(`it("x", () => { expect(value).not.toBe(value); });`)).toEqual([]);
  });

  it("NO marca `toThrow`, que tiene su propio oráculo", () => {
    expect(tautologiesIn(`it("x", () => { expect(() => execute()).toThrow(); });`)).toEqual([]);
  });

  it("NO marca una comparación contra un literal", () => {
    expect(tautologiesIn(`it("x", () => { expect(result.total).toBe(1175.5); });`)).toEqual([]);
  });

  it("NO marca dos expresiones distintas aunque se parezcan", () => {
    const found = tautologiesIn(
      `it("x", () => { expect(calculate(draft)).toEqual(calculate(otroDraft)); });`,
    );

    expect(found).toEqual([]);
  });

  it("NO marca una aserción sobre un objeto que se llama `expect` pero no lo es", () => {
    // Un objeto cualquiera con un método `toBe` no es la API de aserciones: el scanner exige que la
    // raíz de la cadena sea la llamada `expect(...)`.
    expect(tautologiesIn(`it("x", () => { other.expect(a).toBe(a); });`)).toEqual([]);
  });

  it("encuentra varias tautologías y reporta cada línea", () => {
    const found = tautologiesIn(
      `it("x", () => {\n  expect(1).toBe(1);\n  expect(2).toEqual(2);\n  expect(ok).toBe(ok);\n});`,
    );

    // El helper agrega una línea de `import` arriba: el `it` queda en la 2 y las aserciones en 3, 4 y 5.
    expect(found.map((finding) => finding.line)).toEqual([3, 4, 5]);
  });

  it("normaliza el texto de la expresión para comparar", () => {
    // El mismo cálculo escrito con otro espaciado tiene que ser la misma expresión...
    expect(normalizeExpression("  calculate(  input )  ")).toBe("calculate(input)");
    expect(normalizeExpression("calculate(input)")).toBe("calculate(input)");
    // ...pero el interior de un literal de texto no se toca: son dos cadenas distintas.
    expect(normalizeExpression(`"a b"`)).toBe(`"a b"`);
    expect(normalizeExpression(`"a b"`)).not.toBe(normalizeExpression(`"ab"`));
  });
});

describe("scanner de integridad · tests enfocados", () => {
  const focused = [
    ["it.only", `it.only("x", () => {});`],
    ["test.only", `test.only("x", () => {});`],
    ["describe.only", `describe.only("x", () => {});`],
    ["fit", `fit("x", () => {});`],
    ["fdescribe", `fdescribe("x", () => {});`],
    ["test.describe.only", `test.describe.only("x", () => {});`],
  ] as const;

  for (const [label, body] of focused) {
    it(`marca \`${label}\``, () => {
      const found = findFocusedTests("fixture.test.ts", `${body}\n`);

      expect(found).toHaveLength(1);
      expect(found[0].pattern).toBe(label);
      expect(found[0].line).toBe(1);
    });
  }

  it("NO marca un `it` ni un `describe` normales", () => {
    const source = `it("x", () => {});\ndescribe("y", () => { test("z", () => {}); });\n`;

    expect(findFocusedTests("fixture.test.ts", source)).toEqual([]);
  });

  it("NO marca `.only` de otro objeto", () => {
    expect(findFocusedTests("fixture.test.ts", `columns.only(1);\n`)).toEqual([]);
  });
});

describe("scanner de integridad · tests salteados", () => {
  it("inventaría un skip condicional con su motivo", () => {
    const source = `test.skip(!mutationsAllowed, "Requiere E2E_ALLOW_MUTATIONS=true.");\n`;
    const found = findSkippedTests("fixture.spec.ts", source);

    expect(found).toHaveLength(1);
    expect(found[0].pattern).toBe("test.skip");
    expect(found[0].reason).toBe("Requiere E2E_ALLOW_MUTATIONS=true.");
  });

  it("inventaría `it.skip`, `describe.skip`, `xit` y `xdescribe`", () => {
    const source = [
      `it.skip("a", () => {});`,
      `describe.skip("b", () => {});`,
      `xit("c", () => {});`,
      `xdescribe("d", () => {});`,
    ].join("\n");

    expect(findSkippedTests("fixture.spec.ts", source).map((finding) => finding.pattern)).toEqual([
      "it.skip",
      "describe.skip",
      "xit",
      "xdescribe",
    ]);
  });

  it("deja escrito cuando el skip no tiene motivo", () => {
    const found = findSkippedTests("fixture.test.ts", `it.skip("título", () => {});\n`);

    // La cadena del título no es un motivo: se usa como identidad, y se dice que falta el motivo.
    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe("título");
    expect(found[0].hasWrittenReason).toBe(false);
  });

  it("reconoce el motivo escrito en la forma condicional", () => {
    const found = findSkippedTests("fixture.test.ts", `it.skip(!flag, "porque sí");\n`);

    expect(found[0].hasWrittenReason).toBe(true);
  });

  it("NO marca un `it` normal ni un texto que hable de skip", () => {
    const source = `it("x", () => {});\n// el test.skip se usa solo con el flag\nconst s = "test.skip(";\n`;

    expect(findSkippedTests("fixture.test.ts", source)).toEqual([]);
  });

  it("cuenta los skips por archivo y motivo, no por línea", () => {
    const source = [
      `test.skip(!flag, "mismo motivo");`,
      `test.skip(!flag, "mismo motivo");`,
      `test.skip(!flag, "otro motivo");`,
    ].join("\n");

    const counts = countSkipsByKey(findSkippedTests("fixture.spec.ts", source));

    expect(counts).toEqual({
      "fixture.spec.ts::mismo motivo": 2,
      "fixture.spec.ts::otro motivo": 1,
    });
  });

  it("la clave de un skip no depende del número de línea", () => {
    const uno = findSkippedTests("f.spec.ts", `test.skip(!f, "motivo");`)[0];
    const dos = findSkippedTests("f.spec.ts", `\n\n\ntest.skip(!f, "motivo");`)[0];

    expect(skipKey(uno)).toBe(skipKey(dos));
    expect(uno.line).not.toBe(dos.line);
  });
});
