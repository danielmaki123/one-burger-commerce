# AGENTS.md — constitución del agente

Instrucciones de trabajo de este repositorio. Si algo acá contradice un pedido **explícito** del owner para la TASK en
curso, **gana el owner**; después de resolverlo, esta regla se corrige acá en el mismo commit. Este archivo define
**comportamiento y límites**: no es el historial, no es el estado actual y no es el manual de arquitectura. Se
mantiene corto a propósito —**≤ 300 líneas**— porque es lo primero que lee todo agente: el detalle va a una skill y
acá queda la regla general.

## Autonomía

- **Una TASK por vez**, cerrada entera (implementación, tests, validación, commit, push, CI verde y estado)
  antes de la siguiente. **No se inventa producto**: si no hay TASK, se pregunta.
- **Plan escrito = alcance ya resuelto.** Lo que un brief (`ops/tasks/*.md`) o el pedido del owner ya define se
  ejecuta **de corrido**. Se pregunta por lo que el plan **no** decide y, si choca con este archivo, **gana el
  plan** y la excepción se anota acá en el mismo commit.
- **Entrega E2E por defecto**: una TASK **aprobada** se ejecuta hasta el estado operativo final **sin pedir
  permisos intermedios**. Antes de tocar código declara su **Delivery Mode** (`docs-only` · `runtime-e2e` ·
  `high-risk-e2e`), que decide si termina en merge o también en producción. **El flujo obligatorio**, los
  modos, la **política de backups** (por **riesgo del release**) y las **Stop Conditions** —la única lista de
  cuándo parar— viven en [`.agents/skills/delivery-e2e/SKILL.md`](.agents/skills/delivery-e2e/SKILL.md).
- **El orden del trabajo de producto** es el del [roadmap maestro](ops/roadmap/PRODUCT-UX-ROADMAP.md), que es
  **uno solo**; la secuencia inmediata, en [`ops/roadmap/NEXT.md`](ops/roadmap/NEXT.md).
- **Parar y preguntar SOLO ante una Stop Condition.** Ante documentación contradictoria, verificá **primero el
  código, los contratos, la configuración real de GitHub y el estado del repo**; después documentá la diferencia.

## Jerarquía de fuentes

La autoridad, de mayor a menor: **1.** la **instrucción explícita del owner** para la TASK actual; **2.** la
**seguridad, la integridad de los datos y el comportamiento verificable** (dinero, autorización en el servidor, no
perder datos); **3.** los **contratos ejecutables, los tests y la configuración real**
(`src/shared/contracts/*.test.ts`, `prisma/schema.prisma`, `.github/workflows/`, la API real de GitHub); **4.** **este
archivo**, y con él **`.agents/CONTEXT.md`** y **`ops/CURRENT.md`** (cómo está construido / qué pasa hoy); **5.** la
**documentación histórica** y las **referencias secundarias** (skills de terceros, mockups, `ops/history/`, briefs
cerrados), que **no mandan** sobre lo actual. Derivadas, no negociables: **el historial NO gana sobre el estado
actual** · **una referencia visual no gana sobre una invariante de negocio** · **una UI nunca es por sí sola una
frontera de autorización**. En lo visual la ley es [`ops/design/DESIGN_SYSTEM.md`](ops/design/DESIGN_SYSTEM.md) y gana
siempre ahí (color §3, tokens §5, accesibilidad §13); el material de Stitch está **archivado** y no es lectura
obligatoria.

## Leyes del repo

