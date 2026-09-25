# TASK-AUD-002 — Git / CI Governance

## TASK ID

`TASK-AUD-002`

## Título

Cerrar la diferencia entre la política de PR y su enforcement, y el gate de `build:webpack`.

## Prioridad

`P0` — proceso. Es la última pieza de gobierno antes del bloque funcional de dinero.

## Clase de riesgo

`docs/CI` (+ configuración real de GitHub, **autorizada explícitamente por el owner**). **No toca producto.**

---

## PROBLEMA

Dos huecos de gobierno, ambos verificados contra la realidad del repo y de GitHub:

1. **Política ≠ enforcement.** En `main` el PR es obligatorio **por política** (`AGENTS.md` § *Git*), pero el
   ruleset `Protect main` **no tiene la regla `pull_request`**: solo `deletion`, `non_fast_forward` y los
   cuatro checks requeridos. A nivel de plataforma, un push directo a `main` que satisfaga los checks no está
   bloqueado por la falta de PR.
2. **`build:webpack` no corre en CI.** El repo sabe que el build de Turbopack **no valida los exports de una
   página** (`AGENTS.md` § *Validación*), y por eso pide `npm run build:webpack` al tocar un `page.tsx`. Pero
   eso vivía **solo en prosa**: el job `verify` corre `npm run build` y nada más, así que el error de una
   página puede llegar a `main` con el CI verde.

## EVIDENCIA

- **Ruleset**, leído de la API real (`gh api repos/danielmaki123/one-burger-commerce/rulesets/23673659`)
  antes de tocar nada: `enforcement: active`; `conditions.ref_name.include: ["refs/heads/main"]`;
  `bypass_actors: []`; reglas **`deletion`**, **`non_fast_forward`**, **`required_status_checks`**
  (`strict_required_status_checks_policy: true`) con `verify`, `contracts`, `migrations`, `container`.
  **No hay `pull_request`.** Configuración completa guardada antes del cambio para rollback.
- **Workflow**: el job `verify` corría `security:secrets`, `lint`, `typecheck`, `npm test` y `npm run build`
  —**sin** `build:webpack`—. `npm run build:webpack` existe y se usa a mano.
- **Auditoría de E2E para un gate** (pedida por el owner): la suite vive en `tests/e2e`, `workers: 1`,
  `fullyParallel: false`, y en CI ya tiene `forbidOnly` y 2 reintentos. **No es candidata a required check**:
  depende de datos de negocio cargados (la carta real la carga el owner; el CI tiene una base vacía) y de
  credenciales del admin, y sus specs mutantes comparten estado. La evidencia está en el propio inventario de
  AUD-001: de los 43 skips, varios son exactamente «faltan credenciales del admin del entorno
  (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)» y «la carta necesita …» — o sea, en un entorno tipo CI la suite se
  saltea sola. Convertirla en gate sería fabricar «CI enterprise» a costa de falsos rojos.

## CAUSA RAÍZ

El gobierno del repositorio se apoyaba en dos cosas que **no** son ejecutables: una convención escrita (el PR
obligatorio) y una instrucción en prosa (correr el build de webpack al tocar una página). Ninguna de las dos
tiene quién la haga cumplir, y las dos se olvidan justo cuando hay apuro.

## INVARIANTE

1. **Ningún cambio llega a `main` sin pasar por un Pull Request** — y el owner puede completar ese flujo
   **sin una segunda cuenta** (0 aprobaciones requeridas, sin CODEOWNERS).
2. **Si una PR toca un `page.tsx`, el CI corre `build:webpack`**; si no lo toca, no lo corre (y el check
   requerido no queda en «Expected»).

## BOUNDED CONTEXT

No es un bounded context de producto: es el gobierno de Git/CI (`.github/**`, `scripts/**` y la configuración
del ruleset). No toca `src/modules/**`.

---

## SCOPE IN

1. **Ruleset `Protect main`**: **agregar** la regla `pull_request` con `required_approving_review_count: 0`,
   sin CODEOWNERS y sin aprobación de una segunda persona. **No se quita nada**: se preservan `enforcement`,
   `deletion`, `non_fast_forward`, `required_status_checks` con `strict`, los cuatro checks y los
   `bypass_actors` (vacíos).
2. **Gate de `build:webpack`**: script `scripts/check-page-build-needed.mjs` (decide, no construye) conectado
   **dentro del job `verify`** con un step propio y un step condicional de build.
3. **Tests del gate** (`src/shared/contracts/page-build-gate-contract.test.ts`): la lógica de detección
   ejecutando el script real, el acoplamiento con `$GITHUB_OUTPUT` y la conexión en el workflow.
