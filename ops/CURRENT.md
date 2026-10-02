# CURRENT.md — estado operativo actual

**Qué es este archivo**: la fuente de verdad **operativa y actual**. Un agente nuevo tiene que entender
en qué estado está el sistema en pocos minutos.

**Qué NO va acá**: historia (va a [`history/`](history/)), procedimientos (van a
[`.agents/skills/`](../.agents/skills/)) ni arquitectura (va a
[`.agents/CONTEXT.md`](../.agents/CONTEXT.md)). Este archivo se **actualiza seguido** y se mantiene
corto: si crece como un diario, dejó de servir.

> **Última actualización**: 2026-10-01, por **POS operativo del cajero** (`TASK-ORDER-POS-OPERATIONAL-006`,
> `high-risk-e2e`, **orden 6**, ACTIVE). `/admin/pos` pasa a ser el **workspace operativo** del cajero:
> `PosOperationalOrdersProjection` sirve los cuatro KPI **desde el servidor**, un panel operacional
> reutilizable resuelve los cuatro modos, el pedido existente se abre **inmutable** desde Órdenes
> (`/admin/pos?orderId=`) y se cobra en un **checkout completo atómico y exacto**, y la entrega
> `ready_for_pickup → picked_up` gana la puerta nominal `canDeliverOrder`. Antes: **Pedidos runtime**
> (`TASK-ORDERS-RUNTIME-5B`, orden 5b, cerrada). **Vigente: el Default E2E Delivery Contract**
> ([`.agents/skills/delivery-e2e/SKILL.md`](../.agents/skills/delivery-e2e/SKILL.md)).

---

## 1. Producción

| Qué | Estado |
|---|---|
| **Último deploy (producción)** | `build-20261001-032835`, desplegado el 2026-10-01 con **una sola** llamada a `deployService` (`forceRebuild: true`) sobre `main` = `ccb63bf` — **Pedidos runtime** (`TASK-ORDERS-RUNTIME-5B`, PR #103). Las **tres** superficies sirven esa versión (`/api/health`) y `/api/readiness` responde `ready` (db 2 ms); smokes **menú 7/7** y **hosts 6/6** revalidados **después** del deploy. Sin migraciones nuevas: el arranque no tocó la base |
| **Commit desplegado en producción** | `ccb63bf` — **coincide con `main`**: el `sha` configurado en el servicio lo confirma (`inspectService`), leído después del deploy |
| **QA de producción de este release** | **Hecha, con sesión real**: la QA autenticada de Pedidos en los **cuatro** viewports (`orders-visual-check`, **8/8**: sin scroll horizontal, cabecera y filtros dentro del 20% del alto, fila de la densidad aprobada y el detalle con sus **siete** paneles) y los casos de listado, filtros en la URL, KPI del servidor y factura directa (`admin-orders`, **11/11**; los salteados son los que crean cuentas y el de paginación por falta de datos). Capturas versionadas en [`design/screens/`](design/screens/) (`orders-list-*` y `orders-detail-*`, los cuatro viewports). En pantalla real: el **historial muestra el actor** de cada cambio y el listado trae canal, estado y estado financiero. Antes del deploy se verificaron sin sesión health en los tres hosts, readiness y los smokes **menú 7/7** y **hosts 6/6** |
| **`main` en GitHub** | **Avanza con cada merge, los `docs-only` incluidos**: el vigente se lee con `gh api repos/danielmaki123/one-burger-commerce/git/ref/heads/main` |
| **Deriva `main` / producción** | **Ninguna de código**: producción sirve `ccb63bf`, que es `main`. La única diferencia es documental (`ops/CURRENT.md` de este cierre se mergea después del release) |
| **Migración aplicada en este deploy** | La **nueva** del cierre de aceptación: `20260930120000_add_order_currency_and_cash_counted_currencies` (`Order.currencyCode`, `LocationCashConfig.countedCurrencyCodes`, `Shift.baseCurrencyCode` + `Shift.exchangeRatesByCurrency`), aditiva y **sin backfill**, aplicada por el arranque. Encima de las **nueve** del runtime (`20260929120000`…`20260929120600`). La ruta de upgrade sobre una base **con datos** está probada con `scripts/qa-upgrade-pre.sql` + `qa-upgrade-post.sql` + `qa-upgrade-write.ts` |
| **Rollback target** | `build-20260928-235256` sobre `5a99185` — la aplicación se revierte revirtiendo el commit en `main` y volviendo a disparar `deployService`; **la base no se toca**: las columnas nuevas son nullable y la app vieja las ignora |
| **Modelo de deploy** | Easypanel, proyecto `brunobot`, servicio `oneburguerweb`; build **desde GitHub `main`** con `forceRebuild`. Una sola llamada a `deployService` (la llamada puede cortar por timeout y el build sigue en segundo plano: comportamiento conocido) |
| **Migraciones** | La última es `20260929120600_add_refund_shift_rate_snapshot` (Money / Payments runtime): aditiva, nullable y **sin backfill**, aplicada por el arranque |
| **Réplicas** | `1` |
| **Backup pre-deploy** | Este release **no lo exigía** (migración aditiva segura: [`delivery-e2e`](../.agents/skills/delivery-e2e/SKILL.md) §4). El hallazgo `A-57` (el backup **programado** no genera archivos y no hay retención declarada) **sigue abierto** y es del owner |
| **Hosts activos** | `oneburgernic.com` y `www` (landing + redirects 307) · `menu.oneburgernic.com` (app de pedidos) · `admin.oneburgernic.com` (panel) |
| **Health / readiness** | `GET /api/health` (versión del build) · `GET /api/readiness` (`SELECT 1`, 503 si la base no responde) |
| **Base de datos** | PostgreSQL 17 en `oneburguer-postgres` (sin puerto expuesto: `exposedPort=0`) |
| **Datos de negocio** | 3 sucursales reales (Camino de Oriente, Carretera Masaya, Casa Antigua). La carta la sigue cargando el owner |
| **Caja en producción** | Sin terminales de caja cargadas al momento del último QA: es el estado real del negocio, no un defecto |

✅ **QA post-rebuild de producción (2026-09-29, sobre `build-20260928-235256`)** — verificada **contra el build
servido**: health en los **tres** hosts, readiness `ready`, smokes **menú 7/7** y **hosts 6/6**, **#91
presente** (los chunks del panel traen sus textos de UI; el marcador tiene que ser una cadena de UI porque la
minificación borra los nombres de función) y **#96 desplegado** (el detalle real de un turno trae la clave
`exchangeRate`; con **0** cierres posteriores al deploy, contra producción está probado el **mapeo** y contra
**PostgreSQL real** la escritura). Las credenciales se usaron **solo por entorno** y **no** se guardan en el
repo.

