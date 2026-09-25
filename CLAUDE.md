# CLAUDE.md

**Este repo usa [`AGENTS.md`](AGENTS.md) como autoridad.** Este archivo es un **adapter**, no un
manual: no repite reglas (si una regla hiciera falta acá, hay que arreglar `AGENTS.md`).

Orden de lectura para un agente basado en Claude:

1. [`AGENTS.md`](AGENTS.md) — reglas y límites.
2. [`.agents/CONTEXT.md`](.agents/CONTEXT.md) — cómo está construido el sistema.
3. [`ops/CURRENT.md`](ops/CURRENT.md) — qué está vivo hoy.
4. La TASK ([`ops/tasks/`](ops/tasks/), incluida su [plantilla](ops/tasks/TEMPLATE.md)).
5. La skill que corresponda: [`.agents/skills/`](.agents/skills/).
6. [`.agents/MEMORY.md`](.agents/MEMORY.md) — solo si la TASK toca un área donde sus lecciones aplican.

Punto de entrada de una sesión nueva: [`ops/tasks/START-HERE.md`](ops/tasks/START-HERE.md).

> **Nota histórica:** este archivo tuvo antes instrucciones heredadas de **otro proyecto** (sincronizar
> con `origin/staging`, ramas `claude/*`, `docs/current-task.md`, `handoffs/PROJECT_STATE.md`). Nada de
> eso aplica: se trabaja en una rama, se abre PR hacia `main` (que no recibe push directo) y se mergea
> con `--squash` tras el CI verde. `docs/` y `handoffs/` están en `.gitignore` por ser material
> heredado.

## Estado operativo (decisión del owner, no técnica)

Claude Code CLI está **pausado** por decisión del owner. Si se reactiva, es un worker de
implementación más (no un orchestrator) y trabaja con las reglas de `AGENTS.md`.
