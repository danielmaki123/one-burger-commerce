# TASK-AUD-004 — POS Sale Atomicity

## TASK ID

`TASK-AUD-004` (rama `fix/task-aud-004-pos-sale-atomicity`).

## Título

Darle a la venta del mostrador un límite atómico explícito: el pedido, su cupón y **todos** sus cobros, o nada.

## Prioridad

`P1` (plata).

## Clase de riesgo

`dinero`.

---

## PROBLEMA

`registerPosSale` escribía la venta en **dos tiempos, sin transacción**: primero el alta del pedido
(`createPosOrder` → `createOrder`, que además consume el uso del cupón) y **después** los cobros, uno por uno
en un `for`, cada uno con su propio `create` (`prisma-payment-repository.ts:63`). No existía ningún límite
atómico para «la venta»: existía para el pedido por separado (el `create` con sus `items` anidados) y para
cada cobro por separado. Una falla —o un corte— entre el primer y el segundo cobro dejaba un pedido vivo con
**parte** de sus cobros; una falla después del alta y antes de cualquier cobro dejaba un pedido con **cero**
cobros. En los dos casos, la venta que el arqueo tiene que explicar quedaba mintiendo, y el reintento con la
misma `idempotencyKey` devolvía lo que hubiera (`reused: true` + `listPaymentsByOrder`), sin completar lo que
faltaba: el cajero veía «ya estaba cobrado» sobre una venta a medio cobrar.

## EVIDENCIA

**Reproducción (RED observado antes de tocar el código), contra PostgreSQL 17 real.** El arnés es
`src/modules/pos/features/register-pos-sale/register-pos-sale.postgres.test.ts` con
`npm run test:postgres` (`vitest.postgres.config.ts`, base `oneburger_test` migrada).

La falla se inyecta **adentro de la transacción**, envolviendo el repositorio de cobros con un `Proxy` que
delega todo al adaptador real y hace fallar el 2.º `createPayment`: lo que se mide no es *por qué* falla la
escritura (conexión, `timeout`, deploy) sino **qué queda persistido**. Salida observada con el código viejo:

```
× el segundo cobro que falla no deja el pedido persistido a medias
  AssertionError: el pedido quedó persistido con un solo cobro: venta parcial: expected 1 to be +0
× un reintento con la misma clave completa la venta en vez de devolverla incompleta
  AssertionError: expected [ { …(9) } ] to have a length of 2 but got 1
```

Es decir: **pedido = 1** con **cobro = 1** de los 2 pedidos, y el reintento devolvía la venta incompleta.
Con la mutación que saca la transacción (ver *MUTATION CHECK*), además se pone en rojo el caso del cupón:
`usedCount` quedaba en **1** por una venta que nunca se cobró, y el caso del total que cambió dejaba el
pedido guardado con **cero** cobros.

**Primer intento de reproducción, descartado (queda escrito porque es la parte fácil de repetir mal):** se
probó inyectar la falla con un monto que no entra en `numeric(10,2)`. No servía: `registerPosSale` lo rechaza
con `«Es un monto demasiado alto para este pedido»` **antes** de escribir nada (`Order = 0`, `Payment = 0`),
así que el test pasaba sin medir. El rojo tiene que ser por la razón correcta.

**Punto de partida del roadmap, verificado en el código** (`ops/tasks/AUDIT-REMEDIATION-ROADMAP.md:73-101`):
el alta va primero (`register-pos-sale.ts:215` en el original) y el `for` de cobros después
(`:308-322`); `Payment.orderId` referencia `Order` (`prisma/schema.prisma:857`), así que el riesgo **no** es
«un cobro sin pedido» sino «un pedido con cero o parte de sus cobros».

## CAUSA RAÍZ

