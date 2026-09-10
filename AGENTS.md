# AGENTS.md

Instrucciones de trabajo para este repositorio. Si algo acá contradice un pedido
explícito del humano, gana el humano; después de resolverlo, actualizá este archivo.

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
| `ops/project-state.md` | Estado real: qué está desplegado, qué se cerró, qué falta, cómo continuar. **Leer primero.** |
| `ops/production-readiness.md` | Runbook: entorno, deploy, backups, rollback, notificaciones, primer arranque, límites conocidos. |
| `ops/tasks/*.md` | Briefs de tareas acordadas con el owner. |
| `README.md` | Alcance y comandos de validación. |

`docs/` y `handoffs/` están en `.gitignore` (material histórico heredado de otro
proyecto: **no** son fuente de verdad para este repo).

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
- Dominios: **https://oneburgernic.com** (apex) y `https://www.oneburgernic.com`.
- Deploy: `npm run deploy:easypanel` con `EASYPANEL_URL`/`EASYPANEL_TOKEN` en el entorno
  (el script fusiona variables y **no** sobrescribe configuración manual). El webhook del
  panel no es fiable en esta instalación.
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