**Autoridad de las leyes del repo**: se enuncian **acá una sola vez**, con su nombre canónico —el nombre es lo que un
agente cita— y el documento que las detalla se **enlaza**, no se copia: un documento que reescriba una ley completa es
una segunda fuente de derecho. 1. **Reuse First**
([`ops/product/MODULE_ARCHITECTURE.md`](ops/product/MODULE_ARCHITECTURE.md) §10.1): antes de crear, buscar. Se
reutiliza, se compone o se enlaza; se crea solo con una responsabilidad distinta. 2. **Reuse Audit** (§10.3): **REUSE
AUDIT es un gate obligatorio** antes de implementar, y la plantilla ([`ops/tasks/TEMPLATE.md`](ops/tasks/TEMPLATE.md))
lo pide. 3. **One Canonical Flow** (§10.2): **cada operación de negocio tiene un solo flujo canónico**; las demás
superficies enlazan. Órdenes localiza y revisa; el POS cobra. 4. **Single Owner** (§2, §5): **una entidad tiene un
solo módulo dueño de sus reglas**; que se muestre en varias pantallas no autoriza a duplicarlas. 5. **Reference
Fidelity** ([`screen-design`](.agents/skills/screen-design/SKILL.md)): **la referencia aprobada es contrato, no
inspiración**: se traduce a los componentes reales —no se copia el HTML— y no se reinterpreta. 6. **Viewport
Contract** ([`DESIGN_SYSTEM.md`](ops/design/DESIGN_SYSTEM.md) §12): toda superficie operativa se valida en viewport
completo —**1366×768, 1280×720, 768×1024 y 375×812**— y no solo por ancho; la página no scrollea, el scroll vive en el
panel que crece. 7. **Configuration has one owner; transactions snapshot it**: una configuración mutable tiene **una
sola autoridad actual**; en cambio `Payment`, `Invoice`, `Shift`, `Order` y cualquier hecho histórico **congelan los
valores que explican la operación**, en vez de **reconstruir el pasado** con la configuración actual. 8. **Design
Freeze**: aprobadas la SPEC y su `reference.html`, la composición, la información y el comportamiento principal quedan
**congelados**: una desviación **material** modifica primero la spec y la decide el owner, nunca el código.

## Mapa del sistema

| Documento | Responde |
|---|---|
| `AGENTS.md` (este archivo) | Comportamiento, reglas, límites y las leyes del repo |
| [`.agents/CONTEXT.md`](.agents/CONTEXT.md) · [`ops/product/MODULE_ARCHITECTURE.md`](ops/product/MODULE_ARCHITECTURE.md) | **Cómo está construido** (superficies, hosts, stack, DDD, persistencia, outbox, auth, CI) · **arquitectura de producto**: dónde vive cada capacidad y quién es dueño de sus reglas |
| [`.agents/MEMORY.md`](.agents/MEMORY.md) · [`.agents/skills/`](.agents/skills/) | Conocimiento estable aprendido (decisiones cerradas, restricciones, lecciones) · procedimientos repetibles, uno por tipo de trabajo |
| [`ops/CURRENT.md`](ops/CURRENT.md) | Estado operativo actual: producción, riesgos, trabajo en curso, qué sigue |
| [`ops/tasks/`](ops/tasks/) · [`ops/roadmap/`](ops/roadmap/) · [`ops/design/`](ops/design/) | Trabajo planificado: briefs, [plantilla obligatoria](ops/tasks/TEMPLATE.md), [programa de remediación](ops/tasks/AUDIT-REMEDIATION-ROADMAP.md) y **[roadmap maestro de producto y UX](ops/roadmap/PRODUCT-UX-ROADMAP.md)** con su [secuencia inmediata](ops/roadmap/NEXT.md) · **ley visual** y specs de pantalla |
| [`ops/audit-backlog.md`](ops/audit-backlog.md) · [`ops/decisions/`](ops/decisions/) | Cola de hallazgos con ID, tipo y severidad · decisiones de arquitectura (ADR) |
| [`ops/history/`](ops/history/) | Historia archivada. **No es fuente de verdad** |

**Orden de lectura de una sesión nueva** ([`ops/tasks/START-HERE.md`](ops/tasks/START-HERE.md)): `AGENTS.md` →
`.agents/CONTEXT.md` → `ops/CURRENT.md` → la TASK → la skill. `MEMORY.md` se lee cuando sus lecciones aplican y **la
historia no se carga por defecto**. **Escribir en el lugar correcto es parte del trabajo**: la lección reutilizable va
a `MEMORY.md`; el estado del día, a `CURRENT.md`; lo que pasó, a `ops/history/`; el procedimiento, a una skill; la
anomalía sin corregir, al backlog. **La misma regla no se escribe completa en varios lugares**: se enlaza. `docs/` y
`handoffs/` están en `.gitignore`: no se citan.

## El proyecto

**One Burger Commerce** — pedidos para un restaurante, **solo retiro en el local**; sin pasarela de pago (se cobra al
retirar) y propina opcional desmarcada. Superficies, hosts y detalle estable, en
[`.agents/CONTEXT.md`](.agents/CONTEXT.md). Roles: `owner` (todo) · `manager` (órdenes, menú, promociones, inventario,
caja, devoluciones) · `kitchen` (solo órdenes, **no** maneja plata) · `cashier` (cobra y cierra su turno; **no**
administra caja, **no** devuelve, **no** ve el esperado del arqueo). **Fuera del MVP** (código presente, **no**
ofrecido en UI ni en APIs públicas): reservas, mesas, delivery, inventario y reportes avanzados; sus páginas quedan
solo por URL directa y **no se reactivan** sin aprobación explícita. La clasificación de cada capacidad (`ACTIVE` ·
`FROZEN` · `LEGACY` · `FUTURE`) está en [`ops/product/MODULE_ARCHITECTURE.md`](ops/product/MODULE_ARCHITECTURE.md) §5.

