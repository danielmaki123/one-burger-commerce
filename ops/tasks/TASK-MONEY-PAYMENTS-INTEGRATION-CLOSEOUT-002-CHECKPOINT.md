# Checkpoint de ejecución — TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002

> **Archivo temporal de trabajo** para no perder contexto entre rondas de la misma sesión. **No es
> documentación del repo**: se borra cuando la TASK cierre y su contenido va al PR o a `CURRENT.md`.

## Rama y HEAD

`fix/money-payments-integration-closeout`, sobre `main` = `5ea1b3887edd5aadeffb7892219d1406853c82aa`.
**Sin push ni PR todavía** (la TASK es `high-risk-e2e`: PR → CI → merge → deploy).

## Commits de la TASK (locales, en orden)

| # | Commit | Qué cierra |
|---|---|---|
| 1 | `8e27cf5` | Reproducción de `A-81`…`A-90` + brief de la TASK |
| 2 | `271c617` | `A-81`/`A-83`: snapshot del POS (con mutación) + contexto monetario |
| 3 | `01e9ce0` | `A-82`: snapshot de la devolución (con mutación) |
| 4 | `abb3ccd` | `A-88`/`A-89`/`A-90`: migración `20260930120000` + monedas contables por local |
| 5 | `2a1a4fe` | `A-83`/`A-90`: Caja y cierre con `money` + base y tasas firmadas |
| 6 | `1ae56ac` | `A-83`/`A-87`: locale propio (no finge cambio de base) + factura y dashboard |
| 7 | `4fe95a9` | `D-022`/`D-023`/`D-024`: guarda de obligaciones vivas (7 casos PostgreSQL + mutación) |
| 8 | `72011ce` | `A-85`/`A-86`: el medio del POS sale del catálogo, resuelto por el servidor |
| 9 | `89bccac` | `A-85`/`A-86`: monedas configuradas en el POS + disponibilidad persistida |
| 10 | `1e65021` | `A-86`: la disponibilidad se edita en la pantalla de Finanzas |
| 11 | `6d846e9` | `A-84`: Personalización deja de editar moneda, símbolo, locale y tasa |

## Estado de verificación (último run)

- Suite completa: **519 archivos / 3788 tests** en verde.
- PostgreSQL real: **51/51** en 10 archivos (`oneburger_test`, migrada).
- `typecheck`, `lint`, `test:contracts` (**156**) en verde.
- `migrate diff` **sin drift** contra `schema.prisma`.
- Mutaciones verificadas y restauradas: snapshot del POS (3 rojos), snapshot del Refund (2 rojos),
  guarda del cambio de base (4 rojos).

## Hallazgos: estado

`A-81` ✅ · `A-82` ✅ · `A-83` ✅ · `A-84` ✅ · `A-85` ✅ (servidor + pantalla) · `A-86` ✅ (escritura +
pantalla) · `A-87` ✅ · `A-88` ✅ · `A-89` ✅ · `A-90` ✅.

**Falta mover las filas del backlog a `cerrado`** con su PR, en la pasada documental de cierre.

## Lo que FALTA para cerrar la TASK 1

1. **Upgrade test** desde el esquema de producción anterior (la ruta ya está probada en PR #89; falta
   re-ejecutarla con la migración nueva).
2. **Caso EUR/MXN** como fixture end-to-end (el dominio ya lo tiene en `paid-total` y
   `payment-method-availability`; falta el E2E).
3. **E2E local** de Finanzas + POS configurado + cobro + estado financiero, y **visual-check** de
   `/admin/finance` contra `finance-reference.html` en los cuatro viewports.
4. **`build` / `build:webpack`** completos.
5. **Push, PR, CI verde (4 checks), squash merge.**
6. **Deploy** (`deployService` con `forceRebuild`, `EASYPANEL_TOKEN` está **vacío**: lo hace el owner),
   health/readiness, smokes y QA de producción **de lectura**.
7. **Pasada documental de cierre**: `audit-backlog.md` (`A-81`…`A-90` → `cerrado`), `CURRENT.md`,
   `NEXT.md`, el brief de la TASK, y borrar este checkpoint.

## Notas operativas que no hay que repetir

- `DATABASE_URL` de los tests de PostgreSQL: hay que migrar **`oneburger_test`** aparte; `prisma migrate
  deploy` lee `.env` (que apunta a `oneburger`). Se resuelve copiando `.env`, apuntándolo a `_test`,
  corriendo deploy y restaurando.
- **Nunca `git add -A`** en este repo: los residuos locales (`AUDITORIA-ESTADO-*.md`, `plan2uiux.md`,
  `plna.md`, `pos*_reference.html`, `pos fase 1/`, `comanda order referencia/`) están sin trackear a
  propósito. Ya pasó una vez y se deshizo.
- `replace_all` en `DECISIONS.md` duplicó un bloque cinco veces; se restauró con `git checkout --`.
- Los tests de página/ruta son **flaky** bajo carga: correr la suite sola antes de creer en un rojo.
