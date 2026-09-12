# CLAUDE.md

**Este repo usa [`AGENTS.md`](AGENTS.md) como única fuente de verdad** para las reglas de trabajo
(alcance, arquitectura, TDD, validación, git/CI, deploy, idioma y prohibiciones). Un agente basado en
Claude debe leer `AGENTS.md` y, para el estado real, `ops/project-state.md`; el punto de entrada para
un chat nuevo es [`ops/tasks/START-HERE.md`](ops/tasks/START-HERE.md).

> **Nota histórica:** este archivo tuvo antes instrucciones heredadas de **otro proyecto** (sincronizar
> con `origin/staging`, trabajar en ramas `claude/*`, leer `docs/current-task.md` y
> `handoffs/PROJECT_STATE.md`). Nada de eso aplica acá: en este repo la rama de trabajo y deploy es
> **`main`** (push directo autorizado), y `docs/` y `handoffs/` están en `.gitignore` justamente porque
> son material heredado. Se dejó la nota para que nadie las siga por error.

## Estado operativo (decisión del owner, no técnica)

Claude Code CLI está **pausado** por decisión del owner y no se usa para tareas nuevas mientras siga
así. Si se reactiva, es un worker de implementación más (no un orchestrator) y trabaja con las mismas
reglas de `AGENTS.md`: de a una tarea por vez, TDD, validación completa y sin desplegar a producción
sin confirmación.
