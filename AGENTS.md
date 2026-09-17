# AGENTS.md

Instrucciones de trabajo para este repositorio. Si algo acá contradice un pedido
explícito del humano, gana el humano; después de resolverlo, actualizá este archivo.

## Cómo trabajamos (acuerdo con el owner)

- **De a una tarea por vez**: cada tarea se cierra entera (implementación, tests, validación, commit,
  push, CI verde y estado actualizado) antes de empezar la siguiente.
- Si una tarea mezcla temas distintos, se parte en **un commit por tema**.
- Ante una duda de alcance, se pregunta **antes** de codear; no se inventa producto.
- **Plan escrito = alcance ya resuelto** (2026-09-14): lo que un plan o un brief (`ops/tasks/*.md` o
  el que pase por el chat) ya define se ejecuta **de corrido**, cerrando una tarea por vez. Se sigue
  preguntando por lo que el plan **no** decide (alcance nuevo, producto, dependencias, deploy) y, si
  choca con este archivo, gana el plan y la excepción se anota acá en el mismo commit.
- **Sistema de diseño (2026-09-16, reemplaza a todo lo anterior):** la fuente de verdad visual es
  [`ops/references/stitch/design-system.md`](ops/references/stitch/design-system.md), con las **7
  pantallas de referencia** (KDS, POS, Resumen, Menú, Locales, Usuarios, Personalización) al lado en
  `ops/references/stitch/`. **Gana siempre** en lo visual. Los documentos viejos
  (`DESIGN_REFERENCES.md`, `DESIGN_SYSTEM.md`, `design/*.md`, `docs/ui/admin-design-system.md`) y el
  mockup HTML anterior se **borraron**: no se recrean ni se citan.
- El punto de entrada para un chat nuevo es
  [`ops/tasks/START-HERE.md`](ops/tasks/START-HERE.md): tiene el prompt listo para pegar, el
  mapa de documentos y la cola de pendientes en orden.

## Qué es el proyecto

**One Burger Commerce** — plataforma de pedidos para un restaurante, **solo retiro en el local**.

Alcance MVP:

- Público: home, menú, detalle de producto, carrito, checkout para retirar, confirmación y seguimiento.
- Admin: órdenes, menú, usuarios (roles) y **personalización del negocio** (`/admin/settings`).
- Roles: `owner` (todo), `manager` (órdenes y menú), `kitchen` (solo órdenes).
- Pago: **en el local al retirar**. No hay pasarela de pago.
- Propina: opcional, desmarcada por defecto.

Fuera del MVP (código presente, **no** ofrecido en UI ni APIs públicas): reservas, mesas, delivery,
inventario y reportes avanzados. Sus páginas quedan accesibles solo por URL directa: no reactivarlos en
la navegación ni en las APIs públicas sin aprobación explícita.

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
- Tailwind CSS 4 con tokens CSS propios (`src/app/globals.css`) · Vitest (unitarios) · Playwright
  (E2E) · ESLint
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
- Los API routes y las páginas son la capa de composición: validan con zod, resuelven sesión y
  permisos, instancian adaptadores y llaman casos de uso. Los errores de dominio van tipados por módulo
  (`OrderError`, `AuthError`, …) y se mapean en `src/shared/lib/http/error-response.ts`.

## Jerarquía de fuentes (qué gana cuando hay conflicto)

1. **`ops/references/stitch/design-system.md`** — el **sistema de diseño oficial** (2026-09-16): tokens,
   tipografía, espaciado, radios, elevaciones, componentes con variantes, estados y reglas de uso. Se
   lee antes de escribir UI y **siempre gana** en lo visual.
2. **`ops/references/stitch/stitch_redise_o_de_secci_n_existente/<pantalla>/code.html`** (+ `screen.png`)
   — la **referencia visual** de las 7 pantallas. Es referencia: se **traduce** a componentes, no se copia.
3. **`AGENTS.md`** (este archivo) — alcance, arquitectura, testing, validación, git/CI, deploy, idioma
   y prohibiciones. **Sigue mandando sobre el sistema** cuando el conflicto no es visual: en ese caso
   gana este archivo y el documento de diseño se corrige en el mismo commit.
4. **Skills de diseño** — **referencia secundaria, no fuente de verdad**: si contradicen al sistema,
   **gana el repo** (se reporta y no se cambia).
5. **Humano** — si sigue sin estar claro, **PARAR** y preguntar.

## UI y design system

