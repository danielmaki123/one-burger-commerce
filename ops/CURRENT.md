# CURRENT.md — estado operativo actual

**Qué es este archivo**: la fuente de verdad **operativa y actual**. Un agente nuevo tiene que entender
en qué estado está el sistema en pocos minutos.

**Qué NO va acá**: historia (va a [`history/`](history/)), procedimientos (van a
[`.agents/skills/`](../.agents/skills/)) ni arquitectura (va a
[`.agents/CONTEXT.md`](../.agents/CONTEXT.md)). Este archivo se **actualiza seguido** y se mantiene
corto: si crece como un diario, dejó de servir.

> **Última actualización**: 2026-09-26, por el release de **`SCREEN-POS-QUICK-SALE-001`** (POS Fase 1 — Venta
> rápida, **desplegado** por el owner; ver §1 y §4).
> **Vigente desde hoy: el Default E2E Delivery Contract** ([`.agents/skills/delivery-e2e/SKILL.md`](../.agents/skills/delivery-e2e/SKILL.md)):
> una TASK aprobada declara su **Delivery Mode** y se ejecuta hasta el estado final **sin pedir permisos
> intermedios**, y el **backup se decide por riesgo del release**, no por frecuencia (`A-57` sigue abierto como
> problema del **scheduler** de backups y **no obliga** a un backup manual en releases que no lo necesitan).
> **La fase de estabilización técnica sigue cerrada**: ningún P0 conocido y ningún P1 de dinero abierto. Lo que
> sigue abierto es **operativo** (`A-57`) o **decisión del owner** (`A-66`, el `cashier` en Órdenes). Con
> `DS-001`, `IA-001`, Órdenes y la **Venta rápida del POS** cerrados, lo que sigue es **`SCREEN-001 — Resumen`**,
> que **no se inició**.

---

## 1. Producción

