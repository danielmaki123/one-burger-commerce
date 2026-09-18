# AGENTS.md

Instrucciones de trabajo para este repositorio. Si algo acá contradice un pedido
explícito del humano, gana el humano; después de resolverlo, actualizá este archivo.

## Cómo trabajamos (acuerdo con el owner)

- **De a una tarea por vez**: cada tarea se cierra entera (implementación, tests, validación, commit,
  push, CI verde y estado actualizado) antes de empezar la siguiente.
- Ante una duda de alcance, se pregunta **antes** de codear; no se inventa producto.
- **Plan escrito = alcance ya resuelto** (2026-09-14): lo que un plan o un brief (`ops/tasks/*.md` o
  el que pase por el chat) ya define se ejecuta **de corrido**, cerrando una tarea por vez. Se sigue
  preguntando por lo que el plan **no** decide (alcance nuevo, producto, dependencias, deploy) y, si
  choca con este archivo, gana el plan y la excepción se anota acá en el mismo commit.

## Qué es el proyecto

**One Burger Commerce** — plataforma de pedidos para un restaurante, **solo retiro en el local**.

- Público: home, menú, detalle de producto, carrito, checkout para retirar, confirmación y seguimiento.
- Admin: órdenes, menú, usuarios (roles) y **personalización del negocio** (`/admin/settings`).
- Roles: `owner` (todo), `manager` (órdenes y menú), `kitchen` (solo órdenes).
- Pago: **en el local al retirar**. No hay pasarela de pago.
- Propina: opcional, desmarcada por defecto.

Fuera del MVP (código presente, **no** ofrecido en UI ni APIs públicas): reservas, mesas, delivery, inventario y
reportes avanzados; sus páginas quedan solo por URL directa y no se reactivan en la navegación ni en las APIs públicas sin aprobación explícita.

## Dónde está el estado (leer antes de trabajar)

| Documento | Para qué |
|---|---|
| `ops/tasks/START-HERE.md` | **Cómo arrancar en un chat nuevo**: prompt listo, orden de lectura y reglas mínimas. |
| `ops/project-state.md` | Estado real: qué está desplegado, qué se cerró, qué falta, cómo continuar. **Leer primero.** |
| `ops/production-readiness.md` | Runbook: entorno, deploy, backups, rollback, notificaciones, primer arranque, límites conocidos. |
| `ops/tasks/*.md` | Briefs de tareas acordadas con el owner (decisiones ya resueltas). |
| `ops/references/stitch/design-system.md` | **UI — sistema de diseño oficial**: tokens, tipografía, espaciado, radios, elevaciones, componentes con variantes, estados y reglas de uso. Se lee antes de escribir UI y **gana siempre** en lo visual. |
| `README.md` | Alcance y comandos de validación. |

`docs/` y `handoffs/` están en `.gitignore`: son material histórico heredado. La única fuente de verdad
es este archivo + `ops/`.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript estricto · Prisma 6 + PostgreSQL 17
- Tailwind CSS 4 con tokens CSS propios (`src/app/globals.css`) · Vitest (unitarios) · Playwright (E2E) · ESLint
- Docker multi-stage → **Easypanel** (build desde GitHub `main`)

## Arquitectura (DDD)

```
src/modules/<módulo>/{domain,features,ports,adapters}
src/app/**            rutas (App Router) + API routes
src/shared/{ui,lib,config,pwa}
src/infrastructure/** prisma, event bus
```

- `domain`: tipos, reglas y errores del módulo, sin I/O · `ports`: interfaces de repositorio o servicio
  externo · `adapters`: implementaciones (Prisma; `in-memory-*` para tests).
- `features/<caso-de-uso>`: un caso de uso por carpeta, con dependencias inyectadas
  (`{ repository, ... }`); **no** instancia Prisma.

## Jerarquía de fuentes (qué gana cuando hay conflicto)

1. **`ops/references/stitch/design-system.md`** — el **sistema de diseño oficial**: se lee antes de escribir UI y **siempre gana** en lo visual.
2. **`ops/references/stitch/stitch_redise_o_de_secci_n_existente/<pantalla>/code.html`** (+ `screen.png`)
   — la **referencia visual** de las 7 pantallas. Es referencia: se **traduce** a componentes, no se copia.
