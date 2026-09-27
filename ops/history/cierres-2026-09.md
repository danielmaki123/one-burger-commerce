# Historia archivada — cierres técnicos y de producto (2026-09)

**Qué es**: el detalle de los cierres que `ops/CURRENT.md` tenía en su cuerpo y que se movió acá cuando el
archivo llegó a su techo de **250 líneas** (`TASK-GOV-001`, 2026-09-27). **No es fuente de verdad**: el estado
vigente vive en [`../CURRENT.md`](../CURRENT.md), la secuencia en
[`../roadmap/PRODUCT-UX-ROADMAP.md`](../roadmap/PRODUCT-UX-ROADMAP.md) y los hallazgos con su ID en
[`../audit-backlog.md`](../audit-backlog.md).

**Lo que quedó vivo en `CURRENT.md`**: el estado de producción (§1), las capacidades (§2), los riesgos
abiertos (§3), el trabajo actual (§4), lo que sigue (§5), los bloqueos (§6) y las referencias (§7).

---

## Bloque financiero de la remediación (cerrado y desplegado, 2026-09-25)

**AUD-007 — Production Environment Fail-Closed (cerrada)**: el entrypoint de producción
(`scripts/start-production.mjs`, el `CMD` de la imagen) ahora **se niega a arrancar si `APP_ENV` no es
`production`**: antes solo avisaba por consola y con `APP_ENV=staging` los endpoints internos de staging (que
crean admins y corren seeds) quedaban alcanzables. Se sumó el modo `START_PRODUCTION_VALIDATE_ONLY=true`
(valida y sale, sin migrar ni arrancar) y el contrato `production-environment-contract.test.ts` (5 casos, con
mutación).

**AUD-008 — Internal/Staging Endpoint Isolation (cerrada)**: se inventariaron las **6** rutas internas
(`/api/internal/**`). Las **5** de staging cierran por entorno (`APP_ENV === "staging"` → 403, y si la variable
faltara también) y todas exigen un secreto comparado con `timingSafeEqual`; el procesador del outbox rechaza si
el secreto falta. **Verificado en producción con GET** (nunca POST: el de staging crea admins y el del outbox
procesa la cola): las 6 responden **405** sin ejecutar nada. Guardrail nuevo:
`internal-endpoint-isolation-contract.test.ts` recorre las rutas y falla si una nueva nace sin su puerta (con
mutación verificada).

**A-54 — ningún cobro fuera de arqueo (cerrada)**: el arqueo (cierre y corte X) leía, para un turno con
terminal, **solo** los cobros atribuidos a ese turno, así que un cobro entrado **sin caja abierta**
(`Payment.shiftId = null`, el caso del cobro de un pedido del menú) no entraba al arqueo de nadie. Ahora suma
los cobros de su ventana **sin turno** (puerto nuevo `listUnattributedPaymentsInRange`, en los dos
adaptadores): todo cobro entra al arqueo de exactamente un turno. Probado contra PostgreSQL real, con mutación,
y sin contarse la plata entre dos terminales.

**A-55 — doble cobro concurrente (cerrada)**: `registerOrderPayment` validaba el tope leyendo la suma de los
cobros y después escribía: dos cobros simultáneos del mismo pedido leían el mismo saldo, los dos pasaban la
comprobación y el pedido quedaba cobrado por encima de su total (RED real: *los dos cobros pasaron la
comprobación previa … to have a length of 1 but got 2*). Ahora la validación corre **dentro** de la transacción
con la fila del pedido bloqueada (`lockOrder`, `SELECT … FOR UPDATE`), así que el segundo espera y lee la suma
actualizada. Orden de locks: pedido y después turno (el cierre bloquea el turno: sin inversión). Probado contra
PostgreSQL real con dos requests simultáneos forzados por barrera y mutation check.

**A-15 / A-58 — semántica económica neta (cerrada)**: las métricas comerciales del panel nunca cuentan como
ingreso plata devuelta o invalidada. La regla vive en **un solo lugar** (el dominio): `netOrderValue` =
`total - importe devuelto/invalidado`, nunca negativo, y `countsAsSale` (con devoluciones, el pedido cuenta
solo si le quedó algo; sin devoluciones, una venta de C$0 sigue siendo una venta) — la usan ventas, ticket
promedio, series, comparaciones y cualquier agregado futuro. **Limitación declarada**: el modelo no guarda qué
ítems se devolvieron, así que un pedido con devoluciones **no entra en el desglose por producto** (omitir antes
que inventar). RED observado, 6 casos nuevos, mutation check (4 de 6 en rojo) y el contrato previo del agregado
intacto.

**A-15 / A-59 — anular un cobro (cerrada, cierra A-15)**: un `Payment` mal registrado —duplicado, con el monto
o el medio equivocados— se **anula** conservando el registro original: migración aditiva
`20260925120000_add_payment_void` (`voidedAt`, `voidedByUserId`, `voidReason`), puerta `canVoidPayment` (**solo
owner**), `POST /api/admin/payments/[id]/void` con su composición y asiento `payment.void`. La regla «un cobro
anulado no cuenta» vive **una sola vez** por adaptador (`NOT_VOIDED` / `activePayments`). Las dos puntas de la
misma invariante se rechazan entre sí: **no se anula un cobro con devolución viva** y **no se aprueba la
devolución de un cobro anulado**. La anulación es **idempotente y segura ante carreras** porque la guarda va en
el `WHERE` (`voidedAt: null`), no en el `if` de la lectura. RED observado (`The column Payment.voidedAt does not
exist in the current database`), 4 casos contra PostgreSQL real y **tres mutation checks**, los tres
restaurados. **Fuera de alcance a propósito**: la superficie de UI para anular y mostrar el cobro anulado en el
detalle del pedido.

