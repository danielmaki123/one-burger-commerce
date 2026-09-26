# AGENTS.md — constitución del agente

Instrucciones de trabajo de este repositorio. Si algo acá contradice un pedido **explícito** del owner para
la TASK en curso, **gana el owner**; después de resolverlo, esta regla se corrige acá en el mismo commit.
Este archivo define **comportamiento y límites**: no es el historial, no es el estado actual y no es el
manual de arquitectura. Se mantiene corto a propósito —**≤ 300 líneas**— porque es lo primero que lee todo
agente: el detalle va a una skill y acá queda la regla general.

## Autonomía: cuándo actuar y cuándo parar

- **De a una TASK por vez**: cada una se cierra entera (implementación, tests, validación, commit, push, CI
  verde y estado actualizado) antes de empezar la siguiente.
- **Plan escrito = alcance ya resuelto.** Lo que un brief (`ops/tasks/*.md`) o el pedido del owner ya define
  se ejecuta **de corrido**. Se pregunta por lo que el plan **no** decide y, si choca con este archivo,
  **gana el plan** y la excepción se anota acá en el mismo commit.
- **No se inventa producto** ni se completa trabajo para no quedar quieto: si no hay TASK, se pregunta.

**Entrega E2E por defecto**: una TASK **aprobada** se ejecuta hasta el estado operativo final **sin pedir
permisos intermedios** —«¿mergeo?», «¿deployo?», «¿borro la rama?» no se preguntan con los gates verdes—.
Antes de tocar código se declara su **Delivery Mode** (`docs-only` · `runtime-e2e` · `high-risk-e2e`), que
decide si la TASK termina en merge o también en producción. El flujo, los modos, la **política de backups**
(por **riesgo del release**, no por frecuencia) y las **Stop Conditions** —la única lista de cuándo parar—
viven en [`.agents/skills/delivery-e2e/SKILL.md`](.agents/skills/delivery-e2e/SKILL.md): se escriben una vez.

**Parar y preguntar SOLO ante una Stop Condition** de esa política. Nada más se pregunta: nombres, formato y
decisiones inferibles del repo se resuelven y se sigue. Ante documentación contradictoria, verificá **primero
el código, los contratos, la configuración real de GitHub y el estado del repo**; después documentá la
diferencia.

## Jerarquía de fuentes

1. **Instrucción explícita del owner** para la TASK actual.
2. **Seguridad, integridad de datos y comportamiento verificable** (dinero, autorización en el servidor, no
   perder datos).
3. **Contratos ejecutables, tests y configuración real** (`src/shared/contracts/*.test.ts`,
   `prisma/schema.prisma`, `.github/workflows/`, la API real de GitHub).
4. **`AGENTS.md`** (este archivo).
5. **`.agents/CONTEXT.md`** y **`ops/CURRENT.md`** (cómo está construido / qué pasa hoy) · 6. **documentación
histórica** (`ops/history/`, briefs cerrados) · 7. **referencias secundarias** (skills de terceros, mockups).

Derivadas, no negociables: **el historial NO gana sobre el estado actual** · **una referencia visual no gana
sobre una invariante de negocio** · **una UI nunca es por sí sola una frontera de autorización**. En lo
visual la ley es [`ops/design/DESIGN_SYSTEM.md`](ops/design/DESIGN_SYSTEM.md) y gana siempre ahí (color §3,
tokens §5, accesibilidad §13); el material de Stitch está **archivado** y no es lectura obligatoria.

## Mapa del sistema

