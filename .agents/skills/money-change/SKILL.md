# SKILL: money-change — cualquier cambio que toque plata

**Se activa** cuando una TASK toca, directa o **indirectamente**:

`Payment` · `Refund` · `Shift` · `CashMovement` · `ShiftCashCount` · `ShiftBankClose` · `Invoice` ·
`Coupon` · descuentos · propinas · totales · cambio/vuelto · monedas · tipo de cambio · cierres ·
conciliación · arqueos.

**También se activa** si el cambio es «solo de UI» pero muestra, calcula o habilita alguna de esas
cosas: un número mal mostrado en caja es un problema de dinero.

> **Principio que manda: UNA OPERACIÓN LÓGICA DE DINERO DEBE TENER UN LÍMITE ATÓMICO EXPLÍCITO.**
> Si no se puede nombrar la transacción que hace esa operación completa o nula, la TASK no está lista.

---

## 1. Análisis obligatorio (las ocho preguntas)

Se contestan **por escrito** en la TASK o en el PR. «N/A — razón» es una respuesta válida; el silencio
no.

### INVARIANTES

¿Qué tiene que seguir siendo verdad? Escribirlas como igualdades o imposibilidades, no como
intenciones:

- «la suma de los pagos de un turno es igual al arqueo esperado de ese turno»;
- «un pedido cancelado no aporta al esperado»;
- «el total cobrado es igual al total mostrado»;
- «un turno cerrado no recibe pagos nuevos»;
- «el vuelto no puede ser negativo».

Cada invariante necesita un test que la fije **y** que se ponga rojo si se rompe.

### TRANSACCIÓN

- ¿Cuál es el **límite atómico**? ¿Qué tiene que pasar todo junto o no pasar?
- ¿La operación hoy escribe en más de una tabla? Depende de cuál sea, y conviene no mezclarlas: una
  **venta** escribe el pedido (`Order`/`OrderItem`/cupón) y sus `Payment`; un **cierre** escribe el
  snapshot de `Shift`, los `ShiftCashCount` y los `ShiftBankClose`. Si es más de una, ¿está dentro de una
  transacción?
- Ojo con los vecinos que **no** son parte de la operación: `CashMovement` es plata que entra o sale del
  cajón **sin ser un cobro**, y la `Invoice` (factura **simple, no fiscal**) se emite por su **propio**
  caso de uso/API, no dentro del cobro. No los metas en el límite atómico por parecido de nombre.
- Los efectos **posteriores** a la persistencia no están en la transacción y hay que declararlos: p. ej.
  el audit del descuento manual corre **después** de que la venta quedó guardada.
- ¿La transacción abarca llamadas externas (red, impresión, Telegram)? **No debería**: lo externo va
  **después** del commit, por outbox.
- ¿Qué pasa si se corta a la mitad? ¿Queda un *partial write*?

### CONCURRENCIA

- ¿Dos requests simultáneos pueden romper la invariante? (dos cobros del mismo pedido, dos cierres del
  mismo turno, dos facturas con el mismo número).
- ¿Se protege con una **unique constraint**, un lock (`SELECT … FOR UPDATE`) o una transición de
  estado condicional (`UPDATE … WHERE status = …`)?
- Un `if` que **lee y después escribe** sin lock **no** es protección: es una race condition con
  apariencia de control.
- ⚠️ Un `P2002` (choque con un índice único) adentro de un `$transaction` **aborta la transacción**
  (`25P02`): la recuperación «re-leo la fila que ya existe» **no** puede correr adentro. Hay que devolver
  el conflicto y **rehacer la transacción** desde afuera (en el intento nuevo la lectura encuentra la fila
  antes de escribir). TASK-AUD-004.

### IDEMPOTENCIA

- ¿Qué pasa si la misma request se reintenta? (doble click, reintento del cliente, retry de red).
- ¿Hay clave de idempotencia? ¿La unicidad la garantiza la **base** o el código?
- Referencia real del repo: `tests/e2e/admin-pos-idempotency.spec.ts`.

### AUTORIZACIÓN

- ¿Quién puede hacer esta operación y quién **no**? La puerta es una función de dominio de
  `src/modules/auth/domain/admin-permissions.ts`, aplicada en el **servidor**.
