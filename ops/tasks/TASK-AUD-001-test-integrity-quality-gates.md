# TASK-AUD-001 — Test Integrity & Quality Gates

## TASK ID

`TASK-AUD-001`

## Título

Convertir el protocolo de integridad de tests en guardrails mecánicos (sin vender heurísticas como garantías).

## Prioridad

`P0` — proceso. Todas las TASK siguientes dependen de que un verde signifique algo.

## Clase de riesgo

`docs/CI` (proceso, contratos y CI). **No toca producto.**

---

## PROBLEMA

AUD-000 dejó el **protocolo** de integridad de tests escrito en `AGENTS.md` (§ *Integridad de tests*), pero
escrito en prosa: nada impide mecánicamente que un agente escriba un test tautológico, enfoque la suite con
`.only`, agregue una **excepción nueva** a una allowlist para apagar un contrato, o saltee un test sin
dejarlo inventariado. Un protocolo sin gate depende de que alguien lo recuerde.

El hueco más concreto: los contratos del repo (`tdd-contract`, `route-contract`, `module-contract`,
`ui-contract`) tienen un test que detecta **filas muertas** de sus allowlists, pero **ninguno** detecta una
fila **nueva**. Agregar una excepción era una forma silenciosa de reducir la capacidad del repo de detectar
una regresión — justo lo que la deuda congelada prohíbe.

## EVIDENCIA

Medido en `main` (`eeaa810`) antes de tocar nada:

- **Baseline del repo**: `npm ci` ✓ · `prisma generate` ✓ · `security:secrets` ✓ · `lint` ✓ · `typecheck` ✓ ·
  `test` **3252 tests / 466 archivos** ✓ · `test:contracts` **61/61 (10 archivos)** ✓ · `build` ✓.
  *(La primera medición dio 3279/467 porque mis archivos en curso ya estaban en disco; se repitió con el
  árbol limpio para no atribuirme un baseline inflado.)*
- **Inventario medido con el scanner nuevo** sobre **501 archivos de test** (`src/**/*.test.ts(x)` y
  `tests/**/*.spec.ts`):
  - tautologías: **0**;
  - tests enfocados (`.only`, `fit`, `fdescribe`): **0**;
  - tests salteados: **43**, en **32 claves** (archivo + motivo), **todas con motivo escrito** y todas en
    `tests/e2e/**` (se saltean solos cuando falta el flag `E2E_ALLOW_MUTATIONS` o el entorno del dominio):
    es deuda legítima, no un problema.
- **Allowlists con riesgo de crecer** (las que este gate ratchetea), con las filas medidas:
  `tdd-contract.test.ts::EXCEPTIONS` **41** · `route-contract.test.ts::LEGACY_ROUTE_LINES` **49** (con techo
  numérico por fila) · `route-contract.test.ts::LEGACY_ROUTE_PRISMA` **3** ·
  `module-contract.test.ts::LEGACY_PARTIAL_MODULES` **5** · `ui-contract.test.ts::LEGACY_RAW_CONTROLS` **26**
  (con techo) · `ui-contract.test.ts::LEGACY_HEX` **5** (con techo).
- **`design-tokens.allow.json` queda afuera a propósito**: sus techos ya tienen ratchet propio en
  `design-guardrails-contract.test.ts` («no sube el techo» / «si baja, lo baja en el mismo commit»).
  Duplicarlo sería una segunda fuente de verdad para la misma regla.

## CAUSA RAÍZ

El protocolo vive en prosa y las allowlists de los contratos solo se validan por el lado de la **deuda
muerta** (una fila que ya no corresponde), nunca por el lado de la **deuda nueva**. Como el gate que impide
la deuda nueva es el que uno quiere desactivar cuando está apurado, el camino de menor resistencia era
agregar una fila.

## INVARIANTE

> **Un test o excepción nuevos no pueden reducir silenciosamente la capacidad del repositorio de detectar
> una regresión.**

Se operacionaliza así: la deuda congelada (skips inventariados, allowlists de los contratos y sus techos)
**solo se mantiene o baja**. Agregar una fila o subir un techo pone el gate en rojo; bajarla exige registrar
la mejora en el inventario en el mismo commit.

## BOUNDED CONTEXT

No es un bounded context de producto: es el sistema de guardrails (`src/shared/contracts/**` +
`.github/workflows/`). No toca `src/modules/**`.

---

## SCOPE IN

1. **Scanner de integridad** (`src/shared/contracts/test-integrity-policy.ts`), por **AST** con el
   compilador de TypeScript **ya instalado** (sin dependencias nuevas):
   - expectativas tautológicas: `expect(X).toBe(X)` / `toEqual` / `toStrictEqual` con `actual` y `expected`
     sintácticamente idénticos;
   - tests enfocados: `it.only`, `test.only`, `describe.only`, `test.describe.only`, `fit`, `fdescribe`;
   - tests salteados: `it.skip`, `test.skip`, `describe.skip`, `xit`, `xdescribe`, con su motivo.
