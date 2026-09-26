# TEMPLATE de TASK — copiar y completar

> **Cómo se usa**: se copia este archivo a `ops/tasks/TASK-<id>-<nombre>.md` y se completa **antes** de
> escribir código. Es el contrato de arranque de la skill
> [`new-task`](../../.agents/skills/new-task/SKILL.md).
>
> **Reglas de llenado**
>
> - **No todos los campos aplican siempre.** Cuando no aplica se escribe `N/A — <razón>`. El **silencio
>   no es una respuesta válida**.
> - En una TASK que toca **dinero**, `TRANSACCIÓN`, `CONCURRENCIA` e `IDEMPOTENCIA` **nunca** se dejan
>   afuera en silencio: se contestan o se justifica el `N/A` (ver
>   [`money-change`](../../.agents/skills/money-change/SKILL.md)).
> - Los campos de evidencia llevan `archivo:línea`, comando o test. Sin evidencia es una sospecha, y las
>   sospechas no se implementan.

---

## TASK ID

`TASK-<prefijo>-<número>` (p. ej. `TASK-AUD-004`).

## Título

Una línea, en imperativo y en español.

## Prioridad

`P0` (bloquea todo) · `P1` (plata o datos) · `P2` (función rota o fuga) · `P3` (deuda, UI, docs).

## Clase de riesgo

`dinero` · `auth/datos` · `migración` · `UI` · `docs/CI`. Es la **más alta** que aplique: una TASK que
toca dinero y UI es de riesgo *dinero*.

## DELIVERY MODE

