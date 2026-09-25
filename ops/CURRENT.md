# CURRENT.md — estado operativo actual

**Qué es este archivo**: la fuente de verdad **operativa y actual**. Un agente nuevo tiene que entender
en qué estado está el sistema en pocos minutos.

**Qué NO va acá**: historia (va a [`history/`](history/)), procedimientos (van a
[`.agents/skills/`](../.agents/skills/)) ni arquitectura (va a
[`.agents/CONTEXT.md`](../.agents/CONTEXT.md)). Este archivo se **actualiza seguido** y se mantiene
corto: si crece como un diario, dejó de servir.

> **Última actualización**: 2026-09-25, por el **release de AUD-003..006 a producción** (Easypanel).
> `main` = `17ecb27745d798f3c014d6b462e6725285ae4299`, desplegado el 2026-09-25 (~12:29–12:34 UTC) y
> sirviendo `build-20260925-123054`. TASK-AUD-000 (`eeaa810`), AUD-001 (`1b12dfd`), AUD-002 (`f441c48`),
> AUD-003 (`4deb8e5`), AUD-004 (`c0b427b`), AUD-005 (`1c452d9`) y AUD-006 (`17ecb27`) quedaron **cerradas y
> desplegadas**.

---

## 1. Producción

| Qué | Estado |
|---|---|
| **Último deploy** | `build-20260925-123054`, sobre `17ecb27` (**AUD-003..006**), 2026-09-25 12:29 UTC. `commit.sha` del panel = `17ecb27`, `/api/health` = `build-20260925-123054`, `/api/readiness` `ready` (DB 11 ms), smokes **menú 7/7** y **hosts 6/6** |
| **Rollback target** | `build-20260925-022009`, commit configurado `0f4cb214765f2737e40aa6572acf980643ae0099` (código `33c435d`) |
| **Modelo de deploy** | Easypanel, proyecto `brunobot`, servicio `oneburguerweb`; build **desde GitHub `main`** con `forceRebuild`. Una sola llamada a `deployService` (la llamada cortó a los 72 s y el build siguió en segundo plano: comportamiento conocido) |
| **Migraciones** | AUD-003..006 **no** agregaron migraciones: el arranque aplicó `prisma migrate deploy` sin nada nuevo |
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

**P1**

| Riesgo | Detalle | Dónde |
|---|---|---|
| **Cobros de pedidos cancelados** | Un cobro de un pedido cancelado sigue contando en el arqueo y no hay devolución ni movimiento que lo compense: el cierre marca faltante sin forma de registrarlo | `A-15` en [`audit-backlog.md`](audit-backlog.md) · TASK-AUD-015 |

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

## 4. Trabajo actual

**Release AUD-003..006 a producción (2026-09-25)**: `main` (`17ecb27`) desplegado con Easypanel y sirviendo `build-20260925-123054`. Preflight, backup pre-deploy, health/readiness, smokes (7/7 y 6/6) y las comprobaciones HTTP de solo lectura están en §1. **Sin reparación de datos históricos**: `A-50`/`A-51` siguen sin tocar y no se pudieron leer desde el entorno del agente (sin acceso read-only a la base). **AUD-015 no se inició.**

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

Orden inmediato (bloque financiero):

1. `TASK-AUD-015` **no** se inicia en este bloque: tiene la decisión de producto pendiente de `A-15`.
2. El resto del programa (`AUD-007` en adelante) sigue en el roadmap: el bloque financiero (`004`, `005`, `006`) quedó **cerrado**.

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
| **Decisiones de producto pendientes** | Respuesta del owner sobre `A-15`, `A-19`, `A-20`/`A-34` y `A-23` (ver el backlog). `A-17` **no** está acá: se reproduce primero |

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
