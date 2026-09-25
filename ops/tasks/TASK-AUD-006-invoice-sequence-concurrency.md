# TASK-AUD-006 — Invoice Sequence Concurrency

## TASK ID

`TASK-AUD-006` (rama `fix/task-aud-006-invoice-sequence-concurrency`).

## Título

Asignar el correlativo de la factura y crear el documento como una sola operación que sabe perder una carrera.

## Prioridad

`P1` (plata) · **Clase de riesgo**: `dinero`.

---

## PROBLEMA

`emitInvoice` calculaba el número leyendo la factura más nueva y sumando uno (`findLatestNumber` →
`nextInvoiceNumber`) y **después** insertaba. Dos emisiones simultáneas calculan el mismo correlativo; la base
tiene los índices únicos `Invoice.number` y `Invoice.orderId`, así que una sola queda persistida — eso está
bien — pero **la que pierde devuelve un error**: el cajero ve un fallo, el pedido queda **sin factura** y hay
que reintentar a mano. Peor en el caso del **mismo pedido**: dos toques de «facturar» (o un reintento de la
pantalla) pasaban los dos la comprobación previa `findByOrderId` (que en secuencial ya devuelve la factura
existente) y una de las dos reventaba con un error de índice único.

La factura es una **factura simple, explícitamente no fiscal**: no hay autorización ni rango oficial de
numeración, así que la invariante es del documento (que la emisión no falle y que no haya dos facturas del
mismo pedido), no de una autoridad.

## EVIDENCIA

**Reproducción RED observada antes del fix**, contra PostgreSQL 17 real
(`src/modules/invoices/features/emit-invoice/emit-invoice.postgres.test.ts`):

```
× dos emisiones simultáneas del MISMO pedido: una sola factura, las dos respuestas la describen
  PrismaClientKnownRequestError: Unique constraint failed on the fields: (`number`)
```

El caso de dos pedidos distintos es **timing-dependiente** (pasaba sin arreglar nada porque las dos
emisiones no siempre se cruzan). Para que sea un guardrail de verdad, el test fuerza el cruce con una
**barrera**: el repositorio del test deja que las dos emisiones lean el último número antes de que ninguna
inserte. Con esa barrera, la mutación que saca el reintento pone en rojo **los dos** casos
(`Unique constraint failed on the fields: (number)`).

## CAUSA RAÍZ

El correlativo no es un dato que se **lee**: es un recurso que se **asigna**. La operación se escribió como
dos pasos separados (leer el último, insertar) y la atomicidad quedó delegada al índice único, que impide el
duplicado pero **no** resuelve el conflicto: la emisión que pierde no tiene forma de saber que solo tenía que
volver a intentar con el número siguiente. Y el caso del mismo pedido tenía la misma forma: la comprobación
previa (`findByOrderId`) es un `if` sobre una lectura, y dos requests simultáneos lo pasan los dos.

## INVARIANTE

**Dos emisiones simultáneas nunca fallan**: o cada una crea su factura con un número distinto, o la segunda
devuelve la factura que ya existe para su pedido (`reused`). Nunca hay dos facturas del mismo pedido y nunca
hay dos con el mismo número (eso último ya lo garantizaba la base).

## BOUNDED CONTEXT

`invoices`: `ports` (el puerto declara la operación nueva), `adapters` (la asignación con reintento),
`features/emit-invoice` (usa la operación y ya no arma el número).

---

## SCOPE IN

- `src/modules/invoices/ports/invoice-repository.ts`: `createNextForOrder(input)` — asigna el correlativo y
  crea, devolviendo además si **reusó** la factura del pedido.
- `src/modules/invoices/adapters/prisma-invoice-repository.ts`: la implementación con **hasta cinco
  intentos**: en un choque de `number` se vuelve a leer el último (que ya cambió) y se reintenta; en un choque
  de `orderId` se devuelve la factura que existe.
- `src/modules/invoices/features/emit-invoice/emit-invoice.ts`: llama a la operación nueva en vez de armar el
  número; el camino secuencial (`findByOrderId`) queda igual.
- Tests: `emit-invoice.postgres.test.ts` (**nuevo**, 3 casos) y los dobles de los cuatro archivos que
  implementan el puerto (`emit-invoice.test.ts`, `get-order-invoice.test.ts`, `void-invoice.test.ts`,
  `route.test.ts`).

## SCOPE OUT

- **Sin migración**: no se agrega una tabla de correlativos ni una secuencia de PostgreSQL. La salida
  siguiente, si alguna vez hiciera falta (más de cinco emisiones simultáneas sobre el mismo correlativo),
  está anotada en el backlog.
- **No** cambia el formato del número (`F-000001`), ni el documento, ni la anulación, ni el Historial, ni la
  autorización de las rutas.
- **No** se toca la transacción del POS: la factura se emite por su propio caso de uso, después del cobro.

## DEPENDENCIAS

TASK-AUD-001 y el arnés de PostgreSQL real de TASK-AUD-004 (el mismo `npm run test:postgres`, que corre en el
job `migrations` del CI). Sin dependencias nuevas del stack.

