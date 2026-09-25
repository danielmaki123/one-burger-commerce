# TASK-AUD-005 — Shift Close Atomicity

## TASK ID

`TASK-AUD-005` (rama `fix/task-aud-005-shift-close-atomicity`).

## Título

Cerrar el turno en un solo límite atómico y bloquear la fila del turno para que un cobro y un cierre no se crucen.

## Prioridad

`P1` (plata).

## Clase de riesgo

`dinero`.

---

## PROBLEMA

Dos problemas en la misma operación, los dos sobre el documento que se firma:

1. **El cierre no era atómico.** `PrismaShiftRepository.closeShift` hacía **tres escrituras sueltas**: el
   `updateMany` que pasa el turno a `closed` con el arqueo congelado (esperado, desglose por medio,
   diferencia, diferencia de banco), después el reemplazo de los `ShiftBankClose` y después los
   `ShiftCashCount` de cierre. Una falla —o un corte— entre la primera y las otras dejaba el turno
   **cerrado y firmado sin el detalle que lo justifica**, y como un turno cerrado no se vuelve a cerrar
   (`WHERE status = 'open'`), ese arqueo quedaba incompleto **para siempre**.
2. **El arqueo se calculaba antes de que nadie bloqueara nada.** `closeShift` leía los cobros del turno y
   recién después escribía el snapshot; el cobro (`registerPosSale`) resolvía la caja abierta **fuera** de su
   transacción y le firmaba el `shiftId` a cada `Payment`. Entre las dos cosas había una ventana en la que
   la venta quedaba firmada con un turno **cerrado**: su plata no entraba a ningún arqueo (el cierre ya
   había leído) y el documento firmado no la explicaba. Es `A-47`, y la review de TASK-AUD-004 mostró que
   **no se puede cerrar solo desde `closeShift`**: hace falta del lado del cobro.

## EVIDENCIA

Tests contra **PostgreSQL 17 real** (`src/modules/orders/features/shift/close-shift.postgres.test.ts`,
`npm run test:postgres`), con la base en el estado real (migrada, sin dobles donde importa):

- **Todo o nada**: `closeShift(id, { …bankCloses: [{ bankId: "bank_que_no_existe" }] })` —la segunda
  escritura choca con la clave foránea, como chocaría con cualquier falla real— deja el turno en `open`, sin
  `expectedAmount`, sin cierres de banco y sin conteos de cierre. **Rojo observado** con la mutación que
  restaura las tres escrituras sueltas:
  `el turno quedó cerrado sin su detalle: arqueo incompleto para siempre: expected 'closed' to be 'open'`.
- **La carrera, lado cobro**: con el turno ya cerrado antes de que la venta entre a su transacción, la venta
  se rechaza y **no queda ni cobro ni pedido**. **Rojo observado** sin la comprobación:
  `promise resolved "{ order: … }" instead of rejecting`.
- **La carrera, lado cierre**: con la venta **en curso** (turno bloqueado por la venta) y el cierre
  arrancando en el medio, el cierre **espera** y su arqueo cuenta la plata: `expectedAmount === 100`.
  **Rojo observado** sin el lock (leyendo el turno sin `FOR UPDATE`):
  `el arqueo firmó 0 con la plata de la venta en el cajón: expected +0 to be 100`.
- **Dos cierres simultáneos**: uno solo gana, el perdedor devuelve `null` y el detalle del ganador queda
  **una vez** (no se duplica el conteo del que perdió).

**Intento descartado (queda escrito)**: probar la no-atomicidad con un conteo duplicado no sirve —
`createMany` usa `skipDuplicates`. La clave foránea del banco es la falla real más simple de provocar sin
mocks.

**Nota honesta de TDD**: en esta TASK el fix se escribió **antes** que el test (el orden inverso al de
AUD-004). El rojo se observó **con las mutaciones** que restauran el comportamiento previo —que es
literalmente el código defectuoso— y cada una puso en rojo exactamente el caso de su invariante (ver
*MUTATION CHECK*). Es el caso que la skill de bugfix §2 admite documentando motivo, cómo se validó y qué
cubre.

## CAUSA RAÍZ

No había **una** operación: había una secuencia de escrituras y una lectura tomada en un momento arbitrario,
sin dueño del recurso compartido. El cierre escribía sin transacción (tres escrituras, tres oportunidades de
quedar a medias) y ninguno de los dos lados **bloqueaba** la fila del turno, que es el recurso que los dos
tocan: el cierre lo cierra y el cobro le firma plata. Un `if` sobre una lectura previa no es una guarda —ya
estaba escrito en la skill de dinero y este caso lo confirma.

