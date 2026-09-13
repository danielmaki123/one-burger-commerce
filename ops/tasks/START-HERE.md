# START-HERE — cómo arrancar un chat nuevo sin perder contexto

Este archivo es la **puerta de entrada**. Todo lo que hace falta saber está versionado en el repo: no
hace falta nada de conversaciones anteriores. Si algo acá contradice a `AGENTS.md`, manda `AGENTS.md`.

## 1. Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: **`AGENTS.md`** (reglas: alcance, DDD, TDD, validación,
> git/CI, deploy), **`ops/project-state.md`** (el estado real: qué está desplegado, qué se cerró y la
> cola de pendientes de §4) y **`ops/production-readiness.md`** (el runbook: entorno, secuencia de
> deploy, backups, notificaciones, límites).
>
> **Cómo se trabaja acá (acuerdo con el owner):** **de a una tarea por vez**, no varias cosas de un
> saque. Cada tarea se cierra entera antes de pasar a la siguiente: test que falla primero (y se
> confirma el rojo por la razón correcta) → implementación mínima → validación completa → commit +
> push a `main` → CI verde → actualizar `ops/project-state.md`. Si una tarea toca varios temas
> distintos, partila en commits por tema.
>
> **Reglas duras:** ningún control decorativo (cada control implementado con su estado/API **y
> cubierto por un test**, o se elimina con el motivo escrito); nada de datos del negocio en el código
> (nombre, colores, contacto, horarios, precios, zona horaria: salen de la configuración); la UI se
> verifica a **375 px y 1280 px** en navegador real (Playwright), no en HTML estático.
>
> **Validación antes de cerrar:** `npm run test`, `lint`, `typecheck`, `build`, `security:secrets`.
> Si tocaste una página (`src/app/**/page.tsx`), además `npm run build:webpack`. Si tocaste
> `schema.prisma`, `npx prisma generate` (el build local no lo regenera). Si tocaste flujos públicos o
> de admin, corré el E2E (el arnés local está en `ops/project-state.md` §5).
>
> **Deploy:** una sola llamada a `deployService` (runbook §2), **nunca** `npm run deploy:easypanel`, y
> **jamás a producción sin pedirle confirmación al owner**. Después de desplegar: `test:e2e:prod` y
> `test:e2e:prod:hosts` (los dos son de solo lectura).
>
> **Por dónde empezar:** preguntale al owner qué tarea sigue, o tomá la primera de la cola de §4
> (abajo). Ojo: **hoy los pendientes que quedan necesitan algo del owner** (elegir el servicio de
> monitoreo, corregir datos de los locales, el OK de otro administrador del panel, cargar la carta), así
> que lo primero es preguntarle — no inventes trabajo para no quedar quieto. Si el owner dice «procedé
> con lo que puedas», tomá el pendiente que menos dependa de él y explicá qué falta cuando lo cierres.
> Si algo del brief no cierra, decilo antes de codear.
>
> **Ciclo de auditoría (vigente)**: el owner manda las cosas que encuentra **a medida que las revisa**
> y se registran en [`ops/audit-backlog.md`](../audit-backlog.md) con su ID, tipo y severidad. **No se
> ataca ninguna hasta que el owner dice «ya»**, y ahí se toma **la primera de la cola**: una task por
> vez, un commit por task (por tema si toca varios), TDD, validación completa, push a `main`, CI verde
> y estado actualizado. Si un ítem resulta ser una **decisión de producto** y no un bug, se pregunta
> antes de codear.

## 2. Orden de lectura (qué responde cada documento)

| # | Documento | Responde |
|---|---|---|
| 1 | `AGENTS.md` | Reglas de trabajo: alcance del MVP, arquitectura DDD, TDD, validación, git/CI, deploy, idioma, prohibiciones |
| 2 | `ops/project-state.md` | **El estado real**: qué está vivo, qué se cerró (con la verificación de cada fase), la cola de pendientes y cómo levantar el entorno local (§5) |
| 2b | `ops/audit-backlog.md` | **La cola de trabajo del ciclo de auditoría**: las cosas que el owner va reportando, con su ID, tipo, severidad y estado. Se ataca **una por vez** y cada una cierra con su commit |
| 3 | `ops/production-readiness.md` | Runbook: entorno obligatorio, secuencia de deploy, backups, rollback, notificaciones, primer arranque, límites conocidos y pendientes operativos con su receta (§8) |
| 4 | `README.md` · `.env.example` | Alcance, dominios, comandos de validación y variables de entorno |
| 5 | `src/modules/*/README.md` | Cómo funciona cada módulo (reglas, puertos, adaptadores, casos de uso, migraciones) |

