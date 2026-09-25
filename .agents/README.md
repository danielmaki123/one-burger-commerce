# `.agents/` — el sistema operativo de ingeniería

Índice corto. Nada de acá reemplaza a [`../AGENTS.md`](../AGENTS.md), que es la autoridad.

| Documento | Para qué |
|---|---|
| [`../AGENTS.md`](../AGENTS.md) | **Reglas y límites**: qué puede hacer el agente, cuándo parar, arquitectura, TDD, git, CI, Definition of Done. |
| [`CONTEXT.md`](CONTEXT.md) | **Cómo está construido el sistema**: superficies, hosts, stack, DDD, bounded contexts, persistencia, outbox, auth, CI y deploy. Estable. |
| [`MEMORY.md`](MEMORY.md) | **Conocimiento estable aprendido**: decisiones cerradas, errores ya comprendidos, restricciones permanentes y lecciones de testing/CI/producción. |
| [`skills/`](skills/) | **Procedimientos repetibles**, uno por tipo de trabajo (`new-task`, `bugfix`, `money-change`, `database-migration`, `security-change`, `ui-change`, `audit`, `production-release`). |
| [`../ops/CURRENT.md`](../ops/CURRENT.md) | **Estado operativo actual**: qué está en producción, riesgos abiertos, trabajo en curso y qué sigue. |
| [`../ops/tasks/`](../ops/tasks/) | **Trabajo planificado**: briefs, plantilla obligatoria y el roadmap de remediación. |
| [`../ops/history/`](../ops/history/) | **Historia**: lo que ya pasó, archivado. Se consulta a propósito, no por defecto. |

Orden de lectura de una sesión nueva: `AGENTS.md` → `CONTEXT.md` → `ops/CURRENT.md` → la TASK → la
skill que corresponda. `MEMORY.md` se lee cuando la tarea toca un área donde sus lecciones aplican.
