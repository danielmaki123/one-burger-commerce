# AGENTS.md

Instrucciones de trabajo para este repositorio. Si algo acá contradice un pedido
explícito del humano, gana el humano; después de resolverlo, actualizá este archivo.

## Cómo trabajamos (acuerdo con el owner)

- **De a una tarea por vez**, no varias cosas de un saque: cada tarea se cierra entera
  (implementación, tests, validación, commit, push, CI verde y estado actualizado) antes de
  empezar la siguiente.
- Si una tarea mezcla temas distintos, se parte en **un commit por tema**.
- Ante una duda de alcance, se pregunta **antes** de codear; no se inventa producto.
- **Plan escrito = alcance ya resuelto** (2026-09-14): si el owner entrega un plan o un brief (los
  de `ops/tasks/*.md`, o el plan que pase por el chat), las tareas que ese documento ya define se
  ejecutan **de corrido y sin pedir validación entre una y otra**. Se sigue cerrando **una por vez**
  (implementación, tests, validación, commit, push, CI verde y estado actualizado) y se sigue
  preguntando por lo que el plan **no** decide: alcance nuevo, producto, dependencias nuevas y
  deploy. Si el plan choca con este archivo, gana el plan y la excepción se anota acá, en el mismo
  commit.
- **Excepciones anotadas del plan de UI** (`plan2uiux.md`, 2026-09-15; se anotan acá porque el plan
  choca con este archivo):
  - El plan pide un **stop humano** en `C1-4a` (mockup de `/admin` antes de implementarlo). Se
    respeta: es la única tarea del plan que espera validación del owner.
  - El plan escribe el gate como `npm run test:contracts` y el registro de componentes como
    `registry.json`: en este repo el comando es un alias de los cinco contratos de
    `src/shared/contracts/` (que ya corren en `npm run test` y en el job `contracts` de CI) y el
    registro de componentes es `DESIGN_SYSTEM.md` §3 **más** `src/shared/ui/registry.json`, que es un
    **espejo declarado** de ese catálogo: un test de contrato exige que los dos tengan los mismos
    componentes. El catálogo sigue siendo el de `DESIGN_SYSTEM.md` (así lo exige
    `ui-contract.test.ts`).
  - El plan dice «21 E2E»: acá son **23 specs** en `tests/e2e/` y la línea de base vigente está en
    `ops/tasks/START-HERE.md` §5.
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

Fuera del MVP (código presente, **no** ofrecido en UI ni APIs públicas): reservas,
mesas, delivery, inventario y reportes avanzados. Sus páginas de admin quedan solo
accesibles por URL directa. No reactivarlos en la navegación ni en las APIs públicas
sin aprobación explícita.

## Dónde está el estado (leer antes de trabajar)

| Documento | Para qué |
|---|---|
| `ops/tasks/START-HERE.md` | **Cómo arrancar en un chat nuevo**: prompt listo, orden de lectura y reglas mínimas. |
| `ops/project-state.md` | Estado real: qué está desplegado, qué se cerró, qué falta, cómo continuar. **Leer primero.** |
| `ops/production-readiness.md` | Runbook: entorno, deploy, backups, rollback, notificaciones, primer arranque, límites conocidos. |
| `ops/tasks/*.md` | Briefs de tareas acordadas con el owner (decisiones ya resueltas). |
| `DESIGN_REFERENCES.md` | **UI — ADN visual**: los 10 patrones que deciden cómo se ve una pantalla. Se lee antes de escribir UI; gana sobre los demás documentos de diseño. |
| `DESIGN_SYSTEM.md` | **UI — catálogo**: tokens (light y dark), componentes y "cuándo NO usar" cada uno. Deriva del ADN. |
| `README.md` | Alcance y comandos de validación. |