La operación lógica **«cobrar una venta»** estaba escrita como dos operaciones de base separadas y sin
unidad de trabajo: el caso de uso recibía un `createPosOrder` (que internamente usaba el cliente raíz de
Prisma) y un `paymentRepository` (que también usaba el cliente raíz), así que **no existía forma de que
ambas escrituras cayeran en el mismo `tx`**. Sin un alcance transaccional en el puerto, la única garantía
posible era «cada escritura suelta no falla», y eso no es una invariante. El `reused` del reintento era
coherente con un mundo donde la venta no podía quedar a medias; al no serlo, devolvía una venta incompleta
como si estuviera paga.

## INVARIANTE

**Un `Order` de la venta del mostrador no puede existir con menos `Payment` que los que la venta declaró, y
una venta que no se cobró entera no puede dejar el uso del cupón consumido.**

Formas equivalentes que se fijan con tests, todas contra PostgreSQL real:

- no existe un pedido persistido cuando falla cualquiera de sus cobros (`Order = 0` y `Payment = 0`);
- no existe un pedido persistido cuando el total real ya no cubre el cobro (`Order = 0`, el 409 del alta);
- el reintento con la misma clave, después de una falla, devuelve la venta **completa** (2 de 2 cobros);
- dos cobros simultáneos con la misma clave dejan **un** pedido con **sus** cobros, y las dos respuestas
  describen esa misma venta;
- el uso del cupón vuelve a cero si la venta se deshace;
- el aviso de pedido creado (`outbox`) **no** sobrevive a una venta deshecha.

## BOUNDED CONTEXT

- `pos` (dueño del caso de uso y de su composición): `features/register-pos-sale`, `adapters`.
- `orders` (dueño del alta y de los repositorios que ahora aceptan una transacción): `adapters`,
  `features/create-order`, `ports/payment-repository`.
- `infrastructure/database`: el tipo compartido del cliente.
- `notifications`: **no** se toca; se usa su suscriptor para probar el efecto posterior.

---

## SCOPE IN

- `src/infrastructure/database/prisma.ts`: tipo `DatabaseClient` (cliente raíz **o** `tx`).
- `src/modules/orders/adapters/prisma-order-repository.ts`: constructor con cliente inyectable; los métodos
  que abren su propia transacción por lote (`$transaction([...])`) piden el cliente **raíz** a propósito y
  fallan fuerte si se los llama con un `tx`; el `catch` del `P2002` devuelve el conflicto original cuando la
  re-lectura no se puede hacer dentro de la transacción abortada.
- `src/modules/orders/adapters/prisma-payment-repository.ts`: constructor con cliente inyectable.
- `src/modules/orders/features/create-order/create-order.ts`: dependencia **inyectable**
  `publishOrderCreated` (por defecto, el bus de eventos) para poder publicar el aviso después del commit.
- `src/modules/pos/features/register-pos-sale/register-pos-sale.ts`: el caso de uso — valida, cotiza y
  **declara** el límite atómico (`runInSaleTransaction` + `PosSaleTransactionScope`).
- `src/modules/pos/features/register-pos-sale/commit-sale.ts` (**nuevo**) y su `commit-sale.test.ts`: todo lo
  que la venta **escribe**, en un solo lugar (ver *REVIEW ADVERSARIAL*, bloqueante 2).
- `src/modules/pos/adapters/production-pos-sale.ts`: el `$transaction` real, el reintento único ante el
  conflicto de la clave de intento y el aviso diferido hasta después del commit.
- Arnés de PostgreSQL real: `src/shared/testing/postgres.ts` (con la guardia contra `APP_ENV=production`),
  `vitest.postgres.config.ts`, script `test:postgres`, y su paso en el job `migrations` del CI.
- Tests: `register-pos-sale.postgres.test.ts` (8 casos), `commit-sale.test.ts` (5),
  `register-pos-sale.test.ts` y `src/app/api/admin/pos/sale/route.test.ts` (dobles al día).

## SCOPE OUT

- **No** se toca la fórmula del dinero, los precios, el descuento ni el vuelto.
- **No** se agregan `Invoice` ni `CashMovement` a la operación: la factura se emite por su propio caso de uso
  y `CashMovement` es plata que entra o sale del cajón sin ser un cobro.
