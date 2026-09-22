# Rediseño de Caja — reporte consolidado de las Fases 1 a 5

> **Fecha**: 2026-09-23 · **Estado**: Fases 1–5 **mergeadas y desplegadas** en producción. **Fase 6 en
> curso** en `feat/cash-terminal-por-turno` (sin mergear y **sin deployar**: espera el OK del owner).
>
> **Deploy de producción**: `build-20260922-232049`, servido por los tres dominios
> (`menu` / `admin` / apex con `health: ok`). Es posterior a los merges de la Fase 3 (`7225582`) y la
> Fase 5 (`bbc485a`), así que **las dos están vivas**. El deploy lo corrió el owner: el `EASYPANEL_TOKEN`
> no está en el entorno del agente.

## 1. Qué entregó cada fase

| Fase | PR / commit | Qué cambió (en una línea) | Migración | Unitarios al cerrar |
|---|---|---|---|---|
| **1a + 1b** | [#13](https://github.com/danielmaki123/one-burger-commerce/pull/13) · `46282a7` | Sidebar CONTROL (`POS · Caja · Cierres · Aprobaciones · Config de Caja`), `/admin/cash` con un solo sujeto y cuatro estados, la auditoría mudada a Reporte e Historial; **A-39/A-40/A-44 cerrados** | — | 3039 / 439 |
| **2** | [#15](https://github.com/danielmaki123/one-burger-commerce/pull/15) · `57e76e8` | Módulo `cash-config`: `usdEnabled` por sucursal, denominaciones por moneda y `blindCount` editables; API `GET/PUT /api/admin/cash/config` (solo dueño) y la pantalla real de `/admin/cash/config` | `20260922154442_add_cash_config` (siembra 16 billetes) | 3078 / 443 |
| **4** | [#17](https://github.com/danielmaki123/one-burger-commerce/pull/17) · `5a93bd6` | **Arqueo ciego efectivo** y el papel del arqueo **solo para el dueño** (`canPrintCashDocuments`); sin permiso el traspaso se firma igual y queda asentado | — | 3081 / 446 |
| **3** | [#19](https://github.com/danielmaki123/one-burger-commerce/pull/19) · `7225582` | **Cierre por banco**: `Bank`/`LocationBank`/`ShiftBankClose`, catálogo en Config de Caja, `CashCloseModal` con consolidado y diferencia, el cuadre en la hoja y en el detalle, y el aviso al dueño | `20260923120000_add_bank_close` | 3132 / 450 |
| **5** | [#20](https://github.com/danielmaki123/one-burger-commerce/pull/20) · `bbc485a` | **Lectura parcial en modal**, **movimientos por moneda en una hoja** y **reapertura fuera de la UI** (API y esquema intactos) | — | 3166 / 455 |

> La **Fase 1** va en la tabla solo como contexto: el pedido era el consolidado de las Fases 2 a 5.

## 2. Decisiones que tomé y el owner puede cambiar

Están en el commit de cada fase; acá van juntas para que se puedan revisar de una.

**Fase 2**
1. Un billete **no se borra, se apaga** (los cierres viejos guardan con qué se contó).
2. La moneda del negocio **no se puede apagar**; el dólar sí, por sucursal.
3. `blindCount` se persiste y se edita en la Fase 2 pero **se aplica en la panalla** desde la Fase 4.

**Fase 3**
4. La diferencia del cuadre por banco es **del consolidado**, no por banco: el cobro no guarda banco, así
   que atribuirla por banco sería un número inventado.
5. El cuadre compara contra **tarjeta + transferencia**; `mixto`, `otro` y el efectivo quedan afuera (el
   efectivo tiene su propio arqueo).
6. Sin lote declarado, `bankDifferenceAmount` queda en **`null`**, no en cero.
7. El catálogo de bancos se edita desde Config de Caja y **no se borra**: se apaga.

**Fase 5**
8. El **traspaso se queda en Caja** (es operativo) y lo que se mudó a un modal es la **lectura**.
9. Los movimientos **no tienen aprobación** (decisión del owner en la Tarea 2: el límite avisa, no bloquea),
   así que no hay «movimientos sin confirmar» que bloqueen el cierre.

**Fase 6** (ya respondidas por el owner el 2026-09-23)
10. Terminal **propia** (`PosTerminal`), no etiqueta del banco. 11. **Una caja abierta por (sucursal +
    terminal)**. 12. La terminal se elige **en Caja**, el POS **hereda** y **el POS no cierra cajas**.

## 3. Verificación (lo que se puede mostrar)

| Fase | Unitarios / contratos | E2E local | Navegador real |
|---|---|---|---|
| 1 | 3039/439 | suite local verde | `/admin/cash` 375/0 y 1280; capturas `cash-prod-*.png` |
| 2 | 3078/443 | **124/6/0** | config a 375 y 1280, cero desborde; capturas `cash-config-fase2-*.png` |
| 4 | 3081/446 | 124/6/0 | sanidad de producción a 375 en Caja y Config |
| 3 | 3132/450 | 124/6/0 + spec nuevo del cuadre | — |
| 5 | 3166/455 | **125/6/0** | — |

Todas con `lint`, `typecheck`, `build` (y `build:webpack` donde se tocó una página) y `security:secrets`
verdes, y **los 4 checks del CI** verdes en cada PR.

**Límite declarado**: la QA de producción es de **solo lectura** (no se muta la base productiva), así que
las reglas que solo se ven al abrir o cerrar un turno (arqueo ciego, impresión por rol, cuadre por banco)
quedan verificadas por unitarios con rojo observado y por el E2E local, no por un cierre real en
producción.

## 4. Hallazgos abiertos

| # | Qué es | Estado |
|---|---|---|
| **A-43** | La cabecera compartida del panel mide 186 px = **23,3%** a 375 px (la regla es ≤20%). No es de Caja: es el `AdminPageHeader`. | `reportado`, deuda declarada por el owner, va en otro PR |
| **A-45** | El **arqueo ciego se aplica solo en la pantalla**: `GET /api/admin/pos/shift/x` devuelve el esperado a quien opera el POS, cajero incluido. Cerrarlo es decisión de producto (o el corte X deja de dar el esperado a quien no audita, o el ciego se declara regla de interfaz). | `reportado` (agente, 2026-09-23) |

## 5. Estado de deploy (para no duplicar ni revertir)

- **Desplegado**: Fases **1, 2, 3, 4 y 5**.
- **No desplegado**: **Fase 6** (terminal por turno). Va en la rama `feat/cash-terminal-por-turno`, con
  partes 1 (base + índice + contrato), 2 (catálogo de terminales del servidor) y 3a (turno por terminal,
  validación, arqueo que lee **sus** cobros y el POS que firma cada cobro con su turno) ya hechas con la
  suite verde. **No se deploya sin el OK del owner**, como pidió.
- **Falta de la Fase 6**: la sección de terminales en Config de Caja, el selector en Caja (abrir/cerrar por
  terminal) y que el POS mande su terminal; después E2E y QA.
