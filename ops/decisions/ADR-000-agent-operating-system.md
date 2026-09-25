# ADR-000 — Sistema operativo de ingeniería del agente

- **Estado**: aceptado (pendiente de revisión del owner en el PR de TASK-AUD-000)
- **Fecha**: 2026-09-24
- **Contexto de la decisión**: TASK-AUD-000, antes de empezar a corregir las anomalías de la auditoría

## Context

La documentación del agente creció orgánicamente y mezclaba responsabilidades. `AGENTS.md` era a la vez
constitución, manual de arquitectura, guía de UI, procedimiento de testing, runbook de deploy y registro
de lecciones. `ops/project-state.md` había llegado a **3.343 líneas** mezclando estado actual, historia,
bugs, decisiones, tareas, deploys y aprendizajes.

Riesgo concreto y observado: un agente nuevo podía leer una decisión histórica como si fuera el estado
actual. El archivo se contradecía a sí mismo (p. ej. «sin backup automático» junto al registro del
respaldo diario y su drill; `A-43` y `A-45` abiertos y cerrados en bloques distintos), y `AGENTS.md`
describía tres roles cuando el código tiene cuatro (`owner`, `manager`, `kitchen`, `cashier`).

## Problem

Sin separación de responsabilidades:

1. el historial **competía** con el estado actual y, a veces, ganaba;
2. los procedimientos repetibles vivían enterrados en prosa, así que se improvisaban;
3. las lecciones aprendidas se perdían dentro de un changelog;
4. no había una jerarquía de fuentes explícita, así que un documento viejo podía contradecir al código;
5. nada verificaba que las rutas citadas por los documentos existieran, ni que la estructura siguiera en
   pie.

## Decision

Separar cuatro responsabilidades y un estado:

| Responsabilidad | Documento |
|---|---|
| **Comportamiento y reglas** | `AGENTS.md` |
| **Contexto estable** (cómo está construido) | `.agents/CONTEXT.md` |
| **Memoria estable** (lo aprendido) | `.agents/MEMORY.md` |
| **Procedimientos repetibles** | `.agents/skills/<skill>/SKILL.md` |
| **Estado operativo actual** | `ops/CURRENT.md` |

Más: la historia se **archiva** (`ops/history/`), las decisiones se registran (`ops/decisions/`), el
trabajo planificado tiene plantilla obligatoria (`ops/tasks/TEMPLATE.md`) y un roadmap
(`ops/tasks/AUDIT-REMEDIATION-ROADMAP.md`), y **contratos ejecutables** protegen la estructura.

Se fija además una **jerarquía de fuentes** (owner → seguridad e integridad de datos → contratos y
configuración real → `AGENTS.md` → `CONTEXT`/`CURRENT` → historia → referencias secundarias) con tres
reglas derivadas: el historial no gana sobre el estado actual; una referencia visual no gana sobre una
invariante de negocio; una UI nunca es por sí sola una frontera de autorización.

## Consequences

**A favor**

- Una sesión nueva arranca leyendo ~4 documentos cortos en vez de 3.000+ líneas.
- Los procedimientos dejan de improvisarse: RED → fix → GREEN → mutación → validación está escrito, con
  el protocolo de integridad de tests.
- El estado actual y la historia ya no compiten.
- La estructura deja de depender de la disciplina: hay contratos que fallan si se rompe.

**En contra / costo asumido**

- Más archivos: hay que **elegir** dónde escribe cada cosa.
- Los documentos se pueden desincronizar; se mitiga con los contratos (rutas citadas que deben existir,
  archivos obligatorios, techos de tamaño).
- Una regla puede quedar duplicada por descuido. La regla explícita es: **se escribe una vez y se
  enlaza**.
- `ops/project-state.md` sigue existiendo como puntero: es deuda de compatibilidad, no una fuente.

## What belongs where

| Si querés escribir… | Va a |
|---|---|
| Una regla de comportamiento o un límite | `AGENTS.md` |
| Cómo está construido el sistema (estable) | `.agents/CONTEXT.md` |
| Una lección reutilizable o un error ya comprendido | `.agents/MEMORY.md` |
| Un procedimiento que se repite | `.agents/skills/` |
| Qué está desplegado hoy y qué sigue | `ops/CURRENT.md` |
| Un hallazgo con ID, tipo y severidad | `ops/audit-backlog.md` |
| El plan de una TASK | `ops/tasks/` |
| Una decisión de arquitectura | `ops/decisions/` |
| Lo que ya pasó | `ops/history/` |

Prueba rápida: si **cambia semana a semana**, no va a `CONTEXT` ni a `MEMORY`. Si es **de una tarea
puntual**, va al PR o al historial. Si es **una anomalía sin corregir**, va al backlog — nunca a
`MEMORY` como si fuera una decisión resuelta.

## Migration

1. `git mv ops/project-state.md ops/history/project-state-legacy-2026-09.md` — **sin perder una línea**,
   conservando el historial de git.
2. `ops/project-state.md` queda como **puntero** a `CURRENT.md` y al archivo archivado.
3. `AGENTS.md` se reescribe como constitución; los procedimientos se van a las skills, y `AGENTS.md`
   **conserva la regla general y enlaza la skill**.
4. Se corrigen las contradicciones verificadas (roles, fuente de verdad visual, respaldo) y se
   documentan las que quedan.
5. `CLAUDE.md` queda como adapter mínimo, apuntando a `AGENTS.md`.
6. `.gitignore`: `.agents/` pasa a versionarse **selectivamente** (se ignoran los volcados de skills de
   terceros). Además se anclan a la raíz los patrones de documentos heredados, porque `CONTEXT.md` sin
   ancla ignoraba también `.agents/CONTEXT.md`.

## Compatibility

- **No hay cambio funcional del producto.** Es una TASK de documentación, estructura y contratos.
- **No se perdió información**: el contenido histórico está íntegro en el archivo archivado.
- **No se tocó** producción, base de datos, secrets, ruleset de GitHub ni deploy.
- Las referencias viejas a `ops/project-state.md` **siguen resolviendo**: el archivo existe y redirige.
- Los guardrails técnicos que ya existían (DDD, TDD, route handlers, tamaño, design system, contratos,
  CI, migraciones, deploy, PR, seguridad, UI mobile-first, `build:webpack`, E2E, producción) se
  **preservaron**: cambiaron de lugar, no de contenido. La regla de ratcheting (**la deuda vieja puede
  quedar; la nueva no**) se deja escrita como principio del repo.
- Los contratos nuevos son deterministas y corren en un clon superficial: **leen archivos**, no historia
  de git.
