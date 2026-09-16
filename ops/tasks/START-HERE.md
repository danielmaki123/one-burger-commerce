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
> **Por dónde empezar:** hay **dos** frentes y el owner elige. **(a) El plan de UI `plan2uiux.md`**
> (raíz, sin versionar): la **CAPA 0 está cerrada y pusheada** —`DESIGN_REFERENCES.md` como fuente de
> verdad visual, `AGENTS.md` en 300 líneas con la sección de UI y el checklist, `DESIGN_SYSTEM.md` en 250
> líneas con las **20 reglas de interfaz** (producto, accesibilidad, estados y performance) y los 5
> ejemplos reales, `src/shared/ui/registry.json` con la metadata por componente y los tres docs obsoletos
> borrados—. De la **CAPA 1** ya están **C1-1** (los 6 primitivos que faltaban), **C1-2** (guardrails con
> techo por archivo) y **C1-3** (los 16 tokens muertos); **C1-4a (el mockup de `/admin`, el único stop
> humano del plan) está hecho y esperando la validación del owner**, y después va C1-4b (su
> implementación). **(b) El plan
> `plna.md` está completo y desplegado** (FASE 1, 2 y 3), así que por ese lado no hay tareas de plan en la
> cola: lo que queda es la cola de [`ops/audit-backlog.md`](../audit-backlog.md), donde las **A-15 a
> A-23** salen de las tres consultas del 2026-09-15 (caja/POS, fiscal/recibo, design system) y **cinco
> de ellas necesitan una decisión del owner** (A-15 cobros de pedidos cancelados, A-17
> tarjeta/transferencia, A-19 movimientos de caja, A-20 fiscal, A-23 la cuenta de prueba con rol owner);
> las otras cuatro son trabajo técnico ya acotado. **No inventes trabajo para no quedar quieto**: si el
> owner ya entregó un plan (como `plan2uiux.md`), ese plan manda y se ejecuta de corrido; si no, se
> pregunta antes de codear. Si algo del brief no cierra, decilo antes de codear.

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

**Desplegado el 2026-09-15** (una sola llamada a `deployService`, `commit.sha` idéntico al tip de `main`,
smoke 7/7 y dominios 6/6): **`3708f40` (código `9018839`), `build-20260915-121551`**, que lleva **A, B y
las tres fases del plan `plna.md`**: el **POS de mostrador completo** —cobro en un paso, arqueo por
denominación y moneda, refresco cada 3 s, recibo como imagen y mostrador prendido por local—. El POS quedó
**verificado con sesión real de admin en producción** (`/api/admin/pos/availability` 200, catálogo con los
6 productos reales, entrada «Caja» en la navegación, pantalla completa y el interruptor del local en
`yes`): el detalle está en `ops/project-state.md` §2. Antes: `0072531` (`build-20260914-151459`, comandas
B6), `ea6be95` (A-07/A-08) y `982da3f` (A).

**Estado (2026-09-15)**: el plan `plna.md` quedó **sin tareas pendientes**. El frente nuevo es el
**plan de UI `plan2uiux.md`** (raíz, sin versionar), con su **CAPA 0 cerrada del todo**: `DESIGN_REFERENCES.md`
como ADN, `AGENTS.md` (300 líneas, sección de UI + checklist de 5 estados), `DESIGN_SYSTEM.md` (250 líneas,
**20 reglas de interfaz** con qué/por qué/cómo verificar + 5 ejemplos reales con `ruta:línea`), el registro
`src/shared/ui/registry.json` con `file`/`variants`/`sizes`/`use_when`/`dont_use_when`, los tres docs
obsoletos borrados y el contrato `src/shared/contracts/ui-rules-contract.test.ts` que lo sostiene. De la
**CAPA 1** ya están C1-1/C1-2/C1-3 y **C1-4a**: el mockup de `/admin` está hecho, con su pipeline de
Impeccable corrido (**27/40**, 0 P0) y **esperando la validación del owner**, que es el único stop humano
del plan. Lo otro que sigue es lo que el owner elija
de la cola de auditoría, que creció con **tres consultas** que él pidió el 2026-09-15 (caja/POS,
fiscal/recibo y design system) y que se respondieron **sin plan y sin código**: el inventario medido de las
tres quedó resumido en `ops/project-state.md` §2 y desglosado como **A-15 a A-23** en el backlog.

