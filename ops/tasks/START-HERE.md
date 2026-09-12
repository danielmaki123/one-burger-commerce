# START-HERE — cómo retomar el proyecto en un chat nuevo

Este archivo existe para que un agente nuevo (o una persona) arranque **sin depender de
ningún contexto de conversación previa**. Todo lo necesario está versionado en el repo.

## Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md` (el estado real:
> qué está desplegado, qué se cerró y los pendientes priorizados de §4) y `ops/production-readiness.md`
> (el runbook, con la secuencia de deploy).
> **El programa del mock (`ops/tasks/TASK-mock-adoption.md`) está cerrado** salvo los opcionales: T1-T13
> hechos, T8 (multi-sucursal) cerrada y el checkout v2 con sus fases 1-4 y 6 cerradas. Lo que queda son
> los pendientes de `ops/project-state.md` §4 (varios necesitan una decisión o un dato del owner).
> **Reglas duras**: TDD (el test que falla va primero, y se confirma el rojo por la razón correcta);
> **ningún control decorativo** (cada control queda implementado con su API/estado y su test, o se
> elimina con el motivo escrito); **nada de datos del negocio en el código**; verificación a 375 px y
> 1280 px en navegador real (Playwright), no en HTML estático.
> Ojo con dos cosas que el mock NO tiene y no se pueden perder: **nombre y WhatsApp** del cliente y
> la **hora de retiro opcional/programable**.
> Trabajá en español, con commits propios, y validá con `npm run test`, `lint`, `typecheck`,
> `build` y `security:secrets` antes de cerrar cada fase. Si tocás `schema.prisma`, corré
> `npx prisma generate` (el build local no lo regenera).
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que
> el CI quedó verde. **No despliegues a producción sin pedir confirmación**: el deploy es una sola
> llamada a `deployService` (§2 del runbook), nunca `npm run deploy:easypanel`.

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

Producción viva en **https://oneburgernic.com** (el apex sirve la **app**, igual que `www`),
**https://menu.oneburgernic.com** (app de pedidos) y **https://admin.oneburgernic.com** (panel), los
cuatro con certificado. Los datos del negocio ya se editan desde `/admin/settings`, los **locales** y
su catálogo por local desde `/admin/locations` (T8 cerrada) y los pedidos pueden ser **para días
futuros**. El menú real está a medio cargar por el owner (categorías con pocos productos), y las
notificaciones a cocina y los backups siguen pendientes. Detalle y prioridades en
`ops/project-state.md` §4.

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