## INVARIANTE

**Un turno cerrado tiene el documento completo: su snapshot, sus conteos de cierre y sus cierres de banco, o
no está cerrado.** Y: **todo `Payment` firmado con un turno está en el arqueo de ese turno**; ninguna venta
puede quedar firmada por un turno cerrado.

Formas equivalentes que se fijan con tests contra PostgreSQL real: el turno sigue `open` si una escritura del
cierre falla; un solo cierre gana entre dos simultáneos; una venta que entra después del cierre se rechaza sin
dejar pedido ni cobro; un cierre que arranca con la venta en curso espera y la cuenta.

## BOUNDED CONTEXT

- `orders`: `features/shift/close-shift` (caso de uso) y `adapters/prisma-shift-repository` (el `$transaction`
  propio o la participación en el del alcance, y `lockShiftRow`).
- `pos`: `features/register-pos-sale` + `commit-sale` (el cobro pide el lock) y los dos adaptadores de
  composición (`production-pos-shift`, `production-pos-sale`).
- `infrastructure/database`: el tipo `DatabaseClient` (de AUD-004).

---

## SCOPE IN

- `src/modules/orders/adapters/prisma-shift-repository.ts`: cliente inyectable, `inTransaction` (propia o la
  del alcance), `readShift(client, id)`, `closeShift` en una sola transacción y **`lockShiftRow`** exportado
  (`SELECT … FOR UPDATE`).
- `src/modules/orders/features/shift/close-shift.ts`: dependencia `runInShiftTransaction`, tipo
  `CloseShiftScope` (con `lockShift`), y el cierre partido en «validar el payload» (puro, antes) y
  `closeLockedShift` (bloquear → leer el turno → validar el cuadre contra los bancos de la sucursal → armar
  el arqueo → firmar).
- `src/modules/pos/features/close-pos-shift/close-pos-shift.ts`: pasa las dependencias del caso de uso.
- `src/modules/pos/adapters/production-pos-shift.ts`: el `$transaction` del cierre con el lock.
- `src/modules/pos/features/register-pos-sale/register-pos-sale.ts` + `commit-sale.ts`: `lockShift` en el
  alcance de la venta y la comprobación **antes** de crear el pedido (409 con motivo en español).
- `src/modules/pos/adapters/production-pos-sale.ts`: el lock dentro de la transacción de la venta.
- `src/shared/testing/in-memory-shift-transaction.ts` (**nuevo**): el doble de la unidad de trabajo para los
  unitarios y los tests de ruta.
- Tests: `close-shift.postgres.test.ts` (5, nuevos), el doble en `shift-features.test.ts`,
  `shift-terminals.test.ts`, `reopen-shift.test.ts`, `shift-routes.test.ts` y el de la venta
  (`commit-sale.test.ts`, `register-pos-sale.test.ts`, `route.test.ts`).

## SCOPE OUT

- **No** cambia ninguna fórmula del arqueo: el esperado, la diferencia, el desglose por medio y el cuadre por
  banco se calculan igual; lo que cambia es **cuándo y con qué garantías** se leen y se escriben.
- **No** se toca el esquema: sin migración.
- **No** se cambia el cierre ciego, ni la reapertura (ya es una transición condicional de una sola
  escritura), ni las devoluciones/movimientos (crear un movimiento o una devolución con la caja cerrada es
  otra operación y otra TASK: `A-19`/`A-15` están en el backlog).
- **No** se mueve el aviso al dueño (`registerShiftClosedAlert`) adentro de la transacción: sigue siendo
  best-effort **después** del cierre, como pide la skill (nada externo adentro).
- **No** se cambia la autorización de las rutas del cierre.

## DEPENDENCIAS

TASK-AUD-004 (el tipo `DatabaseClient`, el arnés de PostgreSQL y el patrón de alcance transaccional).
PostgreSQL real, disponible en local y en el job `migrations` del CI. Sin dependencias nuevas del stack.

## ARCHIVOS PROBABLES

| Archivo | Quién más lo consume |
|---|---|
| `prisma-shift-repository.ts` | Rutas de caja del POS, composiciones de cierres, movimientos y devoluciones |
| `close-shift.ts` | `close-pos-shift` (POS), la composición de cierres, el corte X no (solo lectura) |
| `production-pos-shift.ts` | Rutas `open`/`close`/`GET` de la caja del POS y la composición de cierres |
| `production-pos-sale.ts` | Ruta `POST /api/admin/pos/sale` |

---

## TEST ROJO