| Documento | Responde |
|---|---|
| `AGENTS.md` (este archivo) | Comportamiento, reglas y límites |
| [`.agents/CONTEXT.md`](.agents/CONTEXT.md) · [`ops/product/MODULE_ARCHITECTURE.md`](ops/product/MODULE_ARCHITECTURE.md) | **Cómo está construido** (superficies, hosts, stack, DDD, persistencia, outbox, auth, CI) · **arquitectura de producto**: dónde vive cada capacidad y quién es dueño de sus reglas |
| [`.agents/MEMORY.md`](.agents/MEMORY.md) | Conocimiento estable aprendido: decisiones cerradas, errores comprendidos, restricciones, lecciones |
| [`.agents/skills/`](.agents/skills/) | Procedimientos repetibles, uno por tipo de trabajo |
| [`ops/CURRENT.md`](ops/CURRENT.md) | Estado operativo actual: producción, riesgos, trabajo en curso, qué sigue |
| [`ops/tasks/`](ops/tasks/) · [`ops/roadmap/`](ops/roadmap/) · [`ops/design/`](ops/design/) | Trabajo planificado: briefs, [plantilla obligatoria](ops/tasks/TEMPLATE.md), [programa de remediación](ops/tasks/AUDIT-REMEDIATION-ROADMAP.md) y [roadmap de producto/UX](ops/roadmap/PRODUCT-UX-ROADMAP.md) · **ley visual** y specs de pantalla |
| [`ops/audit-backlog.md`](ops/audit-backlog.md) · [`ops/decisions/`](ops/decisions/) | Cola de hallazgos con ID, tipo y severidad · decisiones de arquitectura (ADR) |
| [`ops/history/`](ops/history/) | Historia archivada. **No es fuente de verdad** |

**Orden de lectura de una sesión nueva** ([`ops/tasks/START-HERE.md`](ops/tasks/START-HERE.md)):
`AGENTS.md` → `.agents/CONTEXT.md` → `ops/CURRENT.md` → la TASK → la skill. `MEMORY.md` se lee cuando sus
lecciones aplican y **la historia no se carga por defecto**. **Escribir en el lugar correcto es parte del
trabajo**: la lección reutilizable va a `MEMORY.md`; el estado del día, a `CURRENT.md`; lo que pasó, a
`ops/history/`; el procedimiento, a una skill; la anomalía sin corregir, al backlog. **La misma regla no se
escribe completa en varios lugares**: se enlaza. `docs/` y `handoffs/` están en `.gitignore`: no se citan.

## El proyecto

**One Burger Commerce** — pedidos para un restaurante, **solo retiro en el local**; sin pasarela de pago (se
cobra al retirar) y propina opcional desmarcada. Superficies, hosts y detalle estable, en
[`.agents/CONTEXT.md`](.agents/CONTEXT.md). Roles: `owner` (todo) · `manager` (órdenes, menú, promociones,
inventario, caja, devoluciones) · `kitchen` (solo órdenes, **no** maneja plata) · `cashier` (cobra y cierra el
turno; **no** administra caja, **no** devuelve, **no** ve el esperado del arqueo). **Fuera del MVP** (código
presente, **no** ofrecido en UI ni en APIs públicas): reservas, mesas, delivery, inventario y reportes
avanzados; sus páginas quedan solo por URL directa y **no se reactivan** sin aprobación explícita.

## Arquitectura obligatoria (DDD)

```
src/modules/<módulo>/{domain,features,ports,adapters}
src/app/** rutas + API routes · src/shared/{ui,lib,config,pwa,contracts} · src/infrastructure/**
```

**ROUTE**: HTTP → validación → auth/authz → caso de uso; **sin Prisma directo y sin reglas de negocio**.
**FEATURE / APPLICATION**: orquesta el caso de uso con dependencias inyectadas (`{ repository, ... }`), define
la transacción cuando corresponde y **no** instancia Prisma. **DOMAIN**: invariantes, políticas, value objects,
transiciones y reglas financieras — **sin Next, sin Prisma, sin HTTP**. **PORTS**: interfaces que necesitan
aplicación y dominio. **ADAPTERS**: Prisma, cookies, Telegram, servicios externos. El **dominio no depende de
los adapters** y un módulo nuevo nace con las cuatro capas (`module-contract.test.ts`, `route-contract.test.ts`).

## Límites de código

- **Route handlers**: máximo **50 líneas**; validan con zod, resuelven permisos, instancian el adaptador y
  llaman al caso de uso. Prohibido importar `getPrismaClient()` o `@prisma/client` desde un `route.ts`.
