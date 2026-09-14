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
> `schema.prisma`, `npx prisma generate` (el build local no lo regenera; y el `next start` local
> bloquea la regeneración: paralo antes). Si tocaste flujos públicos o de admin, corré el E2E (el
> arnés local está en `ops/project-state.md` §5).
>
> **Deploy:** una sola llamada a `deployService` (runbook §2), **nunca** `npm run deploy:easypanel`, y
> **jamás a producción sin pedirle confirmación al owner**. Después de desplegar: `test:e2e:prod` y
> `test:e2e:prod:hosts` (los dos son de solo lectura).
>
> **Por dónde empezar:** preguntale al owner qué tarea sigue, o tomá la primera de la cola de §4
> (abajo). Ojo: **hoy los pendientes que quedan necesitan algo del owner** (elegir el servicio de
> monitoreo, corregir datos de los locales, cargar la carta, el OK para rotar el token), así que lo
> primero es preguntarle — no inventes trabajo para no quedar quieto. Si el owner dice «procedé con lo
> que puedas», tomá el pendiente que menos dependa de él y explicá qué falta cuando lo cierres. Si algo
> del brief no cierra, decilo antes de codear.

## 1b. Prompt para un chat de **auditoría**

> Trabajás en `one-burger-commerce`. **Este chat es de auditoría: no se cambia código de producto sin
> que el owner lo apruebe.**
>
> Leé, en este orden: **`AGENTS.md`** (reglas y prohibiciones), **`ops/project-state.md`** (qué está
> vivo hoy y qué se cerró, con la verificación de cada fase), **`ops/tasks/START-HERE.md`** (este
> archivo), **`ops/audit-backlog.md`** (la cola de hallazgos, con su formato y sus reglas) y
> **`ops/production-readiness.md`** (runbook y límites conocidos).
>
> Qué se espera de una auditoría acá:
> 1. **Evidencia, no impresiones**: cada hallazgo con `archivo:línea`, el comando o el test que lo
>    muestra, y qué se midió. Si algo se afirma sin verificarlo, se marca como sospecha.
> 2. **Reproducir antes de proponer el arreglo.** Lo que no se reproduce se cierra como *no-repro* con
>    el intento escrito.
> 3. **Clasificar**: `bug` (está roto), `dato` (mal cargado), `infra`, `deuda` técnica, `decisión` de
>    producto (no se implementa sin respuesta del owner) o `documentación` (el doc miente).
> 4. **Severidad** P1/P2/P3 y **orden propuesto**, no un listado suelto.
> 5. **Registrar los hallazgos en `ops/audit-backlog.md`** con su ID (el siguiente libre), tipo,
>    severidad y detalle, y **no tocar código** hasta que el owner diga «ya». Ahí se ataca **una sola
>    task**, la primera de la cola, y se cierra entera (TDD, validación completa, un commit por tema,
>    push a `main`, CI verde, estado actualizado).
>
> Zonas que la auditoría debería mirar primero (por lo que se cambió último y por lo que nunca se
> revisó con ojo crítico): la **consola de comandas** (`/admin/orders`, B0–B6: carriles, urgencia por
> etapa, acciones en la fila, búsqueda y filtros, umbrales por local), el **alcance por sucursal** del
> staff y el **contrato anti-hardcode**, y los **límites conocidos** del runbook §7 (rate limiting en
> memoria, una sola réplica, sin observabilidad externa).

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
`TASK-checkout-v2.md` (carrito + checkout), `TASK-whitelabel-branding.md` (quitar el hardcodeo),
`TASK-checkout-ux.md` (redundancias), `TASK-staff-location-scope.md` (**A**, el alcance por sucursal) y
`TASK-orders-console.md` (**B**, la consola de comandas: B0–B6, cerrada y desplegada).
`ops/audit-checkout-mock.md` es la auditoría medida del mock.

Los mockups del owner (`mockup/` y `stitch_full_pwa_builder/`) son **material de diseño, no fuente de
verdad** del cálculo ni del alcance: están sin versionar a propósito y **no se commitean**.

## 3. Estado en una línea

Producción viva en **`oneburgernic.com`** y **`www`** (sirven el **landing** y redirigen las páginas de
la app), **`menu.oneburgernic.com`** (app de pedidos) y **`admin.oneburgernic.com`** (panel), los cuatro
con certificado. Ya funcionan: personalización del negocio (`/admin/settings`), **locales** con menú y
precios por sucursal (`/admin/locations`, T8), **retiro programable con días futuros**, promos, PIN de
retiro, forma de pago y vuelto, el **alcance por sucursal del staff** (A) y la **consola de comandas**
(B0–B6): tablero del turno en tres carriles con urgencia por etapa, auto-refresh con aviso y sonido,
aceptar/rechazar desde la fila, búsqueda y filtros con el estado en la URL, umbrales de aviso por local
y promedio de preparación del día. El menú real lo está cargando el owner y el **respaldo diario de la
base está probado** (drill de restore hecho el 2026-09-12: el respaldo restauró completo en un Postgres
temporal). Detalle y prioridades en `ops/project-state.md` §4.

