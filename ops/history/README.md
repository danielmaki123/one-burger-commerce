# `ops/history/` — historia archivada

**Qué es**: lo que ya pasó, conservado **entero**. No se reescribe el pasado: se archiva.

**Qué NO es**: no es fuente de verdad y **no describe el estado actual**. Si este directorio y
[`../CURRENT.md`](../CURRENT.md) se contradicen, **gana `CURRENT.md`** — y el historial tiene razón
sobre lo que pasó **en su momento**.

Se consulta **a propósito** (para reconstruir por qué algo es como es, o el detalle de una decisión
vieja), nunca como lectura por defecto de una sesión nueva.

## Contenido

| Archivo | Qué es |
|---|---|
| [`project-state-legacy-2026-09.md`](project-state-legacy-2026-09.md) | El `ops/project-state.md` original (3.343 líneas) hasta el 2026-09-25: changelog de rondas, «qué se cerró» fase por fase, infraestructura, pendientes priorizados, arnés de E2E y límites conocidos. **Contiene bloques que se contradicen entre sí** (era un archivo en construcción continua) y estados ya superados: es historia, no estado. |
| [`handoff-next-session-legacy.md`](handoff-next-session-legacy.md) | Un «arranque de sesión» de una ronda anterior («Puntos 1 y 2 cerrados, sigue el Punto 3»). Se archivó porque **repetía las reglas de `AGENTS.md`** y competía con `ops/tasks/START-HERE.md` como punto de entrada: un documento que dice «leé esto primero» y está viejo es la forma más rápida de arrancar una sesión con el estado equivocado. |

## Cómo agregar algo acá

- Se archiva cuando un documento deja de ser la fuente vigente y su contenido sigue teniendo valor
  histórico: se **mueve** (con `git mv`, para conservar el historial de git) y se deja un puntero si
  había referencias que romper.
- **No se fragmenta obsesivamente**: una división cronológica razonable alcanza.
- **No se edita para «actualizarlo»**: la historia no se corrige. Si algo de acá se usa hoy, se copia
  al documento vigente y se enlaza.