3. **`AGENTS.md`** (este archivo) — **sigue mandando sobre el sistema** cuando el conflicto no es visual: en ese caso
   gana este archivo y el documento de diseño se corrige en el mismo commit.
4. **Skills de diseño** — **referencia secundaria, no fuente de verdad**: si contradicen al sistema,
   **gana el repo** (se reporta y no se cambia).
5. **Humano** — si sigue sin estar claro, **PARAR** y preguntar.

## UI y design system

Dos modos a propósito (owner, 2026-09-16): el **panel** (KDS/POS/Admin) es **oscuro** —su shell lleva
`class="dark"`— y el **público** sigue **claro** con la paleta del negocio. Las reglas del sistema son
**vinculantes** (`design-system.md` §2, §6, §7 y §8), más estas:

- **Los números van en `font-mono` con `tabular-nums`**: precios (`C$ 305.00`), cronómetros, IDs de
  ticket, PIN y contadores. Es lo que evita que la interfaz "tiemble" cuando cambian solos.
- **Ámbar (`--brand-amber`) vs azul cielo (`--brand-primary`)**: ámbar para la identidad, la cocina y la
  acción de comanda; cielo para administración, navegación y confirmación del POS.
- **`animate-pulse` solo en SLA vencido o pérdida de sincronización**: prohibido animar tickets normales.
- **La cabecera no pasa el 20% del alto**: el 80% de la pantalla es para las tarjetas o el catálogo.
- **Controles de 44 px mínimo** (`h-11`): es una interfaz táctil de cocina y mostrador.
- **Los estados operativos son los del sistema** (`--status-pending|prep|ready|sla`), cada uno con
  fondo, borde, texto y punto: por aceptar, en preparación, listas y atrasado.
- **Nada de contenedores blancos planos**: el lienzo del panel es `--bg-canvas` con superficies por capas.
- **Los datos del negocio son los reales**: `C$`/`NIO`, `+505` y las sucursales `Camino de Oriente`,
  `Carretera Masaya` y `Casa Antigua`. Prohibido inventar nombres, ciudades o monedas.
- **Componente que existe, componente que se usa**: primero `src/shared/ui/`, después
  `(admin)/admin/_components/` y `(public)/_components/`. El registro legible por máquina es
  `src/shared/ui/registry.json`, con `file`, `variants`, `sizes`, `use_when` y `dont_use_when`.
- **Prohibido el HTML crudo equivalente** (`<button>`, `<input>`, `<select>`, `<textarea>`) cuando el
  primitivo existe, y prohibido **copiar el HTML de Stitch**: se traduce a componentes del repo. Si falta
  un primitivo, se documenta en `src/shared/ui/registry.json` antes de inventar el sexto `className`.
- **Prohibido el color fuera de token**: nada de `#hex`, `rgba()`, paleta cruda de Tailwind (`slate-*`, `sky-*`, `amber-*`…) donde hay token, ni `fontFamily` inline.
- **Los 16 tokens muertos están prohibidos y ya no existen** (C1-3): `--primary`, `--popover`,
  `--destructive`, `--ring` y la familia `--sidebar-*` se eliminaron porque nadie los consumía.
- **Contraste**: texto/fondo **4.5:1** y borde de control **3:1** (WCAG 1.4.11); lo mide
  `dark-mode-contract.test.ts` y la deuda del modo claro está declarada en `globals.css`.
- **Componente nuevo = registro previo**: un archivo nuevo en `_components/` se registra en
  `src/shared/ui/registry.json` **en el mismo commit**, con su "cuándo SÍ" y su "cuándo NO".
- **Los techos de UI solo bajan**: `src/shared/config/design-tokens.allow.json` congela por archivo las
  violaciones que quedan. **Un techo nunca sube**: si baja, se baja el número en el mismo commit.
- **Ningún control decorativo**: cada control se implementa con su estado/API **y su test**, o se
  elimina con el motivo escrito. **Nada de copy decorativo**: lo que no cambia una decisión no va.
