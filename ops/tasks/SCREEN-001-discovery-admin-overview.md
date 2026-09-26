# SCREEN-001 — DISCOVERY: `/admin` Resumen

> **Fase**: DISCOVERY únicamente. **No hay diseño, ni implementación, ni cambios de runtime** en esta TASK.
> Este documento es la radiografía del estado **real** de la pantalla para que el owner diseñe antes de
> implementar.
>
> **Método**: lectura del código en `main` = `3b219f9` (read-only), con `ruta:línea`. Nada de lo que sigue es
> una propuesta: es lo que hay.
>
> **Fuera de alcance, por pedido explícito**: no se inventan KPI, no se crean `Ventas`/`Productos`/`Analytics`,
> no se decide layout, no se crean charts, no se toca navegación y **no se corrige** la deuda que aparece acá
> (se documenta).
>
> **Fuentes normativas que se respetan**: [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)
> (Resumen es un **overview transversal** que no absorbe ownership) y [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md)
> (ley visual v4). El proceso de la sección es [`../../.agents/skills/screen-design/SKILL.md`](../../.agents/skills/screen-design/SKILL.md).

---

## 0. Resumen ejecutivo (lo que el owner necesita saber de entrada)

1. **La pantalla es de un solo rol**: `/admin` solo la ven **`owner`**; cualquier otro rol es redirigido a
   `/admin/orders` (`page.tsx:8-15`, `admin-permissions.ts:179-181`).
2. **Consume tres lecturas HTTP** y ninguna más: rendimiento del período, rendimiento de hoy y el listado de
   pedidos de hoy (`admin-overview-client.tsx:207,244,259`).
3. **Solo hay tres métricas**: valor de órdenes completadas, cantidad de órdenes completadas y ticket
   promedio; las tres con comparación contra el período anterior (§5).
4. **No lee nada de Caja/Cierres.** El "Turno de hoy" del hero **no es un turno de caja**: se arma con pedidos
   (`client:243-269`). No hay import de `shift`, `pos` ni `cash-config` en el árbol de la pantalla.
5. **No hay dimensión por sucursal** en la API ni en el dominio de métricas: las tres métricas son del
   **negocio entero** (`grep locationIds src/modules/dashboard` = 0).
6. **El umbral de "atrasadas" del Resumen no es el del KDS**: usa los defaults (10/15 min → *late* 15/20) en vez
   de la config por local, y mide el atraso **desde la creación del pedido**, no desde el cambio de etapa
   (`admin-overview-turno-summary.ts:27,70-74` vs `orders/page.tsx:500`). Dos semáforos para la misma operación.
7. **Tres APIs del módulo `dashboard` están vivas pero sin pantalla**: `dashboard/summary`,
   `activity/recent` y `reports/daily` (nadie las consume; §4).
8. **El canal está fijo en la UI**: solo "Todos" y "Retiro"; `delivery` existe en el enum pero **no hay camino
   vivo que cree pedidos delivery** (`client:110-114`, `api/orders/route.ts:61`).
9. **Hay dos cosas que el Resumen ya declara como limitación**: el valor **no equivale a pagos liquidados**
   (`client:75`) y el ranking de productos **excluye los pedidos con devoluciones** (`admin-overview-metrics.ts:189-196`).
10. El Resumen **ya es un overview**: muestra señales y manda a las secciones dueñas (`/admin/orders`,
    `/admin/pos`, `/admin/menu`), que es exactamente la regla de `MODULE_ARCHITECTURE.md` §6.
11. **El punto del hero pulsa con cualquier señal de atención** (`turno.tsx:91-92`), no solo con SLA vencido:
    contradice la ley visual de motion (`MOTION.md`: el pulso es para SLA vencido o desincronización).
12. **La pantalla no está cubierta por ninguna medición en navegador**: `/admin` no está en el E2E de la
    cabecera (20 % del alto) ni en ningún spec de `scrollWidth`, y su único E2E está salteado salvo
    `E2E_ALLOW_MUTATIONS=true`. Lo único medido hoy es el contrato textual de clases. Hay un **riesgo
    calculado** de scroll horizontal en la fila de *Período* a 375 px (§14) y ~2 px de margen en el alto de
    la cabecera a 375×800.

---

## 1. Qué construye la pantalla

