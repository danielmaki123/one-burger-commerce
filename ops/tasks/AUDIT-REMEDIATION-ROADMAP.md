# Roadmap de remediación de la auditoría

**Qué es**: el programa de trabajo posterior a TASK-AUD-000, en orden. Cada entrada registra **objetivo,
prioridad, riesgo, dependencia previa y por qué va en ese orden**. **Ninguna TASK de acá está
implementada.**

**Reglas de este programa**

- Una TASK por vez, con la plantilla [`TEMPLATE.md`](TEMPLATE.md) y la skill que corresponda a su clase
  de riesgo.
- **La evidencia se reproduce al abrir cada TASK** y se registra en
  [`../audit-backlog.md`](../audit-backlog.md) con su ID (regla de la skill
  [`audit`](../../.agents/skills/audit/SKILL.md)). Los títulos de abajo vienen del brief del owner: son
  el **programa**, no hallazgos probados todavía.
- El orden no es negociable sin una razón: cada bloque depende del anterior.

**Clases de riesgo**: `dinero` · `auth/datos` · `migración` · `UI` · `docs/CI`.

---

## Bloque 0 — Gobierno (antes de tocar el producto)

### TASK-AUD-000 — Agent Operating System · `P0` · riesgo `docs/CI`

- **Objetivo**: dejar el sistema operativo de ingeniería (constitución, contexto, memoria, skills, estado
  actual, historia, decisión, plantilla, roadmap y contratos documentales).
- **Riesgo**: sin esto, cada TASK siguiente inventa su propio proceso y no hay jerarquía de fuentes.
- **Depende de**: nada. Es la base.
- **Por qué acá**: **redefine las reglas bajo las cuales trabajarán todas las siguientes**. El owner
  revisa y autoriza el merge.
- **Estado**: **PR abierto, sin mergear** (esta TASK). Sin cambio funcional del producto.

### TASK-AUD-001 — Test Integrity & Quality Gates · `P0` · riesgo `docs/CI`

- **Objetivo**: automatizar lo razonablemente automatizable del protocolo de integridad de tests y de la
  review adversarial: detectar tests tautológicos, `expected` calculado con la función bajo prueba,
  coverage como sustituto de calidad, tests borrados o relajados, y exigir la evidencia de mutación.
  Endurecer los gates existentes sin romper la deuda congelada.
- **Riesgo**: si los tests no son confiables, **ninguna** corrección posterior es verificable. Un falso
  verde en una TASK de dinero es plata perdida.
- **Depende de**: TASK-AUD-000 (el protocolo tiene que existir y estar escrito antes de automatizarlo).
- **Por qué acá**: es el multiplicador de todas las demás. Va antes que cualquier arreglo funcional.

### TASK-AUD-002 — Git / CI Governance · `P0` · riesgo `docs/CI`

- **Objetivo**: cerrar el **gap verificado** de que el ruleset **no exige PR** para llegar a `main`
  (hoy lo sostiene el equipo, no GitHub), y alinear los checks requeridos con la realidad del workflow.
- **Riesgo**: sin PR obligatorio, un push directo a la rama de deploy es posible a nivel de plataforma;
  el ruleset solo bloquea borrado, force push y exige los cuatro checks.
- **Depende de**: TASK-AUD-000 (documentar la realidad del ruleset) y del **OK explícito del owner**
  para tocar la configuración de GitHub.
- **Por qué acá**: es gobierno, y tocar el ruleset es una decisión del owner, no del agente. **No se
  cambia la configuración de GitHub sin su pedido.**

---

## Bloque 1 — Plata y datos (el corazón de la auditoría)

### TASK-AUD-003 — Blind Cash Authorization / `A-45` · `P1` · riesgo `dinero`

- **Objetivo**: **verificar y endurecer**, no construir: el arqueo ciego (que el `cashier` no vea el
  esperado ni la diferencia) ya es regla de servidor.
- **Riesgo**: una fuga del esperado rompe el control interno de caja (el cajero se auditaría a sí
  mismo).
- **Depende de**: TASK-AUD-001 (para que la verificación sea confiable).
- **⚠️ Corrección al brief**: **A-45 está cerrado** desde el 2026-09-23
  (`src/app/api/admin/pos/shift/shift-arqueo-role-filter.ts`, con tests; verificado en el repo). El
  alcance real de esta TASK es **barrer todos los caminos** que devuelven el arqueo, cerrar los que
  falten y convertir el invariante en guardrail permanente.