- La UI se verifica en **navegador real a 375 px y 1280 px** (Playwright), no en HTML estático.

## Reglas de código

- **Una sola fuente por cálculo**: los totales salen de `src/shared/lib/order-totals.ts`
  (`calculateOrderTotal` / `calculateOrderTotals`) y el estado del pedido de
  `src/modules/orders/domain/order-workflows.ts`. Prohibido sumar `subtotal + packaging + tip` a
  mano: hay un test de contrato que lo impide.
- **Los route handlers no tienen lógica**: máximo **50 líneas**, validan con zod, resuelven permisos,
  instancian el adaptador y llaman al caso de uso. Prohibido importar `getPrismaClient()` o
  `@prisma/client` desde un `route.ts`.
- **Módulo nuevo = `domain/features/ports/adapters`**, y `domain/` **no** importa de `app/`,
  `adapters/` ni `infrastructure/`.
- **Tamaño**: máximo **400 líneas por archivo** y **80 por función**. Los archivos que hoy los pasan
  son deuda inventariada: no se agrandan y se parten cuando se los toque por otra razón.
- **Antes de crear, buscar**: si la regla, el cálculo o el texto ya existen, se reusan. Duplicar para
  "no tocar lo otro" no es una opción.

## Testing (no negociable)

**TDD obligatorio para TODO código nuevo**: 1. test que falla **primero** (caso de uso, regla o
componente) · 2. confirmá el **rojo por la razón correcta** (no por un import roto) · 3. implementá lo
mínimo · 4. refactorizá · 5. cerrá con la validación completa.

**Prohibido**: test después de la implementación (si pasa, se dice en el commit) · ruta API sin
`route.test.ts` hermano · caso de uso sin test en `src/modules/**/features/**` · componente sin test
propio (`src/shared/ui/` y `_components/`) · commit sin test de código nuevo funcional · «después lo
testeo».

**TDD — observación del rojo** (2026-09-18): si no se pudo observar el rojo (test y código en el mismo
paso, contexto agotado, caracterización), se documenta en el commit el **motivo**, **cómo se validó el
test** (mutación) y **qué flujo cubre**; escribirlo después sin documentarlo está **prohibido**, y si se
validó invirtiendo el código (verde → rojo → verde) cuenta como TDD efectivo y se documenta igual.

El gate `src/shared/contracts/tdd-contract.test.ts` congela la deuda vieja con su motivo escrito y **no
crece**: una ruta, feature o primitivo nuevo sin test lo pone en rojo. Corre en `npm run test:contracts`
y como paso propio del job `contracts` del CI. Los dobles implementan el **puerto completo**; lo de
infra se cubre con tests de contrato que leen los archivos o con el job que construye la imagen, y los
flujos de usuario van en `tests/e2e/`. Un test con **dientes**: si volvés a introducir el bug, falla (si
se escribió después, se verifica por mutación y se deja dicho en el commit).

## Checklist de UI antes de cerrar una tarea con pantalla

**Sistema Stitch (el panel es oscuro):**

- [ ] ¿Los **números** van en `font-mono` con `tabular-nums` y los **estados del sistema** (`--status-pending|prep|ready|sla`) en vez de colores sueltos?
- [ ] ¿Ámbar solo para identidad/cocina/acción y **azul cielo** para administración y POS?
- [ ] ¿La cabecera y los filtros entran en el **20%** del alto y el resto es operación?
- [ ] ¿Los controles táctiles tienen **≥44 px** y foco visible propio (≥3:1)?
- [ ] ¿`animate-pulse` aparece **solo** en SLA vencido o desincronización?
- [ ] ¿La pantalla es **oscura** y los datos son los reales (`C$` / `+505` / las tres sucursales)?

**Código y componentes:**

- [ ] ¿Usé los primitivos de `src/shared/ui/` y **traduje** el HTML de Stitch en vez de copiarlo?
- [ ] ¿Hay **una sola** acción primaria y ningún texto decorativo?
- [ ] ¿Están los **5 estados**: con datos, cargando, vacío, error y **"nada pendiente"**?
- [ ] ¿Contraste ≥4.5:1 en texto, ≥3:1 en el borde de control, sin scroll horizontal entre 320 y 1280 px?