- Recordar los roles reales: `owner`, `manager`, `kitchen`, `cashier`. `kitchen` **no** maneja plata.
  El `cashier` cobra y cierra, pero **no** administra caja, **no** devuelve, **no** descuenta a mano y
  **no** ve el esperado del arqueo (arqueo ciego = regla de servidor).
- ¿Quien pide una devolución puede además aprobarla? **No, ni siendo el owner.**

### AUDITORÍA

- ¿Queda registro de quién hizo qué, cuándo y por qué monto? (`AdminAuditLog`, historial de estados,
  movimientos de caja).
- ¿El registro se escribe en la **misma** transacción que el hecho? Un log que puede faltar no es
  auditoría.

### ROLLBACK

- ¿Cómo se deshace? En producción **no hay down-migrations**: el rollback operativo es *fix-forward*
  apoyado en el backup (ver `../database-migration/SKILL.md`).
- ¿Existe una compensación (una devolución, un movimiento inverso) o el sistema queda mintiendo?

### PERSISTENCIA

- ¿Qué se guarda y qué se recalcula? **Un cierre no puede recalcularse con los datos de hoy**: el tipo
  de cambio y el esperado del momento tienen que quedar persistidos.
- ¿Las columnas son las correctas (montos, moneda, denominación, referencias) o se está guardando todo
  en un `Json` de `meta`?

---

## 2. Pruebas: qué NO alcanza con un doble

**No se acepta un test con repositorio in-memory para una propiedad que depende de PostgreSQL.**

Si el riesgo es **unique constraint · race condition · transaction · rollback · lock · request
concurrente · partial write**, la prueba tiene que correr contra **PostgreSQL real**.

**El arnés existe desde TASK-AUD-004** (es de este repo, no hay que montarlo de nuevo):

- el archivo se llama `*.postgres.test.ts` y **no** entra en `npm test`;
- se corre con `npm run test:postgres` (`vitest.postgres.config.ts`) contra una base **migrada** y
  dedicada a tests; `src/shared/testing/postgres.ts` da `databaseUrl()`, `resetDatabase()` (trunca todo
  menos `_prisma_migrations`) y `closeDatabase()`. Sin `DATABASE_URL` **falla fuerte**: un test que se
  saltea solo es un test que no existe;
- **corre en CI**: es un paso del job `migrations`, que ya levanta PostgreSQL 17 y aplica las
  migraciones. Un test de integración que no corre en CI no protege nada;
- para inyectar una falla **adentro** de la transacción (el caso típico: «falla el segundo cobro») se
  envuelve el repositorio del alcance con un `Proxy` que delega al adaptador real y rompe en la N-ésima
  llamada. La base y el resto del camino quedan reales.

Los unitarios de Vitest con adaptadores en memoria siguen sirviendo para reglas de dominio, cálculos y
orquestación —y para fijar que el caso de uso **escriba todo adentro** de su unidad de trabajo—, **no**
para atomicidad. El servidor real + PostgreSQL real también se ejercita con **Playwright**
(`tests/e2e/`) y con los jobs **`migrations`** (base limpia + drift) y **`container`** (imagen real,
readiness, bootstrap).

---

## 3. Test rojo esperado para un cambio de dinero

1. Un test que fije la **invariante** (no el detalle de implementación).
2. Un test del **camino negativo**: sin permiso, monto inválido, turno cerrado, pedido cancelado.
3. Un test de **idempotencia** si la operación puede repetirse.
4. Una prueba de **concurrencia** contra base real si la propiedad la necesita.
5. **Mutation check** obligatorio: reintroducir la condición defectuosa y ver el rojo.

Los valores esperados se derivan de una **regla explícita del negocio**, nunca reutilizando el helper
de producción que está bajo prueba (ver [`../../../AGENTS.md`](../../../AGENTS.md) § *Integridad de
tests*).

---

## 4. Prohibiciones

- Declarar la operación atómica sin nombrar la transacción.
- Confiar en un `if` de lectura previa como control de concurrencia.
- Cubrir una unique constraint o una race con un doble en memoria.
- Persistir el desglose del cierre solo en un `Json` que se recalcula después.
- Escribir el log de auditoría fuera de la transacción del hecho.
- Imprimir, notificar o llamar a la red **dentro** de la transacción.
- Autorizar en la UI: el rol se chequea en el servidor.
- Aprobar la propia devolución.
- Publicar un monto sin declarar la **moneda**.