- **Por qué acá**: es la primera de dinero y ya tiene base hecha: cierra rápido y deja el patrón para
  las siguientes.

### TASK-AUD-004 — POS Sale Atomicity · `P1` · riesgo `dinero`

- **Objetivo**: **reproducir y estudiar** el límite atómico real de la venta del mostrador, **sin decidir
  todavía la solución**. Punto de partida: qué escribe hoy la venta —el pedido (`Order`, con su cupón) y
  sus `Payment`, cada uno firmado con el `shiftId` de la terminal— y qué efectos quedan **fuera** de esa
  persistencia.
- **A investigar (registrado por el owner)**: `auditManualDiscount` corre **después** de que la venta se
  persiste (`src/app/api/admin/pos/sale/route.ts:29-35`): un descuento manual aplicado con éxito y un
  fallo posterior del audit dejan el registro de acciones sensibles incompleto. **No se resuelve acá.**
- **Fuera del alcance (verificado)**: `CashMovement` **no** es parte de la venta —es plata que entra o
  sale del cajón **sin ser un cobro**— y `Invoice` **no** nace en el cobro: se emite por su propio caso
  de uso/API (`emit-invoice`).
- **Riesgo**: *partial write* = un `Payment` sin la venta que lo respalda, o una venta sin sus cobros.
  Es plata que no cuadra y no se puede reconstruir.
- **Depende de**: TASK-AUD-001 y TASK-AUD-003. Requiere prueba contra **PostgreSQL real**.
- **Por qué acá**: es la operación de dinero más frecuente del sistema.

### TASK-AUD-005 — Shift Close Atomicity · `P1` · riesgo `dinero`

- **Objetivo**: **estudiar** la atomicidad real del cierre de turno: qué persiste y con qué límite, **sin
  decidir la solución**. Punto de partida: la persistencia **propia** del cierre — estado/snapshot de
  `Shift` (`closingAmount`, `expectedAmount`, `expectedByCurrency`, desglose por medio, propinas, neto de
  movimientos, diferencia de banco), los **conteos de cierre** (`ShiftCashCount`) y los **cierres de
  banco** (`ShiftBankClose`) — y que un turno cerrado no reciba pagos nuevos.
- **Corrección (verificado)**: `Payment.shiftId` se asigna **al cobrar**, no al cerrar
  (`src/modules/pos/adapters/production-pos-sale.ts`), así que la «atribución de pagos» **no** es parte
  del límite atómico del cierre. Lo que el cierre sí hace es **leer** los pagos: por `shiftId` cuando el
  turno tiene terminal, y con la ventana de tiempo del local como respaldo cuando no la tiene
  (`src/modules/orders/features/shift/close-shift.ts:299-313`) — a verificar en el estudio.
- **Riesgo**: un cierre a medias deja el arqueo mintiendo, que es justo el documento que se firma.
- **Depende de**: TASK-AUD-004.
- **Por qué acá**: cierra el ciclo del turno después de la venta.

### TASK-AUD-006 — Invoice Sequence Concurrency · `P1` · riesgo `dinero`

- **Objetivo**: **estudiar** la numeración de la factura bajo concurrencia, **sin predeterminar la
  solución**. El número se calcula leyendo el último y sumando uno antes de crear
  (`findLatestNumber` → `nextInvoiceNumber` → alta, `src/modules/invoices/features/emit-invoice/emit-invoice.ts:180`).
- **Riesgo a investigar**: la base **ya** tiene dos `UNIQUE` — `Invoice.number` y `Invoice.orderId`
  (`prisma/schema.prisma:1240-1241`) —, así que el síntoma realista no es un número repetido persistido
  sino una **emisión que falla** cuando dos requests calculan el mismo número a la vez (o cuando se
  reintenta emitir la factura de un pedido que ya la tiene). Reproducir y acotar el impacto: ¿el fallo es
  visible para el cajero?, ¿queda el pedido sin factura?, ¿se puede reintentar?
- **No es un problema fiscal**: la factura es una **factura simple, explícitamente no fiscal** (sin
  autorización de la DGI ni rango oficial de numeración; `src/modules/invoices/domain/invoice.ts`).
- **Fuera del alcance (verificado)**: la factura **no** nace en la transacción del POS; se emite por su
  propio caso de uso/API después del cobro.