## Validación mínima antes de cerrar

```bash
npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
```

Si tocaste flujos públicos o de admin, además los E2E locales
(`BASE_URL=http://127.0.0.1:3210 npm run test:e2e:prod:full`); si tocás una **página**
(`src/app/**/page.tsx`), `npm run build:webpack`, porque el build de Turbopack no valida los exports
de una página y el problema queda escondido. Componentes y helpers van en su propio archivo.

## Definition of Done

Una tarea está terminada cuando:

- Tests verdes (unitarios + contratos + E2E si toca flujos)
- lint, typecheck, build, security:secrets verdes
- CI verde
- Verificación en navegador real (375 px + 1280 px) si toca UI
- Captura antes/después si toca UI
- ops/project-state.md actualizado
- Commit + push a la rama de trabajo
- PR abierto, CI verde (los 4 checks)
- Merge con `--squash` a main
- Sesión cerrada con el procedimiento de abajo
- Si toca deploy: aprobación del owner + los 2 smokes después
- Excepciones documentadas en el commit (ej: TDD sin rojo observable)

## Git y CI

Repo: `github.com/danielmaki123/one-burger-commerce`. Rama de deploy: **`main`**, que **no recibe push
directo**: un ruleset lo bloquea (ver *Protección de `main`*, abajo).

### Flujo obligatorio para cada tarea

1. **Rama desde main actualizado**:
   `git checkout main && git pull origin main && git checkout -b <tipo>/<nombre-descriptivo>`.
2. **Trabajar y commitear en la rama** (commits con el formato de *Commits*, abajo).
3. **Push de la rama**: `git push -u origin <tipo>/<nombre-descriptivo>`.
4. **Abrir Pull Request hacia `main`** con: qué cambió, por qué, cómo se verificó, qué quedó fuera.
5. **Esperar el CI verde.** No hay merge con un check rojo o con conflictos sin resolver; la aprobación
   de otro dev **no** se exige (approvals 0), así que el PR lo mergea quien lo abrió.
6. **Merge con `--squash`** (`gh pr merge <n> --squash --delete-branch`), solo después del paso 5.

**Nomenclatura de ramas**: `feature/` funcionalidad nueva · `fix/` corrección de bug · `refactor/` sin
cambio de comportamiento · `docs/` solo documentación · `chore/` mantenimiento (deps, config, CI).
**Prohibiciones de Git**: push directo a `main` · `git push --force` a `main`, siempre · trabajar en
ramas ajenas sin avisar.

### Commits

- **Un commit por tema** (no mezclar). Mensaje en español, prefijo + área + resumen; cuerpo con
  **problema, evidencia de verificación y excepciones documentadas**.
- **Nunca commitear**: secretos, `.env` o tokens · caches y artefactos de build · metadata de agentes
  (`.claude/`, `.cursor/`, …). `npm run security:secrets` lo verifica en CI.

### CI y protección de `main`

**CI** (`.github/workflows/publish-ghcr.yml`): corre en **cada push a `main`, en cada PR hacia `main`**
y a mano con `workflow_dispatch`. Los jobs de validación son **verify** (secrets, lint, typecheck,
tests, build), **contracts** (los guardrails de este archivo), **migrations** (Postgres limpio + drift)
y **container** (imagen real, readiness y bootstrap del admin); **publish** (imagen a GHCR) solo corre
en push a `main`. Si un check está rojo, el PR no se mergea. ⚠️ **Nunca marcar `publish` como
*required check***: no corre en PRs y el PR quedaría trabado en «Expected» para siempre.

**Protección de `main`**: está **activa** como **ruleset** (`Protect main`, enforcement `active`, sobre
`refs/heads/main`), no como branch protection clásica: se verifica con
`gh api repos/danielmaki123/one-burger-commerce/rulesets`, **no** con `/branches/main/protection`, que
devuelve **404** cuando la regla es un ruleset (ese 404 **no** significa «sin protección»). Reglas:
**`deletion`** · **`non_fast_forward`** (force push bloqueado) · **`required_status_checks`** con
`strict_required_status_checks_policy: true`.