`docs/` y `handoffs/` están en `.gitignore` (material histórico heredado de otro
proyecto: **no** son fuente de verdad para este repo), igual que los documentos sueltos
de esa etapa que siguen en el disco (`CODEX.md`, `LINEAR.md`, `ARCHITECTURE.md`,
`PROJECT_AUDIT_FOR_CODEX.md`, …): describen otra gobernanza (un «orquestador único
Codex», ramas de otro proyecto) y **no** rigen acá. La única fuente de verdad es este
archivo + `ops/`.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript estricto
- Prisma 6 + PostgreSQL 17
- Tailwind CSS 4 con tokens CSS propios (`src/app/globals.css`)
- Vitest (unitarios) · Playwright (E2E) · ESLint
- Docker multi-stage → **Easypanel** (build desde GitHub `main`)

## Arquitectura (DDD)

```
src/modules/<módulo>/{domain,features,ports,adapters}
src/app/**            rutas (App Router) + API routes
src/shared/{ui,lib,config,pwa}
src/infrastructure/** prisma, event bus
```

- `domain`: tipos, reglas y errores del módulo, sin I/O.
- `features/<caso-de-uso>`: un caso de uso por carpeta, recibe dependencias inyectadas
  (`{ repository, ... }`) y **no** instancia Prisma.
- `ports`: interfaces de repositorio/servicios externos.
- `adapters`: implementaciones (Prisma; `in-memory-*` para tests).
- Los API routes y las páginas son la capa de composición: validan con zod, resuelven
  sesión/permisos, instancian adaptadores y llaman casos de uso.
- Errores de dominio tipados por módulo (`OrderError`, `AuthError`, …) y mapeados en
  `src/shared/lib/http/error-response.ts`.

## Jerarquía de fuentes (qué gana cuando hay conflicto)

1. **`DESIGN_REFERENCES.md`** — el **ADN visual**: los 10 patrones que deciden cómo se ve una pantalla
   (números grandes, cards con personalidad, íconos con fondo, color con significado, jerarquía de 5
   niveles, badges, visualización, spacing, radius y **dark mode siempre**). Se lee **antes de escribir
   cualquier UI**. Si la decisión es visual, manda este archivo.
2. **`DESIGN_SYSTEM.md`** — el **catálogo**: qué tokens existen, qué componentes hay y cuándo NO usar
   cada uno. No contradice al ADN: lo aterriza.
3. **`AGENTS.md`** (este archivo) — todo lo demás: alcance, arquitectura, TDD, validación, git/CI,
   deploy, idioma y prohibiciones. **Sigue mandando sobre los dos documentos de diseño** cuando el
   conflicto no es visual (alcance, arquitectura, proceso): en ese caso gana este archivo y el
   documento de diseño se corrige en el mismo commit.
4. **Skills de diseño** (Impeccable, Frontend design, UI/UX Pro Max, …) — **referencia secundaria, no
   fuente de verdad**. Si un skill contradice el ADN o el catálogo, **ganan los documentos del repo**:
   se reporta el conflicto y **no** se cambia el código.
5. **Humano** — si sigue sin estar claro, se para y se pregunta.

## UI y design system

El **ADN visual** es [`DESIGN_REFERENCES.md`](DESIGN_REFERENCES.md) (raíz, versionado). El **catálogo**
de tokens y componentes es [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) (raíz, versionado), que deriva de este
archivo y del inventario medido en [`ops/tasks/TASK-201-ui-inventory.md`](ops/tasks/TASK-201-ui-inventory.md).

- **Componente que existe, componente que se usa**: primero `src/shared/ui/`, después
  `(admin)/admin/_components/` y `(public)/_components/`. Hoy hay **26 componentes** y **111
  elementos HTML crudos**, y en **22 archivos el componente ya estaba importado**: ese es el defecto
  a no repetir.
- **Prohibido el HTML crudo equivalente** (`<button>`, `<input>`, `<select>`, `<textarea>`) cuando el
  primitivo existe. De los que **NO EXISTE** primitivo (hoy 31 `<select>` y 6 `<textarea>`), la falta
  se documenta en `DESIGN_SYSTEM.md` §3.4 antes de inventar el sexto `className` distinto.