- **Tamaño**: máximo **400 líneas por archivo** y **80 por función**.
- **Una sola fuente por cálculo**: los totales salen de `src/shared/lib/order-totals.ts`
  (`calculateOrderTotal` / `calculateOrderTotals`) y el estado del pedido de
  `src/modules/orders/domain/order-workflows.ts`. Prohibido sumar `subtotal + packaging + tip` a mano.
- **Antes de crear, buscar**: si la regla, el cálculo o el texto ya existen, se reusan; componentes y helpers
  van en su propio archivo.

## Testing (no negociable)

**TDD obligatorio para TODO código nuevo**: 1. test que falla **primero** · 2. rojo confirmado **por la razón
correcta** (no por un import roto) · 3. implementación mínima · 4. refactor · 5. validación completa.

**Obligatorio**: ruta API con `route.test.ts` hermano · caso de uso con test en `src/modules/**/features/**`
· componente con test propio (`src/shared/ui/` y `_components/`) · commit con test del código nuevo
funcional. El gate `src/shared/contracts/tdd-contract.test.ts` congela la deuda vieja con su motivo escrito y
**no crece**. Los **dobles implementan el puerto completo**; lo de infraestructura se cubre con contratos que
leen archivos o con el job que construye la imagen, y los flujos de usuario van en `tests/e2e/`. **Todo bug
demuestra la regresión antes de corregirse** ([`.agents/skills/bugfix/SKILL.md`](.agents/skills/bugfix/SKILL.md):
RED → fix → GREEN → mutación).

### Integridad de tests

Está **prohibido**: `expect(true).toBe(true)` y todo test tautológico · verificar que una función devuelve lo
mismo que ella misma calculó · usar la **misma función de producción** para calcular el `expected` y el
`actual` · mocks que devuelven exactamente lo que la implementación espera sin verificar comportamiento ·
**bajar expectativas** para conseguir verde · **borrar** un test que falla por la nueva implementación ·
cambiar un **acceptance test** sin justificar un cambio real de contrato · usar **coverage como sustituto de
calidad** · escribir el test **después** y afirmar que hubo TDD · **ocultar** que no se observó RED.

**Para bugs**: RED observable **obligatorio**, salvo imposibilidad documentada (motivo, cómo se validó el test
y qué flujo cubre, escritos en el commit). **Mutation check**: después del GREEN, reintroducir la condición
defectuosa o una mutación equivalente; el test **debe fallar**; después se restaura, y **la mutación no se
commitea**. **Valores monetarios**: el `expected` se deriva de una **regla explícita del negocio**, nunca
reutilizando el helper de producción bajo prueba.

**Si un test existente falla, no se cambia automáticamente**: se determina si **(A)** la implementación
introdujo una **regresión** —se arregla el código— o **(B)** el test es **obsoleto porque el contrato cambió
a propósito** —el cambio se justifica por la TASK o por una decisión del owner—. Prohibido: *test rojo →
cambiar el expected → verde* sin demostrar que cambió el contrato.

**Coverage ≠ correctness.** Se prefieren invariantes, ramas críticas, escenarios **negativos**, tests de
integración, **mutación**, **concurrencia**, **autorización** y **persistencia**. Un test con **dientes**: si
volvés a introducir el bug, falla. El gate `test-integrity-contract.test.ts` vigila lo mecánico y dice qué no puede.

## Ratcheting de calidad

**La deuda existente puede quedar temporalmente. La deuda nueva no.** Si un archivo legacy tiene 994 líneas,
una TASK no está obligada a bajarlo a 400, pero **no debe crecer** a 1.050 sin justificación excepcional.
**Los techos solo se mantienen o bajan; nunca suben en silencio.**

Aplica igual a archivos y funciones grandes, route handlers, excepciones de arquitectura
(`route-contract.test.ts`, `module-contract.test.ts`, `tdd-contract.test.ts`), techos de UI
(`src/shared/config/design-tokens.allow.json`), tests faltantes, `eslint-disable` y deuda contractual. Si un
techo baja, se baja el número **en el mismo commit**; si aparece un archivo nuevo con violaciones, se arregla
el archivo, no se agrega la fila. Un documento tampoco crece: se mueve a `ops/history/`, a una skill o al backlog.