**Fase de estabilización técnica — CERRADA (2026-09-25)**: se cumple el criterio que fijó el owner: **A-15
completo**, tests verdes (unitarios, contratos, PostgreSQL real y CI), **ningún P0 conocido** y **ningún P1 de
dinero abierto ligado a A-15**. No se iniciaron `AUD-009/010/012/013/014` ni una auditoría nueva, y **no** se
abrió ninguna TASK por hallazgos laterales: lo que apareció quedó en el backlog como observación. La TASK que
siguió fue **ARCH-001** (arquitectura de producto y módulos).

**Release consolidado a producción (2026-09-25, cerrado)**: `main` = `0b840e7` **desplegado** y sirviendo
`build-20260925-174535`. El release llevó A-54, A-55, AUD-007, AUD-008, A-58 y A-59 con su migración aditiva.
**Sin reparación de datos históricos**: `A-50`/`A-51` siguen sin tocar.

---

## Precedentes de producto y de arquitectura (cerrados)

**SCREEN-POS-QUICK-SALE-001.1 y 001.2 — POS Fase 1 / Venta rápida (CERRADA DEFINITIVAMENTE)**: la 001 adoptó
el workspace `CATÁLOGO | VENTA` (`be4c051`) y la **001.1** lo corrigió contra la **referencia revisada del
owner**: hero y explicaciones fuera, barra operativa de **una línea**, acciones de caja **solo donde bloquean
el cobro**, `Cobrar pedido del menú` fuera del POS (*one canonical flow*: Órdenes localiza, POS cobra) y
opciones secundarias plegadas. La **001.2** corrigió la composición del ticket: el panel **no comprime la lista
de líneas** y tiene **un solo scroll** (líneas + checkout en la misma superficie), con el **total en el pie**
junto al CTA. **Sin dominio, sin endpoints, sin permisos y sin DB** en las tres. Detalle, mediciones y evidencia
en [`../design/screens/pos-quick-sale.md`](../design/screens/pos-quick-sale.md). **La Fase 2 no se inició** (su
contenido se repartió en el roadmap maestro).

**SCREEN-ORDERS-001 — Órdenes (cerrada, `fff8d71`, desplegada)**: discovery, arquitectura/IA, spec, prototipo
y capturas → implementación bajo DS v4 → QA de navegador a 375/768/1280 → PR #57 con CI verde. Entregado: los
dos `animate-pulse` fuera de reposo, el anuncio de atraso con el **umbral del local** (antes, el de por
defecto), el copy de la factura a **80 mm** y la **barra compacta en celular** (la primera comanda ya no queda
debajo del pliegue). Sin dominio, sin endpoints, sin permisos y sin DB. La deuda del discovery quedó registrada
como `A-60` a `A-66`.

**ARCH-001 — Product & Module Architecture (cerrada, 2026-09-25, docs-only)**: la constitución de producto vive
en [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md): las secciones reales del panel,
los módulos que existen, el **ownership** de cada agregado, la regla del Resumen como overview transversal, el
gate para capacidades nuevas y la **deuda registrada** (el dominio de Caja repartido entre `orders` y `pos`,
promociones en `orders`, `dashboard` sin puertos, los cascarones `coupons`/`table-ordering`, puertas sin call
site y la entrada muerta «Mesas» del móvil). **No cambió producto, rutas, navegación, diseño ni DB.**

**TASK-AUD-004 — POS Sale Atomicity (cerrada, `c0b427b`)**: el riesgo se **reprodujo** contra PostgreSQL real
(pedido persistido con 1 de 2 cobros, y con **cero** cobros por la otra vía; el cupón consumido y el reintento
devolviendo la venta incompleta) y se cerró con un **límite atómico explícito**: el pedido, su cupón y todos
sus cobros en un solo `$transaction`. Dos hallazgos en el camino: dentro de una transacción un `P2002`
**aborta** la transacción, y el aviso de pedido creado tenía que salir **después del commit**. Montó el
**arnés de PostgreSQL real** para Vitest (corre en CI, job `migrations`); sin migración. Su review adversarial
dejó `A-46` a `A-49`.

**AUD-003, AUD-002, AUD-001 y AUD-000** (`4deb8e5`, `f441c48`, `1b12dfd`, `eeaa810`): arqueo ciego sin fugas en
corte X, cierre y traspaso; y gobierno de Git/CI (el ruleset `Protect main` exige Pull Request con 0
aprobaciones).

---

## Baselines superados

- **`DS-001` (2026-09-26, cerrado)**: `4dc2cbb` → `build-20260926-003808`, sin migraciones; superado por
  `IA-001` + Órdenes.
- **`SCREEN-POS-QUICK-SALE-001.2` (2026-09-27, cerrado — POS Fase 1 cerrada definitivamente)**: `main` =
  `4f69a24` desplegado sirviendo `build-20260927-193653`. Reabrió POS Fase 1 **solo** para el defecto del
  ticket; **sin migraciones, sin dominio y sin backup**. El estado vigente está en
  [`../CURRENT.md`](../CURRENT.md) §1.
