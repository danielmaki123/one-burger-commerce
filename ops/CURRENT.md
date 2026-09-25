# CURRENT.md — estado operativo actual

**Qué es este archivo**: la fuente de verdad **operativa y actual**. Un agente nuevo tiene que entender
en qué estado está el sistema en pocos minutos.

**Qué NO va acá**: historia (va a [`history/`](history/)), procedimientos (van a
[`.agents/skills/`](../.agents/skills/)) ni arquitectura (va a
[`.agents/CONTEXT.md`](../.agents/CONTEXT.md)). Este archivo se **actualiza seguido** y se mantiene
corto: si crece como un diario, dejó de servir.

> **Última actualización**: 2026-09-25, por el **cierre de la fase de estabilización técnica** (última
> TASK: `AUD-059`, `A-59`). `main` = `974fa74`, CI **verde** (`verify`, `contracts`, `migrations`,
> `container` y `publish`). **Producción quedó en `17ecb27`** (`build-20260925-123054`): **no** se
> desplegó lo de después — A-54 (`d4ee07e`), A-55 (`0126511`), AUD-007 (`d951898`), AUD-008 (`e2ae50b`),
> A-58 (`1c41a3a`) y A-59 (`974fa74`) están en `main` y **no** en producción, porque desplegar necesita
> el OK explícito del owner.
>
> **La fase de estabilización técnica queda CERRADA**: A-15 completo, tests verdes (unitarios,
> contratos, PostgreSQL real y CI), **ningún P0 abierto conocido** y **ningún P1 de dinero abierto**.
> Lo que sigue abierto es **operativo** (`A-57`, backup) o de **decisión del owner** (`A-50`/`A-51`,
> datos históricos), y la próxima TASK planificada es **ARCH-001** (arquitectura de producto y módulos),
> que **no se inició**.

---

## 1. Producción

| Qué | Estado |
|---|---|
| **Último deploy** | `build-20260925-123054`, sobre `17ecb27` (**AUD-003..006**), 2026-09-25 12:29 UTC. `commit.sha` del panel = `17ecb27`, `/api/health` = `build-20260925-123054`, `/api/readiness` `ready` (DB 11 ms), smokes **menú 7/7** y **hosts 6/6** |
| **`main` (sin desplegar)** | `974fa74` — A-54, A-55, AUD-007, AUD-008, A-58 y A-59 están mergeados y **no** desplegados. El deploy es del owner (runbook) |
| **Migración pendiente de aplicar en producción** | `20260925120000_add_payment_void` (aditiva: tres columnas nullable en `Payment`, sin backfill). La aplica el arranque del contenedor (`prisma migrate deploy`) en el próximo deploy |
| **Rollback target** | `build-20260925-022009`, commit configurado `0f4cb214765f2737e40aa6572acf980643ae0099` (código `33c435d`) |
| **Modelo de deploy** | Easypanel, proyecto `brunobot`, servicio `oneburguerweb`; build **desde GitHub `main`** con `forceRebuild`. Una sola llamada a `deployService` (la llamada cortó a los 72 s y el build siguió en segundo plano: comportamiento conocido) |
| **Migraciones** | AUD-003..006 **no** agregaron migraciones: el arranque aplicó `prisma migrate deploy` sin nada nuevo. Lo mergeado después **sí** trae una: `20260925120000_add_payment_void` (A-59), aditiva y sin backfill |
| **Réplicas** | `1` |
| **Backup pre-deploy** | `oneburguer/2026-09-25T12:27:16.589Z.sql.gz`, action `done` a las 12:27:16 (generado a mano por el owner) |
| **Hosts activos** | `oneburgernic.com` y `www` (landing + redirects 307) · `menu.oneburgernic.com` (app de pedidos) · `admin.oneburgernic.com` (panel) |
| **Health / readiness** | `GET /api/health` (versión del build) · `GET /api/readiness` (`SELECT 1`, 503 si la base no responde) |
| **Base de datos** | PostgreSQL 17 en `oneburguer-postgres` (sin puerto expuesto: `exposedPort=0`) |
| **Datos de negocio** | 3 sucursales reales (Camino de Oriente, Carretera Masaya, Casa Antigua). La carta la sigue cargando el owner |
| **Caja en producción** | Sin terminales de caja cargadas al momento del último QA: es el estado real del negocio, no un defecto |

