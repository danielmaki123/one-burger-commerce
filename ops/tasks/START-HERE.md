# START-HERE — cómo arrancar una sesión nueva

Este archivo es la **puerta de entrada**. Todo lo que hace falta está versionado en el repo: no hace
falta nada de conversaciones anteriores. Si algo acá contradice a [`../../AGENTS.md`](../../AGENTS.md),
**manda `AGENTS.md`**.

## 1. Orden de lectura

| # | Documento | Responde |
|---|---|---|
| 1 | [`../../AGENTS.md`](../../AGENTS.md) | **Reglas y límites**: autonomía, jerarquía de fuentes, arquitectura, DDD, TDD, integridad de tests, ratcheting, seguridad, git, PR, CI, Definition of Done y prohibiciones |
| 2 | [`../../.agents/CONTEXT.md`](../../.agents/CONTEXT.md) | **Cómo está construido el sistema**: superficies, hosts, stack, DDD, bounded contexts, persistencia, outbox, auth, CI y deploy |
| 3 | [`../CURRENT.md`](../CURRENT.md) | **El estado real de hoy**: qué está en producción, capacidades activas, riesgos abiertos, trabajo en curso, qué sigue y bloqueos |
| 4 | **La TASK** | El brief (`ops/tasks/*.md`), el roadmap o el pedido del owner |
| 5 | **La skill que corresponda** | [`../../.agents/skills/`](../../.agents/skills/): `new-task`, `bugfix`, `money-change`, `database-migration`, `security-change`, `ui-change`, `audit`, `production-release` |
| 6 | [`../../.agents/MEMORY.md`](../../.agents/MEMORY.md) | **Solo si** la TASK toca un área donde sus lecciones aplican |

**No cargues toda la historia.** [`../history/`](../history/) se consulta **a propósito**, cuando hace
falta reconstruir por qué algo es como es. Es lo que evita leer 3.000 líneas para empezar.

## 2. Prompt para pegar en un chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + PostgreSQL, deploy en Easypanel).
>
> Leé, en este orden: **`AGENTS.md`** (reglas y límites), **`.agents/CONTEXT.md`** (cómo está construido
> el sistema) y **`ops/CURRENT.md`** (el estado real de hoy). Después la TASK y la skill que
> corresponda. **No hace falta leer el historial**: está archivado en `ops/history/` y se consulta solo
> si hace falta.
>
> **Cómo se trabaja acá**: **de a una TASK por vez**, y cada una se cierra entera. TDD con el **rojo
> observado por la razón correcta** → implementación mínima → **mutation check** → validación completa →
> **rama + commit + PR hacia `main`** (nunca push directo: es política del repo) → **CI
> verde** → merge con `--squash` → estado actualizado en `ops/CURRENT.md`.
>
> **Antes de codear**: seguí la skill [`new-task`](../../.agents/skills/new-task/SKILL.md) y declaré
> SCOPE / RISK / TEST / DONE / RECORD. Lo que la TASK ya decide, se ejecuta de corrido; se pregunta solo
> por lo que **no** decide (producto, alcance nuevo, dependencias, deploy).
>
> **Validación antes de cerrar**: `npm run security:secrets`, `lint`, `typecheck`, `test`,
> `test:contracts` y `build`. Si tocás una página (`src/app/**/page.tsx`), además `npm run build:webpack`
> — el build de Turbopack no valida los exports de una página.
>
> **Deploy**: una sola llamada a `deployService` (runbook §2), **nunca** `npm run deploy:easypanel`, y
> **jamás a producción sin el OK explícito del owner**.

## 3. Prompt para un chat de **auditoría**

> Trabajás en `one-burger-commerce`. **Este chat es de auditoría: es READ-ONLY.** No se cambia código de
> producto, ni la base, ni configuración, sin que el owner lo apruebe.
>
> Leé `AGENTS.md`, `.agents/CONTEXT.md`, `ops/CURRENT.md`, este archivo y
> [`../audit-backlog.md`](../audit-backlog.md) (el formato de los hallazgos). Seguí la skill
> [`audit`](../../.agents/skills/audit/SKILL.md).
>
> **Qué se espera**: evidencia, no impresiones. Cada hallazgo con `archivo:línea` o el comando que lo
> muestra, y **qué se midió**. Reproducir antes de proponer el arreglo; lo que no se reproduce se cierra
> como *no-repro* con el intento escrito. Clasificar (`bug` · `dato` · `infra` · `deuda` · `decisión` ·
> `documentación`), asignar severidad y **ordenar**. Registrar en `ops/audit-backlog.md` con el ID
> siguiente libre. **No mezclar auditoría y remediación en el mismo PR.**

## 4. Trabajo planificado y qué NO arrancar

- **Programa de remediación completo, en orden**: [`AUDIT-REMEDIATION-ROADMAP.md`](AUDIT-REMEDIATION-ROADMAP.md).
  Ese archivo dice qué sigue, con su objetivo, prioridad, riesgo y dependencia.
- **Plantilla obligatoria de TASK**: [`TEMPLATE.md`](TEMPLATE.md).
- **Lo que está pausado**: el **rediseño del menú público** (9 pantallas de Stitch) espera confirmación
  explícita del owner, y antes de tocar el sistema de diseño hay que revisar la rama
  `feat/design-system` del otro dev (`A-36`).
- **Bloqueos reales** (lo que necesita al owner): [`../CURRENT.md`](../CURRENT.md) §6.

**No inventes trabajo para no quedar quieto.** Si hay un plan, ese plan manda y se ejecuta de corrido.
Si no lo hay, se pregunta antes de codear.

## 5. Referencias rápidas

| Necesitás | Andá a |
|---|---|
| Reglas, límites y prohibiciones | [`../../AGENTS.md`](../../AGENTS.md) |
| Arquitectura, hosts, stack, auth, CI | [`../../.agents/CONTEXT.md`](../../.agents/CONTEXT.md) |
| Estado actual y riesgos | [`../CURRENT.md`](../CURRENT.md) |
| Lecciones aprendidas (trampas del arnés, E2E, deploy) | [`../../.agents/MEMORY.md`](../../.agents/MEMORY.md) |
| Procedimiento de cada tipo de trabajo | [`../../.agents/skills/`](../../.agents/skills/) |
| Hallazgos con ID y severidad | [`../audit-backlog.md`](../audit-backlog.md) |
| Runbook de producción (entorno, deploy, backups, rollback, límites) | [`../production-readiness.md`](../production-readiness.md) |
| Sistema de diseño oficial (UI) | [`../references/stitch/design-system.md`](../references/stitch/design-system.md) |
| Historia archivada | [`../history/`](../history/) |
