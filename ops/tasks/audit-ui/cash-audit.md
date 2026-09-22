# Auditoría de `/admin/cash` — solo medición

**Fecha**: 2026-09-19 · **Commit auditado**: `3f539b6` (`main`, *docs(estado): deploy de las mejoras del POS a
produccion (2026-09-19) (#12)*) — `git log -1 --format=%H main`.
**Alcance**: auditoría de solo lectura. **No** se tocó código, ni la base, ni `ops/audit-backlog.md`, y **no
hay commit**. El único archivo escrito es este documento.
**Qué mide**: estructura, duplicación, permisos y **mediciones reales en navegador** (local con 1 sucursal y
producción con 3), con el método completo en §I.

> **Nota de honestidad sobre las mediciones**: todo número de §G salió de un navegador real (Playwright 1.62.1
> sobre Chromium). Lo que no se pudo medir dice `NO MEDIDO` y por qué. En producción se hizo **login y después
> solo GET**: no se abrió ni cerró caja, no se registraron movimientos, no se firmaron traspasos, no se creó
> ningún pedido. La cookie de producción se descartó al cerrar el contexto del navegador (no se usó
> `logout`, que es un POST).
> **No se guardó ninguna captura**: el pedido es que el único archivo sea este; la jerarquía visual se mide
> por geometría (§G.4), no por imagen.

---

## Resumen ejecutivo: qué del brief se confirma y qué no

| Afirmación del brief | Veredicto | Evidencia |
|---|---|---|
| Mezcla 4 conceptos en una página | **Confirmado** | Render tree de §A (`page.tsx:91-109`): turno + día + conciliación + historial |
| 3 selectores de sucursal repetidos | **Confirmado (en producción)** | Medido: 2 `<select>` "Local" + 1 grupo "Sucursal de la caja" = **3 controles independientes** (`cash-drawer-panel.tsx:182-189`, `reconciliation-panel.tsx:140-147`, `cash-client.tsx:142-155`). En local **no se dibujan**: hay 1 sola sucursal y los tres están detrás de `locations.length > 1` |
| 2 KPIs de "diferencia" que confunden | **Confirmado** | `day-close-panel.tsx:91` ("Diferencia del día") vs `cash-client.tsx:218` ("Diferencia acumulada"), con **alcances distintos** (§B.2) |
| Historial duplicado con `/admin/cash/history` | **Parcialmente: la ruta no existe** | `/admin/cash/history` **no tiene página** (solo `history/[id]/page.tsx`) → 404. La duplicación real es con **`/admin/history/cierres`** (§B.3) |
| Jerarquía visual rota: todo pesa igual | **Confirmado** | 4 `<h2>` de 20px/700 y **ninguno para el historial**, que es el 86% de la página (§A, §G.4) |
| Densidad ~1800px de alto en desktop | **Confirmado en producción, pero es dependiente de datos** | Producción @1280: **1884px** con **3** cierres. Local @1280 con 91 cierres: **10 607px**. Sin límite ni paginación (§F-A41) |
| — (hallazgo nuevo, no estaba en el brief) | **Bug medido** | **Scroll horizontal a 375px en producción**: `scrollWidth` 438 vs viewport 375 (§F-A39) |

---

## A. Estructura actual

### A.1 Qué renderiza `/admin/cash` (todas las cifras de LOC son exactas: `(Get-Content).Count`)

| Bloque | Componente (ruta) | Endpoint / origen de datos (ruta) | Concepto de dominio | LOC |
|---|---|---|---|---|
| Cabecera + acción "Reporte del día" | `src/app/(admin)/admin/cash/page.tsx` · `_components/admin-operational-ui.tsx` (`AdminPageHeader:70-98`) | — (link a `/admin/cash/report`) | Navegación | 112 |
| **1. Turno actual** (abrir/cerrar/movimientos) | `cash-drawer-panel.tsx` · `_components/pos/cash-count-grid.tsx` | `GET /api/admin/pos/shift`, `POST /api/admin/pos/shift/{open,close}` (`cash-drawer-panel.tsx:82,119`) | Turno de caja | 324 |
| ↳ Corte X y traspaso (**anidado** dentro del bloque 1) | `cash-shift-handover-panel.tsx` · `shift-handovers-list.tsx:65` | `GET /api/admin/pos/shift/x`, `GET/POST /api/admin/pos/shift/handover` (`cash-shift-handover-panel.tsx:75,94,154`) | Corte parcial / custodia | 266 |
| **2. Cierre del día** (acumulado) | `day-close-panel.tsx` (server component) · `src/modules/orders/domain/day-close.ts` | **Sin API**: Prisma directo en el render (`day-close-panel.tsx:37-43`) | Día de caja | 144 |
| **3. Conciliación** (tarjeta/transferencia) | `reconciliation-panel.tsx` | `GET /api/admin/cash/reconciliation?locationId&date` (`reconciliation-panel.tsx:66`) | Banco | 212 |
| **4. Historial de turnos** (lista embebida) | `cash-client.tsx` · `cash-shift-helpers.ts:133` · `shift-csv.ts:76` | `GET /api/admin/cash/shifts?locationId` (`cash-client.tsx:85`) | Auditoría | 279 |
| Detalle de un turno (otra ruta) | `history/[id]/page.tsx` · `payment-mix-panel.tsx:110` · `cash-movements-panel.tsx:172` · `cash-movement-form.tsx:157` · `shift-reopen-form.tsx:112` · `shift-close-sheet-button.tsx:21` | Prisma + `GET/POST /api/admin/cash/shifts/[id]/{movements,reopen,refunds}` | Turno cerrado | 396 |
| Reporte del día (otra ruta) | `report/page.tsx` · `report/cash-day-report-panel.tsx:167` | Prisma directo + `summarizeDayClose`/`groupDayCloseByLocation` | Día de caja (por fecha) | 87 |
| Historial de la sección Historial (otra ruta) | `src/app/(admin)/admin/history/cierres/{page.tsx:25,cierres-client.tsx:267}` · `history-tabs.tsx:58` | `GET /api/admin/history/cierres` | Auditoría multi-sucursal | 267 |

### A.2 Render tree real (medido, no inferido)

`page.tsx:69-111` → `AdminPageHeader` + `CashDrawerPanel` (si `canUseOperate`) + `DayClosePanel` +
`ReconciliationPanel` + `CashClient` (los tres últimos si `canAudit`). `CashDrawerPanel` monta
`CashShiftHandoverPanel` **solo con caja abierta** (`cash-drawer-panel.tsx:251-257`), y por eso el bloque
"Corte X y traspaso" **está contenido dentro** del bloque "Caja del local" en las mediciones de §G.

### A.3 Jerarquía de encabezados (medida)

- 1 `<h1>`: "Caja del día" (24px/700).
- 4 `<h2>`: "Abrir o cerrar la caja", "Corte X y traspaso", "Cierre del día", "Conciliación" (los cuatro a
  **20px/700**, es decir el mismo peso).
- **El historial no tiene `<h2>` ni `<h3>`**: `cash-client.tsx` va de una fila de tabs a una
  `AdminMetricStrip` y a un `<ol aria-label="Cierres de caja">` (`cash-client.tsx:226-274`) sin título. Es el
  bloque más alto de la pantalla (§G) y el único sin nombre visible.

---

## B. Duplicación

### B.1 Selectores de sucursal: tres, con estado independiente

| # | Control | Ruta:línea | Estado | Qué afecta |
|---|---|---|---|---|
| 1 | `Select` con `label="Local"` | `cash-drawer-panel.tsx:65` (estado), `:182-189` (render) | `locationId` propio | El turno que se abre/cierra |
| 2 | `Select` con `label="Local"` | `reconciliation-panel.tsx:49` (estado), `:140-147` (render) | `locationId` propio | La conciliación del día |
| 3 | Grupo de botones `aria-label="Sucursal de la caja"` (`TabsList`/`TabsTrigger`, `src/shared/ui/tabs.tsx:23,63-80`) | `cash-client.tsx:73` (estado), `:142-155` (render) | `locationId` propio | El historial de cierres |

Consecuencia medida: **cambiar de sucursal en uno no mueve a los otros dos**. En producción los tres
dibujan y se ven a la vez (2 `<select>` + grupo de 3 botones). El bloque "Cierre del día" **no** tiene
selector: agrega todas las sucursales del alcance (`day-close-panel.tsx:41-51`), así que hay además **4
alcances distintos** de sucursal en una sola página.

### B.2 KPIs duplicados de "diferencia"

| KPI | Ruta:línea | Qué suma | Población |
|---|---|---|---|
| "Diferencia del día" | `day-close-panel.tsx:91-97` | `summarizeDayClose(dayShifts).difference` | Turnos **de hoy** (`businessDayRange`, `:38-48`) de **todas** las sucursales del alcance |
| "Diferencia acumulada" | `cash-client.tsx:218-221` | `summarizeShifts(visibleShifts).differenceTotal` (`cash-shift-helpers.ts:68-77`) | **Todos** los turnos de **la sucursal elegida**, sin límite de fecha; y `visibleShifts` cambia con el tab `Cierres`/`Todos` (`cash-client.tsx:117-119`) |

Dos números distintos, dos etiquetas casi iguales, y el segundo **cambia de significado según un filtro que
no está en su etiqueta**. Además, los mismos conteos se repiten: "N turnos · N cerrados · N con la caja
abierta · N sin contar" como texto (`day-close-panel.tsx:102-105`) y "Cierres / Sin contar / Turnos abiertos"
como KPIs (`cash-client.tsx:211-216,222`).

### B.3 Historial en dos lugares (y una ruta que no existe)

| | Lista embebida en `/admin/cash` | `/admin/history/cierres` |
|---|---|---|
| Código | `cash-client.tsx:226-274` | `cierres-client.tsx:221-263` |
| Endpoint | `GET /api/admin/cash/shifts` (`shifts/route.ts:19-48`) | `GET /api/admin/history/cierres` (`history/cierres/route.ts:16-33` → `cierres-composition.ts`) |
| Alcance | **Una** sucursal (la del selector 3) | **Todas** las del alcance |
| Filtros | `Cierres`/`Todos` (`cash-client.tsx:60-63`) | Día, sucursal, cajero, "Solo descuadre", limpiar, actualizar (`cierres-client.tsx:149-206`) |
| Columnas | Rango abierto→cerrado, abre, diferencia, esperado | Hora, día, sucursal, cajero, monto de cierre, diferencia + pill Cuadró/Descuadre |
| Export | CSV (`cash-client.tsx:128-137`) | — |
| Detalle | `Link` a `/admin/cash/history/{id}` (`cash-client.tsx:233`) | `Link` al mismo lugar (`cierres-client.tsx:256`) |

- **Fuente de verdad (una sola)**: la tabla `Shift` con su `ShiftCashCount`, leída sin recalcular el arqueo
  (`list-location-shifts.ts:5-13`, `prisma-shift-repository.ts:225-234`). Las dos pantallas son **vistas** de
  la misma tabla; ninguna escribe.
- **`/admin/cash/history` como listado NO existe**: el árbol de rutas solo tiene
  `cash/history/[id]/page.tsx` (`glob` verificado) → esa URL da 404. Lo que existe es
  `/admin/cash/history/{id}` (detalle) y `/admin/history/cierres` (lista).
- **¿Se pueden unificar?** Sí: `/admin/history/cierres` ya es un superconjunto funcional (alcance, filtros,
  cajero, pill de descuadre). La lista embebida aporta dos cosas que la otra no tiene: el **CSV**
  (`shift-csv.ts`) y el **rango abierto→cerrado** de cada fila. Unificar = llevar esas dos cosas al
  Historial y **borrar** `cash-client.tsx:116-276`, no duplicar filtros.
- **Costo de unificar**: el E2E pinnea la lista por rol accesible (`admin-cashier.spec.ts:33` exige que
  `list "Cierres de caja"` tenga **0** para el cajero) y `admin-cash.spec.ts` usa la lista en varios casos.

### B.4 "Cierre del día" duplica al Reporte del día que ya existe

`day-close-panel.tsx:37-51` y `report/page.tsx:49-60` hacen lo mismo: `businessDayRange` + `listShifts` por
sucursal + `summarizeDayClose` + `groupDayCloseByLocation`. La diferencia es que el reporte **acepta
cualquier fecha** (`report/page.tsx:50-51`) y el panel del día solo "hoy". En el render, el bloque de
`/admin/cash` es una versión fija de una pantalla que ya existe y que está enlazada desde la cabecera
(`page.tsx:80-88`).

---

## C. Permisos por rol

Puertas: `canUsePOS` (`admin-permissions.ts:54-60`), `canManageCash` (`:70-72`), `canViewCashHistory`
(`:104-106`), `canViewHistory` (`:116-118`). En la página: `page.tsx:34-40` (`canOperate`/`canAudit` y
redirect a `/admin/orders`), `:42-53` (alcance), `:91-109` (montaje de bloques). En las APIs:
`requireCashScope` → `assertCanManageCash` (`cash-route-helpers.ts:26-30,52-77`) y `requirePosScope` →
`requirePosLocation` → `assertCanUsePos` (`pos-scope.ts:18-22`, `pos-route-helpers.ts:47-52`).

| Bloque | owner | manager | cashier | kitchen |
|---|---|---|---|---|
| 1. Turno actual (abrir/cerrar, conteo) | ✅ `page.tsx:91-97` | ✅ | ✅ | ❌ redirect (`page.tsx:38-40`) |
| ↳ Corte X y traspaso (**dentro** del bloque 1) | ✅ | ✅ | ✅ **(ver C.1)** | ❌ |
| 2. Cierre del día | ✅ | ✅ | ❌ (`page.tsx:99`) | ❌ |
| 3. Conciliación + CSV | ✅ | ✅ | ❌ | ❌ |
| 4. Historial embebido + CSV | ✅ | ✅ | ❌ | ❌ |
| Acción "Reporte del día" (`/admin/cash/report`) | ✅ | ✅ | ❌ (`admin-cashier.spec.ts:38-39`) | ❌ |

**No es "todos ven todo"**: hay dos mitades con dos puertas. El que carga con los cuatro bloques es
**owner/manager** — que es exactamente quien sufre la densidad de §G.

### C.1 Dos tensiones medidas en los permisos

1. **El cajero sí firma traspasos**, pero no ve el historial. `CashShiftHandoverPanel` se monta dentro del
   bloque del cajero (`cash-drawer-panel.tsx:251-257`) y su POST va por la puerta del **mostrador**
   (`handover/route.ts:37` → `requirePosScope`), que el cajero pasa por `canUsePOS`. El corte X también
   (`x/route.ts:19-23`). El comentario de `admin-permissions.ts:63-72` define "control del dinero" como algo
   que el cajero **no** tiene; firmar un traspaso con el monto entregado es, cuando menos, discutible.
2. **El cajero ve un enlace que lo rebota**: `cash-drawer-panel.tsx:240-247` dibuja "Ver el turno abierto"
   para todo el que ve el panel, y `/admin/cash/history/{id}` redirige a `/admin/orders` a quien no tiene
   `canViewCashHistory` (`history/[id]/page.tsx:60-62`). Medido por código; **no reproducido en navegador**
   con rol cajero (crear esa cuenta es una mutación que el brief prohíbe).

---

## D. Propuesta de split

### Opción A — Tabs dentro de `/admin/cash`

`/admin/cash` (turno, default) · `/admin/cash/daily` · `/admin/cash/conciliation` · `/admin/cash/history`.

| Ventajas | Desventajas |
|---|---|
| Una sola entrada de sidebar (hoy es una sola: `admin-layout-helpers.ts:104`) | La URL `/admin/cash/history` **choca conceptualmente** con el detalle que ya vive ahí (`cash/history/[id]/page.tsx`): la lista y el detalle quedarían hermanos, y "history" pasa a significar dos cosas |
| El cajero puede aterrizar en su tab sin que se le dibujen los otros (el permiso ya existe por mitades) | Sin paginación, el tab "Historial" sigue midiendo 10 607px (local) — partir la pantalla no arregla la densidad, la mueve |
| Cambio incremental: se puede hacer tab por tab | Los 4 bloques hoy se renderizan en **el servidor** en un solo request (`day-close-panel.tsx`); pasarlos a tabs sin reescribirlos los deja montados y ocultos (coste real: hoy no hay `TabsContent` en la página) |

### Opción B — Rutas separadas

`/admin/cash` (turno) · `/admin/cash/daily` · `/admin/cash/conciliation` · `/admin/cash/history` (ya existe
como `[id]`).

| Ventajas | Desventajas |
|---|---|
| Cada concepto con su URL y su permiso, sin tabs que oculten bloques | `/admin/cash/history` como lista + `/admin/cash/history/{id}` como detalle es correcto en Next, pero obliga a renombrar la actual ruta de detalle o a convivir con ella |
| Las mediciones de §G se vuelven comparables (una pantalla = un sujeto) | Cuatro entradas donde hoy hay una: hay que decidir el sidebar (§E dice **no** tocarlo en esta fase) |
| `daily` puede **ser** `/admin/cash/report` (que ya existe y acepta fecha) en vez de una pantalla nueva | El E2E que pinnea regiones accesibles de `/admin/cash` se reescribe (`admin-cash.spec.ts:83-91,111-114,185,213,254,320-366`) |

### Recomendación: **3 secciones + el reporte que ya existe**

1. **Turno** (default) — `CashDrawerPanel` + `Corte X y traspaso`.
2. **Conciliación** — `ReconciliationPanel`.
3. **Historial** — la lista (unificada con `/admin/history/cierres`, §B.3) + el detalle que ya existe.

"**Cierre del día**" no necesita sección propia: ya es `/admin/cash/report`, con selector de fecha y los
mismos números (§B.4). Con eso la pantalla baja de 4 bloques/4 alcances de sucursal/3 selectores a 1 sujeto
por sección. Si el owner **quiere** mantener el bloque "hoy" en la sección de caja, entonces son **4**
secciones (Turno · Cierre del día · Conciliación · Historial) — **5 no se justifica**: no hay un quinto
concepto, solo el detalle de un turno, que ya tiene su URL.

---

## E. Qué NO tocar

- **Sidebar**: `ADMIN_CONTROL_NAV_ITEMS` (`admin-layout-helpers.ts:103-106`), `ADMIN_HISTORY_NAV_ITEM`
  (`:116-121`) y el armado del grupo Control (`:142-147`) quedan como están. Partir la pantalla en tabs no
  requiere tocar la navegación; partirla en rutas sí, y eso es una decisión aparte.
- **Otros módulos**: POS (`/admin/pos`), Órdenes, Menú, Locales, Personalización, Aprobaciones.
- **Backend**: ninguna ruta API, caso de uso, adaptador, Prisma ni migración. Esta auditoría solo leyó
  (`src/app/api/admin/cash/**`, `src/modules/orders/**`, `src/modules/pos/**`).
- **Tests** existentes: `cash-client.test.tsx`, `cash-drawer-panel.test.tsx`, `reconciliation-panel.test.tsx`,
  `cash-movements-panel.test.tsx`, `cash-shift-handover-panel.test.tsx`, `shift-handovers-list.test.tsx`,
  `payment-mix-panel.test.tsx`, `cash-shift-helpers.test.ts`, `shift-csv.test.ts` y los E2E de §D.
- `ops/audit-backlog.md` (pedido explícito del owner para esta ronda).

---

## F. Deuda detectada

| ID tent. | Tipo | Sev. | Qué | Evidencia | Estado |
|---|---|---|---|---|---|
| **A-39** | bug (UI) | **P1** | **Scroll horizontal a 375px en producción** por el selector de sucursal del historial: el grupo mide **426px** en un viewport de 375 (`scrollWidth` 438). Rompe la regla "sin scroll horizontal entre 320 y 1280" de `AGENTS.md` | Medido en `admin.oneburgernic.com/admin/cash` @375; responsable `[role=group][aria-label="Sucursal de la caja"]` (426px, botón "Casa Antigua" hasta 434px) → `cash-client.tsx:142-155` + `tabs.tsx:23,63-80` (`whitespace-nowrap` + `px-3` por botón) | **medido** |
| **A-40** | bug (navegación) | P2 | El cajero ve "Ver el turno abierto" y el detalle lo redirige a Órdenes → enlace muerto para el rol que lo ve | `cash-drawer-panel.tsx:240-247` → `history/[id]/page.tsx:60-62` | probado por código (no reproducido con rol cajero: crear la cuenta es una mutación) |
| **A-41** | deuda (densidad) | P2 | La altura no tiene techo: la lista embebida renderiza **todos** los turnos de la sucursal, sin límite ni paginación | `list-location-shifts.ts:25` + `prisma-shift-repository.ts:225-231` (sin `take`) + `cash-client.tsx:227`. Medido: 91 turnos = 10 607px @1280 y 18 133px @375 (13,3 y 22,7 pantallas); 86px por fila @1280 / 162px @375 | **medido** |
| **A-42** | deuda (semántica) | P2 | Dos "diferencia" con alcances distintos y etiquetas casi iguales; la "acumulada" cambia de significado con el tab `Cierres`/`Todos` sin decirlo | `day-close-panel.tsx:91-97` vs `cash-client.tsx:117-119,218-221` | medido (código) |
| **A-43** | deuda (jerarquía) | P2 | El bloque más alto de la página (historial, 86% del alto a 1280) no tiene encabezado, y los 4 `<h2>` pesan igual (20px/700). La cabecera mide **186px = 23,3%** del viewport a 375 (la regla del sistema es ≤20%; a 1280 mide 114px = 14,2%) | Medido §G.4; regla en `ops/references/stitch/design-system.md:195-196`; `AdminPageHeader` en `admin-operational-ui.tsx:77-97` | **medido** |
| **A-44** | deuda (robustez) | P3 | `loadShift` no chequea `response.ok` (un 401/500 se dibuja como "Sin caja abierta") y nunca limpia el `error` previo | `cash-drawer-panel.tsx:78-93` (comparar con `reconciliation-panel.tsx:72` y `cash-client.tsx:94`, que sí chequean) | medido (código) |
| **A-45** | deuda (tamaño) | P3 | 396 líneas sobre un techo de 400 | `history/[id]/page.tsx` | medido |
| **A-46** | deuda (jerarquía) | P3 | El primer viewport @1280 lo ocupa la operación del cajero ("Abrir o cerrar la caja" 642px de 800 + "Corte X" 173px): el owner/manager que entra a auditar ve primero el trabajo del mostrador; el historial arranca en 1455px | Medido §G.4 | **medido** |

**Observaciones que NO son bugs** (para que no se lean como hallazgos):

- `GET /api/auth/admin/session` devuelve **401** durante el login (2 veces en local, 1 en producción);
  es esperado: `login/page.tsx:21-38` y `admin-shell.tsx:42` consultan la sesión **antes** de que exista.
  Después del login, **todas** las llamadas del panel devuelven 200 (medido).
- En `next dev` cada `fetch` del panel se dispara **dos veces** (StrictMode de React); no ocurre en
  producción (medido: una vez por endpoint).
- **Componentes huérfanos: ninguno.** `payment-mix-panel`, `cash-movements-panel`, `cash-movement-form`,
  `shift-reopen-form`, `shift-close-sheet-button` y `shift-handovers-list` se usan desde
  `history/[id]/page.tsx:18-30,359-393` y `cash-shift-handover-panel.tsx:245`.
- **Deuda de tokens: cero** en `cash/`: `src/shared/config/design-tokens.allow.json` no tiene ninguna entrada
  de `src/app/(admin)/admin/cash/**` (la única congelada es `(public)/activity/order-history-views.tsx`).

---

## G. Mediciones reales

Método y condiciones en §I. **Local** = `127.0.0.1:3111` (1 sucursal `loc_principal`, 91 turnos cerrados, 1
caja abierta, ningún turno de hoy). **Producción** = `admin.oneburgernic.com` (3 sucursales, 3 cierres, sin
caja abierta). Viewport de alto 800px en ambos casos.

### G.1 Altura por bloque

| Bloque | Alto @1280 (local) | Alto @375 (local) | Alto @1280 (prod) | Alto @375 (prod) | Scroll interno | Comentario |
|---|---|---|---|---|---|---|
| Cabecera (`AdminPageHeader`) | 114 | 186 | NO MEDIDO | NO MEDIDO | no | Mismo componente; en producción no se repitió su medición. **186px = 23,3% del viewport a 375** (regla ≤20%) |
| 1. Turno — `Caja del local` (incluye Corte X) | 816 | 1096 | 554 | 754 | **no** | En prod no hay caja abierta → 554px y **sin** bloque de traspaso |
| ↳ Corte X y traspaso (dentro de 1) | 330 | 410 | no se dibuja | no se dibuja | no | Se dibuja solo con caja abierta (`cash-drawer-panel.tsx:251`) |
| 2. Cierre del día | 134 | 198 | 216 | 311 | no | Estado **vacío** en las dos ("Todavía no hay turnos abiertos hoy…") + 1 fila (local) / 3 filas (prod) de comparación en ceros |
| 3. Conciliación | 299 | 359 | 377 | 437 | no | — |
| 4. Historial (lista embebida) | **9124** | **16118** | 503 | 876 | **no** | 91 filas × 86px (local) / 3 filas × 87px (prod). A 375: 91 × 162px |
| **Total de la página** | **10 607** | **18 133** | **1884** | **2740** | — | Con `vh=800`: **13,3** y **22,7** pantallas (local); **2,35** y **3,42** (prod) |

**Cortes útiles** (medidos, no estimados): sin el historial, el resto de la página ocupa **1455px @1280** y
**1919px @375** en local (arranque del bloque 4). Es decir: **el "~1800px" del brief corresponde a producción
con pocos cierres** (prod @1280 = 1884px), y a 375 **el resto de la página ya mide 1919px sin contar el
historial**. La cifra no es estructural: crece 86px por cierre @1280 y 162px @375 (§F-A41).

### G.2 Scroll horizontal y desborde a 375px

| Entorno | `documentElement.scrollWidth` | Viewport | ¿Scroll horizontal? | Elementos que desbordan |
|---|---|---|---|---|
| Local (1 sucursal) | 375 | 375 | **No** | Ninguno (0 elementos con `right > vw`) |
| **Producción (3 sucursales)** | **438** | 375 | **SÍ (63px)** | `div[role=group][aria-label="Sucursal de la caja"]` → **426px** (los 3 botones); el botón "Casa Antigua" llega a `right=434` |

A 1280 no hay scroll horizontal en ninguna de las dos.

### G.3 Tiempo de carga (TTFB / DCL / load, ms)

| Entorno | TTFB | DCL | load |
|---|---|---|---|
| Local @1280 (`next dev`) | 294 | 337 | 481 |
| Local @375 (`next dev`) | 216 | 271 | 373 |
| Producción @1280 | 229 | 264 | 468 |
| Producción @375 | 249 | 266 | 476 |

**Advertencias de método**: local corre en `next dev` (Turbopack, compilación on-demand): **no es comparable
con producción**, y se vio en la práctica — la **primera** pasada a 1280 midió el bloque de turno en 90px
porque el `fetch` seguía en vuelo mientras Turbopack compilaba la API; en la pasada con espera explícita
midió 816px. Los números de producción (una réplica, sin caché de borde) son los comparables.

### G.4 Jerarquía visual (geometría medida; no se guardó captura por la regla de un solo archivo)

@1280 (local, 10 607px totales):

| Bloque | Alto | % de la página | Posición |
|---|---|---|---|
| Turno (Caja del local) | 816 | 7,7% | 158 → 974 |
| Cierre del día | 134 | 1,3% | 990 → 1124 |
| Conciliación | 299 | 2,8% | 1140 → 1439 |
| Historial | 9124 | **86,0%** | 1455 → 10 579 |

- **Primer viewport @1280 (0-800px)**: cabecera 114px + "Caja del local" **642px** + "Corte X y traspaso"
  **173px**. Lo primero que ve alguien que entra a auditar es **abrir/cerrar la caja**, que es la tarea del
  cajero.
- **Primer viewport @375 (0-800px)**: cabecera 186px + "Caja del local" **582px**; el bloque del turno
  termina en 1314px.
- **Bloque más prominente: el historial** (86% del alto), y es el único **sin encabezado** (§A.3).
  Los cuatro `<h2>` comparten tamaño y peso, así que visualmente **nada indica cuál es el sujeto principal**.

### G.5 Contraste de KPIs

**Calculado desde los tokens** (WCAG 2.1, luminancia relativa; `globals.css:466-503` + composición alfa sobre
el lienzo `#000f21`; los tonos son los de `AdminMetricStrip`, `admin-operational-ui.tsx:15-53`):

| Elemento | Color de texto | Fondo compuesto | Ratio | AA (4,5:1) |
|---|---|---|---|---|
| KPI neutral — etiqueta | `--text-secondary` `#94a3b8` | `--bg-surface-card` `#132438` | **6,13:1** | ✅ |
| KPI neutral — valor | `--text-primary` `#f8fafc` | `#132438` | **15,01:1** | ✅ |
| KPI warning ("Sin contar") | `--status-pending-text` `#38bdf8` | `rgba(56,189,248,.12)` → `#07243b` | **7,40:1** | ✅ |
| KPI danger ("Diferencia…" ≠ 0) | `--status-sla-text` `#f87171` | `rgba(239,68,68,.2)` → `#301a28` | **5,82:1** | ✅ |
| KPI success | `--status-ready-text` `#34d399` | `rgba(16,185,129,.12)` → `#02232d` | **8,53:1** | ✅ |
| Historial — "Cuadra" | `#34d399` | `#132438` | 8,17:1 | ✅ |
| Historial — "Falta" | `#f87171` | `#132438` | 5,68:1 | ✅ |
| Historial — "Sobra" | `#f59e0b` | `#132438` | 7,31:1 | ✅ |
| Historial — "Sin contar" (`--text-muted`) | `#8296ad` | `#132438` | 5,17:1 | ✅ |

**Medido en pantalla** (color computado real, local @1280 y @375): la franja del historial renderizó los 4
KPIs con tonos `neutral` (`rgb(148,163,184)` etiqueta / `rgb(248,250,252)` valor sobre `rgb(19,36,56)`) y
`warning` (`rgb(56,189,248)` sobre `rgba(56,189,248,0.12)`), que coinciden con lo calculado.

**NO MEDIDO en pantalla**: los tonos **danger** y **success** de los KPIs — no había ningún descuadre ni
sobrante en los datos de local ni de producción, así que esos estados no se dibujaron. Y el KPI
**"Diferencia del día"** (`day-close-panel.tsx:91`) **nunca se renderizó** en ninguna de las dos: las dos
bases no tenían turnos de **hoy**, así que el bloque mostró su estado vacío. El contraste de esos casos es el
**calculado desde tokens** de la tabla de arriba.

---

## H. Preguntas abiertas para el owner

1. **"Cierre del día" en la pantalla de caja**: ¿se elimina del bloque de caja en favor de
   `/admin/cash/report` (que ya hace lo mismo para cualquier fecha, §B.4) o se mantiene "hoy" y entonces son
   **4** secciones?
2. **Historial: ¿se unifica?** ¿La lista embebida de `/admin/cash` desaparece y queda solo
   `/admin/history/cierres` (llevándose el CSV y el rango abierto→cerrado, §B.3), o se mantienen las dos?
3. **Diferencia**: ¿cuál es el número oficial — el del día (todas las sucursales) o el acumulado por
   sucursal? ¿Y "acumulada" debería decir el período (mes / todo / el tab activo)? (§B.2)
4. **Cajero**: ¿debe poder **firmar traspasos** (hoy puede, §C.1) y **ver el detalle de su turno abierto**
   (hoy el enlace lo rebota, §F-A40)?
5. **A-39 (P1)**: ¿se arregla el desborde a 375 del selector de sucursal del historial en una tarea aparte?
6. **Techo del historial (A-41)**: ¿paginación, "últimos N", o filtro por fecha dentro de la pantalla?
7. **Registro de hallazgos**: el brief de esta ronda prohíbe tocar `ops/audit-backlog.md`; `START-HERE.md`
   §1b lo pide. Los IDs tentativos van en §F. ¿Querés que los registre en la próxima ronda?
8. **Evidencia visual**: no se guardó ninguna captura (el único archivo es este). Si querés el PNG de 1280 y
   de 375, decilo y los adjunto en `ops/tasks/audit-ui/` como archivos aparte.

---

## I. Apéndice de método

**Estático** (sin navegador): lectura de los 24 archivos de `src/app/(admin)/admin/cash/**`,
`src/app/(admin)/admin/history/**`, `src/app/api/admin/cash/**`; `glob` de rutas para verificar qué existe
(así se descartó `/admin/cash/history` como listado); LOC exactas con
`(Get-Content -LiteralPath $f).Count`; permisos leídos en `admin-permissions.ts` y en las guardas de API;
contrastes calculados con la fórmula WCAG 2.1 (luminancia relativa + composición alfa) sobre los tokens de
`globals.css`.

**Navegador**: `npm run dev -- --hostname 127.0.0.1 --port 3111` con
`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/oneburger?schema=public`, `APP_ENV=dev`,
`ADMIN_LOGIN_RATE_LIMIT=200`. Playwright 1.62.1 (Chromium) **en un script inline** (`node -e`, sin crear
archivos): login por el formulario (el único POST autorizado) y después **solo GET** a `/admin/cash` a
1280×800 y 375×800, esperando explícitamente la lista del historial y el botón del turno antes de medir
(2,5s de margen para los `fetch` de los paneles cliente). Se midieron `documentElement.scrollHeight`,
`scrollWidth` vs `innerWidth`, los `getBoundingClientRect()` de cada bloque con `aria-label`, el color
computado de los KPIs y `performance.getEntriesByType("navigation")`.

**Datos leídos (solo lectura) para caracterizar las bases**: `SELECT` sobre `Location`, `AdminUser` y `Shift`
en el Postgres local (1 sucursal, 1 cuenta owner, 92 turnos). En producción no se leyó la base: todo salió
del render de la pantalla.

**Estado final**: server local **apagado**, contexto de producción cerrado (cookie descartada, sin `logout`
porque es un POST). No se commiteó nada. `next dev` reescribió `next-env.d.ts` (apunta a
`.next/dev/types/*`); se restauró con `git checkout` para dejar el árbol como estaba.