- **No** se cambia el esquema: ninguna migración.
- **No** se toca el checkout público: `createOrder` sigue publicando igual para todos sus otros llamadores.
- **No** se resuelve el hallazgo del `auditManualDiscount` posterior a la venta (queda en el roadmap).
- **No** se unifica en esta TASK la atomicidad del cierre de turno (AUD-005) ni la numeración de facturas
  (AUD-006).
- **No** se cambia la autorización de la ruta.

## DEPENDENCIAS

TASK-AUD-001 (gate de integridad de tests) y TASK-AUD-003 (cerrada). PostgreSQL real disponible en local y en
el job `migrations` del CI. Sin dependencias nuevas del stack: es Prisma + Vitest, que ya estaban.

## ARCHIVOS PROBABLES

| Archivo | Quién más lo consume |
|---|---|
| `src/infrastructure/database/prisma.ts` | Todos los adaptadores |
| `src/modules/orders/adapters/prisma-order-repository.ts` | Checkout público, KDS, admin, caja, POS |
| `src/modules/orders/adapters/prisma-payment-repository.ts` | POS, checkout, caja, devoluciones |
| `src/modules/orders/features/create-order/create-order.ts` | `POST /api/orders`, POS, mesas |
| `src/modules/pos/**` | Ruta `POST /api/admin/pos/sale` |
| `.github/workflows/publish-ghcr.yml` | Job `migrations` |

---

## TEST ROJO

`src/modules/pos/features/register-pos-sale/register-pos-sale.postgres.test.ts` (7 casos). Los dos primeros
se escribieron **antes** del fix y se observaron **rojos por la razón correcta** (el mensaje habla de la
venta parcial, no de un import roto):

1. `el segundo cobro que falla no deja el pedido persistido a medias` → `expected 1 to be +0` (el pedido).
2. `un reintento con la misma clave completa la venta en vez de devolverla incompleta` → `expected [ … ] to
   have a length of 2 but got 1`.

## ESTRATEGIA

Un **puerto de unidad de trabajo** en el caso de uso (`runInSaleTransaction`) que entrega, con el mismo
cliente de base, las dos piezas que escriben la venta (`createPosOrder` y `paymentRepository`). El adaptador
lo implementa con `prisma.$transaction`. Se eligió esto sobre las alternativas:

- **Compensar** (borrar el pedido si falla un cobro): no es una transacción. Deja una ventana en la que el
  proceso puede morir y el pedido a medias queda igual, y deja rastro de un pedido que existió y se borró.
- **Un `getPrismaClient()` con `AsyncLocalStorage`**: menos código, pero implícito y con dos problemas reales:
  arrastraría a `findOrCreateCustomer` (que **se traga** los errores por diseño) adentro de la transacción
  —en PostgreSQL una sentencia fallida deja la transacción **abortada**, así que un error tragado envenenaría
  la venta entera— y haría correr el aviso del pedido dentro de la transacción.
- **Duplicar el alta dentro del POS**: viola la fuente única de precios y totales.

El límite atómico se nombra una sola vez y se puede leer: el `$transaction` de
`runInSaleTransaction` (`production-pos-sale.ts`).

## DDD

- `features`: el caso de uso **declara** el límite y escribe todo adentro; no conoce Prisma —la transacción
  entra por un puerto—. Se separó `commitSale` (lo que escribe) de `registerPosSale` (lo que decide, valida
  y cotiza).
- `ports`: se agrega el alcance transaccional al contrato de dependencias del caso de uso.
- `adapters`: la composición real (`$transaction`, reintento, aviso diferido) y los repositorios, que ahora
  aceptan un cliente. El `domain` **no** se toca: ninguna regla de dinero cambió.
- `route`: sin cambios.

## TRANSACCIÓN