| Qué | Estado |
|---|---|
| **Último deploy** | `build-20260926-170322`, sobre `be4c051a`+ (`main` con **`SCREEN-POS-QUICK-SALE-001`**, PR #62), 2026-09-26 17:03 UTC — deploy disparado por el **owner**. `/api/health` = `build-20260926-170322`, `/api/readiness` `ready` (DB 85 ms), smokes **menú 7/7** y **hosts 6/6**. **Sin backup manual**: no hay migración ni cambio de datos |
| **`main`** | `3a58633` (docs de cierre, PR #63). El **código en producción** es `be4c051` — el commit de la TASK; el de docs no cambia lo desplegado. CI verde en cada push a `main` (los cuatro checks + `publish`) |
| **Migración aplicada en este deploy** | **Ninguna**: el release es de pantalla y navegación. La última sigue siendo `20260925120000_add_payment_void`, aplicada el 2026-09-25 |
| **Rollback target** | `build-20260926-031111` sobre `fff8d71` (IA-001 + Órdenes) — la aplicación se revierte revirtiendo el commit en `main` y volviendo a disparar `deployService`; la base no se toca (este release no migró) |
| **Modelo de deploy** | Easypanel, proyecto `brunobot`, servicio `oneburguerweb`; build **desde GitHub `main`** con `forceRebuild`. Una sola llamada a `deployService` (la llamada cortó por timeout y el build siguió en segundo plano: comportamiento conocido, la action quedó `done`) |
| **Migraciones** | El release de AUD-003..006 no trajo ninguna. El de A-59 **sí**: `20260925120000_add_payment_void`, aditiva y sin backfill, aplicada por el arranque |
| **Réplicas** | `1` |
| **Backup pre-deploy** | **El owner generó un backup manual de la base** (confirmado el 2026-09-26) aunque el release no lo exigía —no hay migración ni cambio de datos—. El hallazgo `A-57` (el backup **programado** no genera archivos y no hay retención declarada) **sigue abierto** y es del owner; el archivo **no se pudo verificar** desde acá (el panel de Easypanel responde **401** sin token) |
| **Hosts activos** | `oneburgernic.com` y `www` (landing + redirects 307) · `menu.oneburgernic.com` (app de pedidos) · `admin.oneburgernic.com` (panel) |
| **Health / readiness** | `GET /api/health` (versión del build) · `GET /api/readiness` (`SELECT 1`, 503 si la base no responde) |
| **Base de datos** | PostgreSQL 17 en `oneburguer-postgres` (sin puerto expuesto: `exposedPort=0`) |
| **Datos de negocio** | 3 sucursales reales (Camino de Oriente, Carretera Masaya, Casa Antigua). La carta la sigue cargando el owner |
| **Caja en producción** | Sin terminales de caja cargadas al momento del último QA: es el estado real del negocio, no un defecto |

⚠️ **Lo que la verificación de este release NO pudo hacer desde el entorno del agente**: no hay
credenciales de admin de producción (`E2E_ADMIN_*`), así que la **QA autenticada 375/768/1280 del POS queda
pendiente del owner** (es el mismo límite que arrastran los releases anteriores, anotado en el runbook §3).
El POS se verificó **antes** del deploy contra una base local con la suite E2E completa (`admin-pos` 11/11 a
375, 768 y 1280, con capturas en [`design/screens/`](design/screens/)), y después del deploy lo que se puede
comprobar sin sesión: `build-20260926-170322` sirviendo, readiness `ready` y los dos smokes en verde.

⚠️ **Hallazgo operativo (sigue abierto): el backup programado no genera archivos.** La config está
`enabled: true` (cron `0 0 * * *`) y carpeta `oneburguer`, pero las **únicas** acciones de backup del
servicio son **tres** desde siempre: las dos del drill (2026-09-12) y la manual del release anterior
(2026-09-25 12:27). El respaldo programado **no produjo ningún archivo**, tampoco el del día de este
release. **No hay retención declarada.** El backup de este release lo confirmó el owner a mano →
`A-57` en el backlog.

✅ **Verificación post-deploy del release de la Venta rápida (2026-09-26, solo lectura y sin sesión)**:
`/api/health` = `build-20260926-170322` (versión nueva) y `/api/readiness` `ready`; los dos smokes **7/7** y
**6/6**. Lo que **no** se pudo hacer: abrir una pantalla con sesión —no hay credenciales de admin acá—, así
que la **QA autenticada del POS 375/768/1280 queda pendiente del owner** (se verificó antes del deploy contra
una base local: `admin-pos` **11/11**, capturas en [`design/screens/`](design/screens/)). Tampoco se
ejercitó la presencia de `voidedAt` con lectura autenticada (sí la aplica el contenedor al arrancar).

📋 **Pasada read-only de A-50/A-51 (acotada, sin reparar nada)**: **A-51** — los **5** cierres tienen
`expectedAmount` firmado y **ninguno** tenía retiros ni devoluciones, así que la fórmula corregida de AUD-005
**no altera ningún número histórico**; el detalle de `ShiftBankClose` es **no determinable** (producción no
tiene bancos configurados). **A-50** — **no identificable** desde la API (no expone los cobros ni la clave de
intento): requiere leer la base. **No reparado.**

⚠️ **Límite del entorno del agente en este release**: **los logs del contenedor no son accesibles por API**
(`actions/inspectAction`, `actions/getActionLogs` y `services/app/inspectServiceLogs` responden 404), así que
la búsqueda de `P2002`/`P2028`/`25P02`/deadlock/5xx en logs **no se pudo hacer desde acá**: la verificación se
apoya en health, readiness, los dos smokes y comprobaciones HTTP de solo lectura.

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
> **No hay ningún P1 de dinero abierto**: `A-15` (con su remanente `A-59`) quedó **cerrado** el
> 2026-09-25 y `A-58` antes. El único P1 abierto es **operativo** (`A-57`, el backup programado), que
> por decisión del owner **no** bloquea el trabajo de producto.

**P1**

| Riesgo | Detalle | Dónde |
|---|---|---|
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
`A-30` · `A-33`.

**AUD-007 — Production Environment Fail-Closed (cerrada)**: el entrypoint de produccion (`scripts/start-production.mjs`, el `CMD` de la imagen) ahora **se niega a arrancar si `APP_ENV` no es `production`**: antes solo avisaba por consola y con `APP_ENV=staging` los endpoints internos de staging (que crean admins y corren seeds) quedaban alcanzables. Se sumo el modo `START_PRODUCTION_VALIDATE_ONLY=true` (valida y sale, sin migrar ni arrancar) y el contrato `production-environment-contract.test.ts` (5 casos, con mutacion).

**AUD-008 — Internal/Staging Endpoint Isolation (cerrada)**: se inventariaron las **6** rutas internas (`/api/internal/**`). Las **5** de staging cierran por entorno (`APP_ENV === "staging"` -> 403, y si la variable faltara tambien) y todas exigen un secreto comparado con `timingSafeEqual`; el procesador del outbox rechaza si el secreto falta. **Verificado en produccion con GET** (nunca POST: el de staging crea admins y el del outbox procesa la cola): las 6 responden **405** sin ejecutar nada. Guardrail nuevo: `internal-endpoint-isolation-contract.test.ts` recorre las rutas y falla si una nueva nace sin su puerta (con mutacion verificada).

**A-54 — ningun cobro fuera de arqueo (cerrada)**: el arqueo (cierre y corte X) leia, para un turno con terminal, **solo** los cobros atribuidos a ese turno, asi que un cobro entrado **sin caja abierta** (`Payment.shiftId = null`, el caso del cobro de un pedido del menu) no entraba al arqueo de nadie. Ahora suma los cobros de su ventana **sin turno** (puerto nuevo `listUnattributedPaymentsInRange`, en los dos adaptadores): todo cobro entra al arqueo de exactamente un turno. Probado contra PostgreSQL real, con mutacion, y sin contarse la plata entre dos terminales.

**A-55 — doble cobro concurrente (cerrada)**: `registerOrderPayment` validaba el tope leyendo la suma de los cobros y despues escribia: dos cobros simultaneos del mismo pedido leian el mismo saldo, los dos pasaban la comprobacion y el pedido quedaba cobrado por encima de su total (RED real: `los dos cobros pasaron la comprobacion previa ... to have a length of 1 but got 2`). Ahora la validacion corre **dentro** de la transaccion con la fila del pedido bloqueada (`lockOrder`, `SELECT ... FOR UPDATE`), asi que el segundo espera y lee la suma actualizada. Orden de locks: pedido y despues turno (el cierre bloquea el turno: sin inversion). Probado contra PostgreSQL real con dos requests simultaneos forzados por barrera y mutation check.

**A-15 / A-58 — semantica economica neta (cerrada)**: las metricas comerciales del panel nunca cuentan como ingreso plata devuelta o invalidada. La regla vive en **un solo lugar** (el dominio): `netOrderValue` = `total - importe devuelto/invalidado`, nunca negativo, y `countsAsSale` (con devoluciones, el pedido cuenta solo si le quedo algo; sin devoluciones, una venta de C$0 sigue siendo una venta) — la usan ventas, ticket promedio, series, comparaciones y cualquier agregado futuro. La consulta del KPI trae los `Refund` **aprobados** del pedido y el agregado calcula el neto. **Limitacion declarada**: el modelo no guarda que items se devolvieron, asi que un pedido con devoluciones **no entra en el desglose por producto** (omitir antes que inventar). RED observado (`una venta reembolsada seguia contando como ingreso: expected 100 to be +0`), 6 casos nuevos, mutation check (4 de 6 en rojo) y el contrato previo del agregado intacto.

**A-15 / A-59 — anular un cobro (cerrada, cierra A-15)**: el remanente de A-15 se implemento y A-15 quedo **cerrado**. Un `Payment` mal registrado —duplicado, con el monto o el medio equivocados— se **anula** conservando el registro original: migracion aditiva `20260925120000_add_payment_void` (`voidedAt`, `voidedByUserId`, `voidReason`), puerta `canVoidPayment` (**solo owner**), `POST /api/admin/payments/[id]/void` con su composicion y asiento `payment.void`. La regla «un cobro anulado no cuenta» vive **una sola vez** por adaptador (`NOT_VOIDED` / `activePayments`): las cinco consultas de lista y la agregacion del saldo excluyen los anulados, asi que el arqueo (cierre y corte X), el saldo del pedido, la conciliacion y los documentos quedan afuera sin tocar cada consumidor. Las dos puntas de la misma invariante se rechazan entre si: **no se anula un cobro con devolucion viva** (pendiente o aprobada) y **no se aprueba la devolucion de un cobro anulado** (rechazarla si: es como se limpia antes de anular). La anulacion es **idempotente y segura ante carreras** porque la guarda va en el `WHERE` (`voidedAt: null`), no en el `if` de la lectura. Las **metricas no se tocaron**: no leen `Payment` (verificado) y el neto de `A-58` ya contemplaba el «importe invalidado». RED observado (`The column Payment.voidedAt does not exist in the current database`), 4 casos contra PostgreSQL real (el arqueo pasa de 800 a 300 al anular el cobro de 500 con la fila original intacta; el saldo del pedido vuelve a 0; dos anulaciones simultaneas firman una sola; una devolucion viva bloquea la anulacion) y **tres mutation checks** (filtro de exclusion, guarda del `WHERE` y devoluciones vivas), los tres restaurados. **Fuera de alcance a proposito**: la superficie de UI para anular (la ruta es la API) y mostrar el cobro anulado en el detalle del pedido.

**Fase de estabilizacion tecnica — CERRADA (2026-09-25)**: se cumple el criterio que el owner fijo: **A-15 completo**, tests verdes (unitarios, contratos, PostgreSQL real y CI), **ningun P0 conocido** y **ningun P1 de dinero abierto ligado a A-15**. No se iniciaron `AUD-009/010/012/013/014` ni una auditoria nueva, y **no** se abrio ninguna TASK por hallazgos laterales: lo que aparecio quedo en el backlog como observacion. La TASK que siguio fue **ARCH-001** (arquitectura de producto y modulos), **cerrada** el 2026-09-25.

## 4. Trabajo actual

**Roadmap adoptado (2026-09-25, `ROADMAP-001`) y sus cuatro primeras fases cerradas**: el proceso vive en
[`roadmap/PRODUCT-UX-ROADMAP.md`](roadmap/PRODUCT-UX-ROADMAP.md) (decisiones en [`roadmap/DECISIONS.md`](roadmap/DECISIONS.md),
secuencia en [`roadmap/NEXT.md`](roadmap/NEXT.md)). **`DS-001`** (ley visual v4, en [`ops/design/`](design/))
está **aprobado y desplegado**; **`IA-001`** (navegación del panel) también; **`SCREEN-ORDERS-001`** es la
**primera sección rediseñada de punta a punta** ([`design/screens/orders.md`](design/screens/orders.md)) y
**`SCREEN-POS-QUICK-SALE-001`** la segunda ([`design/screens/pos-quick-sale.md`](design/screens/pos-quick-sale.md)).
Lo que sigue es **`SCREEN-001 — Resumen`**, que **no se inició**.

**SCREEN-POS-QUICK-SALE-001 — POS Fase 1 / Venta rápida (cerrada, `be4c051`, `build-20260926-170322`,
desplegada por el owner)**: la Venta rápida pasó a un **workspace `CATÁLOGO | VENTA`** —ticket anclado al
viewport en escritorio, barra + sheet en celular y tablet, opciones secundarias bajo demanda—. **Sin dominio,
sin endpoints, sin permisos y sin DB.** `pos-client.tsx` bajó de **1.005 a 427 líneas**. El detalle, la QA y
los dos desvíos medidos respecto del boceto están en
[`design/screens/pos-quick-sale.md`](design/screens/pos-quick-sale.md). **QA autenticada de producción
pendiente del owner**: desde acá no hay credenciales de admin (§1).

**SCREEN-ORDERS-001 — Órdenes (cerrada, `fff8d71`, desplegada)**: discovery, arquitectura/IA, spec, prototipo
y capturas → implementación bajo DS v4 → QA de navegador a 375/768/1280 → PR #57 con CI verde. Entregado: los
dos `animate-pulse` fuera de reposo, el anuncio de atraso con el **umbral del local** (antes, el de por
defecto: decía un número que la pantalla no usaba), el copy de la factura a **80 mm** y la **barra compacta en
celular** (la primera comanda ya no queda debajo del pliegue). Sin dominio, sin endpoints, sin permisos y sin
DB. La deuda del discovery quedó registrada como `A-60` a `A-66`.

**Release consolidado a producción (2026-09-25, cerrado)**: `main` = `0b840e7` **desplegado** y sirviendo `build-20260925-174535`. El release llevó A-54, A-55, AUD-007, AUD-008, A-58 y A-59 con su migración aditiva. **Sin reparación de datos históricos**: `A-50`/`A-51` siguen sin tocar.

**ARCH-001 — Product & Module Architecture (cerrada, 2026-09-25, docs-only)**: la constitución de producto vive en [`ops/product/MODULE_ARCHITECTURE.md`](product/MODULE_ARCHITECTURE.md): las secciones reales del panel, los módulos que existen, el **ownership** de cada agregado, la regla del Resumen como overview transversal, el gate para capacidades nuevas y la **deuda registrada** (el dominio de Caja repartido entre `orders` y `pos`, promociones en `orders`, `dashboard` sin puertos, los cascarones `coupons`/`table-ordering`, puertas sin call site y la entrada muerta «Mesas» del móvil). **No cambió producto, rutas, navegación, diseño ni DB**: lo que no coincide con la dirección conceptual del roadmap quedó **documentado**, no corregido por decreto.

**TASK-AUD-004 — POS Sale Atomicity** (cerrada, `c0b427b`): el riesgo se **reprodujo** contra PostgreSQL real (pedido persistido con 1 de 2 cobros, y con **cero** cobros por la otra vía; el cupón consumido y el reintento devolviendo la venta incompleta) y se cerró con un **límite atómico explícito**: el pedido, su cupón y todos sus cobros en un solo `$transaction`. Dos hallazgos en el camino: dentro de una transacción un `P2002` **aborta** la transacción, y el aviso de pedido creado tenía que salir **después del commit**. Montó el **arnés de PostgreSQL real** para Vitest (corre en CI, job `migrations`); sin migración. Su review adversarial dejó `A-46` a `A-49`.

**AUD-003, AUD-002, AUD-001 y AUD-000** (`4deb8e5`, `f441c48`, `1b12dfd`, `eeaa810`): arqueo ciego sin fugas
en corte X, cierre y traspaso; y gobierno de Git/CI (el ruleset `Protect main` exige Pull Request con 0
aprobaciones).

## 5. Siguiente trabajo

El programa completo, con objetivo, prioridad, riesgo, dependencia y orden, está en
[`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md); el **proceso de producto** que
aprobó el owner, en [`roadmap/`](roadmap/).

**Baseline de `DS-001` (2026-09-26, cerrado)**: `4dc2cbb` → `build-20260926-003808`, sin migraciones ni cambios visuales; quedó superado por el release de `IA-001` + Órdenes (ver §1).

**Release de `SCREEN-POS-QUICK-SALE-001` (2026-09-26, cerrado)**: `main` = `be4c051` **desplegado** sirviendo
`build-20260926-170322` (deploy del owner). Sin migraciones, sin dominio y sin backup. Health/readiness y los
dos smokes (7/7 y 6/6) en §1; la **QA autenticada de producción queda pendiente del owner** porque acá no hay
credenciales de admin.

**El bloque financiero de la remediación quedó cerrado y desplegado** (`AUD-003..006`, `A-54`, `A-55`,
`A-58`, `A-59`) y con él la **fase de estabilización técnica**. Lo que sigue, en orden:

1. **QA autenticada de producción del POS** (375/768/1280) — la hace el owner o alguien con las credenciales.
2. **`SCREEN-001` — `/admin` Resumen**: **no iniciado**. Se diseña con la skill `screen-design` (spec
   aprobada por el owner) y se implementa bajo DS v4 en una sola pasada, como en Órdenes.
3. **POS Fase 2 — pedidos existentes / pagos / bancos / USD / factura**: la define el owner **aparte**; la
   Fase 1 dejó escrito qué no se tocó. **No se inicia automáticamente.**
4. **Deuda de Órdenes (`A-60` a `A-66`)** y después `AUD-009`/`AUD-010`, `AUD-012`/`AUD-013`/`AUD-014`.
5. `A-57` (backup programado) es **infraestructura**: el owner decide y no bloquea el producto. Y **higiene
   pendiente del owner**: revocar la cuenta de QA anterior y **rotar el `EASYPANEL_TOKEN`**.

> ⚠️ **Dos correcciones al brief de la auditoría, verificadas en el repo:**
>
> 1. **A-45 ya está cerrado** (2026-09-23): el arqueo ciego es regla de servidor
>    (`src/app/api/admin/pos/shift/shift-arqueo-role-filter.ts`, con tests). TASK-AUD-003 no debe
>    reimplementarlo: su alcance real es **verificar** que no queden caminos que filtren el esperado y
>    convertirlo en guardrail permanente.
> 2. **El informe de auditoría que originó este roadmap no está versionado en el repo.** Los títulos de
>    `TASK-AUD-004` a `TASK-AUD-017` vienen del brief del owner; la **evidencia** de cada uno se
>    reproduce y se registra en [`audit-backlog.md`](audit-backlog.md) al abrir su TASK (regla de la
>    skill [`audit`](../.agents/skills/audit/SKILL.md)). Hasta entonces son el programa, no hallazgos
>    probados.
>
> **Dos entradas del backlog que hay que revisar antes de agarrarlas**: `A-16` («no hay historial de
> cajas») y la segunda mitad de `A-18` («`Payment` no tiene `shiftId`») parecen **obsoletas**: el
> historial existe en `/admin/history/cierres` y la Fase 6 del rediseño de Caja agregó `shiftId`. Se
> confirman al abrir su TASK, no acá.

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
- Programa de remediación: [`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md)
- Runbook de producción: [`production-readiness.md`](production-readiness.md)
- Punto de entrada de una sesión: [`tasks/START-HERE.md`](tasks/START-HERE.md)
- Historia: [`history/`](history/)
