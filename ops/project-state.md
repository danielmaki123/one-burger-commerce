# `ops/project-state.md` — movido (compatibilidad)

**Este archivo ya no es el estado del proyecto.** Su contenido histórico completo se archivó en:

➡️ [`ops/history/project-state-legacy-2026-09.md`](history/project-state-legacy-2026-09.md)

**El estado operativo vigente es [`ops/CURRENT.md`](CURRENT.md).** Si buscás «qué está desplegado, qué
se cerró y qué falta», ese es el archivo.

## Por qué se movió

`project-state.md` llegó a **3.343 líneas** mezclando estado actual, historia, bugs, decisiones,
tareas, deploys y aprendizajes. El riesgo concreto: un agente nuevo podía leer una decisión histórica
—o un estado ya superado— **como si fuera el estado de hoy**. De hecho el archivo se contradecía a sí
mismo (por ejemplo, «sin backup automático» conviviendo con el registro del respaldo diario y su drill
de restore, o `A-43`/`A-45` abiertos y cerrados en bloques distintos).

**No se borró nada.** El contenido está íntegro en el archivo archivado, y el historial de git se
conservó con un `git mv`.

## Dónde vive cada cosa ahora

| Buscás | Va a |
|---|---|
| Estado operativo actual | [`CURRENT.md`](CURRENT.md) |
| Historia y «qué se cerró» | [`history/project-state-legacy-2026-09.md`](history/project-state-legacy-2026-09.md) |
| Hallazgos con ID, tipo y severidad | [`audit-backlog.md`](audit-backlog.md) |
| Programa de remediación | [`tasks/AUDIT-REMEDIATION-ROADMAP.md`](tasks/AUDIT-REMEDIATION-ROADMAP.md) |
| Runbook de producción | [`production-readiness.md`](production-readiness.md) |
| Cómo está construido el sistema | [`../.agents/CONTEXT.md`](../.agents/CONTEXT.md) |
| Conocimiento estable aprendido | [`../.agents/MEMORY.md`](../.agents/MEMORY.md) |

> Se conserva este archivo, vacío de contenido propio, **solo** porque hay referencias históricas que
> apuntan a `ops/project-state.md` (commits, briefs cerrados, PRs). Si encontrás una que lo use como
> fuente del estado actual, **corregila**: la referencia es lo que hay que arreglar.
>
> La decisión completa está en
> [`decisions/ADR-000-agent-operating-system.md`](decisions/ADR-000-agent-operating-system.md).