**El límite atómico es la venta del mostrador completa**: el `Order` (con su cupón, su consumo de uso y sus
`items`) y **todos** sus `Payment`, en un solo `prisma.$transaction` interactivo
(`{ timeout: 15_000, maxWait: 10_000 }`; el `maxWait` por defecto es 2 s y una espera de pool haría fallar una
venta que estaba bien).

**Qué queda afuera, a propósito, y por qué:**

- **El aviso de pedido creado** (`publish` → `outbox`): es un efecto **posterior** a la persistencia. Se junta
  durante la transacción y se publica **después del commit** (la dependencia `publishOrderCreated` de
  `createOrder` es inyectable justo para esto). Adentro, el aviso —que escribe con el cliente raíz— podía
  sobrevivir a un rollback: cocina recibía un pedido que no existe. Hay un test que lo fija.
- **El cliente** (`findOrCreateCustomer`): por diseño **no** hace fallar la venta y se traga sus errores, así
  que no entra en la transacción. Una venta deshecha puede dejar un `Customer` sin pedidos: no es plata y
  `findOrCreateCustomer` es idempotente por WhatsApp.
- **El `auditManualDiscount`**: corre después de la venta, en la ruta. Ya estaba declarado como hallazgo
  aparte en el roadmap; esta TASK no lo cambia.
- **Nada externo** (red, impresión, Telegram) entra en la transacción.

**Si se corta a la mitad**: no queda nada — el propio test lo fija (`Order = 0`, `Payment = 0`, cupón sin
consumir, sin aviso).

## CONCURRENCIA

Dos cobros de la misma venta entrando juntos (doble click, reintento de red). La unicidad la garantiza la
**base** (`Order.idempotencyKey @unique`), no un `if`: uno gana y el otro choca con `P2002`.

Hallazgo **nuevo** de esta TASK, medido: dentro de una transacción, ese `P2002` **aborta la transacción
entera** (`25P02 current transaction is aborted`), así que la recuperación del alta —re-leer el pedido que ya
existe— **no puede** correr adentro. El `catch` del repositorio ahora devuelve el conflicto original y el
adaptador **rehace la transacción una vez**: en el intento nuevo el alta encuentra el pedido **antes** de
escribir nada, lo devuelve reusado y no vuelve a cobrar. Está fijado por
`dos cobros simultáneos con la misma clave no dejan una venta a medio cobrar` (con `Promise.all`, contra
PostgreSQL real) y por su mutación.

Sin el reintento, el síntoma no era un cobro duplicado sino un `500` con `25P02`: la venta no se cobraba.

## IDEMPOTENCIA

`Order.idempotencyKey` sigue siendo la clave, con su índice único en la base (no cambia). Lo que cambia es la
semántica del reintento: como una venta a medias ya no puede existir, `reused: true` implica siempre una venta
**completa**, y la rama `reused` devuelve sus cobros sin volver a cobrar. Un reintento después de una falla
cobra la venta entera una sola vez (test 2).

## AUTORIZACIÓN

Sin cambios: la ruta sigue usando `requireAdminSession` + `canUsePOS` (+ `canDiscountPosSale` para el
descuento manual) y el POS sigue sin ser accesible por `kitchen`. Esta TASK **no** toca la autorización; el
caso de uso no decide permisos.

## MIGRACIÓN

`N/A — sin cambios de esquema`.

## OBSERVABILIDAD

- El asiento de auditoría del descuento manual (`auditManualDiscount`) y el `outbox` quedan como estaban.
- El aviso `OrderCreated` **mejora**: ya no puede describir un pedido que no existe (test).
- No se agregó logging nuevo: la falla se propaga como antes (`PosError` / error de base), con la diferencia
  de que ahora la base queda limpia.

---

## TESTS UNITARIOS

- `src/modules/pos/features/register-pos-sale/commit-sale.test.ts` (**nuevo**, 5 casos): el archivo que se
  extrajo tiene su propio test — los cobros se escriben todos (moneda normalizada, vuelto, turno que los
  firma), un pago mixto no anuncia vuelto, el reintento **no vuelve a cobrar**, el total que ya no cubre corta
  sin escribir ningún cobro (409 `CONFLICT` con la diferencia) y el alta se pide con los datos del cliente,
  sin propina y con `paidWithAmount` solo en efectivo.
