# TASK-OPS-001 — Default E2E Delivery Contract

> **Estado**: cerrada (2026-09-26). **Delivery Mode**: `docs-only` — gobierno del agente: no cambia producto,
> no cambia runtime y **no despliega**. Alcance y criterios de aceptación en el cuerpo del PR.
>
> Esta TASK es la que deja por escrito **cuánto dura una TASK** en este repo. La política canónica vive en
> [`../../.agents/skills/delivery-e2e/SKILL.md`](../../.agents/skills/delivery-e2e/SKILL.md); acá queda el
> registro de qué se cambió y qué se verificó.

## TASK ID

`TASK-OPS-001`.

## Título

Convertir la entrega end-to-end en el comportamiento por defecto del agente.

## Prioridad

`P3` (gobierno y documentación: no toca producto, dinero ni datos).

## Clase de riesgo

`docs/CI` — el único código que cambia es un **contrato ejecutable**.

## DELIVERY MODE

- [x] `docs-only`
- [ ] `runtime-e2e`
- [ ] `high-risk-e2e`

## STOP CONDITIONS específicas de esta TASK

`N/A — solo las de la política`. La TASK no toca producción, no migra ni repara datos y no cuesta dinero.

---

## PROBLEMA

La entrega de una TASK estaba a medio escribir en cuatro lugares (`AGENTS.md`, `new-task`,
`production-release`, el runbook) y con una regla que el owner ya había cambiado en la práctica: el
procedimiento pedía **un segundo OK humano** antes de mergear o desplegar, aunque la TASK estuviera aprobada y
los gates verdes. Eso producía dos daños: trabajo detenido esperando una confirmación que ya estaba dada, y una
**regla de backup por frecuencia** («backup manual, antes de cada deploy») que obligaba a respaldar releases de
UI o documentación donde no hay nada que restaurar.

## EVIDENCIA

- `.agents/skills/production-release/SKILL.md:6` — «con el **OK explícito del owner**… Nunca sin pedirlo».
- `.agents/skills/production-release/SKILL.md:23` — checklist: «**OK explícito del owner.**».
- `ops/tasks/START-HERE.md:45` — «**jamás a producción sin el OK explícito del owner**».
- `.agents/MEMORY.md:220` — «Nunca se despliega sin el OK explícito del owner».
- `ops/CURRENT.md:114` — «Mientras tanto: backup manual, **antes de cada deploy**».
- `ops/production-readiness.md:230` — «Con migraciones: backup manual (`pg_dump`) y anotar el identificador».

## CAUSA RAÍZ

La autorización estaba escrita como un **acto humano por release** en vez de una **propiedad del modo de
entrega declarado al abrir la TASK**. Sin un modo explícito, cada sesión tenía que inferir si su TASK llegaba
a producción, y la respuesta por defecto era preguntar. Lo mismo con el backup: sin criterio de riesgo, la
única regla posible era la frecuencia.

## INVARIANTE

**Ninguna TASK llega a producción sin `main` y CI verde**, y **ninguna release riesgosa se ejecuta sin backup
o preflight**: lo que cambia es **quién autoriza** (la aprobación de la TASK, no un segundo OK) y **qué lo
dispara** (el riesgo del release, no su frecuencia).

## BOUNDED CONTEXT

`N/A — no toca módulos de `src/modules/``. El cambio es del sistema operativo del agente (`.agents/`) y de la
documentación operativa (`ops/`), más un contrato en `src/shared/contracts/`.

---

## SCOPE IN

- `.agents/skills/delivery-e2e/SKILL.md` (**nueva**): la política canónica —flujo, tres modos, diez Stop
  Conditions, política de backups, lo que no cambia y prohibiciones—.
- `AGENTS.md`: bloque de entrega E2E + la parada por Stop Condition + deploy «desde `main` y con CI verde,
  sin segunda autorización» + DoD.
- `.agents/skills/new-task/SKILL.md`: el **Delivery Mode** como paso de arranque y en el decision gate.
- `.agents/skills/production-release/SKILL.md`: la semántica nueva, el checklist y las prohibiciones.
- `ops/tasks/TEMPLATE.md`: campo **DELIVERY MODE** y **STOP CONDITIONS** de cada TASK.
- `ops/production-readiness.md`: la política de backup por riesgo.
- `ops/CURRENT.md`: estado vigente (Órdenes desplegada, contrato vigente, `A-57` abierto).
- `.agents/CONTEXT.md`, `.agents/MEMORY.md`, `.agents/README.md`, `ops/tasks/START-HERE.md`: dejar de
  proclamar el segundo OK y el backup por frecuencia.
- `src/shared/contracts/agent-system-contract.test.ts`: el guardrail objetivo.

## SCOPE OUT

- **Producto y runtime**: cero cambios. Sin deploy, sin migración, sin tocar datos.
- **La historia archivada** (`ops/history/`): no se reescribe.
- Las «aprobaciones del owner» que son de **producto** (spec de una pantalla, promesas fuera del MVP,
  tocar el ruleset de GitHub) siguen existiendo: no son gates de deploy.
- El `git push --force` a `main`, el PR obligatorio y los cuatro checks: intactos.