✅ **QA autenticada de producción de Cocina (2026-09-28, sobre `build-20260928-035241`)**: `/admin/kitchen` se
abrió **en producción con sesión** a los cuatro viewports del contrato (`1366×768`, `1280×720`, `768×1024`,
`375×812`). Medido en el navegador: los **tres carriles** con su cuenta en escritorio y **uno por vez con su
conmutador** en tablet y celular; **cero importes** en toda la pantalla (`C$`, `US$` y `NIO` ausentes);
**scroll de página 0 y sin scroll horizontal** en los cuatro; y el pedido real del POS (`P-MUIW4IS4`, el de la
venta de QA) dibujado en **LISTOS** sin cobros ni saldo, con `Retiro: lo antes posible` —el POS no promete
hora—. En Órdenes, el botón **«Modo cocina» ya no existe** y la entrada del panel lleva a la superficie propia.
Capturas en `test-results/qa-kitchen-prod-*.png`. Las credenciales se usaron **solo por entorno** y **no** se
guardan en el repo.

✅ **QA autenticada de producción del POS (2026-09-27, sobre `build-20260927-193653`)**: los cuatro viewports
del contrato con la carta real, una sola superficie con scroll dentro del ticket, cero scroll horizontal y
`Cobrar C$…` siempre visible. **A `375×812` la página sí scrollea (155 px)**: es la referencia aprobada —la
vista primaria es el catálogo y el ticket vive en el sheet—. Las credenciales se usaron **solo por entorno** y
**no** se guardan en el repo.

✅ **Venta real cobrada en producción (2026-09-26)**: se ejercitó el flujo completo con una venta de mostrador
de verdad —`COCA COLA`, cliente `QA POS Fase 1` / `8888-8888`, efectivo con «Exacto»— y en el medio apareció el
bloqueo real de caja: el `Cobrar` estaba **deshabilitado** con la tarjeta `Caja cerrada`, así que se abrió el
turno (autorizado por el owner) y el cobro salió **`Venta P-MUIW4IS4 cobrada por C$44.57 · Sin cambio`**. Queda
un **turno abierto** en Camino de Oriente cuyo efectivo esperado es **C$44.57**: lo cierra el owner desde
`/admin/cash` (la venta no se puede borrar: es un pedido real).

