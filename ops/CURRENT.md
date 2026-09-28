# CURRENT.md — estado operativo actual

**Qué es este archivo**: la fuente de verdad **operativa y actual**. Un agente nuevo tiene que entender
en qué estado está el sistema en pocos minutos.

**Qué NO va acá**: historia (va a [`history/`](history/)), procedimientos (van a
[`.agents/skills/`](../.agents/skills/)) ni arquitectura (va a
[`.agents/CONTEXT.md`](../.agents/CONTEXT.md)). Este archivo se **actualiza seguido** y se mantiene
corto: si crece como un diario, dejó de servir.

> **Última actualización**: 2026-09-27, por **`TASK-ORDERS-KITCHEN-FOUNDATIONS-001`** (fundaciones de
> `Pedidos / Cocina`: auditoría real, ownership, reuse audit, specs y Design Freeze, `docs-only`: **cerrada y
> mergeada, sin deploy**), después del release de **`SCREEN-POS-QUICK-SALE-001.2`** (corrección final del
> ticket, **desplegado**; ver §1 y §4). **POS Fase 1 queda CERRADA DEFINITIVAMENTE** y **«POS Fase 2» dejó de
> existir como fase**: su contenido se reparte en el [roadmap maestro](roadmap/PRODUCT-UX-ROADMAP.md) §2
> órdenes 4 a 7 y 10. **`Pedidos / Cocina` ya no es una incógnita**: quedó auditado y con **dos specs
> congeladas** ([`design/screens/orders.md`](design/screens/orders.md) y
> [`design/screens/kitchen.md`](design/screens/kitchen.md)) y sus **referencias aprobadas por el owner el
> 2026-09-27**. **Vigente: el Default E2E Delivery Contract**
> ([`.agents/skills/delivery-e2e/SKILL.md`](../.agents/skills/delivery-e2e/SKILL.md)). **La fase de
> estabilización técnica sigue cerrada**, con una excepción nueva y acotada en dinero: **`A-68`** (el cobro de
> un pedido existente compara montos sin la conversión canónica) es la razón declarada para consolidar
> Money/Payments **antes** de conectar el estado financiero definitivo de Pedidos. Lo que sigue es
> **Cocina runtime** (orden **3b**), y **no se abre sin autorización del owner**.

---

## 1. Producción