⚠️ **Hallazgo operativo de este release (nuevo): el backup programado no genera archivos.** La config está
`enabled: true` con cron `0 9 * * *` y carpeta `oneburguer`, pero las **únicas** acciones de backup del
servicio son del **2026-09-12** (las dos del drill): no hay ningún archivo entre el 13 y el 25 de septiembre,
ni el del día del release a las 09:00. **No hay retención declarada.** El backup pre-deploy se generó a mano →
`A-57` en el backlog.

✅ **Verificación post-deploy con sesión (2026-09-25, después del deploy)**: con una cuenta de QA de administración (owner/manager, se revoca al terminar el QA) y **solo con `GET`** —sin crear, cerrar ni emitir nada— se verificó: **no hay ningún turno de caja abierto** (`GET /api/admin/pos/shift` → `{"data":null}`, y el corte X también null por eso mismo), las pantallas **Caja, POS, Historial de cierres y Órdenes cargan con sesión (200)**, y el **lado auditor del arqueo funciona**: el historial devuelve los cierres con `expectedAmount` y su diferencia. La verificación del lado `cashier` (que el esperado **no** llegue a esa sesión) **no se ejecutó**: no hay cuenta de ese rol y el brief prohíbe crear usuarios o cambiar roles en el release; la cubren los tests de CI.

📋 **Pasada read-only de A-50/A-51 (acotada, sin reparar nada)**:

- **A-51 (cierres históricos)**: los **5** cierres de producción tienen `expectedAmount` firmado; **4** tienen su conteo de cierre y el quinto es un **cierre ciego** (`closingAmount` y `difference` nulos: sin conteo por diseño, no un cierre a medias). **Cero confirmados y cero probables** con el defecto de las tres escrituras sueltas. El detalle de `ShiftBankClose` queda **no determinable** (producción no tiene bancos configurados, así que la ausencia de filas no distingue «no se declaró» de «no se escribió»). Dato relevante para el cambio de fórmula de AUD-005: **ninguno de los 5 turnos tenía retiros ni devoluciones**, así que el esperado corregido **no altera ningún número histórico**.
- **A-50 (ventas POS previas)**: **no identificable con certeza solo desde el estado persistido accesible por API** — el listado del admin no expone los cobros ni la clave de intento, así que no se puede separar «pedido del menú pendiente de cobro» (normal) de «venta de mostrador a medias». Requiere lectura de la base (`Order.idempotencyKey` y el conteo de `Payment` por pedido). **No reparado.**

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
| **El backup programado no genera archivos** | La config del servicio `oneburguer-postgres` está `enabled: true` (cron `0 9 * * *`) pero las únicas acciones son las dos del drill (2026-09-12) y **no hay retención declarada**: lo posterior al 12/09 no está respaldado (el del release se hizo a mano). Es **materia de infraestructura/operación**: requiere revisar la sección Backups del panel y decidir retención — no es código y **no bloquea** el trabajo de producto. Mientras tanto: **backup manual antes de cada deploy** | `A-57` en [`audit-backlog.md`](audit-backlog.md) |

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

**A-15 — cancelacion de pedido cobrado (REPRODUCIDA, sin implementar)**: se reprodujo el comportamiento actual. Lo que ya existe y cumple la decision del owner: cancelar un pedido **no** toca `Payment`; la devolucion del dinero tiene su flujo (`Refund`, con `canRefund`/`canApproveRefund` —aprobar es del dueno—, motivo/actor/timestamp y su resta en el arqueo); la factura se anula sin borrarse (`void-invoice`). Lo que **falta** y queda registrado como `A-58` (P1): el **KPI comercial no descuenta los reembolsos** (un pedido reembolsado sigue contando su total completo en ventas, ingresos, ticket promedio y ranking por producto/sucursal/cajero), y no existe un **Void/Reversal de cobro** conservando el registro original. La implementacion no se comenzo: se agoto el contexto de la sesion del agente, no hay ninguna decision humana pendiente.

**A-15 / A-58 — semantica economica neta (cerrada)**: las metricas comerciales del panel nunca cuentan como ingreso plata devuelta o invalidada. La regla vive en **un solo lugar** (el dominio): `netOrderValue` = `total - importe devuelto/invalidado`, nunca negativo, y `countsAsSale` (con devoluciones, el pedido cuenta solo si le quedo algo; sin devoluciones, una venta de C$0 sigue siendo una venta) — la usan ventas, ticket promedio, series, comparaciones y cualquier agregado futuro. La consulta del KPI trae los `Refund` **aprobados** del pedido y el agregado calcula el neto. **Limitacion declarada**: el modelo no guarda que items se devolvieron, asi que un pedido con devoluciones **no entra en el desglose por producto** (omitir antes que inventar). RED observado (`una venta reembolsada seguia contando como ingreso: expected 100 to be +0`), 6 casos nuevos, mutation check (4 de 6 en rojo) y el contrato previo del agregado intacto.