2. **Tests propios del scanner** (`test-integrity-policy.test.ts`), con fixtures de los dos lados.
3. **Ratchet de allowlists** (`src/shared/contracts/test-integrity-allowances.ts` + tests): extracción por
   AST de las seis allowlists y comparación de **claves** (agregar/borrar) y **techos** (subir/bajar).
4. **Inventario congelado** (`test-integrity-baseline.json`): los 43 skips por archivo+motivo y las seis
   allowlists con sus claves y techos.
5. **Contrato del gate** (`test-integrity-contract.test.ts`): los tres falsos verdes + el ratchet contra la
   rama base + el motivo escrito de cada skip + que el CI traiga la historia que el ratchet necesita.
6. **Plantilla de PR** (`.github/pull_request_template.md`) con el checklist adversarial.
7. **Step de CI** `Test integrity gate` dentro del job `contracts` (sin crear un required check nuevo).
8. Corrección del comentario del `fetch-depth: 0` del job `contracts`, que explicaba un chequeo por
   historia de git que ya no existe en `docs-sync-contract.test.ts`.

## SCOPE OUT

- **No** se corrige POS, caja, invoice ni ningún comportamiento funcional.
- **No** se toca el esquema Prisma ni se crean migraciones.
- **No** se toca producción, ni el ruleset, ni `publish`.
- **No** se instala Stryker ni ninguna dependencia nueva.
- **No** se agrega cobertura global ni un umbral arbitrario («90 % o falla»).
- **No** se reescribe la deuda de TDD histórica (41 excepciones congeladas) ni los tests existentes.
- **No** se cambian acceptance tests para satisfacer el gate.

## DEPENDENCIAS

`TASK-AUD-000` (el protocolo y la jerarquía de fuentes). Ninguna credencial. Ninguna decisión de producto.

## ARCHIVOS PROBABLES

`src/shared/contracts/test-integrity-policy.{ts,test.ts}` · `test-integrity-allowances.{ts,test.ts}` ·
`test-integrity-contract.test.ts` · `test-integrity-baseline.json` · `.github/workflows/publish-ghcr.yml` ·
`.github/pull_request_template.md` · `ops/tasks/TASK-AUD-001-*.md` · `ops/CURRENT.md` · `AGENTS.md` (solo si
hay que enlazar el gate nuevo).

---

## TEST ROJO

Primero los tests del scanner, con el módulo como **stub** (para que el rojo fuera por la razón correcta y no
por un import roto): **18 de 27 en rojo**, y los 9 fixtures «NO marca» ya en verde. Después, el contrato del
gate con sondas de intrusión (ver *Mutation check*).

## ESTRATEGIA

Separar **lo que se puede demostrar** de **lo que no**:

- **Mecánico y determinista** (sin git, sin red): tautologías, tests enfocados, motivo escrito de cada skip
  e inventario de allowlists. Corre en las dos suites (`npm test` y `npm run test:contracts`).
- **Contra la rama base** (necesita historia): el ratchet que detecta una allowlist que **crece respecto de
  `main`**. En CI lo corre el job `contracts`, que ya tenía `fetch-depth: 0`; hay un contrato que **exige**
  esa línea para que nadie la saque y deje el ratchet mirando el vacío.
- **Lo semántico queda afuera, dicho**: si el `expected` es el valor de negocio correcto, si el mock es
  permisivo o si el test se escribió después, no se detecta mecánicamente. Lo cubren la review adversarial
  (plantilla de PR) y el mutation check de cada TASK.

## RIESGOS DE FALSO POSITIVO

Un guardrail que rompe tests válidos es peor que no tenerlo. Por eso:

| Riesgo | Mitigación |
|---|---|
| Marcar `expect(a).not.toBe(a)` | la cadena con `not` se excluye: la desigualdad tiene oráculo |
| Marcar `expect(result).toEqual(expectedFixture)` | sólo se marca si **ambos lados son la misma expresión** |
| Marcar matchers con oráculo propio (`toThrow`, `toHaveBeenCalled`) | sólo se miran `toBe`/`toEqual`/`toStrictEqual` |
| Marcar un objeto cualquiera con un método `toBe` | la raíz de la cadena tiene que ser la llamada `expect(...)` |
| Confundir expresiones que sólo difieren en espacios | normalización de espacios **fuera** de los literales de texto |
| Marcar `.only` de otra API | la raíz tiene que ser `it`/`test`/`describe` |
| Marcar un skip que en realidad es `test.skip` de Playwright legítimo | no se prohíben: se **inventarían** con su motivo |
| Romper por un test nuevo legítimo | sonda 7: un archivo nuevo con tests normales deja el gate verde |
| Bloquear una mejora (destapar un skip) | bajar el número se permite, registrándolo en el inventario en el mismo commit |