| Archivo | Líneas | Rol |
|---|---:|---|
| `src/app/(admin)/admin/page.tsx` | 15 | Página servidor: `requireAdminSession()` + `canViewAdminOverview`; si no, `redirect("/admin/orders")` |
| `src/app/(admin)/admin/_components/admin-overview-client.tsx` | 482 | **Cliente**: estado, los tres fetch, filtros, secciones y estados |
| `.../admin-overview-turno.tsx` | 176 | Hero "Turno de hoy" (ventas del día + carriles + señales de atención) |
| `.../admin-overview-turno-summary.ts` | 80 | **Dominio de pantalla**: carriles y atraso (`summarizeTurno`) |
| `.../admin-overview-metric-card.tsx` | 121 | Tarjeta de KPI (valor, delta, sparkline, nota) |
| `.../admin-overview-sparkline.ts` | 53 | Serie de la tarjeta (÷ valor/cantidad) |
| `.../admin-overview-trend-chart.tsx` | 209 | Tendencia (barras de valor + línea de cantidad + tabla accesible) |
| `.../admin-overview-chart.ts` | 112 | Matemática del gráfico (escala, paths) |
| `.../admin-overview-top-products.tsx` | 95 | Ranking de productos (top 5) |
| `.../admin-overview-cocina.tsx` | 140 | Carriles de cocina + acciones rápidas |
| `.../admin-overview-formatters.ts` | 45 | Formato de delta, enteros y rango de período |
| `.../admin-overview-payload.ts` | 143 | Validación zod de la respuesta de la API |
| `.../admin-overview-request.ts` | 63 | Fetch con abort/redirect/errores |
| `src/modules/dashboard/features/get-admin-overview-performance/get-admin-overview-performance.ts` | 125 | **Caso de uso** que consulta Prisma |
| `src/modules/dashboard/domain/admin-overview-metrics.ts` | 232 | **Fórmulas** de las métricas, series y top productos |
| `src/modules/dashboard/domain/admin-overview-periods.ts` | 239 | Rangos, zona horaria y buckets |
| `src/modules/dashboard/domain/admin-overview.types.ts` | — | Tipos de la respuesta |
| `src/app/api/admin/overview/performance/route.ts` | 65 | **Ruta** `GET`, zod, autorización y zona del negocio |

**Las tres lecturas** (y no hay más: `grep '/api/admin'` en el árbol da solo estas):

1. `/api/admin/overview/performance?period=<periodo>&channel=<canal>` — `client:207`.
2. `/api/admin/overview/performance?period=today&channel=all` — `client:243-246` (ventas de hoy).
3. `/api/admin/orders?dateFrom=<inicio del día del negocio>` — `client:259` (carriles, SLA y preparación promedio).

`Actualizar` (`client:325-334`) sube un nonce que re-dispara las tres (`client:231,281`).

---

## 2. Secciones visibles, en orden (texto literal)

| # | Sección | Texto / contenido actual | Dónde |
|---|---|---|---|
| 1 | Cabecera | label **"Operación · Métricas en vivo"**, título **"Resumen"**, descripción **"Rendimiento de los pedidos para retirar en el período seleccionado."** + botón **"Actualizar"** | `client:320-335` |
| 2 | Hero "Turno de hoy" | chip **"Turno de hoy · Ventas"** + **"En curso"**; monto en `font-mono` + código de moneda; delta **"{x} vs. ayer"**; frase **"Todo en orden: nada requiere atención inmediata."** / **"{n} frente(s) necesita(n) atención ahora mismo."**; tres mini-tarjetas **"Activas"** (*En cocina y listas*), **"Nuevas"** (*Por confirmar*), **"Atención"** (*SLA < 20 min*); lista **"Necesita atención · {n}"** (vacío: *"Nada pendiente: la cocina viene al día."*) | `turno.tsx:52-165`, `client:337-344` |
| 3 | Filtros | **"Período"** (Hoy · 7 días · 30 días · Este mes) y **"Canal"** (Todos · Retiro) | `client:346-389`, opciones `:103-114` |
| 4 | Indicadores | **"Indicadores del período"** + **"Comparación contra el período inmediatamente anterior."** + chip de rango en `font-mono tabular-nums` | `client:407-424` |
| 5 | Tarjetas KPI | **"Valor de órdenes completadas"** (nota *"No equivale a pagos liquidados"*) · **"Órdenes completadas"** · **"Ticket promedio"**; pie **"Período: {rango}"**; delta **"{±x} % vs. período anterior"** o **"Sin base de comparación"** | `client:66-95`, `metric-card.tsx:105-116`, `formatters.ts:17-23` |
| 6 | Tendencia | **"Tendencia de órdenes completadas"** + rango; leyenda **"Barras: valor completado"** / **"Línea: órdenes completadas"**; frase **"No se registraron órdenes completadas en este período."** o **"{n} orden(es) completada(s) por {C$x}."**; `<details>` **"Ver datos del gráfico"** con tabla **Período / Valor / Órdenes** | `trend-chart.tsx:42-48,57-74,165-188` |
| 7 | Cocina + acciones | **"Estado de cocina"** + *"Cómo viene el flujo de retiro, etapa por etapa."*; carriles **"Por aceptar"** (*Sin confirmar*) / **"En preparación"** (*En cocina*) / **"Listas"** (*Para retirar*); **"Preparación promedio de hoy: {n} min"** o **"sin datos todavía"**; enlace **"Ir al KDS"**; y **"Acciones rápidas"** + *"Lo que se resuelve desde el mostrador."* | `cocina.tsx:11-29,56-98,111-136` |
| 8 | Top productos | **"Productos más vendidos"** + *"Top 5 por unidades en órdenes completadas."*; por fila: **"{i}. {producto}"**, **"{n} unid."**, **"Valor completado: {C$x}"** con barra proporcional (`role="progressbar"`) | `client:472` → `top-products.tsx:36-79` |