4. **Auditoría de E2E**: documentada (arriba) con la decisión de **no** convertirlo en gate y el gap anotado
   para una TASK futura.
5. Documentación: esta TASK, `ops/CURRENT.md` y la sección de ruleset de `AGENTS.md`.

## SCOPE OUT

- **No** se exige 1 approval ni CODEOWNERS.
- **No** se marca `publish` como required.
- **No** se toca producción, ni se deploya, ni se cambian secrets.
- **No** se toca producto.
- **No** se agrega una matriz de CI grande ni E2E flaky como gate.
- **No** se renombran los cuatro required checks.
- **No** se elimina ninguna protección ni bypass existente.
- **No** se prueba el bloqueo con un push directo real a `main`.

## DEPENDENCIAS

`TASK-AUD-000` (documentó la realidad del ruleset) y `TASK-AUD-001` (infraestructura de gates ya probada).
**Autorización explícita del owner** para modificar el ruleset (incluida en el brief de continuación).

## ARCHIVOS PROBABLES

`scripts/check-page-build-needed.mjs` · `src/shared/contracts/page-build-gate-contract.test.ts` ·
`.github/workflows/publish-ghcr.yml` · `ops/tasks/TASK-AUD-002-git-ci-governance.md` · `ops/CURRENT.md` ·
`AGENTS.md` · ruleset `23673659` (API).

---

## TEST ROJO

`page-build-gate-contract.test.ts` con el script como **stub**: **6 de 11 en rojo** (las tres detecciones
positivas, «dice qué archivos lo dispararon» y los dos tests de conexión en el workflow), con los 5 fixtures
«NO pide el build» ya en verde. Después del GREEN: **12/12** (se sumó el test del `$GITHUB_OUTPUT`).

## ESTRATEGIA

- **El detector decide, el workflow construye**: el script recibe la lista de archivos cambiados y contesta
  `needed=true|false`; el workflow corre `build:webpack` solo si es `true`.
- **Dentro de `verify`, no como check nuevo**: un required check condicional quedaría en «Expected» para
  siempre en las PRs que no tocan páginas. El owner lo pidió así y es la opción simple y confiable.
- **Detección con historia explícita**: `fetch-depth: 0` en `verify` y el diff contra
  `github.event.pull_request.base.sha` (o `HEAD^` en un push). Si no hubiera base comparable, **se corre el
  build igual**: un build de más es mejor que un gate que se saltea.
- **Ruleset con red de seguridad**: se guarda el JSON completo antes; el `PUT` manda todo lo que ya estaba
  más la regla nueva, y después se vuelve a leer por API para demostrar que quedó.

## RIESGOS DE FALSO POSITIVO

| Riesgo | Mitigación |
|---|---|
| Marcar como página algo que no lo es (`layout.tsx`, `_components/*.tsx`) | el patrón exige `src/app/…/page.tsx` exacto; hay tests negativos |
| No marcar una página real | se prueban rutas de panel, públicas y profundas (`[productId]`) |
| El step condicional **nunca** corre (gate apagado en silencio) | test que ejecuta el script con `GITHUB_OUTPUT` y exige `needed=true/false` |
| El workflow deja de llamar al detector | contrato que exige el script, `build:webpack` y la expresión `if:` |
| Perder el `fetch-depth` y saltear el gate | contrato que lo exige en el job `verify` |
| Bloquear PRs legítimos con el `require PR` | `required_approving_review_count: 0`, sin CODEOWNERS: el flujo lo completa quien abre el PR |

## TRANSACCIÓN / CONCURRENCIA / IDEMPOTENCIA / AUTORIZACIÓN / MIGRACIÓN

**N/A — no hay dinero ni datos.** El único cambio con efecto externo es la configuración del ruleset, que es
idempotente (se manda el estado deseado completo) y tiene rollback guardado.

## OBSERVABILIDAD

- El script imprime `needed=` y **qué archivos** lo dispararon.
- El step se llama `Detect page changes (webpack gate)` y el build `Webpack build (páginas)`: en el check run
  se ve si corrió.
- El ruleset se verifica por API antes y después, con el diff exacto.

---

## TESTS UNITARIOS

`page-build-gate-contract.test.ts` — 12 tests: 8 de la lógica de detección (incluye el uso incorrecto y que
diga qué archivos lo dispararon), 1 del `$GITHUB_OUTPUT`, 2 de la conexión en el workflow y 1 del
`fetch-depth`.

## TESTS DE INTEGRACIÓN

No hay suite que levante el gate completo: la verificación end-to-end es **el propio CI del PR**, que corre el
detector y decide. Se verifica además el caso positivo del condicional con una PR temporal que toca una página
(evidencia registrada en el PR; la rama se descarta sin mergear).