## TRANSACCIÓN / CONCURRENCIA / IDEMPOTENCIA / AUTORIZACIÓN / MIGRACIÓN

**N/A — no hay dinero ni datos**: el cambio son contratos, un JSON de inventario, una plantilla y un step de
CI. No hay escritura en base, ni endpoints, ni permisos nuevos, ni esquema.

## OBSERVABILIDAD

El gate imprime **archivo, línea y patrón** de lo que encuentra, y los mensajes dicen qué hacer. El step de
CI se llama `Test integrity gate` y aparece por nombre en el check run, no escondido detrás del glob.

---

## TESTS UNITARIOS

- `test-integrity-policy.test.ts` — 27 tests: los 8 fixtures del brief (4 que **deben** marcar y 4 que **no**)
  más bordes (espaciado multilínea, varias tautologías con su línea, `.only` de otro objeto, skip sin motivo,
  skip con título, clave de skip independiente de la línea, normalización que no toca literales).
- `test-integrity-allowances.test.ts` — 13 tests: extracción de `Record<string,string>`,
  `Record<string,number>` y `new Set([...])`; símbolo inexistente; nombre parecido; comparación de claves y
  techos; qué cuenta como empeorar y qué como mejorar.

## TESTS DE INTEGRACIÓN

`test-integrity-contract.test.ts` — 8 tests **sobre el repo real**: 501 archivos de test escaneados, 0
tautologías, 0 enfocados, 43 skips inventariados y con motivo, 6 allowlists ratcheteadas contra el inventario
y contra `main`, y el `fetch-depth: 0` del job `contracts`.

No requiere PostgreSQL: no hay propiedad que dependa de la base (ver *TRANSACCIÓN*, N/A).

## E2E

**N/A — no cambia comportamiento de producto.** Los E2E existentes no se tocan.

## MUTATION CHECK

Sondas de intrusión ejecutadas (cada una debe poner el gate **en rojo**, y después se restaura):

| # | Sonda | Resultado |
|---|---|---|
| 1 | tautología nueva (`expect(truthy).toBe(truthy)`) | **ROJO** ✓ |
| 2 | `it.only` nuevo | **ROJO** ✓ |
| 3 | skip nuevo con motivo nunca inventariado | **ROJO** ✓ |
| 4 | fila nueva dentro de `EXCEPTIONS` | **ROJO** ✓ (disparan los dos mecanismos: inventario y vs. base) |
| 5 | techo de `LEGACY_ROUTE_LINES` que sube | **ROJO** ✓ |
| 6 | fila borrada sin actualizar el inventario | **ROJO** ✓ (pide registrar la mejora) |
| 7 | archivo de test nuevo y legítimo | **VERDE** ✓ (no hay falso positivo) |

Mutation check del **detector**: desactivar la regla de tautologías (`false && TAUTOLOGICAL_MATCHERS.has(...)`)
puso **5 tests en rojo**; restaurado, 27/27. La mutación **no** se commiteó.

La primera versión de la sonda 4 estaba mal escrita (agregaba un `const` aparte en vez de una fila a
`EXCEPTIONS`): se rehizo. Queda dicho porque una sonda mal escrita da una falsa sensación de seguridad.

## ADVERSARIAL REVIEW

- **¿Puedo escribir un test inútil que el gate considere válido?** Sí: `expect(result).toEqual(4)` cuando la
  regla del negocio dice 5, o un mock que devuelve lo que la implementación quiere oír. **No es detectable
  mecánicamente sin adivinar intenciones** y no se intenta.
- **¿Puedo hacer fallar un test válido?** Se probaron los casos peligrosos (`.not`, `toThrow`, fixture
  distinto, literal contra literal con espacios, objeto ajeno con `toBe`, `.only` de otra API, archivo nuevo
  legítimo) y ninguno falla. La normalización no toca el interior de los literales de texto.
- **¿Puedo agregar una excepción TDD nueva para saltarme el gate?** No sin que se vea: el inventario exige
  registrar el cambio y el ratchet contra `main` lo rechaza. Es una decisión del owner, no un atajo.
- **¿Puedo agregar `.only` de otra forma?** `it.only`, `test.only`, `describe.only`, `test.describe.only`,
  `fit`, `fdescribe` están cubiertos. `it.each(...).only` cae en la misma cadena de nombres.
- **¿Puedo esconder un skip?** Sólo con `it.skip(...)`/`test.skip(...)`/`xit`/`xdescribe` (todos detectados)
  o salteando el test desde el propio código. Un `return` temprano dentro de un test **no** se detecta: es
  semántico, queda declarado.