⚠️ **Lo que la verificación de este release NO pudo hacer desde acá**: los **logs del contenedor** no son
accesibles por API (`inspectAction`/`getActionLogs`/`inspectServiceLogs` responden 404, así que la búsqueda de
`P2002`/`P2028`/`25P02`/deadlock/5xx queda pendiente); y el **SHA exacto que compiló el panel** no se puede leer
sin token (`EASYPANEL_TOKEN` está vacío en el entorno del agente), así que el SHA desplegado se afirma por
**coincidencia verificada** con `main` y no por lectura del panel. El POS se verificó además **antes** del
deploy contra una base local con la suite E2E completa (`admin-pos` 11/11 con mutaciones, capturas en
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
> **Ya no hay P1 de dinero**: `A-68` (el cobro de un pedido existente comparaba la suma **cruda** de
> `Payment.amount`) y `A-73` (la devolución sin límite atómico ni lock) quedaron **cerrados** en
> `TASK-MONEY-PAYMENTS-RUNTIME-001`, con test contra **PostgreSQL real** y mutación. El único P1 abierto es
> **operativo** (`A-57`, el backup programado), que por decisión del owner **no** bloquea el trabajo de
> producto. `A-15` (con `A-59`) y `A-58` quedaron **cerrados** el 2026-09-25.

**P1**

| Riesgo | Detalle | Dónde |
|---|---|---|
| **El backup programado no genera archivos** | La config del servicio `oneburguer-postgres` está `enabled: true` (cron `0 0 * * *`) pero el respaldo programado **nunca** produjo un archivo: las únicas acciones de backup son las dos del drill (2026-09-12) y las manuales de los releases, y **no hay retención declarada**. Es **materia de infraestructura/operación**: requiere revisar la sección Backups del panel y decidir retención — no es código y **no bloquea** el trabajo de producto. Mientras tanto: el **backup se decide por riesgo del release**, no por frecuencia ([`delivery-e2e`](../.agents/skills/delivery-e2e/SKILL.md) §4) | `A-57` en [`audit-backlog.md`](audit-backlog.md) |

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
`A-30` · `A-33` · `A-70` (la factura sin puerta de rol ni alcance por sucursal; la anulación no se imprime) ·
`A-76` (`void` no mira el turno ni la factura) · `A-77` (`Payment.tip`, campo muerto que parece vivo) ·
`A-78` (`canPrintCashDocuments` sin puerta de servidor) · `A-79` (cuatro runners de transacción casi
idénticos) · `A-80` (cambiar la tasa o la moneda base no deja asiento de auditoría). Los `A-68`, `A-69`,
`A-71`, `A-72`, `A-73`, `A-74` y `A-75` **ya no están acá: se cerraron** con `TASK-MONEY-PAYMENTS-RUNTIME-001`.

## 4. Trabajo actual

**`TASK-ORDERS-RUNTIME-5B` — Pedidos runtime (`high-risk-e2e`): CERRADA.**
El orden **5b** del roadmap: `/admin/orders` dejó de ser el tablero viejo de comandas y pasó a ser el **read
model administrativo canónico**. Entregó `OrderListProjection` (mínima, paginada, con `financialState` y los
**cuatro KPI del filtro completo**), `OrderDetailProjection` (items, modificadores, notas, punto de retiro,
**historial real con actor**, sellos por etapa, PIN y documentos **sólo con capacidad**), `canViewOrders`,
`resolveAdminLanding`, los **siete filtros en la URL** y el cierre de la autorización mínima de `A-70`.
Cerró `A-09`, `A-10`, `A-60`, `A-61`, `A-62`, `A-63`, el remanente de `A-64` y `A-66`. Detalle, evidencia,
mutaciones y excepciones: [`tasks/TASK-ORDERS-RUNTIME-5B.md`](tasks/TASK-ORDERS-RUNTIME-5B.md).

**`TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` — cierre de aceptación de Money / Payments: CERRADA,
MERGEADA Y DESPLEGADA.**
Segunda pasada sobre los órdenes 4 y 5: los criterios **3, 9 y 12** de `TASK-MONEY-PAYMENTS-RUNTIME-001` no se
cumplían en el runtime desplegado. **`A-81`…`A-90` cerrados con test**: el POS y la devolución ya no pueden
escribir un cobro sin snapshot; el reintento del POS suma el equivalente **persistido**; `readProductionMoney`
es la **lectura única** y Personalización dejó de editar moneda, símbolo, locale y tasa; el POS ofrece los
medios y las monedas **configurados**; `Order.currencyCode` se congela en toda alta nueva; el cambio de base es
una **operación de período cerrado** (`D-023`); y la Caja cuenta monedas **configurables** en vez de
`usdEnabled`. Evidencia, mutaciones y excepciones:
[`tasks/TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002.md`](tasks/TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002.md).

**`TASK-MONEY-PAYMENTS-RUNTIME-001` — Money / Payments runtime: CERRADA Y DESPLEGADA** (`build-20260928-235256`):
creó los módulos `money` y `payments`, las **nueve migraciones** aditivas, `/admin/finance` y la factura con
`paid` estricto; cerró `A-68`, `A-69`, `A-71`, `A-72`, `A-73`, `A-74` y `A-75`. Detalle y evidencia en
[`tasks/TASK-MONEY-PAYMENTS-RUNTIME-001.md`](tasks/TASK-MONEY-PAYMENTS-RUNTIME-001.md).

**`TASK-MONEY-PAYMENTS-FOUNDATIONS-001` — fundaciones de Money / Payments (`docs-only`): CERRADA Y MERGEADA.**
Sin deploy: no tocó runtime, Prisma, migraciones, APIs ni navegación. Entregó la **auditoría real** de los dos
subsistemas contra el código, las matrices de **clasificación** y de **ownership**, los **contratos**, la
**estrategia legacy sin backfill**, las migraciones enumeradas y no creadas, los **archivos prohibidos de
duplicar** y el **Design Freeze de Finanzas**:
[`tasks/TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md`](tasks/TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md).

**Lo que sigue es `Pedido existente → Cobrar en POS`** (orden **6**): cierra `A-67` **componiendo** el backend
que ya existe, **sin** reconstruirlo. La secuencia inmediata está en [`roadmap/NEXT.md`](roadmap/NEXT.md) y
**`ACTIVE` no tiene ninguna TASK**. **`DS-001`** (ley visual v4) está **aprobado y desplegado**; **`IA-001`**
(navegación del panel) también.

**Cocina runtime** (`TASK-ORDERS-KITCHEN-RUNTIME-002`, `high-risk-e2e`) está **desplegada** bajo
`build-20260928-035241` sobre `72b22b5` (detalle en §1 y §5). **`A-60` quedó cerrado** en `Pedidos runtime`
(5b): el recorte financiero del detalle compartido se aplica en el servidor.
**Los cierres anteriores ya no viven acá**: el detalle se movió a
[`history/cierres-2026-09.md`](history/cierres-2026-09.md) cuando este archivo llegó a su techo de **250
líneas**. Ahí están `AUD-003..008`, `A-54`/`A-55`/`A-58`/`A-59`, `SCREEN-POS-QUICK-SALE-001.x`,
`SCREEN-ORDERS-001`, `ARCH-001`, `TASK-GOV-001`, `TASK-AUD-004` y los baselines superados; acá queda la
**línea de estado**.

## 5. Siguiente trabajo

La secuencia la manda el **[roadmap maestro de producto y UX](roadmap/PRODUCT-UX-ROADMAP.md)** §2 (16 órdenes);
la inmediata, [`roadmap/NEXT.md`](roadmap/NEXT.md). El **programa de remediación técnica** —hallazgos `A-*`,
con objetivo, prioridad, riesgo y dependencia— sigue en
[`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md): son dos cosas distintas y **no se
duplican**.

Lo que sigue, en orden:

1. **`Pedido existente → Cobrar en POS`** (orden **6**): **compone** el backend que ya existe
   (`POST /api/admin/orders/[id]/payment`); no lo reconstruye. Cierra `A-67`. Después **Cash ownership** (7).
2. **Deuda de Pedidos/Cocina y de dinero (`A-67` a `A-80`)** y después `AUD-009`/`AUD-010`,
   `AUD-012`/`AUD-013`/`AUD-014`. `A-57` (backup programado) es **infraestructura**: el owner decide y no
   bloquea el producto.

## 6. Bloqueos

Solo bloqueos **reales**. Todo lo demás es trabajo pendiente.

| Bloqueo | Qué lo desbloquea |
|---|---|
| **Higiene de secretos pendiente del owner** | **Rotar el `EASYPANEL_TOKEN`**: el vigente viajó por chat y por la línea de comandos del arranque del deploy, así que corresponde regenerarlo (es además el punto que ya estaba en la lista desde el 2026-09-27). No bloquea nada hoy: el release quedó completo |
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
- Arquitectura de producto: [`ops/product/MODULE_ARCHITECTURE.md`](product/MODULE_ARCHITECTURE.md)
- Programa de remediación: [`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md)
- Runbook de producción: [`production-readiness.md`](production-readiness.md)
- Punto de entrada de una sesión: [`tasks/START-HERE.md`](tasks/START-HERE.md)
- Historia: [`history/`](history/)