`src/modules/orders/features/shift/close-shift.postgres.test.ts`, 9 casos. El rojo de cada invariante se
observó con la mutación que restaura el comportamiento previo (ver *MUTATION CHECK*), con el mensaje de la
invariante y no de un import roto.

## ESTRATEGIA

El mismo patrón que AUD-004, extendido con el **bloqueo**: el caso de uso declara su unidad de trabajo
(`runInShiftTransaction`) y el adaptador la implementa con `$transaction`; adentro, **primero** se bloquea la
fila del turno (`SELECT … FOR UPDATE`) y **después** se lee lo que se va a firmar. El cobro pide el mismo lock
antes de escribir. Se eligió esto sobre:

- **compensar** el cierre a medias (volver a abrir y reescribir): no es una transacción y deja el arqueo
  mintiendo en el medio (además de que reabrir es una operación auditada);
- **un lock a nivel de tabla o `SERIALIZABLE`**: más contención y un modo de fallo (reintentos por
  serialización) que el caso no necesita: la fila del turno es el único recurso compartido.

## DDD

- `features`: el caso de uso declara el límite y bloquea; no conoce Prisma.
- `adapters`: la transacción, el lock (SQL explícito en el adaptador, que es donde vive Prisma), la lectura
  con el cliente que corresponda.
- `ports`: **sin cambios** (el lock entra por el alcance, no por el puerto del repositorio: no es una
  operación de dominio).
- `domain`: sin cambios; ninguna regla de dinero se movió.

## TRANSACCIÓN

**El límite atómico del cierre**: la fila del turno bloqueada, la lectura de los cobros/movimientos/
devoluciones que forman el arqueo, y las tres escrituras del documento (snapshot + conteos + bancos), todo en
un `$transaction` (`{ timeout: 15_000, maxWait: 10_000 }`).

**Del lado del cobro**, el límite de AUD-004 (pedido + todos sus cobros) ahora empieza con el mismo lock.

**Qué queda afuera, a propósito**: el aviso al dueño y el log de auditoría corren **después** del commit
(best-effort, ya era así); el alta del cliente, que no hace fallar la venta; y la validación del payload del
cierre (conteos y monto), que es pura y corre **antes** de abrir la transacción para no tomar una conexión ni
el lock por un payload mal armado.

## CONCURRENCIA

- **Dos cierres del mismo turno**: el `updateMany … WHERE status = 'open'` (que sigue estando, ahora adentro
  de la transacción) deja pasar uno; el otro afecta 0 filas y devuelve `null` sin tocar el arqueo del primero.
  Probado contra PostgreSQL.
- **Cobro y cierre, los dos órdenes**: con el lock, o la venta commiteó antes (y el cierre la cuenta) o el
  cierre commiteó antes (y la venta se rechaza con 409). Los dos órdenes están probados contra PostgreSQL.
- `A-46` (el pool retenido por la transacción de la venta mientras el cliente raíz pide otras conexiones)
  **no** se resuelve acá: sigue en el backlog.

## IDEMPOTENCIA

`closeShift` no es idempotente por clave: es **condicional por estado** (un turno ya cerrado no se vuelve a
cerrar y devuelve `null`). Eso se mantiene igual; lo que cambia es que ahora el estado y el documento se
escriben juntos.

## AUTORIZACIÓN

Sin cambios: las rutas del cierre siguen con `requireAdminSession` + `canUsePOS`/permisos de caja y el cajero
sigue viendo el arqueo ciego (filtro de AUD-003). El caso de uso no decide permisos.

## MIGRACIÓN

`N/A — sin cambios de esquema`.

## OBSERVABILIDAD

- El log de auditoría del cierre (`shiftCloseAudit`) y el aviso al dueño quedan igual: después del commit.
- Mejora: el turno **no puede** quedar firmado sin su detalle, así que lo que se audita siempre existe
  completo.

---

## TESTS UNITARIOS

- `commit-sale.test.ts`: caso nuevo — si el turno se cerró mientras se cobraba, la venta se rechaza **sin
  crear el pedido ni escribir ningún cobro** (409 `CONFLICT`).
- Los dobles de la unidad de trabajo del cierre
  (`src/shared/testing/in-memory-shift-transaction.ts`) y de la venta se actualizaron en
  `shift-features.test.ts` (21 casos de cierre/arqueo siguen verdes), `shift-terminals.test.ts`,
  `reopen-shift.test.ts`, `shift-routes.test.ts` (11), `register-pos-sale.test.ts` (21) y `route.test.ts` (11).
- **Ningún caso se borró ni se debilitó**: los cambios en esos archivos son las dependencias del doble.

## TESTS DE INTEGRACIÓN