- **¿El gate depende de un número de línea?** No: la identidad de un skip es archivo + motivo (hay un test
  que lo fija) y las allowlists se comparan por clave.
- **¿Funciona en un clon superficial?** El ratchet contra la base **necesita** historia. El job `contracts`
  usa `fetch-depth: 0` y hay un contrato que lo exige, así que en CI el ratchet siempre corre; localmente,
  sin `origin/main`, queda un aviso por consola en vez de un verde silencioso.
- **¿El gate lee sólo archivos versionados?** Sí: recorre `src/**` y `tests/**` con el helper de contratos y
  lee el workflow. No depende de secretos, de red ni de conversaciones.
- **¿Un agente podría "arreglar" el gate ampliando la allowlist?** No: es exactamente lo que el ratchet
  bloquea. Tampoco puede borrar el inventario: un baseline vacío hace fallar el contrato a propósito.
- **¿Y si borro el step de CI?** El contrato del workflow exige `fetch-depth: 0`, y las suites del gate
  corren igual dentro del glob de `contracts` y en `npm test` del job `verify`: sacar el step no lo apaga.

### Qué NO se puede demostrar automáticamente (y por eso no se intenta)

1. Que el `expected` sea el valor de negocio correcto.
2. Que el mock no sea demasiado permisivo.
3. Que el test se haya escrito **antes** de la implementación (el orden no queda en el código).
4. Que un acceptance test se haya actualizado por un cambio real de contrato.
5. Que el test que se borró no hiciera falta.

Los cinco se cubren con el checklist adversarial de la plantilla de PR, el mutation check por TASK y la
regla de `AGENTS.md` sobre tests existentes que fallan.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
npx vitest run src/shared/contracts/test-integrity-contract.test.ts   # el gate, explícito
```

No se corre `build:webpack` (no se tocó ninguna `page.tsx`) ni E2E (no cambia comportamiento). El workflow
modificado se valida en el propio CI del PR (`contracts` y `verify`).

## CRITERIOS DE ACEPTACIÓN

- [ ] El scanner detecta los 4 fixtures que debe y **no** marca los 4 que no debe.
- [ ] El scanner tiene tests propios y una mutation check ejecutada.
- [ ] Las 6 allowlists quedan con inventario congelado y ratchet contra `main`.
- [ ] Los 43 skips quedan inventariados por archivo + motivo, y ningún skip nuevo pasa sin registrarse.
- [ ] El gate corre en el job `contracts` con un step propio y visible.
- [ ] La plantilla de PR existe con el checklist adversarial.
- [ ] Las 7 sondas de intrusión dan el resultado esperado.
- [ ] Validación completa en verde y CI del PR en verde.

## REGRESIÓN

El propio gate **es** el test de regresión de esta TASK: si alguien reintroduce un `.only`, una tautología o
una excepción nueva, se pone rojo (probado con las sondas 1 a 6). Se agrega además un test que exige que el
gate mire más de 400 archivos, para que no pueda "pasar" dejando de mirar.

## ROLLBACK

Revertir el commit. El gate no toca producto ni datos: no hay estado que deshacer. Si el gate resultara
demasiado ruidoso, se puede quitar el step de CI sin tocar el resto (las suites seguirían corriendo dentro
del glob), pero **eso sería apagar un guardrail** y exige decisión del owner.

## DOCUMENTACIÓN

- `ops/CURRENT.md`: el trabajo actual pasa a AUD-001 y se registra el gate nuevo.
- `AGENTS.md`: sólo si hace falta enlazar el gate desde § *Integridad de tests* (el protocolo ya está).
- `.agents/MEMORY.md`: se agrega la lección reutilizable (el ratchet de allowlists y por qué el gate no
  intenta juzgar intención).

## MEMORY

Lección candidata: «un guardrail sólo puede vigilar propiedades objetivas; lo semántico se cubre con review
adversarial y mutation check, y conviene decirlo en el propio gate para que nadie le pida más de lo que
puede dar» + «un gate que se saltea en silencio no existe: si necesita historia, el CI tiene que traerla y
un contrato tiene que exigirlo».

## DEFINITION OF DONE

- [ ] Tests verdes (unitarios + contratos) con el **rojo observado** (stub) y la mutation check ejecutada.
- [ ] `security:secrets`, `lint`, `typecheck`, `build` verdes.
- [ ] Ningún techo de deuda subió (el propio gate lo verifica).
- [ ] `ops/CURRENT.md` actualizado; `MEMORY.md` si la lección es reutilizable.
- [ ] Commit + push a la rama, **PR abierto** con la plantilla nueva, **CI verde** (los cuatro checks).
- [ ] Sin deploy, sin cambios de producto, sin migraciones.
