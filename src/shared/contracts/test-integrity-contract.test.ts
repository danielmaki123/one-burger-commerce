import { describe, expect, it } from "vitest";

import { listFiles, readRepoFile } from "./contract-files";
import {
  ALLOWANCE_SOURCES,
  allowanceKey,
  compareAllowances,
  extractAllowance,
  isWorsening,
  readFileAtRef,
  resolveBaseRef,
  type Allowance,
} from "./test-integrity-allowances";
import {
  countSkipsByKey,
  findFocusedTests,
  findSkippedTests,
  findTautologicalExpectations,
} from "./test-integrity-policy";

/**
 * TASK-AUD-001 — gate de integridad de tests.
 *
 * Convierte el protocolo humano de `AGENTS.md` § *Integridad de tests* en guardrails **mecánicos**, pero
 * solo donde la propiedad es **objetiva**. Lo que este gate NO puede demostrar —si un test prueba lo
 * correcto, si el `expected` es el valor de negocio, si el mock es demasiado permisivo— queda dicho acá
 * abajo y lo cubren la review adversarial y el mutation check de cada TASK.
 *
 * Los tres falsos verdes que sí detecta:
 *
 * 1. **Expectativas tautológicas** (`expect(X).toBe(X)`): no hay oráculo.
 * 2. **Tests enfocados** (`.only`, `fit`, `fdescribe`): el CI queda verde con el resto de la suite sin correr.
 * 3. **Deuda que crece en silencio**: una excepción nueva en las allowlists de los contratos, o un `skip`
 *    nuevo. Se inventaría con motivo y se ratchetea contra `main`.
 *
 * Determinista y sin red: lee archivos versionados. La única parte que mira historia es el ratchet contra
 * la rama base, y el CI le da la historia completa (hay un test acá que lo exige).
 */

const BASELINE_PATH = "src/shared/contracts/test-integrity-baseline.json";

/** Archivos de test del repo: unitarios (vitest) y E2E (Playwright). */
function testFiles(): string[] {
  const unit = listFiles("src", (repoPath) => /\.test\.tsx?$/.test(repoPath));
  const e2e = listFiles("tests", (repoPath) => /\.spec\.tsx?$/.test(repoPath));

  return [...unit, ...e2e].sort();
}

type Baseline = {
  skippedTests: Record<string, number>;
  allowances: Record<string, { purpose: string; keys: string[]; ceilings: Record<string, number> }>;
};

function readBaseline(): Baseline {
  const parsed = JSON.parse(readRepoFile(BASELINE_PATH)) as Baseline;

  // Guarda contra un inventario vacío: un baseline sin datos haría pasar todos los ratchets sin mirar nada.
  if (Object.keys(parsed.skippedTests).length === 0 || Object.keys(parsed.allowances).length === 0) {
    throw new Error(`${BASELINE_PATH} está vacío: un inventario vacío no ratchetea nada`);
  }

  return parsed;
}