## Arquitectura obligatoria (DDD)

```
src/modules/<módulo>/{domain,features,ports,adapters} src/app/** rutas + API routes ·
src/shared/{ui,lib,config,pwa,contracts} · src/infrastructure/**
```

**ROUTE**: HTTP → validación → auth/authz → caso de uso; **sin Prisma directo y sin reglas de negocio**. **FEATURE /
APPLICATION**: orquesta el caso de uso con dependencias inyectadas (`{ repository, ... }`), define la transacción
cuando corresponde y **no** instancia Prisma. **DOMAIN**: invariantes, políticas, value objects, transiciones y reglas
financieras — **sin Next, sin Prisma, sin HTTP**. **PORTS**: interfaces que necesitan aplicación y dominio.
**ADAPTERS**: Prisma, cookies, Telegram, servicios externos. El **dominio no depende de los adapters** y un módulo
nuevo nace con las cuatro capas (`module-contract.test.ts`, `route-contract.test.ts`).

## Límites de código

- **Route handlers**: máximo **50 líneas**; validan con zod, resuelven permisos, instancian el adaptador y
  llaman al caso de uso. Prohibido importar `getPrismaClient()` o `@prisma/client` desde un `route.ts`.
- **Tamaño**: máximo **400 líneas por archivo** y **80 por función**. **Antes de crear, buscar**: si la regla,
  el cálculo o el texto ya existen, se reusan.
- **Una sola fuente por cálculo**: los totales salen de `src/shared/lib/order-totals.ts`
  (`calculateOrderTotal` / `calculateOrderTotals`) y el estado del pedido de
  `src/modules/orders/domain/order-workflows.ts`. Prohibido sumar `subtotal + packaging + tip` a mano.

## Testing (no negociable)

**TDD obligatorio para TODO código nuevo**: 1. test que falla **primero** · 2. rojo confirmado **por la razón
correcta** (no por un import roto) · 3. implementación mínima · 4. refactor · 5. validación completa. **Obligatorio**:
ruta API con `route.test.ts` hermano · caso de uso con test en `src/modules/**/features/**` · commit con test del
código nuevo funcional. El gate `src/shared/contracts/tdd-contract.test.ts` congela la deuda vieja con su motivo
escrito y **no crece**. Los **dobles implementan el puerto completo**; lo de infraestructura se cubre con contratos
que leen archivos, y los flujos de usuario van en `tests/e2e/`. **Todo bug demuestra la regresión antes de
corregirse** ([`bugfix`](.agents/skills/bugfix/SKILL.md): RED → fix → GREEN → mutación).

### Integridad de tests

Está **prohibido**: `expect(true).toBe(true)` y todo test tautológico · verificar que una función devuelve lo mismo
que ella misma calculó · usar la **misma función de producción** para calcular el `expected` y el `actual` · mocks que
devuelven exactamente lo que la implementación espera sin verificar comportamiento · **bajar expectativas** para
conseguir verde · **borrar** un test que falla por la nueva implementación · cambiar un **acceptance test** sin
justificar un cambio real de contrato · usar **coverage como sustituto de calidad** · escribir el test **después** y
afirmar que hubo TDD · **ocultar** que no se observó RED. **Para bugs**: RED observable **obligatorio**, salvo
imposibilidad documentada (motivo, cómo se validó y qué flujo cubre, escritos en el commit). **Mutation check**:
después del GREEN, reintroducir la condición defectuosa o una mutación equivalente; el test **debe fallar**; después
se restaura, y **la mutación no se commitea**. **Valores monetarios**: el `expected` se deriva de una **regla
explícita del negocio**, nunca reutilizando el helper de producción bajo prueba.

**Si un test existente falla, no se cambia automáticamente**: se determina si **(A)** la implementación introdujo una
**regresión** —se arregla el código— o **(B)** el test es **obsoleto porque el contrato cambió a propósito** —el
cambio se justifica por la TASK o por una decisión del owner—. Prohibido: *test rojo → cambiar el expected → verde*
sin demostrar que cambió el contrato.