- **Depende de**: TASK-AUD-001.
- **Por qué acá**: comparte con AUD-004/005 la noción de unicidad garantizada por la **base**, no por un `if`.

### TASK-AUD-015 — Financial Invariants Review · `P1` · riesgo `dinero`

- **Objetivo**: revisar el conjunto completo de invariantes financieras (totales, propinas, descuentos,
  devoluciones, cambio/vuelto, tipo de cambio, arqueo, conciliación) y fijar cada una con un test.
- **Riesgo**: es la red que atrapa lo que las TASK anteriores no previeron.
- **Depende de**: TASK-AUD-004, 005 y 006 (primero la atomicidad, después el inventario de invariantes).
- **Por qué acá**: se hace con el terreno ya firme. Incluye `A-15` (cobro de pedido cancelado en el
  arqueo) — **el ítem de plata más importante del backlog**, que necesita decisión del owner.

---

## Bloque 2 — Superficie e infraestructura

### TASK-AUD-007 — Production Environment Fail-Closed · `P1` · riesgo `auth/datos`

- **Objetivo**: que el arranque no se degrade en silencio si falta o está mal una variable crítica
  (`APP_ENV`, `NODE_ENV`, `DATABASE_URL`, los interruptores que escriben OTP en claro).
- **Riesgo**: un entorno de producción a medio configurar puede habilitar endpoints de staging o correr
  sin `secure` en las cookies.
- **Depende de**: TASK-AUD-001.
- **Por qué acá**: es infraestructura de seguridad barata y de alto impacto; va antes de los endpoints.

### TASK-AUD-008 — Internal/Staging Endpoint Isolation · `P1` · riesgo `auth/datos`

- **Objetivo**: que **ningún** endpoint interno o de staging sea alcanzable fuera del entorno que le
  corresponde.
- **Riesgo**: un endpoint de staging alcanzable en producción crea admins y corre seeds.
- **Depende de**: TASK-AUD-007 (el fail-closed por entorno es la base del aislamiento).
- **Por qué acá**: se apoya en el gate anterior.

### TASK-AUD-009 — Outbox Lease / Recovery · `P2` · riesgo `datos`

- **Objetivo**: que un evento tomado y no confirmado **no** quede colgado para siempre y que un lease
  vencido se recupere.
- **Riesgo**: avisos que nunca salen y eventos zombis acumulándose.
- **Depende de**: TASK-AUD-001.
- **Por qué acá**: es la mitad «durabilidad» del outbox; va antes de definir la semántica de entrega.

### TASK-AUD-010 — Outbox Delivery Semantics · `P2` · riesgo `datos`

- **Objetivo**: definir y probar la semántica de entrega (at-least-once) y su idempotencia del lado del
  consumidor.
- **Riesgo**: avisos duplicados o perdidos sin criterio escrito.
- **Depende de**: TASK-AUD-009 (primero que no se pierda el lease, después cuántas veces se entrega).
- **Por qué acá**: cierra el outbox completo.

### TASK-AUD-011 — Backup + Restore Drill · `P2` · riesgo `datos`

- **Objetivo**: **repetir y automatizar** el drill de restore en una base aislada y comparar conteos.
- **Riesgo**: un backup que nunca se restauró es un backup que no existe. (El respaldo diario **ya está
  configurado y el drill ya se hizo el 2026-09-12**: esto es recurrencia y verificación, no partir de
  cero.)
- **Depende de**: TASK-AUD-001.
- **Por qué acá**: es la red de seguridad de las TASK de migración y de dinero. No urge como P0/P1
  porque ya hay un drill verificado, pero no puede quedar afuera.

### TASK-AUD-012 — External Monitoring · `P2` · riesgo `infra`

- **Objetivo**: monitoreo externo que pegue a `GET /api/readiness` y avise al canal del equipo.
- **Riesgo**: hoy nadie se entera de una caída salvo que un cliente avise.
- **Depende de**: decisión del owner (qué servicio) — **es un bloqueo abierto en
  [`../CURRENT.md`](../CURRENT.md) §6**.
- **Por qué acá**: es operación, no producto; puede paralelizarse si el owner elige el servicio.

### TASK-AUD-013 — Secret Scanning Hardening · `P2` · riesgo `auth/datos`

- **Objetivo**: endurecer la detección de secretos más allá del check actual
  (`npm run security:secrets`), sin instalar dependencias que cambien el stack sin OK del owner.