## Review adversarial

Una TASK crítica (dinero, auth, datos, migraciones) lleva una pasada cuyo objetivo es **refutar** la solución,
no confirmarla: ¿puede el CI estar verde y el requisito seguir **roto**? ¿hay un test **tautológico** o un
**mock** permisivo? ¿faltan **escenarios negativos**, **race condition**, **partial write**, **rollback**,
**idempotencia** o **autorización** que solo viva en la UI? ¿se **tragó** un error, se duplicó una regla o se
**modificó un test** para que pase? ¿dos requests simultáneos rompen la invariante?

## UI y design system

La ley visual es [`ops/design/DESIGN_SYSTEM.md`](ops/design/DESIGN_SYSTEM.md) —con `CONTENT`, `PATTERNS`,
`MOTION` y `DATA_VISUALIZATION` al lado—; el checklist está en
[`.agents/skills/ui-change/SKILL.md`](.agents/skills/ui-change/SKILL.md) y una pantalla nueva pasa antes por
[`screen-design`](.agents/skills/screen-design/SKILL.md). Las reglas duras:

- El **panel** (KDS/POS/Admin) es **oscuro** sobre `--bg-canvas` con superficies por capas; el **público** es
  **claro**. Nada de contenedores blancos planos.
- Los **números** van en `font-mono` con `tabular-nums` (precios, cronómetros, IDs, PIN, contadores).
- **Intención, no color**: la marca se pide por intención (`--brand-primary`, `--brand-accent`); qué color
  tiene cada una es **tema** (hoy acento = ámbar), no una asignación fija por superficie.
- **`animate-pulse` solo en SLA vencido o desincronización**; cabecera y filtros en el **20%** del alto;
  **controles ≥44 px** (`h-11`); estados del sistema (`--status-pending|prep|ready|sla`).
- **Datos reales**: `C$`/`NIO`, `+505` y las tres sucursales (**Camino de Oriente**, **Carretera Masaya**,
  **Casa Antigua**). Prohibido inventar nombres, ciudades o monedas.
- **Nada de color fuera de token** (`#hex`, `rgb()`, `rgba()`, `hsl()`, paleta cruda, `fontFamily` inline), **contraste**
  texto/fondo **4.5:1** y borde de control **3:1** (WCAG 1.4.11), y **los tokens muertos no vuelven**:
  `--primary`, `--popover`, `--destructive`, `--ring` y `--sidebar-*` se eliminaron —borrar `--ring` además
  rompe el foco, porque Tailwind compila `outline-ring/50` a `var(--ring)`—.
- **Componente que existe, componente que se usa**; **prohibido el HTML crudo equivalente** donde hay
  primitivo y **prohibido copiar el HTML del material archivado** (se traduce). **Componente nuevo = registro previo** en
  `src/shared/ui/registry.json`, en el mismo commit, con su «cuándo SÍ» y «cuándo NO».
- **Ningún control ni copy decorativo**: cada control con su estado/API **y su test**, o se elimina con el
  motivo escrito. **Los techos de UI solo bajan**, y la UI se verifica en **navegador real a 375 px y 1280
  px** (Playwright), no en HTML estático.

## Seguridad

- **La autorización se aplica en el servidor.** Ocultar algo en React **no** es autorización, y una UI nunca
  es por sí sola una frontera de autorización. Cada operación sensible tiene su **puerta de dominio** en
  `src/modules/auth/domain/admin-permissions.ts`, aplicada aunque hoy coincida con otra.
- Respuestas: **401** sin sesión · **403** sin permiso o fuera de alcance · **404** solo si además no debe
  poder deducirse que el recurso existe.
- **Endpoints internos y de staging**: fail-closed por entorno (`APP_ENV`) + token comparado con
  `timingSafeEqual`. **Secretos solo por entorno**: nunca en el repo, un commit, un documento, un log ni un
  chat; `npm run security:secrets` lo verifica.