## DEPENDENCIAS

`N/A — ninguna`. La decisión del owner ya está tomada y es la que esta TASK escribe.

## ARCHIVOS PROBABLES

Los de `SCOPE IN`. Los consumidores son todas las sesiones futuras: `AGENTS.md` es lo primero que lee un
agente y las skills son el procedimiento que ejecuta.

---

## TEST ROJO

En `src/shared/contracts/agent-system-contract.test.ts`, cinco casos nuevos escritos **antes** de tocar la
documentación:

1. la política existe, es fuente única y nombra los tres modos y las condiciones de parada;
2. `production-release` ya no pide un segundo OK y **conserva** los guardrails del deploy;
3. `new-task` declara los tres modos;
4. la plantilla pide `DELIVERY MODE` y `STOP CONDITIONS`;
5. ningún documento activo vuelve a exigir backup manual por frecuencia.

**Rojo observado** (5 fallas, por la razón correcta):

```
× falta .agents/skills/delivery-e2e/SKILL.md: sin la política escrita, cada sesión vuelve a preguntar si mergea o despliega
× el deploy ya no se autoriza dos veces: expected 'OK explícito del owner' to be null
× el arranque de una TASK tiene que declarar su modo de entrega: expected [ 'docs-only', 'runtime-e2e', 'high-risk-e2e' ] to deeply equal []
× una TASK sin modo de entrega declarado no sabe si termina en merge o en producción: ídem
× el backup se decide por riesgo del release, no por frecuencia: expected [ 'ops/CURRENT.md', 'ops/production-readiness.md' ] to deeply equal []
```

## ESTRATEGIA

Una **sola fuente** (la skill) y **enlaces** desde el resto: `AGENTS.md` da la regla general y el puntero,
`new-task` declara el modo, `production-release` ejecuta y la plantilla lo pide por TASK. El contrato custodia
propiedades **objetivas** y no intenta decidir riesgo de negocio: eso lo declara el humano en el modo.

## DDD

`N/A — no toca capas de dominio`.

## TRANSACCIÓN · CONCURRENCIA · IDEMPOTENCIA

`N/A — no hay operación de escritura de negocio`.

## AUTORIZACIÓN

Es el **objeto** del cambio: la autorización pasa de «segundo OK por release» a «el Delivery Mode declarado en
una TASK aprobada». Se conserva lo que protegía: deploy solo desde `main` con CI verde, una sola llamada a
`deployService`, health/readiness, smokes, `commit.sha`, prohibición de `db:seed`/`migrate reset` y de tocar
servicios ajenos, y el rollback del runbook.

## MIGRACIÓN

`N/A — sin cambios de esquema`.

## OBSERVABILIDAD

El modo queda escrito en la TASK y en el cuerpo del PR, y el reporte final dice con qué modo se entregó.

---

## TESTS UNITARIOS

`src/shared/contracts/agent-system-contract.test.ts`: 18 casos (13 previos + 5 nuevos), todos en verde.

## TESTS DE INTEGRACIÓN

`N/A — no hay propiedad que dependa de PostgreSQL`.

## E2E

`N/A — el cambio no toca flujos de usuario` (Delivery Mode `docs-only`: sin deploy).

## MUTATION CHECK

Los tres que pide la TASK, cada uno ejecutado y restaurado (**la mutación no se commitea**):

| Mutación | Resultado |
|---|---|
| Reintroducir «OK explícito del owner» en `production-release` | **ROJO** |
| Reintroducir la regla de backup manual **por frecuencia** en `AGENTS.md` | **ROJO** |
| Quitar `runtime-e2e` de `new-task` | **ROJO** |

Después de restaurar: `18 passed`.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

## CRITERIOS DE ACEPTACIÓN

- [x] Existe la política Default E2E y es fuente única (contrato).
- [x] `production-release` no exige un segundo OK y conserva sus guardrails (contrato).
- [x] `new-task` conoce los tres modos y no se lo pregunta al owner cuando es inferible (contrato).
- [x] La plantilla pide `DELIVERY MODE` y `STOP CONDITIONS`.
- [x] Ningún documento activo proclama backup manual por frecuencia (contrato).
- [x] Deploy solo desde `main` con CI verde: intacto (contrato).
- [x] Los tres mutation checks dan rojo.
- [x] `AGENTS.md` sigue en **300 líneas** (techo) y `ops/CURRENT.md` en **249** (techo 250).

## REGRESIÓN

Cada mutación de la tabla de arriba es la regresión: reintroducir la regla vieja pone el contrato en rojo.

## ROLLBACK

`git revert` del squash: es documentación y un contrato, sin estado ni datos. No hay nada que restaurar.

## DOCUMENTACIÓN

Este brief, `ops/CURRENT.md` (estado vigente) y las skills tocadas.

## MEMORY

La lección reutilizable quedó en la política (`.agents/skills/delivery-e2e/SKILL.md`): **una autorización por
TASK, un backup por riesgo**. No se duplica en `MEMORY.md`; se enlaza desde ahí.

## DEFINITION OF DONE

Cumplida salvo el deploy, que el modo `docs-only` **excluye por definición**.