describe("contrato · integridad de tests", () => {
  it("no hay expectativas tautológicas (el test pasa siempre, no prueba nada)", () => {
    const findings = testFiles().flatMap((file) =>
      findTautologicalExpectations(file, readRepoFile(file)),
    );

    expect(
      findings.map((finding) => `${finding.file}:${finding.line} ${finding.pattern} — ${finding.detail}`),
      "un `expect(X).toBe(X)` no tiene oráculo: escribí el valor esperado desde la regla del negocio",
    ).toEqual([]);
  });

  it("no hay tests enfocados: `.only`, `fit` ni `fdescribe`", () => {
    const findings = testFiles().flatMap((file) => findFocusedTests(file, readRepoFile(file)));

    expect(
      findings.map((finding) => `${finding.file}:${finding.line} ${finding.pattern}`),
      "un test enfocado deja el resto de la suite sin correr: el CI verde no prueba el repo",
    ).toEqual([]);
  });

  it("todo test salteado dice por qué", () => {
    const findings = testFiles().flatMap((file) => findSkippedTests(file, readRepoFile(file)));
    const silent = findings.filter((finding) => !finding.hasWrittenReason);

    expect(
      silent.map((finding) => `${finding.file}:${finding.line} ${finding.pattern}`),
      "un skip sin motivo escrito no se puede inventariar ni revisar",
    ).toEqual([]);
  });

  it("el inventario de tests salteados no crece (ni se relaja sin decirlo)", () => {
    const baseline = readBaseline();
    const actual = countSkipsByKey(
      testFiles().flatMap((file) => findSkippedTests(file, readRepoFile(file))),
    );

    const added = Object.keys(actual).filter((key) => baseline.skippedTests[key] === undefined);
    const grown = Object.entries(actual)
      .filter(([key, count]) => baseline.skippedTests[key] !== undefined && count > baseline.skippedTests[key])
      .map(([key, count]) => `${key}: ${baseline.skippedTests[key]} → ${count}`);
    const shrunk = Object.entries(baseline.skippedTests)
      .filter(([key, count]) => (actual[key] ?? 0) < count)
      .map(([key, count]) => `${key}: ${count} → ${actual[key] ?? 0}`);

    expect(
      added,
      `un skip nuevo deja un test sin correr: sacalo, o justificalo y registralo en ${BASELINE_PATH} en el mismo commit`,
    ).toEqual([]);
    expect(grown, "un motivo inventariado no puede saltear más casos que antes").toEqual([]);
    expect(
      shrunk,
      `destapaste tests: bajá el número en ${BASELINE_PATH} en el mismo commit (el inventario solo baja, y baja cuando se lo baja)`,
    ).toEqual([]);
  });

  it("las allowlists de los contratos no agregan filas ni suben techos", () => {
    const baseline = readBaseline();
    const problems: string[] = [];

    for (const source of ALLOWANCE_SOURCES) {
      const key = allowanceKey(source);
      const expected = baseline.allowances[key];

      expect(expected, `falta ${key} en ${BASELINE_PATH}`).toBeDefined();

      const actual = extractAllowance(readRepoFile(source.file), source.symbol);

      expect(
        actual,
        `no se pudo leer ${source.symbol} en ${source.file}: si el símbolo cambió de nombre, actualizá ALLOWANCE_SOURCES`,
      ).not.toBeNull();

      const diff = compareAllowances(actual as Allowance, {
        keys: expected.keys,
        ceilings: expected.ceilings,
      });

      problems.push(
        ...diff.added.map(
          (added) => `${key} → fila NUEVA "${added}": la deuda congelada (${source.purpose}) no crece`,
        ),
        ...diff.raised.map(
          ({ key: row, from, to }) => `${key} → techo SUBE en "${row}": ${from} → ${to}`,
        ),
        ...diff.removed.map(
          (removed) => `${key} → fila borrada "${removed}": bajá también ${BASELINE_PATH}`,
        ),
        ...diff.lowered.map(
          ({ key: row, from, to }) =>
            `${key} → techo bajó en "${row}" (${from} → ${to}): registralo en ${BASELINE_PATH}`,
        ),
      );
    }

    expect(
      problems,
      "las allowlists son el inventario de la deuda, no una puerta: se arregla el código, no se agrega la fila",
    ).toEqual([]);
  });

  it("ninguna allowlist creció respecto de la rama base", () => {
    const baseRef = resolveBaseRef();

    // En un clon superficial no hay con qué comparar. No es un gate que se saltea por comodidad: el job
    // `contracts` del CI trae la historia completa (hay un test que lo exige más abajo), así que en CI
    // esta rama nunca se toma. Localmente se deja dicho, para que nadie crea que el ratchet corrió.
    if (baseRef === null) {
      console.warn(
        "[test-integrity] no hay rama base (`git fetch origin main`): el ratchet contra main no corrió en esta corrida",
      );
      return;
    }

    const problems: string[] = [];

    for (const source of ALLOWANCE_SOURCES) {
      const baseSource = readFileAtRef(baseRef, source.file);

      // El archivo no existía en la base (el contrato es nuevo): no hay nada que ratchetear todavía.
      if (baseSource === null) {
        continue;
      }

      const baseAllowance = extractAllowance(baseSource, source.symbol);
      const actualAllowance = extractAllowance(readRepoFile(source.file), source.symbol);

      if (baseAllowance === null || actualAllowance === null) {
        continue;
      }

      const diff = compareAllowances(actualAllowance, baseAllowance);

      if (isWorsening(diff)) {
        problems.push(
          ...diff.added.map(
            (added) => `${allowanceKey(source)} → "${added}" es NUEVA respecto de la base`,
          ),
          ...diff.raised.map(
            ({ key, from, to }) => `${allowanceKey(source)} → "${key}" sube de ${from} a ${to} respecto de la base`,
          ),
        );
      }
    }

    expect(
      problems,
      "una PR no puede ampliar la deuda congelada: arreglá el código (escribí el test, partí el archivo, usá el primitivo) o es una decisión del owner, no un atajo del gate",
    ).toEqual([]);
  });

  it("el job `contracts` del CI trae la historia que el ratchet necesita", () => {
    const workflow = readRepoFile(".github/workflows/publish-ghcr.yml");
    const jobStart = workflow.indexOf("\n  contracts:");

    expect(jobStart, "el workflow tiene que tener el job `contracts`").toBeGreaterThan(-1);

    const nextJob = workflow.indexOf("\n  migrations:", jobStart);
    const jobBlock = workflow.slice(jobStart, nextJob === -1 ? undefined : nextJob);

    expect(
      jobBlock,
      "sin `fetch-depth: 0` el clon es superficial, el ratchet contra la rama base no puede comparar y se saltearía: un gate que se saltea no existe",
    ).toContain("fetch-depth: 0");
  });

  it("el gate mira una cantidad real de archivos (no pasa por no mirar nada)", () => {
    expect(testFiles().length).toBeGreaterThan(400);
  });
});