- Pruebas negativas obligatorias:
  [`.agents/skills/security-change/SKILL.md`](.agents/skills/security-change/SKILL.md).

## Datos, migraciones y dinero

- Migraciones Prisma **versionadas**, **aditivas primero** y **sin BOM** —un BOM rompe `prisma migrate deploy`
  en una base nueva, y hay un test que lo verifica—. `prisma/seed.ts` es **solo para local/demo**, nunca en producción.
- Los datos del negocio (nombre, colores, contacto, horarios, precios, propina, zona horaria) **no se
  hardcodean**: salen de la configuración editable en el admin. Procedimiento en
  [`.agents/skills/database-migration/SKILL.md`](.agents/skills/database-migration/SKILL.md).

**Todo cambio que toque dinero** —directa o indirectamente— activa
[`.agents/skills/money-change/SKILL.md`](.agents/skills/money-change/SKILL.md): invariantes, transacción,
concurrencia, idempotencia, autorización, auditoría, rollback y persistencia. **Una operación lógica de dinero
debe tener un límite atómico explícito**, y una propiedad que dependa de PostgreSQL se prueba contra
PostgreSQL real, no contra un doble en memoria.

## Git, ramas, commits y PR

Repo: `github.com/danielmaki123/one-burger-commerce`. La rama de deploy es **`main`**: **por política no recibe
push directo** (se trabaja en rama y se mergea por PR). Política ≠ enforcement: ver *CI y protección de `main`*.

**Flujo**: 1. rama desde `main` actualizado (`git pull --ff-only origin main && git checkout -b <tipo>/<nombre>`)
· 2. trabajar y commitear en la rama · 3. `git push -u origin <tipo>/<nombre>` · 4. **abrir PR hacia `main`** con
problema, qué cambió, qué **no** cambió, cómo se verificó y qué quedó fuera · 5. **esperar el CI verde** (la
aprobación de otro dev **no** se exige: approvals 0) · 6. **merge con `--squash`**, solo después del paso 5.
Nomenclatura: `feature/` · `fix/` · `refactor/` · `docs/` · `chore/`.

**Prohibiciones**: push directo a `main` · `git push --force` a `main`, siempre · ramas ajenas sin avisar.
**Commits**: uno por tema, en español, prefijo + área + resumen, con **problema, evidencia de verificación y
excepciones** en el cuerpo. **Nunca commitear** secretos, `.env` o tokens · caches y artefactos · metadata de
agentes de terceros (`.claude/`, los volcados de skills ajenas bajo `.agents/skills/`).

## CI y protección de `main`

**CI** (`.github/workflows/publish-ghcr.yml`) corre en cada push a `main`, en cada PR hacia `main` y a mano:
**verify** (secrets, lint, typecheck, tests, build) · **contracts** (los guardrails de
`src/shared/contracts/`) · **migrations** (Postgres 17 limpio + drift contra `schema.prisma`) · **container**
(imagen real: readiness y bootstrap del admin) · **publish** (imagen a GHCR, **solo** en push a `main`).

**Protección de `main`**: **ruleset** `Protect main` (enforcement `active`, sobre `refs/heads/main`), no
branch protection clásica. Verificado contra la API real de GitHub: **`deletion`** · **`non_fast_forward`** ·
**`required_status_checks`** con `strict` y los checks **`verify`, `contracts`, `migrations`, `container`**.
**El ruleset exige Pull Request** (`required_approving_review_count: 0`: el PR es obligatorio a nivel de
plataforma y el owner completa el flujo sin una segunda cuenta). Se verifica con `gh api
repos/danielmaki123/one-burger-commerce/rulesets`; **no** con `/branches/main/protection`, que devuelve **404** con ruleset (404 **no** es «sin protección»).
⚠️ **Nunca marcar `publish` como *required check***: no corre en PRs y el PR quedaría en «Expected». La rama se
toca **solo con pedido explícito del owner**; si algo falla por protección, **se reporta al humano**.

## Deploy y producción