**Coverage ≠ correctness.** Se prefieren invariantes, ramas críticas, escenarios **negativos**, tests de integración,
**mutación**, **concurrencia**, **autorización** y **persistencia**. Un test con **dientes**: si volvés a introducir
el bug, falla. El gate `test-integrity-contract.test.ts` vigila lo mecánico y dice qué no puede.

## Ratcheting de calidad

**La deuda existente puede quedar temporalmente. La deuda nueva no.** Si un archivo legacy tiene 994 líneas, una TASK
no está obligada a bajarlo a 400, pero **no debe crecer** a 1.050 sin justificación excepcional. **Los techos solo se
mantienen o bajan; nunca suben en silencio.** Aplica igual a archivos y funciones grandes, route handlers, excepciones
de arquitectura (`route-contract.test.ts`, `module-contract.test.ts`, `tdd-contract.test.ts`), techos de UI
(`src/shared/config/design-tokens.allow.json`), tests faltantes, `eslint-disable` y deuda contractual. Si un techo
baja, se baja el número **en el mismo commit**; si aparece un archivo nuevo con violaciones, se arregla el archivo, no
se agrega la fila. Un documento tampoco crece: se mueve a `ops/history/`, a una skill o al backlog.

## Review adversarial

Una TASK crítica (dinero, auth, datos, migraciones) lleva una pasada que **refuta** la solución en vez de confirmarla:
¿puede el CI estar verde y el requisito seguir **roto**? ¿hay un test **tautológico** o un **mock** permisivo? ¿faltan
**escenarios negativos**, **race condition**, **partial write**, **rollback**, **idempotencia** o **autorización** que
solo viva en la UI? ¿se **tragó** un error, se duplicó una regla o se **modificó un test** para que pase? ¿dos
requests simultáneos rompen la invariante?

## UI y design system

La ley visual es [`ops/design/DESIGN_SYSTEM.md`](ops/design/DESIGN_SYSTEM.md) —con `CONTENT`, `PATTERNS`, `MOTION` y
`DATA_VISUALIZATION` al lado—; el checklist está en
[`.agents/skills/ui-change/SKILL.md`](.agents/skills/ui-change/SKILL.md) y una pantalla nueva pasa antes por
[`screen-design`](.agents/skills/screen-design/SKILL.md). Las reglas duras:

- El **panel** (KDS/POS/Admin) es **oscuro** sobre `--bg-canvas` con superficies por capas; el **público** es
  **claro**. Nada de contenedores blancos planos. Los **números** van en `font-mono` con `tabular-nums`
  (precios, cronómetros, IDs, PIN, contadores) y la marca se pide por **intención** (`--brand-primary`,
  `--brand-accent`): qué color tiene cada una es **tema**, no una asignación fija por superficie.
- **`animate-pulse` solo en SLA vencido o desincronización**; cabecera y filtros en el **20%** del alto;
  **controles ≥44 px** (`h-11`); estados del sistema (`--status-pending|prep|ready|sla`). **Datos reales**:
  `C$`/`NIO`, `+505` y las tres sucursales (**Camino de Oriente**, **Carretera Masaya**, **Casa Antigua**),
  y **nada de color fuera de token** (`#hex`, `rgb()`, `rgba()`, `hsl()`, paleta cruda, `fontFamily` inline):
  **contraste** texto/fondo **4.5:1** y borde de control **3:1** (WCAG 1.4.11). **Los tokens muertos no
  vuelven**: `--primary`, `--popover`, `--destructive`, `--ring` y `--sidebar-*` se eliminaron —borrar `--ring`
  además rompe el foco, porque Tailwind compila `outline-ring/50` a `var(--ring)`—.
- **Componente que existe, componente que se usa**; **prohibido el HTML crudo equivalente** donde hay primitivo
  y **prohibido copiar el HTML del material archivado** (se traduce). **Componente nuevo = registro previo** en
  `src/shared/ui/registry.json`, en el mismo commit, con su «cuándo SÍ» y «cuándo NO». **Ningún control ni copy
  decorativo**: cada control con su estado/API **y su test**, o se elimina con el motivo escrito. **Los techos
  de UI solo bajan**, y la UI se verifica en **navegador real** en los cuatro viewports del **Viewport
  Contract** (`1366×768`, `1280×720`, `768×1024`, `375×812`), no en HTML estático.

## Seguridad