## 4. Cola de pendientes (en orden recomendado)

**No hay tareas de plan pendientes.** La cola viva es
[`ops/audit-backlog.md`](../audit-backlog.md). Cerrados **A-01/A-07** (`83d7433`) y **A-08** (`f0366c8`).
**A-02 a A-06** están **bloqueados** (datos, infraestructura o decisiones del owner). **A-09 a A-14** los
registró el agente al cerrar las comandas. **A-15 a A-23** salen de las tres consultas del 2026-09-15:

**Necesitan una decisión del owner (no se implementan sin respuesta):**

1. **A-15 (P1)** — un cobro de un pedido **cancelado** sigue contando en el arqueo y no hay devolución ni
   movimiento que lo compense. Es el ítem de plata más importante de la cola.
2. **A-17** — la **tarjeta** no se reporta al cerrar y **transferencia/mixto** no se pueden cobrar (el enum
   ya los tiene; el POS solo manda `cash|card`).
3. **A-19** — **movimientos de caja** (retiro/ingreso), propina al cajón, y si se exige caja abierta para
   cobrar (hoy no se exige).
4. **A-20** — **fiscal**: no hay RUC ni documento del cliente en ningún lado; el recibo es un JPG sin logo
   y solo se emite desde el POS al cobrar.
5. **A-23** — la cuenta `tester@oneburgernic.com` tiene rol **owner** en producción: mantener, degradar o
   borrar.
6. **A-10 y A-12** — siguen de antes: la home del panel por rol y el filtro «solo sin aceptar».

**Trabajo técnico ya acotado (se puede atacar sin decisión de producto):** **A-16** historial de cajas
(`listShifts` existe y el adaptador ya trae los conteos: falta la API/pantalla) · **A-18** persistir el
arqueo por moneda (hoy `expectedByCurrency` vive solo en la respuesta) · **A-22** guardrails de UI
(paleta cruda, `fontFamily` inline, radios/sombras arbitrarios) · **A-13/A-14** deuda vieja.
**A-21 quedó cerrado el 2026-09-15** con la Capa 0 del plan de UI: los documentos que mentían se
reescribieron y un contrato lo verifica.

**Antes de arrancar, preguntale al owner qué task quiere** (el ciclo de auditoría es una por vez, la
primera de la cola, y cada una cierra entera). Los otros pendientes operativos siguen igual:

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
conviene verlo con sus ojos): **cobrar una venta real en el mostrador** y ver el pedido en comandas —es lo
único que no se hizo desde acá, porque crea un pedido de verdad y entra al arqueo del día—; asignarle una
sucursal a una cuenta de cocina en `/admin/users` y entrar con ella para ver la bandeja acotada (**A**); y
recorrer el tablero de comandas con una cuenta de sucursal («Ver el panel» devuelve la barra lateral sin
cerrar sesión, **B6**). Lo demás del POS ya se verificó **con sesión real en producción** (ver §3).

**En pausa por decisión del owner:** notificaciones a cocina (Telegram) — la operación es 100 % panel
(runbook §8.2). **Fuera de alcance sin pedido explícito:** reseñas, favoritos, delivery, mesas,
inventario y reportes avanzados. **Anunciado como próximo por el owner:** el **POS completo** (4-5
semanas: caja con historial, devoluciones, medios de pago, cierre del día) y **inventario**, pensados para
tablets separadas — cuando lleguen, el panel necesita una home por rol (hoy `/admin` redirige a
`/admin/orders` a todo el que no sea dueño: es A-10 del backlog).