| Qué | Estado |
|---|---|
| **Último deploy** | `build-20260927-193653`, sobre `4f69a24` (`main` con el cierre definitivo de POS Fase 1: PR #69, #70 y #71), 2026-09-27 19:37 UTC. `/api/health` = `build-20260927-193653`, `/api/readiness` `ready` (DB 2 ms), smokes **menú 7/7** y **hosts 6/6**, y **QA autenticada en producción** a `1366×768`, `1280×720`, `768×1024` y `375×812` (§4). **Sin backup manual**: no hay migración ni cambio de datos |
| **`main`** | `4f69a24` (PR #71, squash) — el commit que está en producción. CI verde en cada push a `main` (los cuatro checks + `publish`) |
| **Migración aplicada en este deploy** | **Ninguna**: el release es de pantalla. La última sigue siendo `20260925120000_add_payment_void`, aplicada el 2026-09-25 |
| **Rollback target** | `build-20260926-170322` sobre `be4c051` (Venta rápida, `SCREEN-POS-QUICK-SALE-001`) — la aplicación se revierte revirtiendo el commit en `main` y volviendo a disparar `deployService`; la base no se toca (ninguno de los dos releases migró) |
| **Modelo de deploy** | Easypanel, proyecto `brunobot`, servicio `oneburguerweb`; build **desde GitHub `main`** con `forceRebuild`. Una sola llamada a `deployService` (la llamada puede cortar por timeout y el build sigue en segundo plano: comportamiento conocido) |
| **Migraciones** | Este release no trae ninguna. La última es `20260925120000_add_payment_void` (A-59), aditiva y sin backfill, aplicada por el arranque |
| **Réplicas** | `1` |
| **Backup pre-deploy** | **El owner generó un backup manual de la base** (confirmado el 2026-09-26) aunque el release no lo exigía —no hay migración ni cambio de datos—. El hallazgo `A-57` (el backup **programado** no genera archivos y no hay retención declarada) **sigue abierto** y es del owner; el archivo **no se pudo verificar** desde acá (el panel de Easypanel responde **401** sin token) |
| **Hosts activos** | `oneburgernic.com` y `www` (landing + redirects 307) · `menu.oneburgernic.com` (app de pedidos) · `admin.oneburgernic.com` (panel) |
| **Health / readiness** | `GET /api/health` (versión del build) · `GET /api/readiness` (`SELECT 1`, 503 si la base no responde) |
| **Base de datos** | PostgreSQL 17 en `oneburguer-postgres` (sin puerto expuesto: `exposedPort=0`) |
| **Datos de negocio** | 3 sucursales reales (Camino de Oriente, Carretera Masaya, Casa Antigua). La carta la sigue cargando el owner |
| **Caja en producción** | Sin terminales de caja cargadas al momento del último QA: es el estado real del negocio, no un defecto |

✅ **QA autenticada de producción del POS (2026-09-27, hecha sobre el build final `build-20260927-193653`)**:
la pantalla se abrió **en producción con sesión** a los cuatro viewports del contrato (`1366×768`, `1280×720`,
`768×1024`, `375×812`), con la **carta real del local** (2 productos sin modificadores). Medido en el
navegador: **una sola** superficie con scroll dentro del ticket en los cuatro; **ninguna fila cortada**;
**cero scroll horizontal**; `Cobrar C$…` siempre visible; y a `1366×768` y `1280×720` la **forma de pago entra
sin scrollear** (`pagoOffset 0`) y el **scroll de página es 0**.

⚠️ **`375×812` es el único con scroll de página (155 px)**: es el comportamiento de la referencia aprobada —la
vista primaria es el catálogo y el ticket vive en el sheet—. Health, readiness y los dos smokes **7/7** y
**6/6** en §1. Las credenciales se usaron solo por entorno y **no** se guardan en el repo.

✅ **Venta real cobrada en producción (2026-09-26)**: además del contrato de viewport se ejercitó el flujo
completo con una venta de mostrador de verdad —`COCA COLA` (el primer producto **sin** modificadores de la
carta: con uno con modificadores el selector intercepta el «+»)—, cliente `QA POS Fase 1` / `8888-8888`,
efectivo con «Exacto», y en el medio apareció el bloqueo real de caja: el `Cobrar` estaba **deshabilitado** con
la tarjeta `Caja cerrada`, así que se abrió el turno (autorizado por el owner) y el cobro salió
**`Venta P-MUIW4IS4 cobrada por C$44.57 · Sin cambio`**. Queda un **turno abierto** en Camino de Oriente desde
las 03:15 p.m. con fondo C$0.00, cuyo efectivo esperado es **C$44.57**: lo cierra el owner desde `/admin/cash`
(la venta no se puede borrar: es un pedido real).

⚠️ **Lo que la verificación de este release NO pudo hacer desde acá**: los **logs del contenedor** no son
accesibles por API (`inspectAction`/`getActionLogs`/`inspectServiceLogs` responden 404, así que la búsqueda de
`P2002`/`P2028`/`25P02`/deadlock/5xx queda pendiente) y no se ejercitó la presencia de `voidedAt` con lectura
autenticada (sí la aplica el contenedor al arrancar). El POS se verificó además **antes** del deploy contra una
base local con la suite E2E completa (`admin-pos` 11/11 con mutaciones, capturas en
[`design/screens/`](design/screens/)).

⚠️ **Hallazgo operativo (sigue abierto): el backup programado no genera archivos.** La config está
`enabled: true` (cron `0 0 * * *`) y carpeta `oneburguer`, pero las **únicas** acciones de backup del servicio
son **tres** desde siempre: las dos del drill (2026-09-12) y la manual del release anterior. El respaldo
programado **no produjo ningún archivo** y **no hay retención declarada** → `A-57` en el backlog.
📋 **A-50/A-51 (pasada read-only, sin reparar nada)**: **A-51** — los **5** cierres tienen `expectedAmount`
firmado y **ninguno** tenía retiros ni devoluciones, así que la fórmula de AUD-005 **no altera ningún número
histórico**; el detalle de `ShiftBankClose` es **no determinable** (producción no tiene bancos). **A-50** — **no
identificable** desde la API: requiere leer la base. **No reparado.**


**Integraciones**

| Integración | Estado |
|---|---|
| Telegram (alertas del negocio: cierre de turno, devolución grande, diferencia de caja) | Configurada y probada en producción con un cierre real |
| Avisos de pedido a cocina (Telegram) | **En pausa por decisión del owner**; el driver por defecto es `dummy` |
| OTP de WhatsApp (login del cliente) | **Sin proveedor real**: `/api/customer/auth/request-otp` responde 503 |
| n8n (webhooks) | Variables presentes; el canal se elige por entorno |

## 2. Capacidades activas

- **Público**: home, menú, detalle de producto, carrito, checkout **solo para retirar**, confirmación,
  seguimiento del pedido y «Mi actividad». Retiro programable (hora del día o día futuro). Multi-sucursal
  con menú y precios por local. Propina opcional (desmarcada). Pago en el local.
- **Panel**: comandas/KDS (tres carriles, urgencia por etapa, auto-refresh, aceptar/rechazar, búsqueda y
  filtros), POS de mostrador (catálogo real, modificadores, cobro y vuelto), Caja (turno, arqueo por
  moneda, cierres, aprobaciones, configuración), Historial (cierres y facturas), Menú (categorías,
  productos, modificadores, bloques), Promociones, Locales, Usuarios y Personalización del negocio.
- **Arqueo ciego**: el `cashier` cobra y cierra el turno **sin ver el esperado**; Manager y Owner
  mantienen el arqueo completo. Es una regla de **servidor**.
- **Fuera del MVP** (código presente, no ofrecido en UI ni en APIs públicas): reservas, mesas, delivery,
  inventario y reportes avanzados.

## 3. Riesgos abiertos

Severidad: **P0** (pérdida de datos o de plata en producción) · **P1** (rompe una invariante de dinero o
filtra datos) · **P2** (función rota, fuga o deuda estructural con impacto).

> **No hay ningún P0 abierto conocido.**
>
> **Hay un P1 de dinero abierto y acotado**: `A-68` (el cobro de un pedido que ya existe compara
> `Payment.amount` **sin** la conversión a moneda del negocio, mientras la venta del POS **sí** convierte).
> **No hay superficie** que lo dispare hoy (`A-67`): se llega sólo por API. Es la razón declarada para
> consolidar **Money/Payments antes** de conectar el estado financiero definitivo de Pedidos. `A-15` (con su
> remanente `A-59`) quedó **cerrado** el 2026-09-25 y `A-58` antes. El otro P1 abierto es **operativo**
> (`A-57`, el backup programado), que por decisión del owner **no** bloquea el trabajo de producto.

**P1**

| Riesgo | Detalle | Dónde |
|---|---|---|
| **El cobro de un pedido que ya existe compara montos sin convertir** | `register-order-payment.ts:124-140` compara la **suma cruda** de `Payment.amount` contra `Order.total` (y recibe `businessCurrencyCode`/`usdExchangeRate` que **no usa**), mientras la venta del POS **sí** convierte (`pos-sale.ts:50-74`). Con un cobro en dólares, un pedido de `C$365` acepta `US$10` como «10 pagados» y deja cobrar otros `C$355`: se cobra de más. **Hoy no hay superficie** que lo dispare (`A-67`): se llega sólo por API. Es la **razón declarada** para consolidar Money/Payments **antes** de conectar el estado financiero de Pedidos | `A-68` en [`audit-backlog.md`](audit-backlog.md) |
| **El backup programado no genera archivos** | La config del servicio `oneburguer-postgres` está `enabled: true` (cron `0 0 * * *`) pero el respaldo programado **nunca** produjo un archivo: las únicas acciones de backup son las dos del drill (2026-09-12) y la manual del release anterior (2026-09-25 12:27), y **no hay retención declarada**. Es **materia de infraestructura/operación**: requiere revisar la sección Backups del panel y decidir retención — no es código y **no bloquea** el trabajo de producto. Mientras tanto: el **backup se decide por riesgo del release**, no por frecuencia ([`delivery-e2e`](../.agents/skills/delivery-e2e/SKILL.md) §4) | `A-57` en [`audit-backlog.md`](audit-backlog.md) |

**P2**

| Riesgo | Detalle | Dónde |
|---|---|---|
| **Ventas anteriores al arreglo de atomicidad (AUD-004)** | El bug que se cerró pudo dejar, **antes del deploy del fix**, pedidos con menos `Payment` que los declarados (o con **cero**) y cupones consumidos por ventas que no se cobraron. El cambio garantiza la invariante **de acá en adelante** y **no** las detecta ni las repara (sin backfill ni migración, a propósito): una venta parcial vieja subcuenta la caja. Repararlas es **decisión del owner**; el conteo es de solo lectura | `A-50` en [`audit-backlog.md`](audit-backlog.md) · TASK-AUD-004 § *Datos previos* |
| **`A-17` — pendiente de reproducir (probablemente obsoleta)** | El texto original decía que la tarjeta no se reportaba al cerrar y que transferencia no se podía cobrar. **Verificado en el código: ya no aplica** — el POS cobra `cash`/`card`/`transfer`/`other` (`POS_PAYMENT_METHODS`) y el cierre **congela** `cardSalesAmount`, `transferSalesAmount` y `otherSalesAmount`. Falta **reproducir** si sobrevive algún resto antes de tomarla | `A-17` en [`audit-backlog.md`](audit-backlog.md) |
| **Entorno de producción fail-closed** | El arranque no debe degradarse en silencio si falta una variable crítica | TASK-AUD-007 |
| **Aislamiento de endpoints internos/de staging** | Deben ser inalcanzables fuera del entorno que les corresponde | TASK-AUD-008 |
| **Lease y recuperación del outbox** | Un evento tomado y no confirmado no debe quedar colgado para siempre | TASK-AUD-009 |
| **Semántica de entrega del outbox** | Definir y probar at-least-once y su idempotencia | TASK-AUD-010 |
| **Controles crudos en el admin** | ~100 controles que todavía no son primitivos, con techo declarado por archivo | `A-24` |
| **`settings-client.tsx` de 951 líneas** | Muy por encima del techo de 400 | `A-26` |
| **Rama `feat/design-system` de otro dev** | Verificarla antes de tocar el sistema de diseño (el rediseño del menú público sigue pausado) | `A-36` |
| **La home del panel no existe para roles sin Resumen** | `/admin` redirige a `/admin/orders`: un `manager` o una `kitchen` no eligen sección | `A-10` |

**P3 relevante**: `A-09` (el actor del cambio de estado no se muestra) · `A-11` (timeouts de la QA de
solo lectura) · `A-12` (filtro «solo sin aceptar») · `A-13` (módulos cascarón `coupons` y
`table-ordering`) · `A-14` (mapeo de errores repetido) · `A-16` y `A-18` (**revisar: pueden estar
obsoletos**, ver §5) · `A-19` (movimientos de caja) · `A-20`/`A-34` (fiscal y RUC) · `A-22` (deuda de UI
sin guardrail) · `A-23` (cuenta de prueba con rol `owner` en producción) · `A-25` · `A-27` · `A-28` ·
`A-30` · `A-33` · `A-69` (reglas de dinero duplicadas: `shift-refund` y el `"NIO"` hardcodeado) ·
`A-70` (la factura sin puerta de rol ni alcance por sucursal; la anulación no se imprime) · `A-71` (el cobro
de un pedido existente sin clave de idempotencia).

## 4. Trabajo actual

**`TASK-ORDERS-KITCHEN-FOUNDATIONS-001` — fundaciones de `Pedidos / Cocina` (CERRADA, `docs-only`, sin
deploy)**: sacó del chat y **versionó** la auditoría real de las dos superficies contra el código, el
**ownership** —quién posee el pedido, su canal de origen, sus tiempos, el dinero, el documento y la
autorización, registrado en `ops/product/MODULE_ARCHITECTURE.md` §5—, la matriz
`REUSE / ADAPT / CONSOLIDATE / NEW / MISSING / OUT` y las **dependencias** entre `orders`, `locations`,
`money`, `payments`, `invoices` y `auth`. Dejó **dos specs congeladas**
([`design/screens/orders.md`](design/screens/orders.md) —Pedidos: listado + detalle— y
[`design/screens/kitchen.md`](design/screens/kitchen.md) —Cocina—) con sus **referencias aprobadas por el
owner el 2026-09-27**, y registró **cuatro hallazgos nuevos** (`A-68` a `A-71`). Corrigió premisas obsoletas:
la spec de Órdenes afirmaba que «no se pide ningún dato nuevo / no hay `FALTA`» y **hay seis**. **No tocó
runtime, DB, migraciones, APIs, navegación ni pantallas.**

**Lo que sigue es `Cocina runtime`** (orden **3b** del roadmap): `/admin/kitchen` como **proyección de
`orders`**, con el carril de `confirmed` corregido, el canal de origen y la puerta que impide que el dinero
llegue a cocina. `Resumen` sigue en el orden 16 y **«POS Fase 2» dejó de existir como fase**. **`DS-001`** (ley
visual v4, en [`ops/design/`](design/)) está **aprobado y desplegado**; **`IA-001`** (navegación del panel)
también; **`SCREEN-ORDERS-001`** fue la **primera sección rediseñada de punta a punta** y
**`SCREEN-POS-QUICK-SALE-001`** la segunda ([`design/screens/pos-quick-sale.md`](design/screens/pos-quick-sale.md)).

**Los cierres anteriores ya no viven acá**: el detalle —reproducción, límite atómico, mutaciones y evidencia—
se movió a [`history/cierres-2026-09.md`](history/cierres-2026-09.md) cuando este archivo llegó a su techo de
**250 líneas**. Ahí están `AUD-003..008`, `A-54`/`A-55`/`A-58`/`A-59`, `SCREEN-POS-QUICK-SALE-001.x`,
`SCREEN-ORDERS-001`, `ARCH-001`, `TASK-GOV-001`, `TASK-AUD-004` y los baselines superados; acá queda la
**línea de estado**: el bloque financiero está cerrado y desplegado, y la estabilización técnica sigue cerrada
salvo el P1 acotado `A-68` (§3).

## 5. Siguiente trabajo

La secuencia la manda el **[roadmap maestro de producto y UX](roadmap/PRODUCT-UX-ROADMAP.md)** §2 (16 órdenes);
la inmediata, [`roadmap/NEXT.md`](roadmap/NEXT.md). El **programa de remediación técnica** —hallazgos `A-*`,
con objetivo, prioridad, riesgo y dependencia— sigue en
[`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md): son dos cosas distintas y **no se
duplican**.

**Release de `SCREEN-POS-QUICK-SALE-001.2` (2026-09-27, cerrado — POS Fase 1 cerrada definitivamente)**:
`main` = `4f69a24` **desplegado** sirviendo `build-20260927-193653`, con el ticket de **un solo scroll**, el
total en el pie y la QA autenticada de producción en los cuatro viewports (§1). Reabrió POS Fase 1 **solo**
para el defecto del ticket; **sin migraciones, sin dominio y sin backup**.

Lo que sigue, en orden:

1. **`Cocina runtime`** (orden **3b** del roadmap): **no iniciado**. `/admin/kitchen` como proyección de
   `orders` —mapa canónico de carriles, sellos por etapa, `Order.source` (migración aditiva), `canOperateKitchen`
   y el recorte financiero del servidor—. **`high-risk-e2e`**. El alcance exacto, el runtime que puede tocar y
   lo que tiene prohibido duplicar están en [`roadmap/NEXT.md`](roadmap/NEXT.md). **No se inicia sola.**
2. **Money / Payments ownership** (órdenes 4 y 5) y después **`Pedidos runtime`** (orden **5b**): el estado
   financiero canónico (`pending` / `partial` / `paid`) tiene dueño propio **antes** de que el listado y el
   detalle lo muestren. **No se inician solas.**
3. **Pedido existente → Cobrar en POS** (orden 6): **compone** el backend que ya existe
   (`POST /api/admin/orders/[id]/payment`); no lo reconstruye. Cierra `A-67`. Después **Cash ownership** (7).
4. **Deuda de Pedidos/Cocina (`A-60` a `A-71`)** y después `AUD-009`/`AUD-010`, `AUD-012`/`AUD-013`/`AUD-014`.
5. `A-57` (backup programado) es **infraestructura**: el owner decide y no bloquea el producto. Y **higiene
   pendiente del owner**: revocar la cuenta de QA anterior y **rotar el `EASYPANEL_TOKEN`**.

> ⚠️ **Dos correcciones al brief de la auditoría, verificadas en el repo**: **A-45 ya está cerrado**
> (2026-09-23, el arqueo ciego es regla de servidor: `src/app/api/admin/pos/shift/shift-arqueo-role-filter.ts`),
> así que TASK-AUD-003 debe **verificar** que no queden caminos que filtren el esperado, no reimplementarlo; y
> **el informe de auditoría que originó este roadmap no está versionado**: los títulos de `TASK-AUD-004` a
> `TASK-AUD-017` vienen del brief del owner y su evidencia se reproduce al abrir cada TASK.

> **Dos entradas del backlog a revisar antes de agarrarlas**: `A-16` («no hay historial de cajas») y la segunda
> mitad de `A-18` («`Payment` no tiene `shiftId`») parecen **obsoletas** —el historial existe en
> `/admin/history/cierres` y la Fase 6 de Caja agregó `shiftId`—. Se confirman al abrir su TASK, no acá.

## 6. Bloqueos

Solo bloqueos **reales**. Todo lo demás es trabajo pendiente.

| Bloqueo | Qué lo desbloquea |
|---|---|
| **Carta incompleta en producción** | El owner carga categorías, productos, precios y fotos desde `/admin/menu` |
| **Dos datos mal cargados en los locales** | El owner corrige en `/admin/locations` (el slug de Camino de Oriente y la ciudad de Casa Antigua) |
| **Monitoreo externo inexistente** | El owner elige el servicio; la receta está en el runbook §8.5 |
| **Puertos expuestos de servicios ajenos** | OK de quien administra esos servicios del panel compartido |
| **Decisiones de producto pendientes** | Respuesta del owner sobre `A-19`, `A-20`/`A-34` y `A-23` (ver el backlog). `A-17` **no** está acá: se reproduce primero. `A-15` **ya no está**: quedó cerrada con `A-58` y `A-59` |

## 7. Referencias

- Reglas y límites: [`../AGENTS.md`](../AGENTS.md)
- Cómo está construido el sistema: [`../.agents/CONTEXT.md`](../.agents/CONTEXT.md)
- Conocimiento estable aprendido: [`../.agents/MEMORY.md`](../.agents/MEMORY.md)
- Procedimientos: [`../.agents/skills/`](../.agents/skills/)
- Cola de hallazgos: [`audit-backlog.md`](audit-backlog.md)
- **Roadmap maestro** (`ops/roadmap/PRODUCT-UX-ROADMAP.md`):
  [`roadmap/PRODUCT-UX-ROADMAP.md`](roadmap/PRODUCT-UX-ROADMAP.md) — secuencia inmediata en
  [`roadmap/NEXT.md`](roadmap/NEXT.md)
- Arquitectura de producto: [`product/MODULE_ARCHITECTURE.md`](product/MODULE_ARCHITECTURE.md)
- Programa de remediación: [`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md)
- Runbook de producción: [`production-readiness.md`](production-readiness.md)
- Punto de entrada de una sesión: [`tasks/START-HERE.md`](tasks/START-HERE.md)
- Historia: [`history/`](history/)