- **Prohibido el color fuera de token**: nada de `#hex` (hoy hay 10 de UI), `rgba()` (35), paleta
  cruda de Tailwind donde hay token (70 apariciones de `red-*`, `stone-*`, `amber-*`, `emerald-*`,
  `sky-*`) ni `fontFamily` inline que duplique `font-heading` (29). Solo tokens de `globals.css`.
- **Los 16 tokens muertos están prohibidos y ya no existen** (C1-3): `--primary`, `--popover`,
  `--destructive`, `--ring` y la familia `--sidebar-*` se eliminaron de `globals.css` porque nadie los
  consumía. Un contrato lo verifica: si necesitás uno de verdad, se declara **con su consumidor** en el
  mismo commit.
- **El modo oscuro es obligatorio** (aprobado el 2026-09-15, `DESIGN_REFERENCES.md` §3 Patrón 10): todo
  token nuevo necesita su valor en `.dark` y todo par texto/fondo tiene que dar **4.5:1** en los dos
  modos. `src/shared/contracts/dark-mode-contract.test.ts` lo mide.
- **Componente nuevo = registro previo**: un archivo nuevo en `_components/` se registra en
  `DESIGN_SYSTEM.md` **en el mismo commit**, con su "cuándo SÍ" y su "cuándo NO". El espejo legible por
  máquina es `src/shared/ui/registry.json`, y un contrato exige que los dos tengan los mismos componentes.
- **Los techos de UI solo bajan** (C1-2, `plan2uiux.md`): `src/shared/config/design-tokens.allow.json`
  congela, por archivo, las violaciones que todavía quedan (paleta cruda, `fontFamily` inline,
  radios/tamaños/sombras arbitrarios, `window.confirm`, `role` a mano y HTML crudo). **Un techo nunca
  sube**; si un archivo baja sus violaciones, baja el número en el mismo commit; un archivo nuevo no
  agrega fila, arregla el archivo. Al terminar la Capa 1.9 del plan de UI, todas las tablas quedan vacías.
- **Ningún control decorativo**: cada control se implementa con su estado/API **y su test**, o se
  elimina con el motivo escrito en el commit.
- **Nada de texto decorativo**: copy que no cambia una decisión del usuario ("Bienvenido",
  "Descubrí lo mejor de…", subtítulos que repiten el título). `DESIGN_SYSTEM.md` §5 lo lista.
- La UI se verifica en **navegador real a 375 px y 1280 px**, no en HTML estático.

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

## TDD (obligatorio para cambios funcionales)

1. Escribí **primero** el test que falla (unitario del caso de uso o de la regla).
2. Corré y confirmá el rojo.
3. Implementá lo mínimo para el verde.
4. Refactorizá con los tests verdes.
5. Cerrá con la validación mínima completa.

Reglas de test:

- Los dobles de test implementan el **puerto completo** (si agregás un método al puerto,
  el compilador te obliga a implementarlo también en el adaptador en memoria).
- Los cambios de infra (Dockerfile, CI, scripts de arranque) se cubren con **tests de
  contrato** que leen los archivos (`src/shared/config/deploy-runtime-contract.test.ts`)
  o, mejor, con el job de CI que **construye y ejecuta la imagen**.
- Los flujos de usuario se cubren en `tests/e2e/` (público y admin).
- No mockees lo que podés probar de verdad; no inventes tests que no verifican nada.

## Checklist de UI antes de cerrar una tarea con pantalla

Ninguna tarea que toque UI se cierra con un "no" acá. El ADN está en `DESIGN_REFERENCES.md` §3 y el
catálogo con el "cuándo NO" de cada componente, en `DESIGN_SYSTEM.md` §3.

**ADN visual (los 10 patrones):**

