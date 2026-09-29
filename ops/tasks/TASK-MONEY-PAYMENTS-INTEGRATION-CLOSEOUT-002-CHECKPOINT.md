# Checkpoint de ejecución — TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002

> **Archivo temporal de trabajo.** No es documentación del repo: se borra cuando la TASK cierre y su contenido
> va al PR o a `CURRENT.md`.

## Rama y HEAD

`fix/money-payments-integration-closeout`, sobre `main` = `5ea1b3887edd5aadeffb7892219d1406853c82aa`.

## Estado de verificación

| Gate | Resultado |
|---|---|
| Suite completa | **519 archivos / 3788 tests** |
| PostgreSQL real | **51/51** en 10 archivos |
| `typecheck` · `lint` · `test:contracts` | verde · verde · **156** |
| `npm run build` (Turbopack) | **verde** |
| `migrate diff` | **sin drift** |
| E2E Finanzas (`admin-finance.spec.ts`) | **7/7**, incluida la disponibilidad (`A-86`) |
| E2E tasa (`admin-exchange-rate.spec.ts`) | **2/2**, reescrito contra Finanzas (`A-84`) |
| E2E local completo | **86 pasan / 4 fallan** — los 4 son **previos** (ver abajo) |
| Upgrade test | ruta vieja → datos → migración → verificación + escritura, **verificado** |
| Mutaciones (restauradas) | POS 3 rojos · Refund 2 rojos · guarda del cambio de base 4 rojos |

## Los 4 fallos de E2E, medidos en las dos ramas

- **`admin-locations.spec.ts` (3)**: fallan **igual en `main`** con los mismos síntomas → **`A-91`** (deuda del
  arnés de E2E, no del runtime de dinero). No se repararon a propósito.
- **`admin-exchange-rate.spec.ts` (1)**: **sí era de esta TASK** — `A-84` quitó el control de la tasa de
  Personalización, así que el spec que lo usaba tenía que reescribirse contra `/admin/finance`. **Ya está
  reescrito y verde (2/2).**

## Upgrade test — cómo se corrió (base `oneburger_upgrade`, desechable)

`prisma migrate deploy` lee `.env` (que apunta a `oneburger`), y `--schema` fuera de `prisma/` **no encuentra**
el directorio de migraciones. La secuencia que funciona:

1. `prisma/schema.legacy.tmp.prisma` = el schema **sin** las cuatro columnas nuevas (copia temporal, no se
   commitea) → `migrate deploy` con ese schema aplica las **59** migraciones viejas.
2. `prisma db execute --file scripts/qa-upgrade-pre.sql` carga los datos con forma de producción.
3. Se devuelve la migración nueva a `prisma/migrations` y se aplica su SQL con
   `prisma db execute --file prisma/migrations/20260930120000_.../migration.sql`.
4. `prisma db execute --file scripts/qa-upgrade-post.sql` + `tsx scripts/qa-upgrade-write.ts`.

Resultado: legacy sin snapshot, `mixed` con `methodKind` nulo, pedido **sin** moneda, cierre **sin** base ni
tasas, `countedCurrencyCodes` traducido de `usdEnabled` a `{NIO, USD}`, **cero** valores inventados; y el
esquema migrado **acepta** un pedido con moneda, un cierre con base y mapa de tasas, y **tres** monedas
contables en una sucursal sin ninguna columna nueva.

## Lo que FALTA

1. `npm run build:webpack` (el `next build` de Turbopack ya pasó).
2. **Push, PR, CI verde (4 checks), squash merge.**
3. **Deploy**: lo hace el **owner** (`EASYPANEL_TOKEN` vacío en el entorno del agente). Después:
   health/readiness, smokes de menú y hosts y QA de producción **de lectura** — **sin** afirmar que una
   escritura peligrosa se probó en producción.
4. **Pasada documental de cierre**: `CURRENT.md`, `NEXT.md`, el brief de la TASK, y **borrar este archivo**.

## Trampas operativas que no hay que repetir

- **Nunca `git add -A`**: los residuos locales (`AUDITORIA-ESTADO-*.md`, `plan2uiux.md`, `plna.md`,
  `pos*_reference.html`, `pos fase 1/`, `comanda order referencia/`) están sin trackear a propósito.
- **Nunca `replace_all`** en `DECISIONS.md`: duplicó un bloque cinco veces; se restauró con `git checkout --`.
- `Location` **no tiene `deletedAt`**: un `where: { deletedAt: null }` no compila.
- Los specs de página/ruta son **flaky** bajo carga: correr la suite sola antes de creer en un rojo.
- Playwright **borra `test-results/`** al arrancar: una captura de una corrida anterior no sobrevive.