**Briefs de tareas ya cerradas** (contexto de decisiones, no trabajo pendiente):
`TASK-multi-location.md` (T8, el más grande), `TASK-mock-adoption.md` (el programa de UI),
`TASK-checkout-v2.md` (carrito + checkout), `TASK-whitelabel-branding.md` (quitar el hardcodeo) y
`TASK-checkout-ux.md` (redundancias). `ops/audit-checkout-mock.md` es la auditoría medida del mock.

Los mockups del owner (`mockup/` y `stitch_full_pwa_builder/`) son **material de diseño, no fuente de
verdad** del cálculo ni del alcance: están sin versionar a propósito y **no se commitean**.

## 3. Estado en una línea

Producción viva en **`oneburgernic.com`** y **`www`** (sirven el **landing** y redirigen las páginas de
la app), **`menu.oneburgernic.com`** (app de pedidos) y **`admin.oneburgernic.com`** (panel), los cuatro
con certificado. Ya funcionan: personalización del negocio (`/admin/settings`), **locales** con menú y
precios por sucursal (`/admin/locations`, T8), **retiro programable con días futuros**, promos, PIN de
retiro, forma de pago y vuelto. El menú real lo está cargando el owner y el **respaldo diario de la base
está probado** (drill de restore hecho el 2026-09-12: el respaldo restauró completo en un Postgres
temporal). Detalle y prioridades en `ops/project-state.md` §4.

**Desplegado el 2026-09-13** (commit `ea6be95`, build `build-20260913-174229`): la información de
**cada sucursal** en la home y el footer (A-07) y la **marca en el header también en celular** (A-08),
verificados contra `menu.oneburgernic.com` con el smoke 7/7 y los dominios 6/6.

## 4. Cola de pendientes (en orden recomendado)

**Primero está la cola de auditoría** ([`ops/audit-backlog.md`](../audit-backlog.md)): es lo que el
owner va reportando al revisar el producto. **A-01/A-07** (commit `83d7433`: la home y el footer
muestran la información de **cada sucursal**) y **A-08** (commit `f0366c8`: la marca —isotipo +
nombre— en el header **también en celular**) quedaron cerrados. Lo que sigue en esa cola (A-02 a A-06)
está **bloqueado**: son datos, infraestructura o decisiones del owner, así que **hay que preguntarle**
cuál sigue. Después, esta lista:

1. **Monitoreo externo** — un uptime que pegue a `GET /api/readiness` y avise al canal del equipo.
   Receta: runbook §8.5. Necesita que el owner elija el servicio.
2. **Corregir dos datos de los locales de producción** (hallazgo del drill): hay **3 locales** y los
   tres son reales (lo confirmó el owner), pero el slug de *Camino de Oriente* es `one-burger-masaya` y
   la ciudad de *Casa Antigua* dice `Jinoteoe`. Se arregla en `/admin/locations` (5 minutos, runbook
   §8.8); el slug del local no se usa en ninguna URL pública, así que no rompe nada.
3. **Cerrar los puertos expuestos** de servicios ajenos del panel compartido (`capostgres` 5455,
   `postimage` 8585). Receta: runbook §8.4. Necesita el OK de quien administra esos servicios.
4. **Cargar la carta completa** (categorías, productos, precios, fotos) desde `/admin/menu`. Es del
   owner; la app ya está lista (hoy hay 2 categorías y 6 productos).
5. **Rotar el `EASYPANEL_TOKEN`** cuando el owner cierre los cambios (decisión suya del 2026-09-12).

**En pausa por decisión del owner:** notificaciones a cocina (Telegram) — la operación es 100 % panel
(runbook §8.2). **Fuera de alcance sin pedido explícito:** reseñas, favoritos, delivery, mesas,
inventario y reportes avanzados.

## 5. Cómo verificar que el repo está sano (5 minutos)

```bash
npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
npx prisma generate   # solo si el build local falla por el cliente de Prisma
```

Y la última línea de base conocida, para comparar: **1560 tests unitarios en 245 archivos**, CI
(`verify` + `migrations` + `container` + `publish`) verde en cada push, E2E local **88 pasaron / 6
salteados / 0 fallos** (los 6 saltos son la verificación de dominios reales; el arnés local corre con
`E2E_APEX_HOST`, ver §5 de `project-state.md`) y smoke productivo **7/7** más hosts **6/6**. El E2E
local se corrió el **2026-09-13** con Postgres 17 + migraciones + seed + `next start -p 3210`.

## 6. Qué pedirle a Daniel si falta algo

- `EASYPANEL_URL` y `EASYPANEL_TOKEN` para desplegar o mirar el panel (solo por entorno, nunca en el
  repo ni en un commit). El token da acceso total al servidor.
- Credenciales de la cuenta owner para entrar al admin (`admin@oneburgernic.com`; la contraseña la
  administra él).
- Bot token + chat id de Telegram **solo si algún día se retoman las notificaciones** (hoy están en
  pausa a propósito).