- [ ] ¿El dato principal **domina** (Hero 56 px Fraunces 700) y los secundarios van en KPI 32 px?
- [ ] ¿La pantalla usa los **5 niveles** (Hero, KPI, Título, Body, Label) y ninguno intermedio?
- [ ] ¿Los **íconos tienen fondo de color** (48×48, radio 12) y los colores **significan** algo?
- [ ] ¿Hay **máximo 2 tipos de card** por pantalla (no todas blancas)?
- [ ] ¿El spacing es **32 px entre secciones** y 24 px dentro de las cards?
- [ ] ¿Los badges de tendencia/estado usan `-soft` de fondo y `-strong` de texto?
- [ ] ¿Donde hay datos hay **visualización** (sparkline / donut / barras), y sin datos hay estado vacío?
- [ ] ¿Se ve bien en **light Y dark** (`class="dark"` en `<html>`) y el par texto/fondo da ≥4.5:1?

**Código y componentes:**

- [ ] ¿Usé los primitivos de `src/shared/ui/` donde ya existían? (si falta uno, se registra en
      `DESIGN_SYSTEM.md` §3.4, no se inventa el sexto `className`)
- [ ] ¿Cero `text-[Npx]`, cero paleta cruda, cero `rounded-[Npx]` y cero `shadow-[...]`?
- [ ] ¿Hay **una sola** acción primaria y ningún texto decorativo?
- [ ] ¿Están los **4 estados** de toda pantalla con datos: cargando, vacío, error y con datos?
- [ ] ¿La verifiqué en **navegador real a 375 px y 1280 px** (Playwright), no en HTML estático?
- [ ] ¿Corrí los gates (`npm run test:contracts`, `npm run test`) y el E2E si toqué flujos?

## Validación mínima antes de cerrar

```bash
npm run test        # unitarios
npm run lint
npm run typecheck
npm run build       # Turbopack; el deploy usa este camino
npm run security:secrets
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

Una página de Next solo puede exportar lo que Next conoce (`default`, `metadata`, …). El
build con Webpack lo exige y falla si una página exporta de más; con Turbopack el problema
queda escondido hasta que alguien usa ese otro camino de build. Los componentes y los helpers
van en su propio archivo (por eso `orders-page-helpers.ts` no vive dentro de la página).

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
- El contenedor, al arrancar: valida entorno → aplica migraciones → (opcional) crea el
  primer admin → `next start`. Si el arranque falla, Easypanel **no** promueve la versión
  y sigue sirviendo la anterior.
- El token del panel da acceso total al servidor: solo por variable de entorno, nunca en
  el repo ni en un commit.

## Idioma y estilo

- **Español** en: UI, textos del admin, documentación, commits y respuestas al humano.
- **Inglés** en: nombres de archivos, funciones, tipos y variables de código.
- UI mobile-first (se verifica a 375 px), `min-h-11` en controles táctiles, labels
  asociados a sus inputs, textos de error claros en español.
- Estilos con los **tokens semánticos** de `globals.css` (`bg-card`, `text-foreground`,
  `bg-brand`, `border-border`); no colores sueltos ni clases ad hoc.

## Datos

- Migraciones Prisma versionadas y **sin BOM** (hay test que lo verifica): un BOM rompe
  `prisma migrate deploy` en cualquier base nueva.
- `prisma/seed.ts` es **solo para local/demo** (crea credenciales conocidas). Nunca en
  producción.
- Los datos del negocio (nombre, colores, contacto, horarios, precios, propina) **no se
  hardcodean**: se leen de la configuración editable en el admin. Ver
  `ops/tasks/TASK-whitelabel-branding.md`.

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
- No crear un componente en `_components/` sin registrarlo en `DESIGN_SYSTEM.md` en el mismo commit.
- No duplicar un cálculo ni una transición de estado que ya tiene fuente única (`order-totals.ts`,
  `order-workflows.ts`).
- No pasar de **400 líneas por archivo**, **80 por función** ni **50 por route handler**.
- No agregar dependencias nuevas sin aprobación humana.
- No crear `AGENTS.md` anidados, `docs/ai/` ni skills: no es el patrón del repo.