**A-15 / A-59 — anular un cobro (cerrada, cierra A-15)**: el remanente de A-15 se implemento y A-15 quedo **cerrado**. Un `Payment` mal registrado —duplicado, con el monto o el medio equivocados— se **anula** conservando el registro original: migracion aditiva `20260925120000_add_payment_void` (`voidedAt`, `voidedByUserId`, `voidReason`), puerta `canVoidPayment` (**solo owner**), `POST /api/admin/payments/[id]/void` con su composicion y asiento `payment.void`. La regla «un cobro anulado no cuenta» vive **una sola vez** por adaptador (`NOT_VOIDED` / `activePayments`): las cinco consultas de lista y la agregacion del saldo excluyen los anulados, asi que el arqueo (cierre y corte X), el saldo del pedido, la conciliacion y los documentos quedan afuera sin tocar cada consumidor. Las dos puntas de la misma invariante se rechazan entre si: **no se anula un cobro con devolucion viva** (pendiente o aprobada) y **no se aprueba la devolucion de un cobro anulado** (rechazarla si: es como se limpia antes de anular). La anulacion es **idempotente y segura ante carreras** porque la guarda va en el `WHERE` (`voidedAt: null`), no en el `if` de la lectura. Las **metricas no se tocaron**: no leen `Payment` (verificado) y el neto de `A-58` ya contemplaba el «importe invalidado». RED observado (`The column Payment.voidedAt does not exist in the current database`), 4 casos contra PostgreSQL real (el arqueo pasa de 800 a 300 al anular el cobro de 500 con la fila original intacta; el saldo del pedido vuelve a 0; dos anulaciones simultaneas firman una sola; una devolucion viva bloquea la anulacion) y **tres mutation checks** (filtro de exclusion, guarda del `WHERE` y devoluciones vivas), los tres restaurados. **Fuera de alcance a proposito**: la superficie de UI para anular (la ruta es la API) y mostrar el cobro anulado en el detalle del pedido.

**Fase de estabilizacion tecnica — CERRADA (2026-09-25)**: se cumple el criterio que el owner fijo: **A-15 completo**, tests verdes (unitarios, contratos, PostgreSQL real y CI), **ningun P0 conocido** y **ningun P1 de dinero abierto ligado a A-15**. No se iniciaron `AUD-009/010/012/013/014` ni una auditoria nueva, y **no** se abrio ninguna TASK por hallazgos laterales: lo que aparecio quedo en el backlog como observacion. La proxima TASK planificada es **ARCH-001** (arquitectura de producto y modulos) y **no se empezo**.

## 4. Trabajo actual

**Fase de estabilización técnica cerrada (2026-09-25)**: `main` = `974fa74`, CI verde (los cuatro checks + `publish`). Última TASK: **AUD-059** (`A-59`), que cierra `A-15`. **Nada de lo mergeado después de `17ecb27` está desplegado**: el deploy de `main` a producción es del owner (runbook, preflight, backup manual y smokes). **No hay ninguna TASK en curso**; la próxima planificada es ARCH-001 y no se inició.

**TASK-AUD-059 — Void/Reversal de cobro (cerrada, `974fa74`)**: un cobro mal registrado se **anula** conservando la fila (migración aditiva `20260925120000_add_payment_void`), con `canVoidPayment` (solo owner), motivo obligatorio y asiento `payment.void`. La exclusión vive una sola vez por adaptador, así que el arqueo, el saldo del pedido, la conciliación y los documentos dejan de verlo; y las dos puntas de la invariante se rechazan entre sí (no se anula un cobro con devolución viva, no se aprueba la devolución de un cobro anulado). Detalle y evidencia en §3.

**Release AUD-003..006 a producción (2026-09-25)**: `main` (`17ecb27`) desplegado con Easypanel y sirviendo `build-20260925-123054`. Preflight, backup pre-deploy, health/readiness, smokes (7/7 y 6/6) y las comprobaciones HTTP de solo lectura están en §1. **Sin reparación de datos históricos**: `A-50`/`A-51` siguen sin tocar y no se pudieron leer desde el entorno del agente (sin acceso read-only a la base). **AUD-015 no se inició como TASK**: su alcance se cerró con `A-58` y `A-59`.