`src/modules/orders/features/shift/close-shift.postgres.test.ts`, **5 casos contra PostgreSQL 17 real**:
falla a mitad del cierre; dos cierres simultáneos; cierre después del cobro; venta después del cierre; cierre
con la venta en curso. **Corren en CI** (job `migrations`, que ya tiene la base migrada).

## E2E

`N/A — no cambia ningún flujo de usuario`. El cierre del POS ya está cubierto por el E2E de caja
(`tests/e2e/cash-post-deploy.spec.ts`); acá cambia qué queda en la base cuando algo falla o cuando las dos
operaciones se cruzan, que el E2E no puede provocar de forma determinista.

## MUTATION CHECK

| Mutación | Rojo esperado | Observado |
|---|---|---|
| El cierre vuelve a escribir sin transacción (`inTransaction` devuelve el cliente tal cual) | El caso de la falla a mitad | **1 rojo**: `el turno quedó cerrado sin su detalle: arqueo incompleto para siempre` |
| El cierre lee el turno **sin** `FOR UPDATE` (un `findUnique` común) | El caso del cierre con la venta en curso | **1 rojo**: `el arqueo firmó 0 con la plata de la venta en el cajón` |
| El cobro **no** comprueba el turno (se saca el bloqueo del lado de la venta) | El caso de la venta después del cierre | **1 rojo**: `promise resolved … instead of rejecting`
| El cobro de un **pedido existente** no comprueba el turno (segundo escritor) | El caso del cobro con el turno cerrado | **1 rojo**: `promise resolved "{ data: … }" instead of rejecting`
| El cierre de producción vuelve a **no** cablear movimientos ni devoluciones | El caso del esperado con retiro y devolución | **1 rojo**: `expected 100 to be 50` |