El **sistema oficial** es [`ops/references/stitch/design-system.md`](ops/references/stitch/design-system.md)
y **gana siempre** en lo visual. Dos modos a propósito (owner, 2026-09-16): el **panel** (KDS/POS/Admin)
es **oscuro** —su shell lleva `class="dark"`— y el **público** sigue **claro** con la paleta del negocio.

**Reglas del sistema, vinculantes** (`design-system.md` §2, §6, §7 y §8):

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

Y las reglas de siempre, que el sistema no reemplaza:

- **Componente que existe, componente que se usa**: primero `src/shared/ui/`, después
  `(admin)/admin/_components/` y `(public)/_components/`. El registro legible por máquina es
  `src/shared/ui/registry.json`, con `file`, `variants`, `sizes`, `use_when` y `dont_use_when`.
- **Prohibido el HTML crudo equivalente** (`<button>`, `<input>`, `<select>`, `<textarea>`) cuando el
  primitivo existe, y prohibido **copiar el HTML de Stitch**: se traduce a componentes del repo. Si falta
  un primitivo, se documenta en `src/shared/ui/registry.json` antes de inventar el sexto `className`.
- **Prohibido el color fuera de token**: nada de `#hex`, `rgba()`, paleta cruda de Tailwind
  (`slate-*`, `sky-*`, `amber-*`, `emerald-*`, `rose-*`) donde hay token, ni `fontFamily` inline.
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
- **Docs**: prohibido crear archivos `.md` nuevos sin aprobación humana; si el cambio deja un doc
  desactualizado, se actualiza en el mismo commit.

## Testing (no negociable)

**TDD obligatorio para TODO código nuevo**: 1. test que falla **primero** (caso de uso, regla o
componente) · 2. confirmá el **rojo por la razón correcta** (no por un import roto) · 3. implementá lo
mínimo · 4. refactorizá · 5. cerrá con la validación completa.

**Prohibido**: test después de la implementación (si pasa, se dice en el commit) · ruta API sin
`route.test.ts` hermano · caso de uso sin test en `src/modules/**/features/**` · componente sin test
propio (`src/shared/ui/` y `_components/`) · commit sin test de código nuevo funcional · «después lo
testeo».

**Excepciones** (se documentan en el commit y en el gate): refactor puro sin cambio de comportamiento ·
hotfix urgente con test en el commit siguiente · configuración o datos sin lógica (JSON, tokens, seeds,
migraciones aditivas).

El gate `src/shared/contracts/tdd-contract.test.ts` congela la deuda vieja con su motivo escrito y **no
crece**: una ruta, feature o primitivo nuevo sin test lo pone en rojo. Corre en `npm run test:contracts`
y como paso propio del job `contracts` del CI. Los dobles implementan el **puerto completo**; lo de
infra se cubre con tests de contrato que leen los archivos o con el job que construye la imagen, y los
flujos de usuario van en `tests/e2e/`. Un test con **dientes**: si volvés a introducir el bug, falla (si
se escribió después, se verifica por mutación y se deja dicho en el commit).

## Checklist de UI antes de cerrar una tarea con pantalla

Ninguna tarea que toque UI se cierra con un "no" acá. El sistema está en
`ops/references/stitch/design-system.md` y el registro de componentes en `src/shared/ui/registry.json`.

**Sistema Stitch (el panel es oscuro):**

- [ ] ¿Los **números** (plata, cronómetros, IDs, PIN, contadores) van en `font-mono` con `tabular-nums`?
- [ ] ¿Usé los **estados del sistema** (`--status-pending|prep|ready|sla`) y no colores sueltos?
- [ ] ¿Ámbar solo para identidad/cocina/acción y **azul cielo** para administración y POS?
- [ ] ¿La cabecera y los filtros entran en el **20%** del alto y el resto es operación?
- [ ] ¿Los controles táctiles tienen **≥44 px** y foco visible propio (≥3:1)?
- [ ] ¿`animate-pulse` aparece **solo** en SLA vencido o desincronización?
- [ ] ¿La pantalla es **oscura** y no quedó ningún contenedor blanco plano?
- [ ] ¿Los datos son los reales (`C$` / `+505` / las tres sucursales), sin inventar?

**Código y componentes:**

