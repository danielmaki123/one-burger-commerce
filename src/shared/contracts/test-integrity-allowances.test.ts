import { describe, expect, it } from "vitest";

import {
  allowanceKey,
  compareAllowances,
  extractAllowance,
  isWorsening,
} from "./test-integrity-allowances";

/**
 * TASK-AUD-001 — tests del **ratchet de allowlists**.
 *
 * El ratchet decide si una PR puede agrandar una lista de excepciones. Si se equivoca, o deja pasar deuda
 * nueva o bloquea una mejora legítima, así que sus reglas (qué cuenta como "agregar", qué como "subir el
 * techo", qué es una mejora) están fijadas acá con fixtures chicos.
 */

describe("ratchet de allowlists · extracción", () => {
  it("extrae las claves de un `Record<string, string>`", () => {
    const source = `const EXCEPTIONS: Record<string, string> = {
  "src/a.ts": "motivo",
  "src/b.ts": "otro motivo",
};`;

    expect(extractAllowance(source, "EXCEPTIONS")).toEqual({
      keys: ["src/a.ts", "src/b.ts"],
      ceilings: {},
    });
  });

  it("extrae claves y techos de un `Record<string, number>`", () => {
    const source = `const LEGACY_ROUTE_LINES: Record<string, number> = {
  "src/a/route.ts": 120,
  "src/b/route.ts": 51,
};`;

    expect(extractAllowance(source, "LEGACY_ROUTE_LINES")).toEqual({
      keys: ["src/a/route.ts", "src/b/route.ts"],
      ceilings: { "src/a/route.ts": 120, "src/b/route.ts": 51 },
    });
  });

  it("extrae los miembros de un `new Set([...])`", () => {
    const source = `const LEGACY_ROUTE_PRISMA = new Set([
  "src/a/route.ts",
  "src/b/route.ts",
]);`;

    expect(extractAllowance(source, "LEGACY_ROUTE_PRISMA")).toEqual({
      keys: ["src/a/route.ts", "src/b/route.ts"],
      ceilings: {},
    });
  });

  it("ignora las claves de forma no literal y no explota", () => {
    const source = `const MIX = {
  "literal": 1,
  [computed]: 2,
  ...spread,
};`;

    expect(extractAllowance(source, "MIX")?.keys).toEqual(["literal"]);
  });

  it("devuelve `null` cuando el símbolo no existe", () => {
    expect(extractAllowance(`const OTRA = {};`, "EXCEPTIONS")).toBeNull();
  });

  it("no se confunde con un símbolo de nombre parecido", () => {
    const source = `const EXCEPTIONS_OLD = { "a": 1 };\nconst EXCEPTIONS = { "b": 2 };`;

    expect(extractAllowance(source, "EXCEPTIONS")?.keys).toEqual(["b"]);
  });

  it("arma una clave estable por archivo y símbolo", () => {
    expect(
      allowanceKey({ file: "src/a.test.ts", symbol: "EXCEPTIONS", purpose: "x" }),
    ).toBe("src/a.test.ts::EXCEPTIONS");
  });
});

describe("ratchet de allowlists · comparación", () => {
  const baseline = {
    keys: ["a", "b"],
    ceilings: { a: 100, b: 50 },
  };

  it("detecta una fila nueva", () => {
    const diff = compareAllowances({ keys: ["a", "b", "c"], ceilings: {} }, baseline);

    expect(diff.added).toEqual(["c"]);
    expect(isWorsening(diff)).toBe(true);
  });

  it("detecta un techo que sube", () => {
    const diff = compareAllowances({ keys: ["a", "b"], ceilings: { a: 120, b: 50 } }, baseline);

    expect(diff.raised).toEqual([{ key: "a", from: 100, to: 120 }]);
    expect(isWorsening(diff)).toBe(true);
  });

  it("no considera empeorar cuando una fila se elimina", () => {
    const diff = compareAllowances({ keys: ["a"], ceilings: { a: 100 } }, baseline);

    expect(diff.removed).toEqual(["b"]);
    expect(isWorsening(diff)).toBe(false);
  });

  it("no considera empeorar cuando un techo baja", () => {
    const diff = compareAllowances({ keys: ["a", "b"], ceilings: { a: 80, b: 50 } }, baseline);

    expect(diff.lowered).toEqual([{ key: "a", from: 100, to: 80 }]);
    expect(isWorsening(diff)).toBe(false);
  });

  it("no reporta nada cuando la allowlist no cambió", () => {
    const diff = compareAllowances({ keys: ["a", "b"], ceilings: { a: 100, b: 50 } }, baseline);

    expect(diff).toEqual({ added: [], removed: [], raised: [], lowered: [] });
    expect(isWorsening(diff)).toBe(false);
  });

  it("una fila nueva con techo propio cuenta como agregar, no como subir", () => {
    const diff = compareAllowances(
      { keys: ["a", "b", "c"], ceilings: { a: 100, b: 50, c: 999 } },
      baseline,
    );

    expect(diff.added).toEqual(["c"]);
    expect(diff.raised).toEqual([]);
  });
});