## 5. Cómo verificar que el repo está sano (5 minutos)

```bash
npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
npx prisma generate   # solo si el build local falla por el cliente de Prisma
```

Y la última línea de base conocida, para comparar: **2055 tests unitarios en 304 archivos**
(2026-09-15, cierre de la Capa 0 del plan de UI; antes de esa ronda: 2016 en 295 y 2010 en 294), CI
(`verify` + `contracts` + `migrations` + `container` + `publish`)
verde en cada push, **E2E completo local 106 pasaron / 6 salteados / 0 fallos** (con
`E2E_APEX_HOST=oneburgernic.com` y `E2E_APEX_PORT=3210` para que el apex no quede salteado), smoke
productivo **7/7**, hosts **6/6** y la QA pública de solo lectura contra `menu.oneburgernic.com` **31 / 2 / 0**.

⚠️ **El E2E local necesita Docker arriba** (Postgres) y **dos límites de tasa altos al levantar el
servidor**: `ADMIN_LOGIN_RATE_LIMIT=200` y `ORDER_CREATE_RATE_LIMIT=200`. El alta pública de pedidos tiene
tope de **10/min por IP** (`src/app/api/orders/route.ts:31`) y la suite crea varios pedidos seguidos desde
127.0.0.1: sin esa variable, 2-3 casos de `public-order.spec.ts` fallan por corrida con «No pudimos
confirmar el pedido» **y pasan en aislamiento** (13/13) — se estaba midiendo el limitador, no el checkout.
Corré **una sola suite a la vez**: si la máquina está compilando o linteando en paralelo, algún caso se cae
por el timeout de 5 s de `toHaveURL` o por el de 30 s al abrir la página.

⚠️ Tres advertencias del arnés, aprendidas a golpes (están en el runbook §2 con el detalle):

- **La QA de solo lectura contra producción puede dar timeouts de carga** en ráfaga (pasó tres veces: dos
  el 2026-09-14 y una el 2026-09-15 con `design-tokens.spec.ts`, que al repetirse pasó 5/5). Si vuelve a
  pasar, **medí antes de culpar al código**: las superficies públicas respondían en 0,7–0,8 s y las seis
  en 200. Es saturación del burst (una réplica, muchos navegadores en paralelo) o de la red de quien la corre.
- **El `sha` del panel puede quedar atrás de `main`** si el último push fue solo de documentación: el
  artefacto desplegado es el commit del **código** (hoy `9018839`), mientras `main` va por `634dc4e`. La
  comparación honesta es `commit.sha` del panel contra el commit que se quiso desplegar, no contra `HEAD`.
- **El login del panel tiene rate limit (10/min por IP)** y varios E2E seguidos hacen que los casos se
  **salteen** con el mensaje «faltan credenciales», que engaña: el login por UI responde 200. Además
  `tryLoginAsOwner` espera la URL **10 s**, que en producción es corto (las pantallas tardaron 8–20 s).

## 6. Qué pedirle a Daniel si falta algo

- `EASYPANEL_URL` y `EASYPANEL_TOKEN` para desplegar o mirar el panel (solo por entorno, nunca en el
  repo ni en un commit). El token da acceso total al servidor. **Ojo**: la respuesta de `inspectService`
  devuelve los secretos del servicio **en claro** (la `DATABASE_URL` con su contraseña, `NEXTAUTH_SECRET`
  y el token del servicio): usar el `grep -o '"sha":"[^"]*"'` del runbook §2, no volcar todo.
- Credenciales de la cuenta owner para entrar al admin (`admin@oneburgernic.com`; la contraseña la
  administra él). Para QA contra producción ya existe `tester@oneburgernic.com` (rol **owner**, creada por
  él el 2026-09-15; es A-23 del backlog): no hace falta pedirla de nuevo si sigue vigente.
- Bot token + chat id de Telegram **solo si algún día se retoman las notificaciones** (hoy están en
  pausa a propósito).