Las tres se restauraron y **no se commitean**.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
DATABASE_URL=postgresql://… npm run test:postgres
```

Sin `build:webpack` (no se toca ninguna `page.tsx`) y sin E2E (no cambia ningún flujo). La suite de
PostgreSQL se corrió **tres veces seguidas** por la naturaleza de la carrera: verde las tres.

## CRITERIOS DE ACEPTACIÓN

- [x] Límite atómico **nombrado**: `runInShiftTransaction` + `lockShift` (`SELECT … FOR UPDATE`).
- [x] El cierre es todo-o-nada, probado contra PostgreSQL con una falla real en la segunda escritura.
- [x] Un turno cerrado no recibe cobros nuevos, probado contra PostgreSQL en los **dos** órdenes.
- [x] Todo cobro firmado con el turno está en su arqueo (lado cierre del lock).
- [x] Dos cierres simultáneos: uno solo gana.
- [x] `readShift(client, id)`: la lectura de dentro de la transacción no usa el cliente raíz (si no, leería
      el estado viejo y el cierre devolvería el turno abierto).
- [x] Sin migración, sin cambio de fórmula ni de producto.
- [x] Ningún techo de deuda subió.

## REGRESIÓN

Si vuelven las tres escrituras sueltas, si el cierre lee sin bloquear o si el cobro deja de comprobar el
turno, cada mutación pone en rojo **su** caso (ver *MUTATION CHECK*).

## ROLLBACK

Revert del commit: la app vuelve a escribir sin transacción y sin lock (no hay datos que reparar: el cambio
no toca datos existentes). La base no necesita nada: **no hay migración**.

## DOCUMENTACIÓN

- Este archivo.
- `ops/CURRENT.md`: `A-47` **cerrado**, la carrera del turno fuera de los riesgos abiertos.
- `ops/audit-backlog.md`: `A-47` cerrado con su verificación; la tabla de lo cerrado.
- `.agents/MEMORY.md`: la lección del lock (`FOR UPDATE` para que un cobro y un cierre no se crucen) y la del
  patrón «la transacción propia o la del alcance» del repositorio.
- `.agents/skills/money-change/SKILL.md`: el cierre como ejemplo del límite atómico y la advertencia de
  bloquear la fila que los dos lados tocan.

## MEMORY

Sí: (1) un cierre es un **documento**: se firma completo o no se firma; (2) cuando dos operaciones escriben
sobre el mismo agregado, la guarda es **bloquear la fila** (`SELECT … FOR UPDATE`) y **leer después** del
bloqueo, no un `if` sobre una lectura previa; (3) un repositorio puede abrir su propia transacción o
participar de la que le inyectaron (`inTransaction`), y la lectura de adentro tiene que usar **el mismo**
cliente.

## REVIEW ADVERSARIAL

Pasada con el objetivo de **refutar**, sobre el diff y con PostgreSQL real. **Veredicto: no mergear tal cual**:
encontró un **segundo escritor** de `Payment.shiftId` sin cubrir y un test nuevo que fallaba ~30% de las
veces. Los dos se resolvieron en esta TASK:

**Bloqueante 1 — el otro camino que firma el turno.** `register-order-payment` (el cobro de un pedido que ya
existe, `POST /api/admin/orders/[id]/payment`) resolvía la caja abierta y escribía el `Payment` **sin
transacción y sin lock**: con el cierre en curso, su `INSERT` esperaba el lock y entraba apenas el cierre
commiteaba, quedando firmado por un turno **cerrado** y fuera de todo arqueo (el corte X solo lee los cobros
**atribuidos**). Reproducido por la review contra PostgreSQL real y **cerrado acá**: ese cobro ahora corre en
su propia unidad de trabajo con el **mismo lock** (`runInOrderPaymentTransaction`, exportado por la
composición para que el test use el de producción y no una copia) y **rechaza con 409** si el turno dejó de
estar abierto, en vez de firmar plata que ningún arqueo va a leer.

**Bloqueante 2 — un test que dependía del orden.** El caso de los dos cierres simultáneos afirmaba que gana
el cierre **emitido primero**; medido: gana el primero ~70% de las veces. Ahora afirma la invariante (un solo
ganador y que lo persistido sea lo **del ganador**).

**Hallazgos de la review que se cerraron de paso, en el mismo límite atómico:**

- **El cierre de producción no cableaba `cashMovementRepository` ni `refundRepository`**: firmaba un esperado
  **sin** retiros ni devoluciones mientras el corte X del mismo turno sí los restaba — dos números distintos
  para el mismo turno, y el que se firma era el que no los miraba. Ahora los dos se leen **dentro** de la
  transacción (repositorios con cliente inyectable) y hay un test que lo fija (cobro 100, retiro 40,
  devolución 10 → esperado 50).
- **Los conteos de cierre no se reemplazaban** (los bancos sí): un turno reabierto y vuelto a cerrar con otro
  conteo quedaba con el detalle viejo de las denominaciones repetidas y contradecía el total firmado.

**Lo que queda abierto, en el backlog** (no se arregla acá): el guardrail de que el repositorio del alcance
esté atado al `tx` (`A-52`), el cierre «no-op» que contesta 200 sin datos (`A-53`), el cobro sin caja abierta
en un turno con terminal que ningún arqueo lee (`A-54`) y la carrera de dos cobros simultáneos sobre el mismo
pedido (`A-55`).

## DATOS PREVIOS — lo que este fix NO arregla

Los cierres firmados **antes** de este cambio pueden tener un detalle incompleto (conteos o bancos que no se
escribieron) y, en producción, un esperado **sin** retiros ni devoluciones. Este cambio **no** los recalcula
ni los repara: un arqueo firmado es un documento y reescribirlo es una decisión del owner. Queda registrado
en `A-51`.

- [x] Rojo observado por invariante (con las mutaciones, documentado).
- [x] `security:secrets`, `lint`, `typecheck`, `test`, `test:contracts`, `build` verdes.
- [x] `test:postgres` verde (5 nuevos + 8 de la venta + 3 del arnés).
- [x] Mutation check hecho y restaurado (3 mutaciones).
- [x] Ningún techo de deuda subió.
- [x] Documentación actualizada.
- [x] PR abierto, CI verde, merge `--squash`.
- [x] **Sin deploy**: esta TASK no toca producción.
- [x] **Test flaky de AUD-004 corregido**: el caso del cupón de un solo uso afirmaba por **texto** del error
      y el mensaje depende de qué validación gana la carrera; ahora afirma la **forma** (un `status` de
      negocio). Se detectó corriendo la suite de PostgreSQL varias veces.

## DEFINITION OF DONE

- [x] Rojo observado por invariante (con las mutaciones, documentado).
- [x] security:secrets, lint, 	ypecheck, 	est, 	est:contracts, uild verdes.
- [x] 	est:postgres verde (9 del cierre + 8 de la venta + 3 del arnés = 20), y corre en CI.
- [x] Mutation check hecho y restaurado (5 mutaciones).
- [x] Ningún techo de deuda subió.
- [x] Documentación actualizada.
- [x] PR abierto, CI verde, merge --squash.
- [x] **Sin deploy**: esta TASK no toca producción.
- [x] **Dos bloqueantes de la review adversarial resueltos** (el segundo escritor de Payment.shiftId y el test dependiente del orden) y **test flaky de AUD-004 corregido**.
