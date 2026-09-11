# START-HERE — cómo retomar el proyecto en un chat nuevo

Este archivo existe para que un agente nuevo (o una persona) arranque **sin depender de
ningún contexto de conversación previa**. Todo lo necesario está versionado en el repo.

## Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-checkout-v2.md`.
> La tarea es la **mejora del checkout**: ejecutá las fases aprobadas de ese brief, en orden,
> una por commit. El brief lista las decisiones que hay que preguntar antes de las fases 4 y 5.
> **TDD siempre**: escribí primero el test que falla, corrélo y confirmá el rojo antes de
> implementar. Nada de código antes del test.
> Trabajá en español, con commits propios, y validá con `npm run test`, `lint`, `typecheck`,
> `build` y `security:secrets` antes de cerrar cada fase. Si tocás `schema.prisma`, corré
> `npx prisma generate` (el build local no lo regenera).
> Lo visual se verifica en navegador real (Playwright) a 375 px y 1280 px, no en HTML estático.
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que
> el CI quedó verde. **No despliegues a producción sin pedir confirmación.**

## Orden de lectura (y qué responde cada documento)

| # | Documento | Responde |
|---|---|---|
| 1 | `AGENTS.md` | Reglas de trabajo: alcance, arquitectura DDD, TDD, validación, git/CI, deploy, idioma, prohibiciones |
| 2 | `ops/project-state.md` | Qué está desplegado hoy, qué se cerró, qué falta, cómo levantar el entorno local |
| 3 | `ops/production-readiness.md` | Runbook: entorno, deploy, backups, rollback, notificaciones, primer arranque, límites conocidos |
| 4 | `ops/tasks/TASK-checkout-v2.md` | La tarea a ejecutar: qué falta del checkout, el análisis del mock, fases y criterios de aceptación |
| 5 | `README.md` · `.env.example` | Alcance del MVP y variables de entorno |

Tareas ya cerradas, por si hace falta el contexto de una decisión:
`ops/tasks/TASK-whitelabel-branding.md` (personalización del negocio) y
`ops/tasks/TASK-checkout-ux.md` (redundancias de texto y botones).

`mockup/confirmar pedido.txt` es una **guía del owner** para el checkout: está sin versionar a
propósito (el `.gitignore` excluye su carpeta de trabajo) y **no es fuente de verdad del
cálculo**. Su análisis está en `TASK-checkout-v2.md` §3.

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