⚠️ **Dos huecos medidos el 2026-09-18**: (1) la lista de checks requeridos está **vacía**, así que el CI
**no bloquea** el merge —hay que marcar `verify`, `contracts`, `migrations` y `container`, **nunca**
`publish` (no corre en PRs)—; (2) **no hay regla de PR obligatorio**: el push directo lo bloquea el
ruleset, pero mergear sin PR sigue siendo posible y lo sostiene el equipo.

El agente **no puede modificar la configuración de rama**: si algo falla por protección, se reporta al
humano, no se intenta saltar.

### Cierre de sesión

Antes de dar una sesión por terminada, **en este orden**:

1. Mergear el PR de la tarea (`--squash --delete-branch`) y volver a `main` con `git pull`.
2. Actualizar `ops/project-state.md` (qué se cerró, qué quedó desplegado y **qué falta**),
   `ops/tasks/START-HERE.md` (el arranque del próximo chat) y `ops/audit-backlog.md` si hay hallazgos.
3. **Ese cierre también va por PR**: no se pushea a `main` para documentar.
4. Reportar al humano: rama actual, **último commit de `main`**, `git status` limpio y qué queda
   pendiente. Si algo del pedido no coincide con lo que dice GitHub, **se reporta la diferencia** en vez
   de documentar el estado esperado.

## Deploy (Easypanel)

- Panel: `http://76.13.250.83:3000` · proyecto `brunobot` · servicio `oneburguerweb` ·
  Postgres `oneburguer-postgres` (sin puerto expuesto).
- Dominios: **https://oneburgernic.com** (apex) y `https://www.oneburgernic.com` sirven el
  landing y redirigen la app (307); **https://menu.oneburgernic.com** sirve la app de pedidos
  y **https://admin.oneburgernic.com** el panel. Los cuatro con certificado.
- Deploy: **una sola llamada** a `deployService` por API (proyecto `brunobot`, servicio
  `oneburguerweb`, `forceRebuild: true`) con `EASYPANEL_TOKEN` en el entorno; la secuencia
  exacta está en `ops/production-readiness.md` §2. ⚠️ **No** usar `npm run deploy:easypanel`:
  fusiona variables y puede crear servicios.
- **Solo se deploya desde `main` después del merge. Nunca desde una rama de trabajo.**
- Después del deploy, los dos smokes de solo lectura (`test:e2e:prod` y `test:e2e:prod:hosts`).
- El contenedor, al arrancar: valida entorno → aplica migraciones → (opcional) crea el primer admin →
  `next start`. Si el arranque falla, Easypanel **no** promueve la versión y sigue sirviendo la
  anterior. El token del panel da acceso total al servidor: solo por entorno, nunca en el repo.

## Idioma y estilo

- **Español** en UI, textos del admin, documentación, commits y respuestas al humano; **inglés** en
  nombres de archivos, funciones, tipos y variables de código.
- UI mobile-first (se verifica a 375 px), `min-h-11` en controles táctiles, labels asociados a sus
  inputs, textos de error claros en español.
- Estilos con los **tokens semánticos** de `globals.css` (`bg-card`, `text-foreground`, `bg-brand`,
  `border-border`); no colores sueltos ni clases ad hoc.

## Datos

- Migraciones Prisma versionadas y **sin BOM** (un BOM rompe `prisma migrate deploy` en cualquier base nueva): hay un
  test que lo verifica. `prisma/seed.ts` es **solo para local/demo**, nunca en producción.
- Los datos del negocio (nombre, colores, contacto, horarios, precios, propina) **no se hardcodean**:
  se leen de la configuración editable en el admin (`ops/tasks/TASK-whitelabel-branding.md`).

## Prohibiciones

- No reactivar módulos fuera del MVP en navegación ni APIs públicas sin pedido explícito.
- No tocar servicios ajenos del panel compartido (`cacommerce`, `capostgres`, `imagehost`,
  `postimage`, proyecto `n8n`).
- No hacer `db:seed` ni `migrate reset` contra producción.
- No dejar `BOOTSTRAP_ADMIN_*` ni secretos temporales en el entorno del servicio.
