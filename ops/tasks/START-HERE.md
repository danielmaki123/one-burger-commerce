# START-HERE — cómo retomar el proyecto en un chat nuevo

Este archivo existe para que un agente nuevo (o una persona) arranque **sin depender de
ningún contexto de conversación previa**. Todo lo necesario está versionado en el repo.

## Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-whitelabel-branding.md`.
> La tarea a ejecutar es **TASK-whitelabel-branding** (ya aprobada, con las decisiones
> resueltas en su §8): personalización del negocio para que ningún dato quede hardcodeado,
> editable desde una sección del admin.
> Trabajá con **TDD** (test que falla primero), en español, con commits propios y la
> validación mínima (`npm run test`, `lint`, `typecheck`, `build`) antes de cerrar cada fase.
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que
> el CI quedó verde. Si necesitás desplegar, pedime el `EASYPANEL_URL` y `EASYPANEL_TOKEN`
> (no están en el repo).

## Orden de lectura (y qué responde cada documento)

| # | Documento | Responde |
|---|---|---|
| 1 | `AGENTS.md` | Reglas de trabajo: alcance, arquitectura DDD, TDD, validación, git/CI, deploy, idioma, prohibiciones |
| 2 | `ops/project-state.md` | Qué está desplegado hoy, qué se cerró, qué falta, cómo levantar el entorno local |
| 3 | `ops/production-readiness.md` | Runbook: entorno, deploy, backups, rollback, notificaciones, primer arranque, límites conocidos |
| 4 | `ops/tasks/TASK-whitelabel-branding.md` | La tarea a ejecutar: alcance, modelo de datos, fases, criterio de aceptación |
| 5 | `README.md` · `.env.example` | Alcance del MVP y variables de entorno |

## Estado en una línea

Producción viva en **https://oneburgernic.com** (admin en `/admin/login`), datos del negocio
hardcodeados todavía, menú real a medio cargar por el owner, notificaciones a cocina y
backups pendientes. Detalle y prioridades en `ops/project-state.md` §4.

## Reglas mínimas que no se negocian

1. **TDD**: el test que falla va primero.
2. **Nada de datos del negocio en el código**: si un nombre, teléfono, color o precio está
   escrito en una superficie pública, es un bug (esta tarea existe por eso).
3. **No reactivar** reservas, mesas, delivery ni inventario en navegación o APIs públicas.
4. **No tocar** servicios ajenos del panel compartido (`cacommerce`, `capostgres`,
   `imagehost`, `postimage`, proyecto `n8n`).
5. **Nunca** commitear secretos, tokens ni `.env` (`npm run security:secrets` lo verifica).
6. Los cambios se cierran con: tests verdes, CI verde y verificación en el camino real
   (contenedor o producción).

## Qué pedirle a Daniel si falta algo

- `EASYPANEL_URL` y `EASYPANEL_TOKEN` para desplegar (solo por entorno, nunca en el repo).
- Credenciales de la cuenta owner si hace falta entrar al admin
  (`admin@oneburgernic.com`; la contraseña la administra Daniel).
- Token del bot de Telegram + chat id si la tarea incluye activar notificaciones.