---

## 3. Endpoints consumidos (con su puerta y su dueño)

| Endpoint | Puerta server-side | Devuelve | Dueño del dato |
|---|---|---|---|
| `GET /api/admin/overview/performance` | `canViewAdminOverview` → **owner** (403 si no; 401 sin sesión; 400 con params inválidos) | `{data:{metrics,series,topProducts}, meta:{generatedAt,timeZone,period,channel,ranges}}` | `dashboard` (read model) sobre `orders` |
| `GET /api/admin/orders?dateFrom=` | `canManageOrderOperations` → owner/manager/**kitchen**; alcance por local | `{data: AdminOrder[], meta:{count,averagePrepMinutes,locationIds,locationScope}}` | `orders` |

Detalles que importan para el diseño:

- El `where` de la métrica consulta **solo `Order`** (más `Refund` aprobado como relación) y una **única
  ventana** que es la unión del período actual y el anterior (`get-admin-overview-performance.ts:47-60`).
- El listado de pedidos trae **todas** las órdenes del día del negocio, **sin límite** (`prisma-order-repository.ts:478-486`),
  y la pantalla las clasifica en el cliente.
- La respuesta se **valida con zod** antes de pintarse (`admin-overview-payload.ts:102-143`): rechaza conteos
  negativos, fechas locales irreales y `utcStart >= utcEnd`.
- La ruta **no** filtra por sucursal ni por el alcance del usuario (hoy el único rol que entra es `owner`,
  cuyo alcance es "todas").

---

## 4. APIs del módulo `dashboard` que existen y **no** tienen pantalla

| Endpoint | Qué devuelve | Estado |
|---|---|---|
| `GET /api/admin/dashboard/summary` | `{ordersToday, ordersPending, reservationsToday, reservationsPendingAction, inventoryCriticalAlerts, recentActivityCount}` (incluye **reservas** e **inventario**, fuera del MVP; "hoy" con el reloj del servidor) | **Viva, sin consumidor** |
| `GET /api/admin/activity/recent` | items unificados de órdenes + reservas + inventario (límite 1..100, default 20) | **Viva, sin consumidor** |
| `GET /api/admin/reports/daily` | `{orders:{totalCount,totalRevenue,byStatus}, reservations:{...}}` | **Viva, sin consumidor ni página** |

Son candidatas a **descartar** (no a revivir: reservas e inventario están fuera del MVP y `MODULE_ARCHITECTURE.md`
no las ofrece en navegación ni en APIs públicas). No se proponen como fuente de nada.

---

## 5. Métricas: fórmula, fuente, período, comparación y scope

> **Semántica económica única** (`admin-overview-metrics.ts:58-97`): el valor de un pedido es su **neto**
> (`total − devoluciones aprobadas`, nunca negativo) y un pedido con neto 0 **no cuenta como venta**.

| Métrica | Fórmula exacta | Fuente | Período | Comparación disponible | ¿Scope por sucursal? |
|---|---|---|---|---|---|
| **Valor de órdenes completadas** (`completedOrderValue`) | `Σ netOrderValue(order)` sobre los pedidos **vendidos** del rango; `netOrderValue = roundCurrency(total − Σ Refund.amount aprobados)`, con `net > 0 ? net : 0` | `Order.total` + `Refund` **aprobados** | El elegido (`today\|7d\|30d\|month`); por defecto **7d** | `changePercent = (current − previous) / previous × 100` contra el período anterior de igual longitud (`null` si `previous = 0`) | **NO** (negocio entero) |
| **Órdenes completadas** (`completedOrderCount`) | Cantidad de pedidos **vendidos** del rango (`countsAsSale`): sin devoluciones siempre cuenta; con devoluciones solo si el neto `> 0` | `Order` (estado terminal) + `Refund` aprobados | Ídem | Ídem | **NO** |
| **Ticket promedio** (`averageTicket`) | `count === 0 ? 0 : Σ neto / count` (promedio **por pedido**, no por ítem ni por día) | Derivada de las dos anteriores | Ídem | Ídem | **NO** |

**Reglas que definen "pedido completado"** (a respetar tal cual, es una sola fuente):

- Estados terminales = **`delivered`, `picked_up`, `served`, `closed`** (`admin-overview-metrics.ts:13-18`).
- La fecha del pedido para el rango es la **primera** vez que entró a un estado terminal
  (`getFirstCompletionAt`, `:31-52`), comparada en UTC contra el rango semiabierto `[utcStart, utcEnd)`.
- `type === "table"` queda **siempre** fuera; el canal filtra `delivery`/`pickup` (`:127-129`).
- Devoluciones: **solo `Refund` con `status = "approved"`**; no se lee ningún "void/reversal" (no existe como
  modelo aparte; la anulación de un cobro es otra cosa y **no** entra acá).

**Bordes ya resueltos** (no hay que reinventarlos): `previous = 0` → `changePercent = null` y la UI pinta
**"Sin base de comparación"** (`formatters.ts:17-23`); división por cero del ticket → `0`, no `null`; la suma
total no se redondea (solo cada neto individual).

---

## 6. Períodos, comparaciones y buckets

| Período | Rango actual | Rango anterior | Buckets de la serie |
|---|---|---|---|
| `today` | hoy (día del negocio) | ayer | **24** horas (`label` `HH:00`) |
| `7d` | hoy − 5 días → hoy | los 7 días inmediatamente anteriores | 7 días (`label` `MM-DD`) |
| `30d` | hoy − 29 → hoy | los 30 anteriores | 30 días |
| `month` | día 1 del mes → hoy | mismo tramo del mes anterior, recortado al último día de ese mes | un día por día |

- **Zona horaria**: la del **negocio** (configuración), obligatoria; los offsets se resuelven con `Intl` y dos
  pasadas para el cambio de horario (`admin-overview-periods.ts:81-110`).
- **Comparación**: siempre *período anterior de igual longitud* (o *month-to-date* contra el mes anterior). No
  hay comparación contra el año anterior, ni contra presupuesto, ni entre sucursales.

---

## 7. Top productos y otros agregados disponibles

| Agregado | Qué trae | Límite | Fuente |
|---|---|---|---|
| **Top productos** | `{productId, productName, units, completedOrderValue}` agregado por producto del período | **Sin límite en la API**; la pantalla muestra **5** (`client:316`) | Pedidos **vendidos sin devoluciones** (los pedidos con cualquier devolución aprobada se excluyen **enteros**, por limitación declarada: el modelo no guarda qué ítem se devolvió) |
| **Serie** | por bucket: `completedOrderValue` y `completedOrderCount` | — | Solo pedidos del rango actual |
| **Preparación promedio de hoy** | `averagePrepMinutes` = promedio de `readyAt − createdAt`, descartando negativos y `> 240` min | `null` sin datos | `order-stage-times.ts:48-88` vía `/api/admin/orders` |
| **Carriles de cocina** | nuevas / en preparación / listas / abiertas / tardadas | — | Derivados en el cliente del listado de hoy |

**No existen** (explícito): desglose por sucursal, por cajero o por medio de pago; comparación por canal;
buckets por producto; ventas por hora comparadas contra otro día; ticket por sucursal; ninguna métrica de
caja/arqueo; ninguna proyección.

---

## 8. Pedidos abiertos / atrasados: de dónde salen

- **Origen**: `GET /api/admin/orders?dateFrom=<medianoche local del día del negocio>` (`client:116-121,258-259`).
- **Clasificación** (`admin-overview-turno-summary.ts:29-36`): `pending = {new}` · `preparing = {confirmed, accepted, preparing, out_for_delivery}` ·
  `ready = {ready, ready_for_pickup}`; cualquier otro estado se ignora. `abiertas` = suma de los tres.
- **Atraso**: `resolveComandaUrgency({ stageChangedAt: order.createdAt, nowMs, ...umbrales })`, es decir **desde
  la creación del pedido**. Umbrales: `comandaThresholds({})` → **defaults 10/15 min** ⇒ *late* a **15 min**
  (por aceptar) y **20 min** (cocina).
- **Divergencia real con el KDS** (documentada, no se corrige acá): el KDS pasa la config del local
  (`orders/page.tsx:500-503`) y mide desde el **cambio de etapa** (`order-stage-times.ts:30-38`). El mismo
  pedido puede estar "tardado" en el Resumen y no en Órdenes.
- **Señales de atención** (las únicas acciones contextuales del hero): `nuevas > 0` → *"N orden(es) nueva(s) sin
  confirmar · La cocina aún no las ve · confirmalas desde Órdenes"* y `tardadas > 0` → *"N orden(es) pasó los 20
  min en curso · Revisá qué las está atrasando"*, ambas con destino **`/admin/orders`** (`client:287-307`).

---

## 9. Caja / Cierres: qué puede consultarse **sin duplicar reglas**

- **Hoy el Resumen no consulta nada de caja** (grep de `cash|shift|cierre` en el árbol: solo un comentario).
- Lo que **existe** y es de las secciones dueñas, con su puerta y su alcance:

| Consulta | Endpoint | Puerta | Alcance | Dueño |
|---|---|---|---|---|
| Turnos/cierres de los locales del alcance | `GET /api/admin/cash/shifts` | `canManageCash` (owner/manager) | por `locationIds` del usuario | **Caja** (`orders`/`pos`) |
| Detalle de un turno | `GET /api/admin/cash/shifts/[id]` | `requireCashShift` → `canManageCash` | local | Caja |
| Estado del turno del local | `GET /api/admin/pos/shift` | `canUsePOS` + local con POS | local | POS/Caja |
| Conciliación | `GET /api/admin/cash/reconciliation` | `canManageCash` | local | Caja |
| Cierres para el Historial (multi-local) | `GET /api/admin/history/cierres` | `canViewHistory` (owner/manager) | alcance completo | Caja/Cierres |
| Config del arqueo (monedas, denominaciones) | `GET /api/admin/cash/config` | `canManageCashConfig` (owner) | — | `cash-config` |

- **Regla de arquitectura a respetar** (`MODULE_ARCHITECTURE.md` §6): el Resumen puede **leer** y **mostrar una
  señal** de caja (p. ej. "hay un cierre con diferencia"), pero el detalle y la resolución son de **Caja/Cierres**;
  el Resumen **no** recalcula arqueos ni diferencias.
- **Hoy no hay** una lectura "liviana" pensada para un overview: las consultas de caja existentes son de la
  sección (por local, con sus puertas). Cualquier señal de caja en Resumen necesitaría **una lectura nueva de
  Caja**, no una regla nueva en Resumen. Es decisión de producto, no de esta TASK.

---

## 10. Sucursal: qué existe y qué falta

| Qué | Estado |
|---|---|
| Métricas por sucursal | **DATO NO DISPONIBLE**: la API y el dominio no aceptan ni aplican `locationId`; los pedidos se agregan para todo el negocio |
| Filtro de sucursal en la pantalla | **NO EXISTE** (los únicos filtros son período y canal) |
| Dato de sucursal por pedido | **SÍ existe** en el modelo (`Order.locationId`) y el listado de pedidos ya resuelve alcance por local (`resolveOrderListLocationIds`) |
| Locales como entidad dinámica | **SÍ** (`locations`, configurables; `MODULE_ARCHITECTURE.md` §9 exige que las superficies que consumen locales se adapten **por datos**) |
| Comparación dinámica por sucursal (roadmap) | **FALTANTE**: hoy no hay serie, total ni comparación por local |

---

## 11. Roles

| Rol | Ve Resumen | Qué pasa si entra |
|---|---|---|
| `owner` | **Sí** | Es su pantalla de inicio (`homeHref = "/admin"`) |
| `manager`, `kitchen`, `cashier` | **No** | `page.tsx` los redirige a `/admin/orders`; la API responde **403** |
| Sin sesión | No | **401** (la ruta) / redirección al login (la página) |

Nota: la navegación **sí** ofrece `Órdenes` a todos los roles, y el ítem `Resumen` solo se dibuja para el
owner (`admin-layout-helpers.ts:56,202`). A-10 sigue abierto por esto (los roles sin Resumen no eligen sección).

---

## 12. Links y acciones actuales

| Elemento | Tipo | Destino |
|---|---|---|
| `Actualizar` (cabecera) | acción | re-consulta las tres lecturas (mismo nonce que el turno) |
| Señal "N nuevas sin confirmar" | navegación | `/admin/orders` |
| Señal "N pasó los 20 min en curso" | navegación | `/admin/orders` |
| `Ir al KDS` (bloque cocina) | navegación | `/admin/orders` |
| `Nueva orden de mostrador` (acción rápida) | navegación | `/admin/pos` |
| `Editar el menú` (acción rápida) | navegación | `/admin/menu` |
| Filtros Período/Canal | acción (estado local, recarga datos) | — |
| `Reintentar` (solo en error) | acción | re-consulta |

**No hay** accesos a Caja, Cierres, Locales, Usuarios ni Configuración desde Resumen, y **no hay** acciones que
modifiquen datos (la pantalla es de solo lectura).

⚠️ **Redirect heredado**: cuando la API responde **403**, `runAdminOverviewRequest` manda a
**`/admin/inventory`** (`request.ts:14`) — una sección **fuera del MVP** y sin navegación. Desde Resumen es
inalcanzable (solo el owner pasa el guard), pero es una salida vieja que sigue escrita.

---

## 13. Estados actuales

| Estado | Qué se ve |
|---|---|
| **Cargando (rendimiento)** | `OverviewSkeleton` con `role="status"` y `aria-label="Cargando rendimiento"`, `animate-pulse` + `motion-reduce:animate-none` (`client:123-138,395`) |
| **Cargando (turno/hero)** | El hero se dibuja con `loading` propio (`client:341`) |
| **Error (rendimiento)** | Bloque `role="alert"` con borde/fondo/estado **SLA** y el texto **"No se pudo cargar el rendimiento del período seleccionado."** + botón **"Reintentar"** (`client:140-152,396-401`) |
| **Error (turno y cocina)** | **Best-effort**: si falla, no hay mensaje; el hero queda con "—" y los carriles en 0 (`client:240-277`) |
| **Vacío (sin datos en el período)** | Las métricas se muestran en **0** (no hay estado vacío explícito); el gráfico dice **"No se registraron órdenes completadas en este período."** y **"Todavía no hay dos puntos para dibujar la tendencia."** en cada tarjeta; el ranking dice **"Sin productos completados"** / *"Todavía no existen órdenes completadas con productos en el período seleccionado."* (`top-products.tsx:87-88`) |
| **Sin base de comparación** | El delta muestra **"Sin base de comparación"** (`formatters.ts:19`) |
| **Sin datos de preparación** | **"sin datos todavía"** (`cocina.tsx:96`) |
| **Sin permiso** | No se llega: redirección (página) o 403 (API). El 403 del cliente manda a `/admin/inventory` (`request.ts:14`, ver §12) |
| **401 de la API** | `window.location.assign("/admin/login")` (`request.ts:13`, `client:221`) |
| **Sin sesión** | `requireAdminSession()` lanza `AuthError(401)`; `page.tsx` no lo captura (lo resuelve el shell/login) |
| **Accesibilidad** | `aria-labelledby` por sección, leyenda y `<title>/<desc>` del SVG, tabla accesible plegada, `role="status"` al terminar de cargar (`client:474-476`) |

**Huecos de estado**: no hay `loading.tsx` ni `error.tsx` en la ruta (`src/app/(admin)/admin/` solo tiene
`not-found.tsx`); el error del turno/cocina **se traga** (`catch` vacíos, `client:253-255,271-273`) y deja el
hero con "…" y la frase "Todo en orden" con 0 frentes; en error de rendimiento **sobreviven** cabecera, hero y
filtros, y desaparecen KPIs, gráfico, cocina, acciones y top 5 (`client:402-478`).

---

## 14. Comportamiento 375 / 768 / 1280

| Aspecto | 375 | 768 | 1280 |
|---|---|---|---|
| Contenedor | `space-y-5` | `md:space-y-6` | igual que 768 |
| Filtros | una columna; cada filtro `grid-cols-[3.5rem_1fr]` (label + tabs) | igual | `lg:grid-cols-[1.3fr_0.7fr]` (período y canal lado a lado) |
| Tarjetas KPI | 1 columna | `sm:grid-cols-2` | `xl:grid-cols-3` (3 en línea) |
| Cocina + acciones | apiladas | apiladas | `lg:grid-cols-[1.6fr_1fr]` |
| Gráfico | SVG fluido + tabla plegada en `<details>` | ídem | ídem |
| Cabecera | `AdminPageHeader` compacto (título 20 px, descripción recortada a 2 líneas, acción `w-full`) | escala de tablet (título 24 px) | escala completa; la descripción deja de recortarse en `lg` |
| Riesgo de scroll horizontal | **Candidato calculado (no medido)**: la fila de **Período** con 4 opciones. Ancho útil ≈335 px − etiqueta 56 − gaps ≈ 251 px para el `TabsList` ⇒ ≈63 px por opción, mientras "30 días"/"Este mes" necesitan ~71–80 px y el primitivo es `whitespace-nowrap`; nada en la cadena recorta el overflow | — | — |
| Cobertura de esa medición | **`/admin` NO está** en el E2E que mide la cabecera (`tests/e2e/admin-page-header-height.spec.ts`) ni en ningún spec que mida `scrollWidth`; el único E2E que toca Resumen (`tests/e2e/admin.spec.ts:90-101`) está **salteado** salvo `E2E_ALLOW_MUTATIONS=true` | | |
| Estimación del 20 % de alto (aritmética con las clases y textos, **sin medir en navegador**) | ≈ **158 px vs techo 160 px** a 375×800 (≈2 px de margen: el `w-full` del bloque de acciones obliga a envolver) | ≈110 px vs 204,8 | ≈110 px vs 180 |

---

## 15. Datos hardcodeados / no configurables en la pantalla

| Dato fijo | Dónde | Debería venir de |
|---|---|---|
| Títulos, unidades (`pedidos`, `prom / orden`), tonos (`amber`/`sky`), iconos y la nota *"No equivale a pagos liquidados"* | `client:66-101` | Son etiquetas de UI (legítimas); la **nota** es una advertencia de significado, no un dato |
| Etiquetas de período y canal (Hoy/7/30/Este mes; Todos/Retiro) | `client:103-114` | Fijas por decisión de MVP (canal fijo, sin delivery) |
| **Top 5** de productos | `client:316` | Número de pantalla, no configurable |
| Umbrales de atraso **10/15 → late 15/20** | `admin-overview-turno-summary.ts:27` + `comanda-helpers.ts:138-139` | **Config por local** (`acceptAlertMinutes`/`prepAlertMinutes`), que existe y **no se lee acá** |
| Período por defecto **7d** y canal por defecto **all** | `api/overview/performance/route.ts:13-14` | Decisión de producto |
| Textos del hero y de las señales (incluido "pasó los 20 min en curso") | `client:293-306` | El número sale del umbral; el texto está fijo |
| **`animate-pulse` del punto del hero** | `turno.tsx:91-92`: se enciende con **cualquier** señal de atención (`attention.length > 0`), incluida "nuevas sin confirmar" | La ley visual (`DESIGN_SYSTEM.md` §21 / `MOTION.md`) lo reserva para **SLA vencido o desincronización** |
| **Locale `es-NI` (×3) y `timeZone: "UTC"`** para el rango de fechas | `formatters.ts:1,6,10,14` | El idioma es del producto (aceptable); la zona de un rótulo de fechas debería ser la del negocio |
| Geometría fija del gráfico (720×240, padding 20/28/8/28, barra 2–24 px, máx. 7 etiquetas) y de la sparkline (100×32) | `chart.ts:32-48,75`, `sparkline.ts:12-13` | Números del componente (aceptable); las guías `x1="28"`/`y=20+…` están escritas a mano en el SVG (`trend-chart.tsx:92-98`) |
| Comentario "las tres tarjetas del Resumen son sky" | `metric-card.tsx:19` | El código marca la primera **amber** (`client:72`) y las otras dos sky: **comentario y código no coinciden** |
| Moneda y zona horaria | **No** hardcodeadas: salen de `useBusinessSettings()` y de la config del negocio | ✓ correcto |
| Sucursales | **No** aparecen en la pantalla (no hay filtro ni comparación) | — |

---

## 16. Dependencias de otros módulos (según `MODULE_ARCHITECTURE.md`)

| Capacidad que el Resumen toca | Módulo **dueño** | Cómo la consume hoy | ¿Duplica reglas? |
|---|---|---|---|
| Pedidos (estado, tipo, total, items, historial) | `orders` | **Prisma directo** desde el feature de `dashboard` | **Sí, parcialmente**: reimplementa la lectura (no usa puertos de `orders`). Deuda ya registrada en `MODULE_ARCHITECTURE.md` §12.3 |
| Devoluciones aprobadas (neto) | `orders` (`Refund`) | **Prisma directo** (`refunds` con `status: "approved"`) | La **regla** del neto vive una sola vez y es de `dashboard` (dominio); el dato crudo lo lee directo |
| Preparación promedio / atraso de cocina | `orders` (+ `pos` para el POS) | Vía `/api/admin/orders` (sí usa el caso de uso de `orders`) | **Sí, divergente**: los umbrales del Resumen no son los del KDS (§8) |
| Configuración del negocio (zona horaria, moneda) | `business-settings` | `getBusinessSettings` (ruta) y `useBusinessSettings` (UI) | No |
| Locales | `locations` | **No los lee** (no hay dimensión por sucursal) | — |
| Catálogo (productos) | `menu` | Solo nombres/valores **snapshot** dentro del pedido (`OrderItem.productName`, `lineTotal`) | No (no consulta el catálogo) |
| Caja / cierres / arqueo | `Caja` (`orders`/`pos`/`cash-config`) | **No lee nada** | — |
| Métricas y reportes (read models) | `dashboard` | Es su dueño | — |
| Usuarios y roles | `auth` | Solo la puerta `canViewAdminOverview` | No |

**Regla que el rediseño no puede romper**: `Resumen` **muestra señales**; las secciones dueñas **muestran y
resuelven el detalle** (`MODULE_ARCHITECTURE.md` §6). Un dato del Resumen **no** crea un módulo ni una sección
nueva, y las reglas de pedidos, dinero y caja **no se reimplementan** acá.

---

## 17. Clasificación elemento por elemento

| Elemento actual | Clase | Por qué |
|---|---|---|
| Cabecera (`Resumen` + descripción + `Actualizar`) | **ÚTIL** | Título, alcance del período y refresco manual: lo mínimo para orientarse |
| Hero "Turno de hoy" (ventas del día + delta) | **ÚTIL**, pero **MAL NOMBRADO** | El dato es de **pedidos**, no de un turno de caja: el nombre sugiere caja y puede confundir (no se corrige acá) |
| Carriles del hero (nuevas / en preparación / listas) | **REDUNDANTE** | Es un espejo del KDS con **otro umbral** y **otro reloj**; para operar está `/admin/orders` |
| Señales de atención (**nuevas**, **tardadas**) con destino a Órdenes | **ÚTIL** | Es exactamente la ley del overview: señal + acceso a la sección dueña |
| Filtros Período / Canal | **ÚTIL** (canal **cuasi-muerto**) | Período se usa; canal tiene una sola opción real (`Retiro`) porque `delivery` no tiene camino vivo |
| KPI "Valor de órdenes completadas" | **ÚTIL** con **nota necesaria** | El número no es plata cobrada; la nota lo declara |
| KPI "Órdenes completadas" | **ÚTIL** | Volumen del período |
| KPI "Ticket promedio" | **ÚTIL** | Derivada consistente |
| Sparkline por tarjeta | **ÚTIL** | Tendencia dentro del período elegido, con "sin datos" cuando no alcanza |
| Gráfico de tendencia (barras + línea + tabla accesible) | **ÚTIL** | Responde "cómo evoluciona" con los valores exactos disponibles |
| Bloque Cocina (carriles + preparación promedio) | **REDUNDANTE / MAL UBICADO** | Duplica el KDS en una pantalla de señales; el promedio de preparación es **operación**, no overview |
| Acciones rápidas (POS, Menú) | **SIN CONTEXTO** en un overview | Son atajos de navegación, no señales; el sidebar ya las ofrece |
| Top 5 productos | **ÚTIL** | Es un agregado comercial legítimo del período (no un módulo "Productos") |
| Estados de error/loading/vacío | **ÚTIL** (con hueco) | El error de rendimiento existe; el **turno falla en silencio** y no hay vacío explícito de métricas |
| `dashboard/summary`, `activity/recent`, `reports/daily` | **LEGACY** (API viva sin pantalla) | Incluyen reservas e inventario (fuera del MVP) y usan el reloj del servidor |
| Canal `delivery` en la API y en el enum | **LEGACY** | Sin camino vivo que cree pedidos delivery |
| Umbral de atraso hardcodeado (10/15 → 15/20) | **MAL UBICADO** | Existe config por local y el Resumen la ignora |
| Atraso medido desde `createdAt` | **CONTRADICTORIO** con el KDS | Mismo concepto, dos definiciones |
| `animate-pulse` del punto del hero cuando hay "nuevas" | **CONTRADICTORIO** con la ley visual | El pulso está reservado a SLA vencido o desincronización (`MOTION.md`) |
| Redirect del 403 a `/admin/inventory` | **LEGACY** | Una sección fuera del MVP y sin navegación |
| Nombres `text-st-*` y `chart-1`/`chart-2` en la pantalla | **LEGACY (nomenclatura)** | Design System v4 los declara históricos; los canónicos son `text-panel-*` y `chart-primary/secondary`. Se migra **por sección**, no en bloque |
| Tabla del gráfico con `tabular-nums` sin `font-mono` | **MAL UBICADO (menor)** | La ley pide los números en mono tabular |
| `div` interno de la barra sin `aria-hidden` (el comentario dice que sí) | **deuda menor** | Hoy el `role="progressbar"` del padre lo vuelve presentacional igual |
| Sin `loading.tsx`/`error.tsx` y error del turno tragado | **deuda** | El usuario no distingue "no hay pedidos" de "no se pudo leer" |
| 6 componentes del Resumen sin test propio | **deuda de cobertura** | Hay contrato textual sobre el cliente, pero no testes de `turno`, `metric-card`, `cocina`, `top-products`, `trend-chart` ni del cliente |
| Lectura por Prisma directo en `dashboard` | **LEGACY/deuda** | Registrada en `MODULE_ARCHITECTURE.md` §12.3 (no se arregla acá) |
| Métricas / comparaciones **por sucursal** | **DATO NO DISPONIBLE** | No hay dimensión por local en el read model |
| Señal de **caja/cierres** | **DATO NO DISPONIBLE sin lectura nueva** | Existe el dato y su sección dueña; el Resumen no tiene lectura propia |
| Cualquier KPI de margen, proyección, conversión o "ventas" como sección | **FUERA DE ALCANCE** | No existe el dato defendible y el roadmap prohíbe inventarlo |

---

## 18. Preguntas que el owner tiene que resolver antes de diseñar (no las resuelve esta TASK)

1. **Alcance del Resumen**: ¿se queda en **pedidos** (lo que hay hoy) o incorpora **señales de caja** (para lo
   cual hace falta una lectura nueva de Caja, con su puerta)?
2. **Sucursal**: ¿el Resumen muestra el negocio entero, o necesita filtro/comparación por local? (Hoy el dato
   **no** está disponible en el read model; agregarlo es trabajo de datos, no de pantalla.)
3. **Carriles de cocina en Resumen**: ¿se mantienen como señal (y entonces hay que unificar umbral y reloj con
   el KDS) o se delegan a Órdenes?
4. **Nombre del hero**: si el dato es de pedidos, ¿"Turno de hoy" es el nombre correcto?
5. **Canal**: ¿se retira del Resumen mientras `delivery` no tenga camino vivo?
6. **Ticket promedio**: ¿sigue siendo "por pedido" o el negocio espera "por persona/ticket" con otro
   significado? (Cambiarlo cambia la fórmula, no el layout.)
7. **Comparación**: ¿alcanza con "período anterior de igual longitud" o el negocio quiere comparar contra el
   mismo día de la semana pasada?

---

## 19. Qué NO hizo esta TASK

- **No** se modificó ni un archivo de runtime: ni pantalla, ni componente, ni API, ni dominio, ni tokens, ni
  navegación.
- **No** se inventaron KPI, no se crearon `Ventas`/`Productos`/`Analytics`, no se decidió layout, no se
  dibujaron charts nuevos.
- **No** se corrigió ninguna de las divergencias encontradas (umbral/reloj vs KDS, canal muerto, carriles
  redundantes, Prisma directo): quedan **documentadas** para que el owner decida.
- La evidencia es de **código**, no de la base: qué hay en producción (p. ej. si existen pedidos `delivery`
  históricos) no es verificable en read-only sin acceso a datos.

---

## 20. Siguiente paso (del proceso, no de esta TASK)

Con este documento, el camino de `SCREEN-001` es: **decisión del owner sobre §18** → arquitectura de la sección
e information architecture → UX → **spec de pantalla** en `ops/design/screens/admin-overview.md` (plantilla
[`../design/screens/TEMPLATE.md`](../design/screens/TEMPLATE.md)) → aprobación → implementación con
[`ui-change`](../../.agents/skills/ui-change/SKILL.md). **Nada de eso se inició.**