- `src/modules/pos/features/register-pos-sale/register-pos-sale.test.ts` (**21 casos, verdes**): el doble de
  la unidad de trabajo corre el trabajo con los mismos dobles, sin transacción. Fija que el caso de uso
  **escriba todo adentro**, no cómo se abre la transacción. Ningún caso se borró ni se debilitó: el archivo
  tenía 21 casos antes y tiene 21 después (lo único que cambió son las dependencias del doble).
- `src/app/api/admin/pos/sale/route.test.ts` (11, verdes): la ruta mockea la composición; el
  `runInSaleTransaction` del doble entrega los mismos dobles.
- `src/modules/orders/features/create-order/create-order.test.ts` (52, verdes): sin cambios de
  comportamiento para el checkout público (el publicador por defecto sigue siendo el bus).

**Nota de TDD**: los casos de `commit-sale.test.ts` son **caracterización** de código que se movió, no un
cambio de comportamiento: el rojo de la atomicidad se observó en los tests de PostgreSQL y se verifica con
las mutaciones de abajo (skill [`bugfix`](../../.agents/skills/bugfix/SKILL.md) §2, «caracterización de código
heredado»).

## TESTS DE INTEGRACIÓN

`src/modules/pos/features/register-pos-sale/register-pos-sale.postgres.test.ts`, **8 casos contra PostgreSQL
17 real** (`npm run test:postgres`):

1. el segundo cobro que falla no deja el pedido persistido a medias;
2. un reintento con la misma clave completa la venta en vez de devolverla incompleta;
3. dos cobros simultáneos con la misma clave no dejan una venta a medio cobrar;
4. si el total real del menú ya no cubre el cobro, no queda el pedido sin cobros;
5. el aviso de pedido creado sale después del commit: una venta que se deshace no lo deja;
6. una venta que se deshace no deja el cupón consumido;
7. dos ventas simultáneas con el mismo cupón consumen un solo uso (el límite lo decide la base);
8. una venta que sí completa deja el pedido con sus dos cobros y el turno firmado (`Payment.shiftId`).

El arnés es infraestructura de test de esta TASK (`src/shared/testing/postgres.ts`: `resetDatabase()` con
`TRUNCATE … RESTART IDENTITY CASCADE` menos `_prisma_migrations`). **Corre en CI**: se agregó el paso
`Integration tests against real PostgreSQL (atomicity, rollback, concurrency)` al job `migrations`, que ya
levanta PostgreSQL 17 — un test que no corre en CI no protege nada.

## E2E

`N/A — no cambia ningún flujo de usuario`. El cobro del mostrador ya está cubierto por
`tests/e2e/admin-pos-idempotency.spec.ts` y la suite del POS; acá cambia **qué queda en la base** cuando algo
falla, que es lo que el E2E no puede provocar de forma determinista.

## MUTATION CHECK

Tres mutaciones, todas con rojo observado y **restauradas** (no se commitean):

| Mutación | Rojo esperado | Observado |
|---|---|---|
| Repositorios con el cliente **raíz** en vez del `tx` (sin atomicidad real) | Los 6 casos de invariante | **6 rojos** de 8 y verde solo los dos que no dependen de la atomicidad (la venta completa y el cupón de un solo uso, que lo protege el lock de la fila del cupón) |
| Sin el reintento del `P2002` | El caso de los dos cobros simultáneos | **1 rojo**, exactamente ese |
| Publicar el aviso **dentro** de la transacción | El caso del aviso después del commit | **1 rojo**: `la venta se deshizo pero quedó el aviso del pedido: expected 1 to be +0` |

La primera mutación se volvió a correr **después** de partir el archivo en dos: el rojo es el mismo (6 de 8),
así que la extracción no se llevó puesta la propiedad.

