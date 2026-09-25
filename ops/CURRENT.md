# CURRENT.md — estado operativo actual

**Qué es este archivo**: la fuente de verdad **operativa y actual**. Un agente nuevo tiene que entender
en qué estado está el sistema en pocos minutos.

**Qué NO va acá**: historia (va a [`history/`](history/)), procedimientos (van a
[`.agents/skills/`](../.agents/skills/)) ni arquitectura (va a
[`.agents/CONTEXT.md`](../.agents/CONTEXT.md)). Este archivo se **actualiza seguido** y se mantiene
corto: si crece como un diario, dejó de servir.

> **Última actualización**: 2026-09-24, por TASK-AUD-000 (reorganización del sistema de ingeniería).
> No se tocó producción, la base, el ruleset ni el deploy: el estado de producción de abajo es el
> **registro del repo**, no una verificación nueva de esta TASK.

---

## 1. Producción

| Qué | Estado |
|---|---|
| **Último deploy registrado** | `build-20260925-015642`, sobre el código de `33c435d` (PR #29). Después entró el PR #30 (`0f4cb21`), **solo documentación**: no cambia el artefacto servido |
| **Modelo de deploy** | Easypanel, proyecto `brunobot`, servicio `oneburguerweb`; build **desde GitHub `main`** con `forceRebuild`. Una sola llamada a `deployService` |
| **Hosts activos** | `oneburgernic.com` y `www` (landing + redirects 307) · `menu.oneburgernic.com` (app de pedidos) · `admin.oneburgernic.com` (panel). Los cuatro con certificado |
| **Health / readiness** | `GET /api/health` (versión del build) · `GET /api/readiness` (`SELECT 1`, 503 si la base no responde) |
| **Smokes** | Última corrida registrada: menú **7/7** y hosts **6/6** (solo lectura) |
| **Base de datos** | PostgreSQL 17 en `oneburguer-postgres` (sin puerto expuesto). **Respaldo diario** `0 9 * * *` a disco local, **con drill de restore hecho y verificado** (2026-09-12) |
| **Datos de negocio** | 3 sucursales reales (Camino de Oriente, Carretera Masaya, Casa Antigua). La carta la sigue cargando el owner: al último registro, 2 categorías y 6 productos |
| **Caja en producción** | Sin terminales de caja cargadas al momento del último QA: es el estado real del negocio, no un defecto |

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
| **`A-17` — pendiente de reproducir (probablemente obsoleta)** | El texto original decía que la tarjeta no se reportaba al cerrar y que transferencia no se podía cobrar. **Verificado en el código: ya no aplica** — el POS cobra `cash`/`card`/`transfer`/`other` (`POS_PAYMENT_METHODS`) y el cierre **congela** `cardSalesAmount`, `transferSalesAmount` y `otherSalesAmount`. Falta **reproducir** si sobrevive algún resto antes de tomarla | `A-17` en [`audit-backlog.md`](audit-backlog.md) |
| **Atomicidad de la venta del POS** | Falta el límite atómico explícito. Riesgo **a reproducir** (con PostgreSQL real): un pedido —y el uso del cupón— persistido con **cero o parte** de sus `Payment` si falla un `createPayment` posterior (el alta va primero; los cobros se crean uno por uno). El reintento con la misma `idempotencyKey` devuelve los pagos que existan, **sin completar** los que falten. Sin decidir la solución | TASK-AUD-004 |
| **Atomicidad del cierre de turno** | Estudio del límite real del cierre: estado/snapshot de `Shift`, conteos de cierre y cierres de banco. `Payment.shiftId` se asigna **al cobrar**, no al cerrar | TASK-AUD-005 |
| **Numeración de facturas** | Carrera entre `findLatestNumber` y el alta: el `UNIQUE` ya impide duplicados **persistidos**, pero la emisión puede **fallar**. Solución sin predeterminar | TASK-AUD-006 |
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

## 4. Trabajo actual

**TASK-AUD-000 — Agent Operating System** (esta TASK): reorganizar el sistema operativo de ingeniería.
Docs, estructura y contratos. **Sin cambio funcional del producto.** PR abierto, **sin mergear** por
pedido explícito del owner.

## 5. Siguiente trabajo

El programa completo, con objetivo, prioridad, riesgo, dependencia y orden, está en
[`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md).

Orden inmediato:

1. **TASK-AUD-001 — Test Integrity & Quality Gates** (P0 de proceso): los gates que impiden los falsos
   verdes. Va primero porque **todas** las demás dependen de poder confiar en sus tests.
2. **TASK-AUD-002 — Git / CI Governance**: cerrar el gap de PR obligatorio en el ruleset y alinear los
   checks.
3. **TASK-AUD-003 — Blind Cash Authorization / A-45**: **verificar y endurecer**, no construir desde
   cero (ver la nota de abajo).
4. `TASK-AUD-004` a `TASK-AUD-017` en el orden del roadmap.

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