- **Solo se despliega desde `main` y después del CI verde.** La aprobación de una TASK `runtime-e2e` —o el
  pedido explícito del owner— **autoriza** su merge y su release: **no se pide una segunda autorización** salvo
  una **Stop Condition**. Nunca desde una rama de trabajo.
- Una sola llamada a `deployService` (`forceRebuild: true`) por API, con `EASYPANEL_TOKEN` **por entorno**.
  ⚠️ **No** usar `npm run deploy:easypanel`: fusiona variables y puede crear servicios.
- Después: **health** y **readiness** (`/api/health`, `/api/readiness`) y los dos smokes de solo lectura
  (`test:e2e:prod`, `test:e2e:prod:hosts`).
- **Nunca** `db:seed` ni `migrate reset` contra producción, y **nunca** modificar otros servicios del
  servidor (`cacommerce`, `capostgres`, `imagehost`, `postimage`, proyecto `n8n`).
- Procedimiento, rollback y límites:
  [`.agents/skills/production-release/SKILL.md`](.agents/skills/production-release/SKILL.md) y
  [`ops/production-readiness.md`](ops/production-readiness.md) — el runbook manda en la secuencia exacta.

## Validación mínima antes de cerrar

`npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts &&
npm run build`. Además: **`npm run build:webpack`** si tocaste una página (`src/app/**/page.tsx`) —Turbopack no
valida los exports de una página y el problema queda escondido— · `npx prisma generate` si tocaste `prisma/schema.prisma` ·
los E2E locales con Postgres arriba (`BASE_URL=http://127.0.0.1:3210 npm run test:e2e:prod:full`) si tocaste flujos, con
límites de tasa altos y **una sola suite a la vez**.

## Definition of Done

- [ ] Tests verdes (unitarios + contratos + E2E si toca flujos), con el **rojo observado** o su excepción
      documentada.
- [ ] `security:secrets`, `lint`, `typecheck`, `build` verdes; `build:webpack` si tocó una página.
- [ ] Verificación en **navegador real (375 px y 1280 px)** y **captura antes/después** si toca UI.
- [ ] Ningún techo de deuda **subió**.
- [ ] `ops/CURRENT.md` actualizado (y `ops/audit-backlog.md` si cierra un hallazgo); `MEMORY.md` **solo** si
      la lección es reutilizable.
- [ ] Commit + push a la rama, **PR abierto**, **CI verde** (los cuatro checks).
- [ ] Si el **Delivery Mode** incluye deploy: health/readiness, los dos smokes y QA de producción **después**
      del merge, sin una segunda autorización; excepciones documentadas en el commit.

## Cierre de sesión

En este orden: 1. mergear el PR (`--squash --delete-branch`) **después** del CI verde y volver a `main` con
`git pull --ff-only` · 2. actualizar **`ops/CURRENT.md`** (qué quedó desplegado, qué se cerró y **qué falta**),
`ops/tasks/START-HERE.md` y `ops/audit-backlog.md` si hay hallazgos · 3. **ese cierre también va por PR** ·
4. reportar la rama actual, el **último commit de `main`**, `git status` limpio y qué queda pendiente; si algo no coincide con GitHub, **se reporta la diferencia**.

## Idioma y estilo

**Español** en UI, admin, documentación, commits y respuestas; **inglés** en nombres de archivos, funciones,
tipos y variables de código. UI mobile-first (se verifica a 375 px), `min-h-11` en controles táctiles, labels
asociados a sus inputs y textos de error claros en español. Estilos con los **tokens semánticos** de
`src/app/globals.css`; no colores sueltos ni clases ad hoc.

## Prohibiciones

Además de las repartidas arriba (push a `main` y force push, `db:seed` y `migrate reset` en producción, tocar
servicios ajenos, deployar sin CI verde, cambiar el ruleset): no reactivar módulos fuera del MVP en navegación ni en
APIs públicas sin pedido explícito · no dejar `BOOTSTRAP_ADMIN_*` ni secretos temporales en el entorno · no
corregir un bug encontrado durante una auditoría o una reorganización (**documentarlo**) · no escribir la misma
regla completa en varios documentos: se escribe una vez y se enlaza.