- [ ] ¿Usé los primitivos de `src/shared/ui/` y **traduje** el HTML de Stitch en vez de copiarlo?
- [ ] ¿Cero `text-[Npx]`, cero paleta cruda, cero `rounded-[Npx]` y cero `shadow-[...]`?
- [ ] ¿Hay **una sola** acción primaria y ningún texto decorativo?
- [ ] ¿Están los **5 estados**: con datos, cargando, vacío, error y **"nada pendiente"**?
- [ ] ¿Contraste ≥4.5:1 en texto, ≥3:1 en el borde de control, y sin scroll horizontal entre 320 y
      1280 px?
- [ ] ¿La verifiqué en **navegador real a 375 px y 1280 px** (Playwright), no en HTML estático?
- [ ] ¿Corrí los gates (`npm run test:contracts`, `npm run test`) y el E2E si toqué flujos?

## Validación mínima antes de cerrar

```bash
npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
```

Si tocaste flujos públicos o de admin, además:

```bash
# local (levanta Postgres + seed + server) o contra producción, solo lectura
BASE_URL=http://127.0.0.1:3210 npm run test:e2e:prod:full
BASE_URL=https://oneburgernic.com npm run test:e2e:prod
```

Ningún cambio se considera cerrado sin: tests verdes, CI verde y verificación del
camino real (contenedor o producción).

Si tocás una **página** (`src/app/**/page.tsx`), además:

```bash
npm run build:webpack   # el build de Turbopack no valida esto
```

Una página de Next solo puede exportar lo que Next conoce (`default`, `metadata`, …): el build con
Webpack lo exige y falla si exporta de más, y con Turbopack el problema queda escondido. Componentes
y helpers van en su propio archivo (por eso `orders-page-helpers.ts` no vive dentro de la página).

## Git y CI

- Repo: `github.com/danielmaki123/one-burger-commerce`, rama de trabajo y deploy: **`main`**.
- Commits en español, con prefijo: `fix|feat|refactor|docs|chore|test(<área>): resumen`.
  El cuerpo explica el problema y la evidencia de verificación.
- Push directo a `main` autorizado para este proyecto.
- **Nunca** commitear secretos, `.env`, tokens, caches, artefactos de build ni metadata
  de agentes (`npm run security:secrets` lo verifica).
- CI (`.github/workflows/publish-ghcr.yml`) corre en cada push a `main`:
  `verify` (secrets, lint, typecheck, tests, build) → `migrations` (aplica migraciones en
  Postgres limpio y falla ante drift) → `container` (construye la imagen, la ejecuta
  contra Postgres, exige readiness y **prueba el bootstrap del primer admin**) →
  `publish` (imagen a GHCR). Si algo está rojo, no está listo.

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
- **No desplegar sin confirmación del owner**; después del deploy correr los dos smokes de
  solo lectura (`test:e2e:prod` y `test:e2e:prod:hosts`).
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

- Migraciones Prisma versionadas y **sin BOM** (un BOM rompe `prisma migrate deploy` en cualquier
  base nueva): hay un test que lo verifica.
- `prisma/seed.ts` es **solo para local/demo** (crea credenciales conocidas): nunca en producción.
- Los datos del negocio (nombre, colores, contacto, horarios, precios, propina) **no se hardcodean**:
  se leen de la configuración editable en el admin (`ops/tasks/TASK-whitelabel-branding.md`).

## Prohibiciones

- No reactivar módulos fuera del MVP en navegación ni APIs públicas sin pedido explícito.
- No tocar servicios ajenos del panel compartido (`cacommerce`, `capostgres`, `imagehost`,
  `postimage`, proyecto `n8n`).
- No hacer `db:seed` ni `migrate reset` contra producción.
- No borrar ni reescribir tests existentes para que pasen: si un test cambia de contrato,
  actualizalo explicando por qué en el commit.
- No dejar `BOOTSTRAP_ADMIN_*` ni secretos temporales en el entorno del servicio.

UI y código:

- No escribir HTML crudo (`button`, `input`, `select`, `textarea`) donde ya hay componente, ni
  `#hex`, `rgba()` o paleta cruda de Tailwind donde hay token.
- No crear un componente en `_components/` sin registrarlo en `src/shared/ui/registry.json` en el mismo
  commit, ni copiar el HTML de Stitch: se traduce a componentes del repo.
- No duplicar un cálculo ni una transición de estado que ya tiene fuente única (`order-totals.ts`, `order-workflows.ts`).
- No pasar de **400 líneas por archivo**, **80 por función** ni **50 por route handler**.
- No agregar dependencias nuevas sin aprobación humana.
- No crear `AGENTS.md` anidados, `docs/ai/` ni skills: no es el patrón del repo.