**TASK-AUD-006 — Invoice Sequence Concurrency** (cerrada, `17ecb27`): el correlativo de la factura se calculaba leyendo la última y sumando uno, y la emisión que perdía la carrera contra el índice único **le fallaba al cajero** (el pedido quedaba sin factura; en el mismo pedido, dos toques simultáneos reventaban). Ahora el repositorio **asigna el correlativo y crea como una sola operación**, con reintento acotado (choque de número) y devolviendo la factura existente cuando el choque es del pedido. Factura **simple, no fiscal**; sin migración.

**TASK-AUD-005 — Shift Close Atomicity** (cerrada, `1c452d9`): el cierre del turno escribía en **tres escrituras sueltas** (snapshot + conteos de cierre + cierres de banco) y leía los cobros **antes** de que nadie bloqueara la fila del turno. Ahora corre en **una sola transacción** con la fila del turno **bloqueada** (`SELECT … FOR UPDATE`) y el arqueo se lee **después** del bloqueo; el cobro pide el mismo lock antes de escribir. Cierra `A-47` (de la review de AUD-004) y los dos caminos que le firman el turno a un `Payment` (`registerPosSale` y el cobro de un pedido existente), los dos con el mismo lock. La review adversarial encontró además que el cierre de **producción no cableaba movimientos ni devoluciones**: firmaba un esperado distinto al del corte X del mismo turno. Eso **cambia el número del arqueo** en los turnos con retiros o devoluciones (ahora coincide con el corte X y con la fórmula documentada): es lo único de esta TASK que el owner tiene que mirar después del deploy. Sin cambio de esquema.

**TASK-AUD-004 — POS Sale Atomicity** (cerrada, `c0b427b`): el riesgo se **reprodujo** contra PostgreSQL real (pedido
persistido con 1 de 2 cobros, y con **cero** cobros por la otra vía; el cupón consumido y el reintento
devolviendo la venta incompleta) y se cerró con un **límite atómico explícito**: el pedido, su cupón y todos
sus cobros en un solo `$transaction`. Dos hallazgos nuevos en el camino: dentro de una transacción un `P2002`
**aborta** la transacción (hay que rehacerla, no re-leer adentro) y el aviso de pedido creado tenía que salir
**después del commit** para no sobrevivir a un rollback. Se montó el **arnés de PostgreSQL real** para
Vitest y corre en CI (job `migrations`). Sin cambio de producto ni de la fórmula del dinero, sin migración.
La **review adversarial** no encontró forma de que una venta quede parcial ni un cobro duplicado y dejó
cuatro hallazgos fuera de alcance (`A-46` a `A-49`) más el pendiente del owner sobre los datos anteriores
(`A-50`).

**TASK-AUD-003 — Blind Cash Authorization**: **cerrada**. PR #35 → `4deb8e5`. Encontró y cerró dos fugas
reales: el corte X y el cierre mandaban los **sumandos** del esperado, y el **traspaso** devolvía el esperado
sin filtrar por una puerta del mostrador. Las pantallas acompañan.

**TASK-AUD-002 — Git / CI Governance**: **cerrada**. PR #33 → `f441c48`. El ruleset `Protect main` **exige
Pull Request** (0 aprobaciones) y `verify` corre `build:webpack` cuando la PR toca un `page.tsx`.

**TASK-AUD-001 / AUD-000**: **cerradas** (`1b12dfd` / `eeaa810`), las dos con `publish` en verde.

## 5. Siguiente trabajo

El programa completo, con objetivo, prioridad, riesgo, dependencia y orden, está en
[`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md).

**El bloque financiero de la remediación quedó cerrado** (`AUD-003..006`, `A-54`, `A-55`, `A-58`, `A-59`) y
con él la **fase de estabilización técnica**. Lo que sigue, en orden:

1. **Deploy de `main` a producción** — decisión del owner: hay seis cambios mergeados sin desplegar
   (§1) y una migración aditiva pendiente de aplicar. El runbook manda la secuencia.
2. **`ARCH-001` — Product & Module Architecture**: es la próxima TASK planificada y **no se inició**.
3. `AUD-009`/`AUD-010` (outbox: lease y semántica de entrega) y `AUD-012`/`AUD-013`/`AUD-014` siguen en el
   roadmap, **sin iniciar**.
4. `A-57` (backup programado) es **infraestructura**: el owner decide y no bloquea el producto.

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