## VALIDACIÓN

```bash
npx prisma generate
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
DATABASE_URL=postgresql://… npm run test:postgres
```

Sin `build:webpack` (no se toca ninguna `page.tsx`) y sin E2E (no cambia ningún flujo).

## CRITERIOS DE ACEPTACIÓN

- [x] Rojo observado antes del fix, por la razón correcta, contra PostgreSQL real.
- [x] Límite atómico **nombrado**: el `$transaction` de `runInSaleTransaction` cubre el pedido, el cupón y
      todos los cobros.
- [x] Los 8 casos de integración verdes contra PostgreSQL real.
- [x] Los efectos posteriores (aviso) declarados y **probados** fuera de la transacción.
- [x] Idempotencia preservada: la unicidad la garantiza la base y el reintento devuelve la venta completa.
- [x] Concurrencia probada con dos requests simultáneos reales (misma clave y mismo cupón).
- [x] Sin migración, sin cambio de esquema, sin cambio de producto ni de la fórmula del dinero.
- [x] Los datos anteriores al fix, declarados como pendientes del owner (no se reparan).
- [x] El arnés de PostgreSQL corre en CI.
- [x] Ningún techo de deuda subió (archivo ≤400 y funciones ≤80).

## DATOS PREVIOS — lo que este fix NO arregla (bloqueante de la review adversarial)

La transacción garantiza la invariante **de acá en adelante**. Lo que el bug ya escribió antes del deploy
sigue en la base y este cambio **no lo detecta ni lo repara**:

- **pueden existir ventas de mostrador anteriores con menos `Payment` que los que la venta declaró** —o con
  **cero**—, porque el alta se guardaba antes y los cobros se escribían uno por uno. El arqueo lee `Payment`:
  una venta parcial vieja **subcuenta la caja** de su turno;
- **el cupón de una de esas ventas pudo quedar consumido** sin que la venta se cobrara;
- **este cambio no toca esos datos**: no hay backfill, no hay migración, no hay reparación automática. Es
  deliberado: decidir qué hacer con plata ya cobrada (o no cobrada) es del **owner**, no de una TASK técnica,
  y el repo prohíbe tocar producción sin su OK.

Para medirlo alcanza una consulta de **solo lectura** (el caso que no admite dudas es el pedido sin ningún
cobro; una venta parcial —algunos cobros y no todos— es más difícil de detectar porque el total declarado
puede venir en otra moneda):

```sql
-- Pedidos de mostrador SIN ningún cobro. Solo lectura: no modifica nada.
SELECT o.id, o."orderNumber", o."createdAt", o.total
FROM "Order" o
LEFT JOIN "Payment" p ON p."orderId" = o.id
WHERE o.type = 'pickup' AND p.id IS NULL
ORDER BY o."createdAt" DESC;
```

Si el conteo no es cero, la decisión (reparar, dejarlas como están o anularlas con un movimiento de caja)
queda registrada como pendiente del owner en `ops/CURRENT.md` y en `A-50` del backlog: **esta TASK no la
toma**.

## REGRESIÓN

Si se vuelve a escribir el pedido y los cobros con clientes distintos —o se saca el reintento del conflicto, o
se publica el aviso adentro de la transacción— los tests 1-6 se ponen rojos (ver *MUTATION CHECK*). El test
del caso feliz sigue verde: mide otra cosa.

## ROLLBACK

Revert del commit (la app vuelve a escribir sin transacción; no hay datos que reparar porque el cambio no
altera datos existentes ni el esquema). La base no necesita nada: **no hay migración**. Fix-forward apoyado en
el backup si apareciera un problema de datos.

## DOCUMENTACIÓN

- Este archivo.
- `ops/CURRENT.md`: riesgo de atomicidad **cerrado** (y los nuevos abiertos: la carrera del turno y los datos
  anteriores), trabajo actual y orden inmediato.