## E2E

**N/A — no cambia comportamiento de producto.** La auditoría de la suite E2E se documenta en *PROBLEMA*/*EVIDENCIA*
y no se convierte en gate (decisión explícita).

## MUTATION CHECK

Sondas sobre el gate nuevo:

| # | Sonda | Esperado |
|---|---|---|
| 1 | quitar la condición `if:` del step de webpack | **ROJO** en el contrato de conexión |
| 2 | sacar la llamada al script del workflow | **ROJO** |
| 3 | sacar `fetch-depth: 0` de `verify` | **ROJO** |
| 4 | hacer que el script no escriba en `GITHUB_OUTPUT` | **ROJO** en el test del acoplamiento |
| 5 | aflojar el patrón a `page` (sin `.tsx`) | **ROJO** en los fixtures negativos |

## ADVERSARIAL REVIEW

- **¿Puede estar verde el CI y el error de página llegar a `main`?** Ya no: si la PR toca un `page.tsx`, el
  `build:webpack` corre dentro de `verify`. Lo que **no** cubre: un error de página introducido por un archivo
  que no es `page.tsx` pero que la página importa — eso lo cubre el `build` de Turbopack, que sí valida el
  resto del árbol.
- **¿El gate se puede apagar sin que se note?** El contrato exige la conexión y el `fetch-depth`; y si el
  script dejara de publicar `needed`, un test lo detecta.
- **¿`require PR` bloquea al owner?** No: 0 aprobaciones y sin CODEOWNERS. Verificado en la práctica: la
  propia PR de AUD-002 se mergeó **después** de activar la regla.
- **¿El gate podría bloquear una PR legítima?** El peor caso es correr un build de más (lento), no un rojo
  falso: el build de webpack es el mismo que se corre a mano y hoy pasa.
- **¿Se puede saltear el diff con un merge commit raro?** Con `strict` y el rebase/merge habitual no; si el
  diff no se puede calcular, el script asume que hay páginas y corre el build.

### Qué NO se puede demostrar automáticamente

Que el build de webpack **pase** no prueba que la página esté bien: prueba que compila y exporta lo que
Turbopack no validaba. El comportamiento de la página lo cubren los E2E (locales) y la verificación en
navegador real de cada TASK de UI.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
npx vitest run src/shared/contracts/page-build-gate-contract.test.ts
```

Más: `gh api …/rulesets/23673659` antes y después (diff exacto) y el CI del PR con los cuatro checks.

## CRITERIOS DE ACEPTACIÓN

- [ ] El ruleset conserva TODO lo que tenía y suma `pull_request` con 0 aprobaciones.
- [ ] `publish` **no** quedó como required.
- [ ] El ruleset verificado por API muestra `pull_request`, los cuatro checks, `strict`, `deletion` y
      `non_fast_forward`.
- [ ] El PR de AUD-002 completa su flujo **con la regla activa**.
- [ ] El gate de páginas detecta bien (12 tests) y está conectado en `verify` con la condición.
- [ ] La auditoría de E2E queda documentada con su decisión.

## REGRESIÓN

Los 12 tests del gate son la regresión: si alguien desconecta el detector, saca la condición, quita el
`fetch-depth` o rompe el patrón de páginas, se ponen rojos (probado con las sondas 1–5).

## ROLLBACK

- **Ruleset**: se guardó la configuración completa previa (`rules` sin `pull_request`). Volver atrás es un
  `PUT` con ese JSON. El cambio no borra nada, así que revertirlo es quitar una regla.
- **CI**: revertir el commit del workflow; el script y sus tests son aditivos.

## DOCUMENTACIÓN

`ops/CURRENT.md` (AUD-002 cerrada, el ruleset exige PR desde ahora), `AGENTS.md` (§ *CI y protección de
`main`*: la regla ya no es solo política) y `ops/tasks/AUDIT-REMEDIATION-ROADMAP.md` si cambia el orden.

## MEMORY

Lección candidata: «un gobierno que no se puede verificar por API/configuración es una convención, no un
control» y «un gate condicional debe vivir dentro de un check requerido, nunca como check requerido
condicional (queda en Expected para siempre)».

## DEFINITION OF DONE

- [ ] Ruleset modificado dentro del alcance autorizado y verificado por API (antes/después).
- [ ] Gate de `build:webpack` conectado en `verify` con tests propios.
- [ ] Validación completa en verde y CI del PR verde (los cuatro checks).
- [ ] PR mergeada **con** la regla de PR activa (prueba de que el flujo se completa).
- [ ] `main` verde después del merge, con `publish` en verde. **Sin deploy.**
- [ ] `ops/CURRENT.md` actualizado.