- **La autorización se aplica en el servidor.** Ocultar algo en React **no** es autorización, y una UI nunca es
  por sí sola una frontera de autorización. Cada operación sensible tiene su **puerta de dominio** en
  `src/modules/auth/domain/admin-permissions.ts`, aplicada aunque hoy coincida con otra. Respuestas: **401** sin
  sesión · **403** sin permiso o fuera de alcance · **404** solo si además no debe poder deducirse que el recurso existe.
- **Endpoints internos y de staging**: fail-closed por entorno (`APP_ENV`) + token comparado con
  `timingSafeEqual`. **Secretos solo por entorno**: nunca en el repo, un commit, un documento, un log ni un
  chat; `npm run security:secrets` lo verifica. Pruebas negativas obligatorias:
  [`.agents/skills/security-change/SKILL.md`](.agents/skills/security-change/SKILL.md).

## Datos, migraciones y dinero

- Migraciones Prisma **versionadas**, **aditivas primero** y **sin BOM** —un BOM rompe `prisma migrate deploy`
  en una base nueva, y hay un test que lo verifica—. `prisma/seed.ts` es **solo para local/demo**, nunca en
  producción.
- Los datos del negocio (nombre, colores, contacto, horarios, precios, propina, zona horaria) **no se
  hardcodean**: salen de la configuración editable en el admin. Procedimiento en
  [`.agents/skills/database-migration/SKILL.md`](.agents/skills/database-migration/SKILL.md).
- **Ley 7** aplica acá: la configuración mutable se edita hacia adelante y **el hecho histórico congela los
  valores que lo explican** (medios de cobro, desglose del turno, factura emitida). Reconstruir el pasado con
  la configuración de hoy es un bug de dinero. **Todo cambio que toque dinero** —directa o indirectamente—
  activa [`.agents/skills/money-change/SKILL.md`](.agents/skills/money-change/SKILL.md): invariantes,
  transacción, concurrencia, idempotencia, autorización, auditoría, rollback y persistencia. **Una operación
  lógica de dinero debe tener un límite atómico explícito**, y una propiedad que dependa de PostgreSQL se
  prueba contra PostgreSQL real, no contra un doble en memoria.

## Git, ramas, commits y PR

Repo: `github.com/danielmaki123/one-burger-commerce`. La rama de deploy es **`main`**: **por política no recibe push
directo** (se trabaja en rama y se mergea por PR). Política ≠ enforcement: ver *CI y protección de `main`*. **Flujo**:
1. rama desde `main` actualizado (`git pull --ff-only origin main && git checkout -b <tipo>/<nombre>`) · 2. trabajar y
commitear en la rama · 3. `git push -u origin <tipo>/<nombre>` · 4. **abrir PR hacia `main`** con problema, qué
cambió, qué **no** cambió, cómo se verificó y qué quedó fuera · 5. **esperar el CI verde** (la aprobación de otro dev
**no** se exige: approvals 0) · 6. **merge con `--squash`**, solo después del paso 5. Nomenclatura: `feature/` ·
`fix/` · `refactor/` · `docs/` · `chore/`. **Prohibiciones**: push directo a `main` · `git push --force` a `main`,
siempre · ramas ajenas sin avisar. **Commits**: uno por tema, en español, prefijo + área + resumen, con **problema,
evidencia de verificación y excepciones** en el cuerpo. **Nunca commitear** secretos, `.env` o tokens · caches y
artefactos · metadata de agentes de terceros (`.claude/`, los volcados de skills ajenas bajo `.agents/skills/`).

## CI y protección de `main`

**CI** (`.github/workflows/publish-ghcr.yml`) corre en cada push a `main`, en cada PR hacia `main` y a mano:
**verify** (secrets, lint, typecheck, tests, build) · **contracts** (los guardrails de `src/shared/contracts/`) ·
**migrations** (Postgres 17 limpio + drift contra `schema.prisma`) · **container** (imagen real: readiness y bootstrap
del admin) · **publish** (imagen a GHCR, **solo** en push a `main`).

**Protección de `main`**: **ruleset** `Protect main` (enforcement `active`, sobre `refs/heads/main`), no branch
protection clásica; se verifica con `gh api repos/danielmaki123/one-burger-commerce/rulesets`, **no** con
`/branches/main/protection` (devuelve **404** con ruleset, y 404 **no** es «sin protección»). Verificado contra la API
real: **`deletion`** · **`non_fast_forward`** · **`required_status_checks`** con `strict` y los checks **`verify`,
`contracts`, `migrations`, `container`**, y **Pull Request obligatorio** (`required_approving_review_count: 0`). ⚠️
**Nunca marcar `publish` como *required check***: no corre en PRs y el PR quedaría en «Expected». La rama se toca
**solo con pedido explícito del owner**.