- `ops/audit-backlog.md`: fila en *Registro de lo cerrado*, la decisión pendiente del owner (`A-50`) y los
  cuatro hallazgos de la review adversarial (`A-46` a `A-49`).
- `ops/tasks/AUDIT-REMEDIATION-ROADMAP.md`: nota en TASK-AUD-005 sobre dónde tiene que vivir la invariante
  «un turno cerrado no recibe cobros» (`A-47`).
- `.agents/MEMORY.md`: el `P2002` que aborta la transacción, el arnés de PostgreSQL real y la decisión de la
  venta atómica con sus efectos posteriores después del commit. Se corrige, además, la línea que decía que el
  ruleset NO exige Pull Request (lo cerró TASK-AUD-002 y MEMORY había quedado viejo).
- `.agents/skills/money-change/SKILL.md` §2: el arnés de PostgreSQL real **ya existe** y corre en CI (antes
  decía que había que montarlo); y la advertencia del `P2002` en la sección de concurrencia.

## MEMORY

Sí: (1) dentro de un `$transaction` de Prisma/PostgreSQL un `P2002` **aborta** la transacción (`25P02`), así
que la recuperación por re-lectura no puede ir adentro — hay que rehacer la transacción; (2) el arnés de
PostgreSQL real (`*.postgres.test.ts` + `npm run test:postgres` + job `migrations`); (3) los efectos
posteriores (aviso/outbox) se publican **después** del commit y la dependencia tiene que ser inyectable para
poder probarlo.

## REVIEW ADVERSARIAL

Se hizo una pasada cuyo objetivo fue **refutar** la solución (no confirmarla), sobre el diff completo y con la
suite de PostgreSQL corrida de verdad. **Veredicto: no pudo refutar la atomicidad** — no encontró forma de que
una venta quede parcial, ni un cobro duplicado, ni un error tragado que esconda un conflicto, ni una
expectativa bajada (los dos archivos de test que se tocaron solo cambiaron las dependencias del doble; el
resto del diff no debilita ningún caso).

Dejó **dos bloqueantes, los dos resueltos en esta TASK**:

1. **Los datos anteriores al fix.** La transacción garantiza la invariante de acá en adelante, pero lo que el
   bug ya escribió **no** se detecta ni se repara. Está escrito y medido en § *Datos previos* con una consulta
   de solo lectura, y la decisión quedó registrada como `A-50` (del owner).
2. **Tamaño.** El archivo del caso de uso había quedado en **479 líneas** (techo 400) y con funciones de
   **134** (techo 80). Se partió en `register-pos-sale.ts` (251) + `commit-sale.ts` (238, con su
   `commit-sale.test.ts`): ninguna función pasa de 71 y el tope de archivo se respeta.

Y **cuatro hallazgos fuera de alcance**, registrados en el backlog (`A-46` a `A-49`) en vez de arreglados de
paso (regla del repo): el pool dentro de la transacción, el TOCTOU del turno (es de **AUD-005**, y la nota
quedó también en el roadmap), la ventana de pérdida del aviso (es de **AUD-010**) y el número de pedido por
reloj (es de **AUD-006**). Dos más se cerraron acá mismo: el test del cupón de un solo uso con dos ventas
concurrentes y la guardia de `resetDatabase()` contra una base con `APP_ENV=production`.

## DEFINITION OF DONE

- [x] Rojo observado (y documentado el primer intento descartado).
- [x] `security:secrets`, `lint`, `typecheck`, `test`, `test:contracts`, `build` verdes.
- [x] `test:postgres` verde (8 + 3 casos), y el arnés corre en CI.
- [x] Mutation check hecho y restaurado (repetido después de partir el archivo).
- [x] Review adversarial con sus dos bloqueantes resueltos y los cuatro hallazgos derivados al backlog.
- [x] Ningún techo de deuda subió (archivo y funciones por debajo de los topes).
- [x] Documentación actualizada.
- [x] PR abierto, CI verde, merge `--squash`.
- [x] **Sin deploy**: esta TASK no toca producción.