`docs-only` (docs/ADR/roadmap/contratos sin runtime: **sin deploy**) · `runtime-e2e` (producto o runtime:
merge **y** deploy con QA en producción) · `high-risk-e2e` (dinero, auth, datos o esquema: ídem, con los
gates de su skill). El flujo y las condiciones de parada están en
[`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md); acá **no** se repite el procedimiento.

- [ ] `docs-only`
- [ ] `runtime-e2e` (default cuando toca producto/runtime)
- [ ] `high-risk-e2e`

## STOP CONDITIONS específicas de esta TASK

Qué condición de parada tiene **esta** TASK en particular, además de las diez de la política. Si no hay
ninguna propia: `N/A — solo las de la política`.

---

## PROBLEMA

Qué está mal, en términos del sistema (no del síntoma).

## REUSE AUDIT

La ley está en [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md) §10.1–§10.3: antes de
crear una pantalla, ruta, feature, caso de uso, componente o flujo, se busca si la capacidad **ya existe**.

```md
Objetivo:                 <qué quiere lograr el usuario>
Capacidad existente:      <qué hay hoy y dónde (módulo, caso de uso, ruta, componente)>
Qué se reutiliza:         <lo que se compone o se enlaza>
Qué es realmente nuevo:   <lo que no existía; si no hay nada, la TASK no crea>
```

Una implementación paralela (**lo nuevo**) exige una **responsabilidad de dominio distinta** y su
justificación. Si la capacidad ya existe y la TASK la reconstruye, la respuesta correcta es reutilizar,
componer o **enlazar al flujo canónico** (§10.2).

## EVIDENCIA

Lo observado y reproducible: `archivo:línea`, el comando, el test, la medición. Si es un hallazgo de
auditoría, su ID en [`../audit-backlog.md`](../audit-backlog.md).

## CAUSA RAÍZ

Por qué el código permite esto. «Faltaba un `if`» **no** es causa raíz.

## INVARIANTE

Qué tiene que seguir siendo verdad después del cambio, escrito como igualdad o imposibilidad
(«la suma de los pagos del turno es igual al esperado de ese turno»).

## BOUNDED CONTEXT

Módulo(s) dueño(s) del cambio en `src/modules/`. Si son dos, decirlo: es señal de alcance grande.

---

## SCOPE IN

Qué cambia exactamente. Archivo por archivo cuando se pueda.

## SCOPE OUT

Qué **no** cambia. Se dice explícitamente aunque parezca obvio.

## DEPENDENCIAS

TASK previa · decisión del owner · credencial · migración. Si no hay: `N/A — ninguna`.

## ARCHIVOS PROBABLES

Rutas que se van a tocar, y **quién más las consume** (para estimar el radio de impacto).

---

## TEST ROJO

El test que se escribe **primero**, con el nombre del archivo y la aserción que va a fallar. Qué rojo
se espera ver y **por qué razón**.

## ESTRATEGIA

El enfoque, en pocas líneas. Si hay más de una opción razonable, por qué se elige esta.

## DDD

Qué capa cambia (`domain` · `features` · `ports` · `adapters` · `route`) y qué se mantiene puro. Si el
cambio mete I/O en `domain/`: `N/A — no aplica` **no** sirve, hay que rediseñar.

## TRANSACCIÓN

Cuál es el **límite atómico** de la operación (qué pasa todo junto o no pasa). `N/A — <razón>` solo si
la operación es una única escritura sin efectos derivados.

## CONCURRENCIA

¿Dos requests simultáneos rompen la invariante? ¿Se protege con unique constraint, lock o transición de
estado condicional? Ojo: leer-y-después-escribir **no** es protección.

## IDEMPOTENCIA

¿Qué pasa si la request se reintenta? ¿Hay clave de idempotencia y la garantiza la **base**?

## AUTORIZACIÓN

Quién puede y quién **no**. Qué puerta de `src/modules/auth/domain/admin-permissions.ts` se usa, y qué
prueba negativa lo fija. Recordar: `kitchen` no maneja plata; `cashier` no administra caja, no devuelve,
no descuenta a mano y no ve el esperado del arqueo.

## MIGRACIÓN

Si toca el esquema: ruta de upgrade, compatibilidad, backfill, `NOT NULL`, índices y rollback operativo
(ver [`database-migration`](../../.agents/skills/database-migration/SKILL.md)). Si no:
`N/A — sin cambios de esquema`.

## OBSERVABILIDAD

Qué queda registrado (auditoría, historial de estados, movimientos) y **dónde**, para poder reconstruir
qué pasó. Si el log puede faltar, decirlo.

---

## TESTS UNITARIOS

Los del dominio y los casos de uso, con el rojo observado.

## TESTS DE INTEGRACIÓN

Contra **PostgreSQL real** cuando la propiedad dependa de la base (unique, race, transacción, rollback,
lock, partial write). Un doble en memoria **no** demuestra eso: ver
[`money-change`](../../.agents/skills/money-change/SKILL.md) §2.

## E2E

El flujo de usuario que se cubre en `tests/e2e/`, o `N/A — no toca flujos de usuario`.

## MUTATION CHECK

Qué mutación se va a introducir después del GREEN y qué test tiene que fallar. La mutación **no** se
commitea. Si no se puede mutar, decir por qué.

## VALIDACIÓN

Los comandos que se van a correr. Base obligatoria:

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

Más `npm run build:webpack` si toca una página, y los E2E si toca flujos.

## CRITERIOS DE ACEPTACIÓN

Lista verificable. Cada criterio tiene que poder marcarse con evidencia, no con una opinión.

## REGRESIÓN

Qué test **falla si se reintroduce el bug**. Es la prueba de que el test tiene dientes.

## ROLLBACK

Cómo se deshace: revert del commit para la app; para la base, **fix-forward** apoyado en el backup (no
hay down-migrations).

## DOCUMENTACIÓN

Qué documento se actualiza: `CURRENT.md`, el backlog, `CONTEXT.md` si cambió la arquitectura, la skill
si cambió el procedimiento.

## MEMORY

Qué lección **reutilizable** entra en [`.agents/MEMORY.md`](../../.agents/MEMORY.md), o
`N/A — específico de esta TASK` (en ese caso va al PR, no a MEMORY).

## DEFINITION OF DONE

Ver la lista de [`AGENTS.md`](../../AGENTS.md) § *Definition of Done*. Marcar acá las excepciones
documentadas (p. ej. TDD sin rojo observable, con su motivo).