## Deploy y producción

- **Solo se despliega desde `main` y después del CI verde.** La aprobación de una TASK `runtime-e2e` —o el
  pedido explícito del owner— **autoriza** su merge y su release: **no se pide una segunda autorización** salvo
  una **Stop Condition**. Nunca desde una rama de trabajo.
- Una sola llamada a `deployService` (`forceRebuild: true`) por API, con `EASYPANEL_TOKEN` **por entorno**.
  ⚠️ **No** usar `npm run deploy:easypanel`: fusiona variables y puede crear servicios.
- Después: **health** y **readiness** (`/api/health`, `/api/readiness`) y los dos smokes de solo lectura
  (`test:e2e:prod`, `test:e2e:prod:hosts`). **Nunca** `db:seed` ni `migrate reset` contra producción, y
  **nunca** tocar otros servicios del servidor (`cacommerce`, `capostgres`, `imagehost`, `postimage`, `n8n`).
  Procedimiento y rollback en
  [`.agents/skills/production-release/SKILL.md`](.agents/skills/production-release/SKILL.md) y
  [`ops/production-readiness.md`](ops/production-readiness.md): el runbook manda en la secuencia exacta.

## Validación mínima antes de cerrar

`npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run
build`. Además: **`npm run build:webpack`** si tocaste una página (`src/app/**/page.tsx`) —Turbopack no valida los
exports de una página y el problema queda escondido— · `npx prisma generate` si tocaste `prisma/schema.prisma` · los
E2E locales con Postgres arriba (`BASE_URL=http://127.0.0.1:3210 npm run test:e2e:prod:full`) si tocaste flujos, con
límites de tasa altos y **una sola suite a la vez**.

## Definition of Done

- [ ] Tests verdes (unitarios + contratos + E2E si toca flujos), con el **rojo observado** o su excepción documentada.
- [ ] `security:secrets`, `lint`, `typecheck`, `build` verdes; `build:webpack` si tocó una página.
- [ ] Verificación en **navegador real (375 px y 1280 px)** y **captura antes/después** si toca UI.
- [ ] Ningún techo de deuda **subió**. `ops/CURRENT.md` actualizado (y `ops/audit-backlog.md` si cierra un
      hallazgo); `MEMORY.md` **solo** si la lección es reutilizable.
- [ ] Commit + push a la rama, **PR abierto**, **CI verde** (los cuatro checks).
- [ ] Si el **Delivery Mode** incluye deploy: health/readiness, los dos smokes y QA de producción **después**
      del merge, sin una segunda autorización; excepciones documentadas en el commit.

## Cierre de sesión

En este orden: 1. mergear el PR (`--squash --delete-branch`) **después** del CI verde y volver a `main` con `git pull
--ff-only` · 2. actualizar **`ops/CURRENT.md`** (qué quedó desplegado, qué se cerró y **qué falta**),
`ops/tasks/START-HERE.md` y `ops/audit-backlog.md` si hay hallazgos · 3. **ese cierre también va por PR** · 4.
reportar la rama actual, el **último commit de `main`**, `git status` limpio y qué queda pendiente; si algo no
coincide con GitHub, **se reporta la diferencia**.

## Idioma y estilo

**Español** en UI, admin, documentación, commits y respuestas; **inglés** en nombres de archivos, funciones, tipos y
variables de código. UI mobile-first (se verifica a 375 px), `min-h-11` en controles táctiles, labels asociados a sus
inputs y textos de error claros en español. Estilos con los **tokens semánticos** de `src/app/globals.css`; no colores
sueltos ni clases ad hoc.

## Prohibiciones

Además de las repartidas arriba (push a `main` y force push, `db:seed` y `migrate reset` en producción, tocar
servicios ajenos, deployar sin CI verde, cambiar el ruleset): no reactivar módulos fuera del MVP en navegación ni en
APIs públicas sin pedido explícito · no dejar `BOOTSTRAP_ADMIN_*` ni secretos temporales en el entorno · no corregir
un bug encontrado durante una auditoría o una reorganización (**documentarlo**) · no escribir la misma regla completa
en varios documentos: se escribe una vez y se enlaza.