**Desplegado el 2026-09-14** (tres deploys, todos verificados con `commit.sha` idéntico al tip de
`main`, smoke 7/7 y dominios 6/6): `0124784` (`build-20260914-113152`, las comandas B0–B5), `0c3aa35`
(`build-20260914-145114`, primer intento de B6, revertido) y **`0072531` (`build-20260914-151459`, el
estado actual: B6 — «Ver el panel» devuelve la barra lateral sin cerrar sesión)**. El 2026-09-13 se
desplegaron A-07/A-08 (`ea6be95`) y A (`982da3f`).

## 4. Cola de pendientes (en orden recomendado)

**Primero está la cola de auditoría** ([`ops/audit-backlog.md`](../audit-backlog.md)): es lo que se va
encontrando al revisar el producto. **A-01/A-07** (commit `83d7433`: la home y el footer muestran la
información de **cada sucursal**) y **A-08** (commit `f0366c8`: la marca —isotipo + nombre— en el header
**también en celular**) quedaron cerrados. Lo que sigue en esa cola (**A-02 a A-06**) está **bloqueado**:
son datos, infraestructura o decisiones del owner, así que **hay que preguntarle** cuál sigue. El cierre
de las comandas dejó además **cuatro ítems abiertos** (A-09 a A-12: el actor del cambio de estado sin
mostrar, la home del panel que redirige a órdenes para los roles sin Resumen, los timeouts de la QA de
solo lectura y el filtro «solo sin aceptar» que se decidió no implementar): están en el backlog con su
detalle, para que la auditoría los mire. Después, esta lista:

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
5. **Rotar el `EASYPANEL_TOKEN`** (se pasó por chat cinco veces; da acceso total al servidor).

**QA interactiva que necesita la sesión del owner** (el recorrido está cubierto por el E2E local, pero
conviene verlo con sus ojos): asignarle una sucursal a la cuenta de cocina en `/admin/users` y entrar con
ella para ver la bandeja acotada (**A**), y recorrer el tablero de comandas con una cuenta de sucursal —
«Ver el panel» tiene que devolver la barra lateral sin cerrar sesión (**B6**).

**En pausa por decisión del owner:** notificaciones a cocina (Telegram) — la operación es 100 % panel
(runbook §8.2). **Fuera de alcance sin pedido explícito:** reseñas, favoritos, delivery, mesas,
inventario y reportes avanzados. **Anunciado como próximo por el owner (2026-09-14): POS e inventario,
pensados para tablets separadas** — cuando lleguen, el panel necesita una home por rol (hoy `/admin`
redirige a `/admin/orders` a todo el que no sea dueño: es A-10 del backlog).

## 5. Cómo verificar que el repo está sano (5 minutos)

```bash
npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
npx prisma generate   # solo si el build local falla por el cliente de Prisma
```

Y la última línea de base conocida, para comparar: **1783 tests unitarios en 263 archivos** (2026-09-14,
cierre de B6), CI (`verify` + `migrations` + `container` + `publish`) verde en cada push, **E2E completo
local 97 pasaron / 6 salteados / 0 fallos** (el arnés local corre con `E2E_APEX_HOST`, ver §5 de
`project-state.md`), smoke productivo **7/7** y hosts **6/6**.

⚠️ Dos advertencias del arnés, aprendidas a golpes (están en el runbook §2 con el detalle):

- **La QA de solo lectura contra producción puede dar timeouts de carga** en ráfaga (pasó dos veces el
  2026-09-14: una en masa). Si vuelve a pasar, **medí antes de culpar al código**: las superficies
  públicas respondían en 0,7 s de media y las seis en 200, y al repetir la suite pasó. Es saturación del
  burst (una réplica, muchos navegadores en paralelo) o de la red de quien la corre.
- **El `sha` del panel puede quedar atrás de `main`** si el último push fue solo de documentación: el
  artefacto desplegado es el commit del código (hoy `0072531`), mientras `main` va por `8ba51ec`. La
  comparación honesta es `commit.sha` del panel contra el commit que se quiso desplegar, no contra `HEAD`.

## 6. Qué pedirle a Daniel si falta algo

- `EASYPANEL_URL` y `EASYPANEL_TOKEN` para desplegar o mirar el panel (solo por entorno, nunca en el
  repo ni en un commit). El token da acceso total al servidor.
- Credenciales de la cuenta owner para entrar al admin (`admin@oneburgernic.com`; la contraseña la
  administra él).
- Bot token + chat id de Telegram **solo si algún día se retoman las notificaciones** (hoy están en
  pausa a propósito).