- **Riesgo**: un secreto en un commit es un acceso total al servidor.
- **Depende de**: TASK-AUD-001.
- **Por qué acá**: barato y de alto impacto; se apoya en el gate que ya existe.

### TASK-AUD-014 — Rate Limit / OTP Hardening · `P2` · riesgo `auth/datos`

- **Objetivo**: revisar el limitador en memoria y el flujo de OTP (que hoy responde 503 sin proveedor
  real): límites, mensajes, y que no se filtren códigos.
- **Riesgo**: el limitador en memoria es una limitación aceptada con una sola réplica; una segunda
  réplica lo vuelve decorativo. El OTP sin proveedor es superficie muerta que puede reactivarse mal.
- **Depende de**: TASK-AUD-007 y TASK-AUD-008.
- **Por qué acá**: toca la puerta de entrada; va después de que el entorno y los endpoints estén sanos.

### TASK-AUD-016 — Scope / Capabilities Alignment · `P2` · riesgo `auth/datos`

- **Objetivo**: alinear lo que la UI ofrece con lo que el servidor autoriza y con el alcance del MVP:
  navegación por rol (`A-10`), módulos fuera del MVP que no deben aparecer, y puertas que hoy coinciden
  pero no deberían (`A-12`).
- **Riesgo**: una capacidad visible que el servidor rechaza es una invitación a un bug de autorización;
  y una capacidad oculta que el servidor permite es una fuga.
- **Depende de**: TASK-AUD-007 y TASK-AUD-008.
- **Por qué acá**: cierra el borde entre producto y autorización **después** de que las reglas de
  servidor estén firmes.

---

## Bloque 3 — Deuda estructural (continuo)

### TASK-AUD-017+ — Structural Debt Reduction · `P2`/`P3` · riesgo `UI`/`deuda`

- **Objetivo**: bajar la deuda inventariada **sin subir ningún techo**: controles crudos (`A-24`),
  partir `settings-client.tsx` (`A-26`), los `window.confirm` (`A-25`), la barra del KDS en el 20%
  (`A-28`), el E2E determinista de madrugada (`A-27`), el mapeo de errores repetido (`A-14`), los
  módulos cascarón (`A-13`), la deuda de UI sin guardrail (`A-22`) y la de TDD congelada (`T-01`…`T-14`).
- **Riesgo**: es deuda de mantenimiento, no de plata; el riesgo de **no** hacerla es que crezca.
- **Depende de**: TASK-AUD-000 (la regla de ratcheting) y TASK-AUD-001 (los gates que impiden que crezca
  mientras se baja).
- **Por qué al final y en continuo**: por la regla del repo, **la deuda existente puede quedar
  temporalmente; la deuda nueva no**. Se ataca por oportunidad y por cercanía al código que se toca, sin
  frenar la remediación de plata.

---

## Resumen del orden

| # | TASK | Prioridad | Depende de |
|---|---|---|---|
| 000 | Agent Operating System | P0 | — |
| 001 | Test Integrity & Quality Gates | P0 | 000 |
| 002 | Git / CI Governance | P0 | 000 + OK del owner |
| 003 | Blind Cash Authorization (`A-45`) | P1 | 001 |
| 004 | POS Sale Atomicity | P1 | 001, 003 |
| 005 | Shift Close Atomicity | P1 | 004 |
| 006 | Invoice Sequence Concurrency | P1 | 001 |
| 015 | Financial Invariants Review | P1 | 004, 005, 006 |
| 007 | Production Environment Fail-Closed | P1 | 001 |
| 008 | Internal/Staging Endpoint Isolation | P1 | 007 |
| 009 | Outbox Lease / Recovery | P2 | 001 |
| 010 | Outbox Delivery Semantics | P2 | 009 |
| 011 | Backup + Restore Drill | P2 | 001 |
| 012 | External Monitoring | P2 | decisión del owner |
| 013 | Secret Scanning Hardening | P2 | 001 |
| 014 | Rate Limit / OTP Hardening | P2 | 007, 008 |
| 016 | Scope / Capabilities Alignment | P2 | 007, 008 |
| 017+ | Structural Debt Reduction | P2/P3 | 000, 001 |

**Lógica del orden**: primero el gobierno que hace confiables las pruebas (000–002); después la **plata**
(003–006, 015), que es donde el error cuesta dinero real; después la **superficie de seguridad**
(007–008, 013–014) y los **datos durables** (009–011); y la deuda estructural en continuo, sin subir
ningún techo.
