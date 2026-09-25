# START-HERE — cómo arrancar un chat nuevo sin perder contexto

Este archivo es la **puerta de entrada**. Todo lo que hace falta saber está versionado en el repo: no
hace falta nada de conversaciones anteriores. Si algo acá contradice a `AGENTS.md`, manda `AGENTS.md`.

> ## Estado al cerrar la sesión del 2026-09-25 (corrección post-deploy — **la sección Caja queda cerrada**)
>
> **Repo**: `main` — el HEAD real es `git log -1 main`. El cierre de esta ronda quedó en **`40e288f`**
> (PR **#27**, squash, rama `fix/cash-post-deploy` borrada) y **producción sirve `build-20260925-011110`**
> (lo deployó el agente con el OK y el token del owner en el momento, una sola llamada a `deployService`).
>
> **Qué entró (brief «Corrección post-deploy + cierre de Caja»)**: el POS **cobra un pedido del menú**
> (N3 — era el hueco real detrás del «no sale la factura»), **«Seguí tu pedido»** en la confirmación (H3b),
> el **429 del alta pública con su propio mensaje** (N2), el **aviso de los bancos** en Caja (H1) y
> **A-45**: el arqueo ciego pasó a ser **regla de servidor** (el cajero no lee el esperado por API; Manager
> y Owner sí).
>
> **QA post-deploy (solo lectura)**: 5 verdes y 1 salteado —panel del POS desplegado, ruta del cobro
> validando 422, mensaje del 429 en producción, aviso y botón desplegados en el bundle, `/orders/track` vivo—
> y smokes **7/7** (menú) + **6/6** (hosts). Dos límites, dichos en `ops/project-state.md`: no había caja
> abierta en producción (el aviso de los bancos y el corte X no se pudieron ver en pantalla) y la
> confirmación del cliente pide el token del pedido, así que el botón nuevo no se clickeó sin crear un pedido
> real. Los dos flujos quedan cubiertos por el **E2E local (131/6/0)** y los unitarios con rojo observado.
>
> **🏁 Caja cerrada**: no hay más trabajo de Caja. Lo que sigue es **la tarea que elija el owner**. Deuda
> abierta que **no** es de Caja: **A-43** (la cabecera compartida del panel mide 23,3% del alto a 375 px),
> que va en otro PR. El detalle está en `ops/project-state.md` (bloque del 2026-09-25) y en
> [`ops/audit-backlog.md`](../audit-backlog.md).
>
> ---
>
> ## Estado al cerrar la sesión del 2026-09-19 (tercera ronda — mejoras visuales del POS, desplegadas)
>
> **Repo**: `main` — el HEAD real es `git log -1 main`; el cierre de esta ronda quedó en **`bce20da`**
> (PR **#10**, squash, rama borrada) y el cierre documental en **`904683d`** (PR #11).
> **Deploy hecho el 2026-09-19**: `build-20260919-030008`, commit **`904683d`**, sobre el servicio
> `oneburguerweb` (una sola llamada a `deployService`). **Producción ya sirve los PR #8 y #10**: health
> `ok`, readiness `ready` (base en 1 ms) y los dos smokes en verde (**menú 7/7**, **hosts 6/6**).
>
> **Lo que se cerró (PR #10)**: la **UI del mostrador** sobre el catálogo que dejó el PR #8. Ahora el POS
> **vende cualquier producto de la carta** (con modificadores, pregunta en un modal oscuro), muestra las
> **fotos**, filtra por **chips de categoría con contador**, tiene el **formulario del cliente con íconos**,
> **montos rápidos de efectivo**, **vuelto en vivo** y la **caja cerrada** como alerta destacada.
>
> Cómo quedó el código (leer esto antes de tocar el POS):
>
> | Pieza | Archivo | Qué es |
> |---|---|---|
> | El catálogo, un solo caso de uso | `src/modules/menu/features/get-catalog/get-catalog.ts` | `getCatalog({ scope: "public" \| "pos", locationId, query, categorySlug, includeUnavailable })`. La única diferencia entre las dos superficies es el alcance (`catalog-policy.ts`) |
> | La regla de modificadores | `src/modules/menu/domain/modifier-selection.ts` | `validateModifierSelections` / `applyModifierSelection` / **`isModifierSelectionRequired`** / **`canQuickAddProduct`** (el «+» de la carta, el `requiresOptions` del POS y el alta leen **la misma**; **no** crear otra) |
> | El texto y el precio de un grupo | `src/modules/menu/domain/modifier-copy.ts` | `formatModifierOptionPrice` y `describeModifierGroup`: los usan la carta y el modal |
> | La búsqueda | `src/modules/menu/domain/catalog-search.ts` | `matchesCatalogQuery` — **una sola** para el servidor y la pantalla |
> | La vista del mostrador | `src/modules/pos/domain/pos-catalog-view.ts` | `projectPosCatalog`: aplana, deduplica, deriva `requiresOptions` y arma `categories: [{id, name, count}]` |
> | El panel del catálogo | `src/app/(admin)/admin/pos/pos-catalog-grid.tsx` | Buscador + **chips** + tarjetas + los tres estados vacíos. **`min-w-0`** en la columna: sin eso la fila de chips desborda a 375 px |
> | La tarjeta / la foto | `pos-catalog-card.tsx` · `pos-catalog-photo.tsx` | Dos estados (Agregar / Agotado) y la foto con respaldo por fallo de carga |
> | El selector | `pos-modifier-dialog.tsx` | Modal oscuro (primitivo `Modal` inline, `RadioGroupItem`/`Checkbox`); devuelve ids, nombres y `unitPrice` |
> | El cobro | `pos-payment-rows.tsx` · `pos-quick-cash.tsx` | Medios, montos rápidos (`[Exacto] [C$200] [C$500] [C$1000]`) y vuelto en vivo (`calculateOrderChange`) |
> | El borrador | `src/modules/pos/domain/pos-draft.ts` | `posLineKey` = producto + modificadores + nota; `modifierOptionIds` / `modifierNames` viajan en la línea |
>
> **Cambios de comportamiento que ya están en `main`** (los tres decididos por el owner): el catálogo del
> mostrador **incluye los agotados** («Agotado», sin botón); el campo `price` de su respuesta pasó a ser
> `basePrice` (`PosCatalogProduct extends ProductRecord`); y **A-37**: un grupo obligatorio sin opciones
> activas ya no bloquea la venta (el alta consume la regla del menú). **El contrato público `/api/menu` no
> cambió**: quedó idéntico byte a byte (único campo normalizado `generatedAt`).
>
> **A-37 y A-38 quedaron cerrados** (2026-09-19, PR #10) en [`ops/audit-backlog.md`](../audit-backlog.md).
>
> **Git — el flujo sigue igual, no hay push directo a `main`:**
>
> 1. `git checkout main && git pull origin main`
> 2. `git checkout -b <tipo>/<nombre-descriptivo>` — `feature/` · `fix/` · `refactor/` · `docs/` · `chore/`
> 3. Commitear en la rama y `git push -u origin <tipo>/<nombre-descriptivo>`
> 4. **Abrir Pull Request hacia `main`** con: qué cambió, por qué, cómo se verificó, qué quedó fuera
> 5. Esperar **CI verde** (4 checks) y mergear con `--squash --delete-branch`
>
> **CI**: `verify` (secrets, lint, typecheck, tests, build), `contracts`, `migrations` y `container` corren
> en cada PR; **`publish` (imagen a GHCR) solo en push a `main`**. La protección de `main` está **ACTIVA
> como ruleset** `Protect main` (id `23673659`): bloquea borrado y force push y **exige los 4 checks** con
> `strict`. Se verifica con `gh api repos/danielmaki123/one-burger-commerce/rulesets/23673659` —
> `/branches/main/protection` devuelve **404** y ese 404 **no** significa «sin protección». **Falta la
> regla de PR obligatorio** (lo bloquea el equipo, no GitHub).
>
> **Ramas remotas**: `main` y `feat/design-system` (la del otro dev, A-36).
>
> ## ➡️ Próxima tarea: **la que elija el owner** (los dos pedidos del POS están cerrados)
>
> **No hay brief pendiente ni tarea de producto abierta.** `main` **está desplegado** (`build-20260919-030008`,
> commit `904683d`), así que lo que se mergee después necesita un deploy nuevo: una sola llamada a
> `deployService` (runbook §2) **con el OK explícito del owner**, y los dos smokes después. Un deploy
> tarda unos minutos y la llamada **corta por timeout** sin que eso signifique que falló: se confirma con
> `inspectService` (`commit.sha`) y con el `version` de `/api/health`.
>
> Lo que queda vivo es la cola de [`ops/audit-backlog.md`](../audit-backlog.md). **Preguntale al owner qué
> quiere**; lo que necesita su decisión: **A-15** (cobros de pedidos cancelados — la de plata), **A-17**
> (tarjeta/transferencia), **A-19** (movimientos de caja), **A-20/A-34** (fiscal y RUC del negocio),
> **A-23** (la cuenta de prueba con rol `owner`), **A-10** (home del panel por rol), **A-12** (filtro «solo
> sin aceptar») y **A-33** (dónde se mira el listado completo de Órdenes).
>
> **Trabajo técnico ya acotado (sin decisión)**: **A-36** revisar `feat/design-system` · **A-16** historial
> de cajas · **A-18** arqueo por moneda · **A-24 → A-26 → A-25 → A-28 → A-27** (los pendientes que dejó la
> migración al sistema Stitch: controles crudos, partir `settings-client.tsx`, los tres `window.confirm`,
> la barra del KDS en el 20%, E2E determinista de madrugada). **A-35, A-37 y A-38 quedaron cerrados.**
>
> ## 🚫 Qué NO arrancar todavía
>
> **El rediseño del menú público (9 pantallas de Stitch) sigue PAUSADO**: el owner pidió **esperar su
> confirmación explícita**. Antes de tocarlo, **verificar la rama `feat/design-system` del otro dev**
> (A-36): puede chocar con el sistema de diseño.
>
> ## Cola relevante del backlog
>
> **Cerrados el 2026-09-19**: **A-37** (`canQuickAddProduct` vs `createOrder`) y **A-38**
> (`applyLocationPricing` y la fila de `LocationProduct`).
>
> migración al sistema Stitch: controles crudos, partir `settings-client.tsx`, los tres `window.confirm`,
> la barra del KDS en el 20%, E2E determinista de madrugada). **A-35 quedó cerrado el 2026-09-19** (los 4
> checks están cargados en el ruleset).
>
> El handoff de la ronda anterior sigue en
> [`handoff-next-session.md`](handoff-next-session.md) (contexto, no trabajo pendiente).

## 1. Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: **`AGENTS.md`** (reglas: alcance, DDD, TDD, validación,
> git/CI, deploy), **`ops/project-state.md`** (el estado real: qué está desplegado, qué se cerró y la
> cola de pendientes de §4) y **`ops/production-readiness.md`** (el runbook: entorno, secuencia de
> deploy, backups, notificaciones, límites).
>
> **Cómo se trabaja acá (acuerdo con el owner):** **de a una tarea por vez**, no varias cosas de un
> saque. Cada tarea se cierra entera antes de pasar a la siguiente: test que falla primero (y se
> confirma el rojo por la razón correcta) → implementación mínima → validación completa → **rama +
> commit + PR hacia `main`** (nunca push directo: `main` está protegida) → **CI verde** → merge →
> actualizar `ops/project-state.md`. Si una tarea toca varios temas distintos, partila en commits por
> tema. El detalle del flujo está en `AGENTS.md` § *Git y CI* y en el bloque de arriba.
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
> **Por dónde empezar:** el **sistema de diseño es Stitch y ya está aplicado en el panel**
> (`ops/references/stitch/design-system.md` es la fuente de verdad visual). El plan `plna.md` y el plan
> de UI `plan2uiux.md` (raíz, sin versionar) están **cerrados en sus tres fases**: no queda ningún archivo
> del panel con tokens viejos y los documentos anteriores (`DESIGN_REFERENCES.md`, `DESIGN_SYSTEM.md`,
> `design/*.md`) están **borrados: no se citan ni se recrean**. **Los dos pedidos del POS (catálogo y UI)
> están cerrados** (PR #8 y #10) y **no hay tarea de producto pendiente**: preguntale al owner qué quiere,
> con la cola de [`ops/audit-backlog.md`](../audit-backlog.md) a mano. Lo que sigue sin decisión:
> **A-36** (revisar `feat/design-system`) y después **A-24** los controles crudos que todavía no son
> primitivos → **A-26** partir `settings-client.tsx` → **A-25** los tres `window.confirm` → **A-28** la
> barra del KDS en el 20% → **A-27** E2E determinista de madrugada; y lo que necesita una decisión del
> owner (A-15 cobros de pedidos cancelados —la de plata más importante—, A-17 tarjeta/transferencia, A-19
> movimientos de caja, A-20/A-34 fiscal y RUC, A-23 la cuenta de prueba con rol owner, A-10 home por rol,
> A-12 filtro «solo sin aceptar», A-33 el listado completo de Órdenes). **No inventes trabajo para no
> quedar quieto**: si el owner ya entregó un plan, ese plan manda y se ejecuta de corrido; si no, se
> ejecuta de corrido; si no, se pregunta antes de codear. Si algo del brief no cierra, decilo antes de
> codear.
>
> **Trampas del arnés que ya nos costaron tiempo:** (1) el `next start` local necesita
> `DATABASE_URL`, `APP_ENV=production`, `NODE_ENV=production` y **`ORDER_CREATE_RATE_LIMIT=200`** (sin
> eso el checkout del E2E falla de a ratos y parece un bug del producto); (2) **alrededor de la
> medianoche** del huso del negocio los specs que crean un pedido y lo buscan en el tablero de «Hoy»
> fallan porque el retiro cae al día siguiente — mirá el reloj antes de creer que rompiste algo
> (A-27); (3) los E2E de admin **mutan** la base local: si un spec se corta a la mitad deja sucursales
> y usuarios de prueba que hacen fallar a los siguientes, y el residuo se limpia con SQL contra el
> contenedor (los patrones están en `ops/project-state.md` §5); (4) cualquier **overlay montado en un
> portal** (la hoja de edición, el `Modal`) tiene que llevar el alcance `dark` o sale en modo claro:
> hay un contrato que lo verifica.

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
>    **rama + PR hacia `main`** con el CI verde, estado actualizado).
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

**Desplegado el 2026-09-17** (una sola llamada a `deployService` por API, `commit.sha` idéntico al tip
de `main`, smoke 7/7 y dominios 6/6): **`2f35710`, `build-20260917-015211`**. Ese build lleva el **sistema
de diseño Stitch completo en el panel**: la Fase 1 (tokens, Plus Jakarta + JetBrains Mono, estados
`--status-*` y los arreglos de contraste), la Fase 2 (las **7 pantallas**: KDS, POS, Resumen, Menú,
Locales, Usuarios y Personalización) y la segunda pasada (los **modales** y las pantallas secundarias:
Inventario, Zonas, Promos, Menú completo, catálogo por local y detalle de orden), más el **horario único
por sucursal** (Personalización dejó de editarlo y Locales tiene «Aplicar a todas las sucursales»).
Antes en ese mismo día: `2b9df47` (`build-20260917-003340`, cierre de la Fase 2) y el 2026-09-15
`3708f40` (`build-20260915-121551`, POS de mostrador).

**Estado (2026-09-17)**: el plan `plna.md` quedó **sin tareas pendientes** y el plan de UI
`plan2uiux.md` (raíz, sin versionar) está **cerrado en sus tres fases**: la fuente de verdad visual es
[`ops/references/stitch/design-system.md`](../references/stitch/design-system.md) (v3.0.0) con las 7
pantallas de referencia al lado, los documentos viejos (`DESIGN_REFERENCES.md`, `DESIGN_SYSTEM.md`,
`design/*.md`) y el mockup HTML están **borrados**, y el detalle de las decisiones quedó en
`ops/DESIGN_LOG.md` (entry del 2026-09-16) y del segundo pase. En el panel **no queda ningún archivo con
tokens viejos** (cero `bg-card`, `border-border`, `text-foreground`, `rounded-2xl`, `shadow-sm`,
`text-[Npx]`). Lo que sigue es la **cola de auditoría** de abajo (A-24 a A-28 son los pendientes que dejó
la migración) y lo que el owner elija de las decisiones abiertas.

## 4. Cola de pendientes (en orden recomendado)

**No hay tareas de plan pendientes.** La cola viva es
[`ops/audit-backlog.md`](../audit-backlog.md). Cerrados **A-01/A-07** (`83d7433`), **A-08** (`f0366c8`) y
**A-06** (el owner rotó el `EASYPANEL_TOKEN` el 2026-09-17). **A-02 a A-05** están **bloqueados** (datos,
infraestructura o decisiones del owner). **A-09 a A-14** los registró el agente al cerrar las comandas.
**A-15 a A-23** salen de las tres consultas del 2026-09-15. **A-24 a A-28** son los pendientes que dejó
la migración al sistema Stitch (2026-09-17). **A-29 a A-34** salen de las rondas del 2026-09-18 (mobile
del chrome, PDF del cierre, TDD formalizado, el Historial y el POS, el listado de Órdenes inalcanzable y
el RUC del negocio). **A-36** es el de esta sesión: hay que revisar la rama `feat/design-system` del otro
dev antes de tocar el sistema de diseño. **A-35** (`publish` no va como required check) **quedó cerrado el
2026-09-19**: los 4 checks ya están cargados en el ruleset.

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

**Pendientes que dejó la migración al sistema Stitch (2026-09-17):** **A-24** los 57 controles crudos que
todavía no son primitivos (Menú, Inventario, Categorías; los tokens ya están) · **A-26** partir
`settings-client.tsx` (951 líneas) · **A-25** los tres `window.confirm` → `Modal` (toca dos specs de E2E) ·
**A-27** hacer determinista el E2E alrededor de la medianoche · **A-28** la barra superior del KDS y la
regla del 20%. El orden sugerido es **A-24 → A-26 → A-25 → A-28 → A-27**.

**Pendiente de la sesión del 2026-09-18 (git/CI):** **A-36** revisar la rama
`feat/design-system` del otro dev **antes** de tocar el sistema de diseño (puede chocar con el rediseño
del menú público). **A-35 quedó cerrado el 2026-09-19**: el ruleset `Protect main` ya exige `verify`,
`contracts`, `migrations` y `container`, **sin** `publish`.

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
5. ~~**Rotar el `EASYPANEL_TOKEN`**~~ — **hecho el 2026-09-17** (A-06 cerrado; el nuevo token no viajó
   por chat).

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

Y la última línea de base conocida, para comparar: **3010 tests unitarios en 434 archivos** y
**contracts 50/50** (2026-09-19, cierre de la UI del POS; antes el mismo día: 2952/427 con el catálogo
unificado y 2940/427), CI (`verify` + `contracts` + `migrations` + `container` + `publish`)
verde en cada push, **E2E completo local con mutaciones 122 pasaron / 7 salteados / 0 fallos** (con
`E2E_ALLOW_MUTATIONS=true`, `E2E_APEX_HOST=oneburgernic.com` y `E2E_APEX_PORT=3210`; **sin** esa variable
los specs que cobran y crean pedidos se saltean solos), smoke productivo **7/7**, hosts **6/6** y la QA
pública de solo lectura contra `menu.oneburgernic.com` **31 / 2 / 0**.

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
  artefacto desplegado es el commit del **código** (hoy `2f35710`, `build-20260917-015211`, con `main` en
  `8e96387`). La comparación honesta es `commit.sha` del panel contra el commit que se quiso desplegar,
  no contra `HEAD`.
- **Los E2E de admin mutan la base local** y un spec cortado a la mitad deja sucursales y usuarios de
  prueba que hacen fallar a los siguientes (pasó el 2026-09-17: una sucursal `Sucursal E2E Alcance` activa
  rompió los specs que asumen un solo local, y las excepciones de catálogo de `LocationProduct` dejaron un
  plato a C$42 y el vuelto del checkout en rojo). El residuo se limpia contra el contenedor, sin tocar el
  repo:

  ```bash
  docker exec -i one-burger-commerce-postgres-1 psql -U postgres -d oneburger -f - <<'SQL'
  DELETE FROM "Order" WHERE "locationId" <> 'loc_principal';
  DELETE FROM "Location" WHERE id <> 'loc_principal';
  DELETE FROM "AdminUser" WHERE email <> 'admin@example.com';
  DELETE FROM "LocationProduct";
  UPDATE "Order" SET status = 'cancelled' WHERE status IN ('new','confirmed','accepted','preparing','ready','ready_for_pickup');
  SQL
  ```

  Y el servidor local, con los dos límites altos:
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/oneburger?schema=public APP_ENV=production NODE_ENV=production ADMIN_LOGIN_RATE_LIMIT=200 ORDER_CREATE_RATE_LIMIT=200 npx next start -p 3210`.
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
