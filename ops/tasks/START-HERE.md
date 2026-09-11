# START-HERE — cómo retomar el proyecto en un chat nuevo

Este archivo existe para que un agente nuevo (o una persona) arranque **sin depender de
ningún contexto de conversación previa**. Todo lo necesario está versionado en el repo.

## Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md`, `ops/audit-checkout-mock.md` y **`ops/tasks/TASK-mock-adoption.md`**.
> La tarea es la **adopción del mock completo** (rediseño de la UI pública): se copian **el orden
> visual, los colores y los componentes** del mock, **no** su comportamiento (medido: no funciona) ni
> sus dependencias (CDN) ni sus defectos de accesibilidad (zoom bloqueado, 0 `role`, 45 fallos de
> contraste). **Regla dura: ningún control decorativo** — cada control queda implementado con su
> API/estado y **cubierto por un test**, o se elimina con el motivo escrito.
> El plan está en tareas (§4 del brief) en el **orden del mock**; `TASK-checkout-v2.md` es la tarea T5.
> **TDD por fase y por tarea**: escribí primero el test que falla, corrélo y confirmá el rojo por la
> razón correcta antes de implementar. Nada de código antes del test.
> Ojo con dos cosas que el mock NO tiene y no se pueden perder: **nombre y WhatsApp** del cliente y
> la **hora de retiro opcional/programable**.
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
| 4 | `ops/audit-checkout-mock.md` | La auditoría medida del mock: inventario y clasificación por elemento, lo que se descarta con motivo y los 18 defectos que no se arrastran |
| 5 | `ops/tasks/TASK-mock-adoption.md` | **El plan vigente**: adopción del mock (reglas, matriz de adopción, ola 1 en 7 tareas, ola 2 pendiente de OK y decisiones) |
| 6 | `ops/tasks/TASK-checkout-v2.md` | El detalle de la tarea **T5 (carrito + checkout)** del programa, con su protocolo TDD por fase |
| 7 | `README.md` · `.env.example` | Alcance del MVP y variables de entorno |

Tareas ya cerradas, por si hace falta el contexto de una decisión:
`ops/tasks/TASK-whitelabel-branding.md` (personalización del negocio) y
`ops/tasks/TASK-checkout-ux.md` (redundancias de texto y botones).

Los mockups del owner (`mockup/` con el `confirmar pedido.txt` previo, y
`stitch_full_pwa_builder/` con el mock completo de 7 pantallas) son **material de diseño, no fuente
de verdad** del cálculo ni del alcance: están sin versionar a propósito (son su espacio de trabajo) y
**no se commitean**. Lo que sí se versiona es la auditoría medida:
[`ops/audit-checkout-mock.md`](../audit-checkout-mock.md), con su herramienta
(`scripts/audit-checkout-mock.mjs`, navegador real a 375 px y 1280 px).

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
