# START-HERE — cómo retomar el proyecto en un chat nuevo

Este archivo existe para que un agente nuevo (o una persona) arranque **sin depender de
ningún contexto de conversación previa**. Todo lo necesario está versionado en el repo.

## Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-checkout-ux.md`.
> La tarea a ejecutar es **TASK-checkout-ux**: eliminar las redundancias de texto y de
> botones del carrito y del checkout, y generar los turnos de retiro desde la configuración
> en vez de tenerlos escritos en el código. El inventario medido, el rediseño y las fases
> están en el brief.
> Trabajá con **TDD** (test que falla primero), en español, con commits propios y la
> validación mínima (`npm run test`, `lint`, `typecheck`, `build`) antes de cerrar cada fase.
> La verificación de "un solo botón visible" va en navegador real (Playwright) a 375 px y
> 1280 px, no en HTML estático.
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que
> el CI quedó verde. **No despliegues a producción sin pedir confirmación.**

## Orden de lectura (y qué responde cada documento)

| # | Documento | Responde |
|---|---|---|
| 1 | `AGENTS.md` | Reglas de trabajo: alcance, arquitectura DDD, TDD, validación, git/CI, deploy, idioma, prohibiciones |
| 2 | `ops/project-state.md` | Qué está desplegado hoy, qué se cerró, qué falta, cómo levantar el entorno local |
| 3 | `ops/production-readiness.md` | Runbook: entorno, deploy, backups, rollback, notificaciones, primer arranque, límites conocidos |
| 4 | `ops/tasks/TASK-checkout-ux.md` | La tarea a ejecutar: inventario medido de redundancias, rediseño, fases, criterio de aceptación |
| 5 | `README.md` · `.env.example` | Alcance del MVP y variables de entorno |

Tareas ya cerradas, por si hace falta el contexto de una decisión:
`ops/tasks/TASK-whitelabel-branding.md` (personalización del negocio).

## Estado en una línea

Producción viva en **https://oneburgernic.com** (landing), **https://menu.oneburgernic.com**
(app de pedidos) y **https://admin.oneburgernic.com** (panel). Los datos del negocio ya se
editan desde `/admin/settings`. El menú real está a medio cargar por el owner (hay una
categoría sin productos), y las notificaciones a cocina y los backups siguen pendientes.
Detalle y prioridades en `ops/project-state.md` §4.

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