## TESTS DE INTEGRACIÓN

`src/modules/invoices/features/emit-invoice/emit-invoice.postgres.test.ts`, **3 casos contra PostgreSQL 17
real**: dos emisiones simultáneas de pedidos distintos (con barrera), dos emisiones simultáneas del mismo
pedido, y el reintento secuencial después de emitir.

## MUTATION CHECK

| Mutación | Rojo esperado | Observado |
|---|---|---|
| Se saca el reintento (`intentosMaximos = 1`) | Los dos casos de concurrencia | **2 rojos**: `Unique constraint failed on the fields: (number)` |
| Se saca la rama que reusa la factura del `orderId` | El caso del mismo pedido | **1 rojo** (el mismo), y el log muestra el choque por `orderId` |

Las dos se restauraron y **no se commitean**.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
DATABASE_URL=postgresql://… npm run test:postgres
```

`test:postgres` quedó en **23 casos** (9 del cierre + 8 de la venta + 3 de facturas + 3 del arnés).

## CRITERIOS DE ACEPTACIÓN

- [x] Rojo observado antes del fix por la razón correcta (índice único del número).
- [x] La asignación del correlativo y el alta son **una** operación con reintento acotado y explícito.
- [x] Dos emisiones simultáneas del mismo pedido dejan **una** factura y las dos respuestas la describen.
- [x] El caso de pedidos distintos es determinista (barrera), no depende del planificador.
- [x] Sin migración, sin cambio de formato ni de comportamiento visible para el cajero.
- [x] Ningún techo de deuda subió.

## REGRESIÓN

Si vuelve el cálculo del número afuera de la asignación (o se saca el reintento / la rama del `orderId`), los
tests de concurrencia se ponen rojos (ver *MUTATION CHECK*).

## ROLLBACK

Revert del commit: la app vuelve a leer-y-insertar con el índice único como única red. Sin datos que reparar
(el cambio no toca filas existentes) y sin migración.

## DOCUMENTACIÓN

- Este archivo.
- `ops/CURRENT.md`: `TASK-AUD-006` cerrada.
- `ops/audit-backlog.md`: fila en el registro de lo cerrado y la salida siguiente anotada (secuencia o lock de
  asesoría si el tope de cinco intentos alguna vez no alcanza).
- `.agents/MEMORY.md`: un correlativo se **asigna**, no se lee.

## MEMORY

Sí: **un correlativo (o cualquier «último + 1») es un recurso que se asigna, no un dato que se lee**: leer el
último e insertar deja la carrera en manos del índice único, que evita el duplicado pero le falla al usuario.
La forma que funciona es una sola operación con reintento acotado —y, si el conflicto es de la clave de
negocio (el `orderId`), devolver lo que ya existe—.

## REVIEW ADVERSARIAL

A diferencia de AUD-004 y AUD-005 —que sí tuvieron una pasada independiente que encontró bloqueantes reales—
acá la revisión fue **propia y acotada**, y se dice para que nadie la cuente de más. Las refutaciones que se
probaron:

- **¿Puede el CI estar verde y el requisito roto?** Los dos casos de concurrencia se fuerzan con barrera, así
  que no dependen del planificador: quitar el reintento los pone rojos (probado).
- **¿Hay error tragado?** `isUniqueConflict` solo captura el `P2002`; cualquier otro error sale tal cual, y si
  se agotan los cinco intentos se relanza el último conflicto (nada silencioso).
- **¿Hay partial write?** La operación es **un** `INSERT` de un documento: no hay segunda tabla que pueda
  quedar a medias.
- **¿Se duplicó la regla del número?** `nextInvoiceNumber` sigue siendo la única fuente y ahora la usa el
  adaptador (el caso de uso dejó de armar el número).
- **¿Se debilitó algún test?** Los cuatro dobles que implementan el puerto recibieron el método nuevo; las
  aserciones existentes (los números `F-000001` / `F-000042`) siguen igual.
- **¿La idempotencia la garantiza la base?** `Invoice.orderId @unique` sí; la comprobación previa es un atajo,
  y ahora el choque también se resuelve devolviendo la factura existente.

**Riesgo residual**: con más de cinco emisiones simultáneas sobre el mismo correlativo, la sexta falla con el
error del índice único (bounded, visible y reintentable a mano). Queda en el backlog como `A-56` con la salida
siguiente (secuencia de PostgreSQL o `pg_advisory_xact_lock`).

## DEFINITION OF DONE

- [x] Rojo observado (con barrera para el caso no determinista).
- [x] `security:secrets`, `lint`, `typecheck`, `test`, `test:contracts`, `build` verdes.
- [x] `test:postgres` verde (23 casos) y corriendo en CI.
- [x] Mutation check hecho y restaurado (2 mutaciones).
- [x] Documentación actualizada.
- [x] PR abierto, CI verde, merge `--squash`.
- [x] **Sin deploy**: esta TASK no toca producción.
