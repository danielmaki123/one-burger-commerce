# Backlog de auditoría — correcciones task por task

> **Qué es este archivo**: la lista de trabajo del ciclo de auditoría. El owner manda las cosas que
> va encontrando **a medida que las revisa**; acá se registran, se clasifican y se priorizan. Cuando
> el owner dice **"ya"**, se ataca **una sola** —la primera de la cola— y no se pasa a la siguiente
> hasta cerrarla entera.
>
> **Reglas del ciclo** (no reemplazan a `AGENTS.md`, lo ordenan):
> 1. Una task por vez. Cada task se cierra completa: **test que falla primero** (con el rojo
>    confirmado por la razón correcta) → implementación mínima → validación completa → commit + push
>    a `main` → CI verde → `ops/project-state.md` actualizado.
> 2. **Un commit por task**; si la task toca temas distintos, un commit por tema. Nunca dos tasks en
>    un mismo commit.
> 3. **Nada se arregla sin reproducirlo antes.** Si no se reproduce, se cierra como *no-repro* con
>    el intento escrito; no se parchea a ciegas.
> 4. **Lo que no es un bug es una decisión de producto**: se marca `decisión`, se le pregunta al
>    owner y **no se implementa sin respuesta**. No se inventa producto.
> 5. **Nada de datos del negocio en el código** (contrato anti-hardcode) y **ningún control
>    decorativo**: se implementa con su estado/API y su test, o se elimina con el motivo escrito.
> 6. La UI se verifica a **375 px y 1280 px en navegador real** (Playwright), no en HTML estático.
> 7. **Producción no se toca ni se despliega sin confirmación explícita del owner.**
>
> **Fecha de apertura**: 2026-09-12 · **Rama**: `main` · **Estado (2026-09-17)**: **A-01/A-07**
> (commit `83d7433`) y **A-08** (commit `f0366c8`) cerrados, y **A-06** cerrado el 2026-09-17 (el owner
> rotó el `EASYPANEL_TOKEN`). **A-02 a A-05** están **bloqueados**: son datos, infraestructura o
> decisiones del owner, así que no hay task técnica para atacar sin que él diga
> cuál. **A-09 a A-14** los registró el **agente** al cerrar la consola de comandas (B0–B6). **A-15 a
> A-23** los registró el agente el **2026-09-15**, al responder **tres consultas del owner** (caja/POS,
> fiscal/recibo y design system) que se pidieron **sin plan y sin código**: son el inventario medido de
> esos tres frentes, con su evidencia, para que el próximo plan salga de ahí y no de una re-lectura.
> **A-15, A-17, A-19, A-20 y A-23 son decisiones de producto o de operación: no se implementan sin
> respuesta del owner.** **A-16, A-18 y A-22 son trabajo técnico** ya acotado (historial de cajas,
> persistencia del arqueo por moneda y guardrails de UI). **A-21 se cerró el 2026-09-15** con la Capa 0
> del plan de UI: los documentos del repo que mentían se reescribieron y hay un contrato que lo verifica
> (el cuarto punto era de `plna.md`, que no está versionado).
> **El plan `plna.md` (FASE 1-3) está completo y desplegado**: no queda trabajo pendiente de ese plan.

## 1. Índice

Estados: `reportado` · `a reproducir` · `en curso` · `cerrado` · `no-repro` · `decisión-pendiente` ·
`bloqueado` (espera algo del owner) · `descartado` (con motivo).

| ID | Qué se reportó | Tipo | Sev. | Estado | Commit |
|---|---|---|---|---|---|
| A-01 | El **footer** y el bloque **"Información del restaurante"** de la home muestran horario, ciudad y dirección de la **configuración del negocio**, no del local: con 3 locales reales la información no corresponde al local del pedido | decisión | P2 | `cerrado` (A-07) | `83d7433` |
| A-07 | **"Acá debería salir la información de cada sucursal"**: el footer tiene que mostrar los datos de **cada local**, no los del negocio | feat | P2 | `cerrado` | `83d7433` |
| A-08 | **El isotipo de One Burger desapareció en los headers**: el owner pide que la marca (isotipo + nombre del negocio) se mantenga arriba a la derecha en las secciones principales | bug | P2 | `cerrado` | `f0366c8` |
| A-02 | Datos mal cargados en **locales de producción**: el slug de *Camino de Oriente* es `one-burger-masaya` y la ciudad de *Casa Antigua* dice `Jinoteoe` | dato | P2 | `bloqueado` (sesión de owner) | — |
| A-03 | Falta **cargar la carta completa** (categorías, productos, precios, fotos): producción tiene 2 categorías con 6 productos | dato | P3 | `bloqueado` (owner) | — |
| A-04 | **Monitoreo externo** inexistente: nada pega a `GET /api/readiness` ni avisa si el sitio o la base se caen | infra | P2 | `bloqueado` (owner elige servicio) | — |
| A-05 | **Puertos expuestos** de servicios ajenos del panel compartido (`capostgres` 5455, `postimage` 8585) | infra | P2 | `bloqueado` (OK de otro admin) | — |
| A-06 | **Rotar `EASYPANEL_TOKEN`** (se pasó por chat cinco veces; da acceso total al servidor) | infra | P2 | `cerrado` (el owner lo rotó el 2026-09-17) | — |
| A-09 | **El actor del cambio de estado se guarda pero no se muestra en ninguna pantalla**: `OrderStatusHistory.changedByUserId` queda asentado (B5b) y no hay vista que lo lea | deuda | P3 | `reportado` (agente) | — |
| A-10 | **La home del panel no existe para los roles sin Resumen**: `/admin` redirige a `/admin/orders`, así que un `manager` o una `kitchen` no tienen dónde elegir sección. Con POS e inventario anunciados (tablets separadas), hace falta una home por rol | decisión | P2 | `decisión-pendiente` | — |
| A-11 | **Timeouts de la QA de solo lectura**: dos corridas contra `menu.oneburgernic.com` fallaron por `page.goto` de 30 s (una en masa, 33 casos) y al repetirlas pasaron; medido en el momento, las cargas públicas respondían en 0,7 s | infra | P3 | `a reproducir` | — |
| A-12 | **El filtro «solo sin aceptar»** del brief B4 **no se implementó**: los carriles ya separan lo nuevo, así que se decidió no duplicarlo. Falta que el owner lo confirme (si lo quiere igual, es un toggle de la vista) | decisión | P3 | `decisión-pendiente` | — |
| A-13 | **Dos módulos cascarón** (`coupons`, `table-ordering`): versionan solo su `README.md`, con las carpetas `adapters/domain/features/ports` **vacías** en el disco de quien las creó (git no versiona carpetas vacías, así que en un clon no existen). El motor de cupones vive en `orders` y el bootstrap de mesas en `tables/lib` | deuda | P3 | `reportado` (agente) | — |
| A-14 | **El mapeo de errores repite el mismo bloque 12 veces**: `src/shared/lib/http/error-response.ts` tiene un `if (error instanceof XError)` idéntico por módulo (11 antes de TASK-301). Se puede resolver con una tabla de constructores sin cambiar el comportamiento | deuda | P3 | `reportado` (agente) | — |
| A-15 | **Un cobro de un pedido cancelado sigue contando en el arqueo**: `listPaymentsInRange` filtra por local y ventana **sin mirar el estado del pedido** (`src/modules/orders/adapters/prisma-payment-repository.ts:92`) y `update-order-status.ts` no toca pagos; **no existe `Refund`** ni movimiento que compense. Si el cajero devuelve la plata, el cierre marca faltante sin forma de registrarlo | decisión + bug de plata | **P1** | `decisión-pendiente` (owner) | — |
| A-16 | **No hay historial de cajas**: `get-current-shift.ts:21` devuelve solo la caja **abierta** y `listShifts` (`ports/shift-repository.ts:49`; el adaptador ya trae `include: {cashCounts:true}`) **no lo usa ninguna API ni pantalla**. Al cerrar y recargar, el arqueo desaparece de la UI aunque los datos están en `Shift` + `ShiftCashCount` | feat / deuda | P2 | `reportado` (agente) | — |
| A-17 | **La tarjeta no se reporta y la transferencia no se puede cobrar**: el cierre filtra `method === "cash"` (`close-shift.ts:139`) y no hay vista que sume tarjeta del día; el enum `PaymentMethodType` ya tiene `transfer`/`mixed`/`other` (`schema.prisma:347-353`) pero el POS solo acepta `cash\|card` (`sale-payload.ts:30`) | decisión | P2 | `decisión-pendiente` (owner) | — |
| A-18 | **El detalle por moneda del cierre no se persiste**: `expectedByCurrency` viaja solo en `meta` (`close-shift.ts:113`) y `Shift` no tiene columnas por moneda; recomputar un cierre viejo usa la **tasa de hoy**. Tampoco hay `Payment.shiftId` (`schema.prisma:732-753`): la atribución es por ventana de tiempo | deuda / dato | P3 | `reportado` (agente) | — |
| A-24 | **57 controles crudos** siguen en 21 archivos del admin (los `<select>`/`<textarea>` de Menú e Inventario, el `type=color` de Categorías, varios `<button>`): los tokens ya son los del sistema, pero el control no es el primitivo. Hay techo declarado por archivo en `design-tokens.allow.json` | deuda | P2 | `reportado` (agente) | — |
| A-25 | **Tres `window.confirm`** (Usuarios, Locales, Promos) en vez del primitivo `Modal`: el guardrail pide el modal y el diálogo nativo no se puede estilar ni testear igual | deuda | P3 | `reportado` (agente) | — |
| A-26 | **`settings-client.tsx` tiene 951 líneas** (el techo son 400) y su componente pasaba las 700: el plan de partición está escrito (helpers, campos, secciones de identidad/contacto/horarios/operación/apariencia y la tarjeta de vista previa) | deuda | P2 | `reportado` (agente) | — |
| A-27 | **El E2E es sensible a la medianoche**: cerca de las 00:00 los minutos de preparación empujan el retiro al día siguiente y el tablero de «Hoy» no muestra el pedido recién creado (fallan comandas, acciones y el alcance por sucursal). Se parchó `admin-order-scope` para comprobar el alcance por API; falta hacerlo determinista (reloj congelado o día de negocio por test) | test | P3 | `reportado` (agente) | — |
| A-28 | **La barra superior del KDS ocupa ~25% del alto** (contadores + buscador + acciones + filtros) y en celular crece a varias filas: la regla del 20% de `design-system.md` §8.4 pide rediseñarla. No se tocó para no cambiar el alcance de una pantalla ya cerrada | UI | P3 | `reportado` (agente) | — |
| A-29 | **Mobile Órdenes: el chrome ocupa ~49% a 375 px** (encabezado + las tres filas de la barra de trabajo del layout unificado, 2026-09-18). Los contadores del turno duplican lo que ya dicen los carriles: candidato a colapsar en el Modo cocina (Punto 3) o a posponer | UI | P3 | `reportado` (agente) | — |
| A-30 | **No existe un PDF del cierre de caja**: el Historial › Cierres quedó con «Ver detalle» (al detalle que ya existe) porque el repo solo tiene el export CSV del día; una hoja imprimible del cierre es producto nuevo. **Opcional: se hace cuando el owner lo pida** | feat / decisión | P3 | `decisión-pendiente` (owner) | — |
| A-31 | **TDD: formalizar el caso «el rojo no se observó»**: la regla del repo prohíbe el test después de la implementación y pide decirlo en el commit, pero no dice **cómo**. En el Punto 2 (2026-09-18) el dominio y los dos casos de uso se escribieron junto con su test y el rojo no se pudo observar (se dijo en el commit, sin formato). Se formalizó en `AGENTS.md` §Testing: **si el rojo no se observa, se documenta en el commit con el motivo** y se verifica por mutación cuando el caso lo permita | deuda / proceso | P3 | `cerrado` (2026-09-18, `AGENTS.md`) | — |
| A-33 | **El listado agrupado de Órdenes quedó inalcanzable**: `page.tsx` dibuja el listado por grupos solo con `!showBoard` y `statusFilter === "all"`, y el tablero se apaga únicamente en «Cerradas» (que además manda `status=closed` y excluye un pedido nuevo). El layout unificado del Punto 1 se llevó el «Ver en el listado» y con él la única entrada. Se descubrió el 2026-09-18 verificando el Punto 3 (el caso D1 de `public-order.spec` ya no puede comprobar el grupo «Programados») | decisión / UI | P3 | `reportado` (agente) | — |
| A-35 | **No marcar `publish` como *required check*** en la protección de `main`: el job tiene `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, así que **no corre en PRs** y GitHub lo deja en «Expected» para siempre: el PR nunca se puede mergear. Los required son `verify`, `contracts`, `migrations` y `container` | infra / guardrail | P2 | `cerrado` (2026-09-19) | ruleset `23673659` |
| A-36 | **Verificar la rama `feat/design-system` del otro dev antes de tocar el sistema de diseño**: existe en el remoto y no la creó esta sesión. El **rediseño del menú público (9 pantallas de Stitch) sigue pausado** (la próxima tarea es el POS), así que hay que ver qué trae esa rama para no pisarla ni duplicar criterios de tokens | deuda / coordinación | P2 | `reportado` (agente, 2026-09-18) | — |
| A-34 | **A-20 (fiscal) avanzó a medias**: el Punto 4 (2026-09-18) guarda `taxId`/`legalName` en el `Customer` y la factura los congela, pero **el negocio no tiene RUC** (no hay campo en `BusinessSettings`/`Local`) y el recibo JPG sigue sin logo ni RUC. Falta decidir si la factura es fiscal de verdad (RUC del negocio, numeración autorizada) | decisión | P3 | `decisión-pendiente` (owner) | — |
| A-32 | **El Historial depende del POS para dibujarse**: `ADMIN_HISTORY_NAV_ITEM` vive en el grupo Control y `withControlGroup` (`admin-layout-helpers.ts:114`) hacía `if (!posAvailable) return groups`, con `posAvailable` resuelto desde `GET /api/admin/pos/availability` (`admin-shell.tsx:96`). Sin POS disponible, un manager **no veía** el Historial aunque el Historial no dependa del POS. **Arreglado el 2026-09-18**: cada ítem lleva su permiso propio y el grupo se dibuja si queda al menos uno | bug | P2 | `cerrado` | `f35755c` |
| A-37 | **`canQuickAddProduct` deja pasar un grupo obligatorio sin opciones activas**: con `isRequired: true` y todas las opciones inactivas la función devolvía `true` (no lo exigía) y `createOrder` respondía **422**. El "+" de la home y del menú, y el **Agregar** del POS, ofrecían algo que el alta rechazaba. **Cerrado el 2026-09-19**: la regla es una sola (`isModifierSelectionRequired` / `canQuickAddProduct` en `modules/menu/domain/modifier-selection.ts`) y el alta la consume | bug / regla compartida | P2 | `cerrado` (2026-09-19) | `af80d93` |
| A-38 | **`applyLocationPricing` deja pasar un producto sin fila en `LocationProduct`**: el comentario del schema decía que sin fila el producto **no se vende** en ese local, pero el código lo deja con el precio del negocio. Dos verdades sobre lo mismo. **Cerrado el 2026-09-19**: el owner confirmó que sin fila **sí se vende** y se corrigió el comentario (no el código) | dato / decisión | P3 | `cerrado` (2026-09-19) | `61d8ed5` |
| A-19 | **No existen los movimientos de caja**: sin `CashMovement` (retiro/ingreso con motivo y responsable) ni configuración de caja en ningún lado; la propina en efectivo entra al cajón por decisión implícita (`close-shift.ts:143-144`) y la caja puede quedar abierta para siempre | decisión | P3 | `decisión-pendiente` (owner) | — |
| A-20 | **No hay un solo campo fiscal** (`ruc`/`taxId`/`fiscal`/`legalName`/`documentNumber`: cero coincidencias en `prisma/` + `src/**`) y `Customer` solo tiene nombre + WhatsApp (`schema.prisma:59-69`). El recibo es un **JPG sin logo y sin RUC** (`src/shared/lib/receipt-image.ts`) y **solo se emite desde el POS al cobrar**, no desde el detalle del pedido | decisión | P3 | `decisión-pendiente` (owner) | — |
| A-21 | **Documentación desactualizada en cuatro puntos verificados**: `DESIGN_SYSTEM.md §3.4:273` decía "2 literales de carga" (había **18** distintos), `§2.1:164` decía 15 tokens huérfanos (había **16**: también `--ring`, `globals.css:40`), `AGENTS.md:109` mandaba a `DESIGN_SYSTEM.md §5` por la lista de copy decorativo y **§5 no la tenía**, y `plna.md:546` afirma un `Payment.shiftId` que no existe. **Cerrado el 2026-09-15** (Capa 0 del plan de UI): los tres puntos del repo se corrigieron reescribiendo `DESIGN_SYSTEM.md` (los números viejos ya no existen: §2.1 y §3.4 se reescribieron) y `AGENTS.md` (el puntero a `§5` ahora es verdadero), y un contrato falla si `AGENTS.md` cita una sección que no existe. El cuarto punto es de `plna.md`, un documento **no versionado**: queda anotado en A-18 | documentación | P3 | `cerrado` | commit de la Capa 0 |
| A-22 | **Lo que no tiene guardrail se degrada**: la paleta cruda de Tailwind (**70** usos, igual que en TASK-201), `style={{ fontFamily }}` (**30**), `rounded-[Npx]` (**37** con 9 valores), ~20 sombras `rgba()` a mano y **46** valores arbitrarios de espaciado no tienen test; `DESIGN_SYSTEM.md §6:370` lo admite. En cambio lo que sí tiene contrato (`#hex`, controles crudos, registro de componentes) se mantiene estable | deuda | P3 | `reportado` (agente) | — |
| A-23 | **Cuenta de prueba con rol `owner` en producción** (`tester@oneburgernic.com`, 3 locales): es un acceso total más. Decidir si se mantiene, se degrada (p. ej. a `cashier`) o se borra | dato / infra | P3 | `decisión-pendiente` (owner) | — |
| A-39 | **Scroll horizontal a 375 px en producción por el selector de sucursal del historial de Caja**: el grupo `[role=group][aria-label="Sucursal de la caja"]` medía **426 px** en un viewport de 375 (`scrollWidth` 438 contra 375) con 3 sucursales; con menos de dos el control no se dibujaba (`locations.length > 1`), y por eso el E2E local no lo veía. **Cerrado el 2026-09-19 (Fase 1b del rediseño de Caja) y verificado en producción el 2026-09-22** (`build-20260922-142614`): el historial salió de Caja, en `/admin/history/cierres` el filtro de sucursal es un `Select` y `/admin/cash` mide **375/0** con las 3 sucursales reales | bug (UI) | **P1** | `cerrado` (Fase 1b; verificado en prod 2026-09-22) | PR #13 · `46282a7` |
| A-40 | **El cajero ve «Ver el turno abierto» y el detalle lo rebota**: el enlace vive en el bloque del turno (que ve `canUsePOS`) y `/admin/cash/history/[id]` redirige a Órdenes a quien no tiene `canViewCashHistory`. **Cerrado el 2026-09-19 (Fase 1a del rediseño de Caja)**: el enlace se dibuja solo con `canSeeShiftDetail` | bug | P2 | `cerrado` (2026-09-19, Fase 1a) | rama `feat/cash-redesign` |
| A-44 | **Una lectura fallida se dibujaba como «sin caja abierta»**: el `fetch` del estado de la caja no miraba `response.ok` (un 401/500 quedaba como caja cerrada) y tampoco limpiaba el error anterior. **Cerrado el 2026-09-19 (Fase 1a)**: `use-cash-shift` chequea el estado, propaga el mensaje del servidor y separa el error de lectura del error de acción | bug | P3 | `cerrado` (2026-09-19, Fase 1a) | rama `feat/cash-redesign` |
| A-43 | **La cabecera del panel mide 186 px = 23,3% del viewport a 375 px** (la regla del sistema es ≤20%; a 1280 son 114 px = 14,2%). Es el `AdminPageHeader` compartido (todas las pantallas del panel) y el chrome del shell, **igual antes y después** del rediseño de Caja: no es de Caja. Deuda declarada por decisión del owner (2026-09-19): va en otro PR | UI / deuda | P2 | `reportado` (agente, 2026-09-19) | — |

> Las **limitaciones conocidas y aceptadas** de `ops/production-readiness.md` §7 **no** son ítems de
> este backlog (rate limiting en memoria, `replicas: 1`, `X-Powered-By` cosmético, `style-src` con
> `'unsafe-inline'`, módulos fuera del MVP). Si el owner quiere atacar alguna, entra como ítem nuevo.
> A-09 a A-12 los registró el agente (no el owner): **A-10 y A-12 son decisiones de producto**, no bugs,
> y no se implementan sin respuesta.

## 2. Detalle

### A-01 · Footer y home con datos del negocio en vez del local — `cerrado` (implementado por A-07)

- **Qué se reportó**: con **tres locales reales** en producción, el footer y el bloque "Información
  del restaurante" de la home siguen mostrando el horario y la dirección de la **configuración del
  negocio**, así que no dicen nada del local que el cliente elige en el checkout.
- **Verificado en el código** (2026-09-12):
  - `src/app/(public)/layout.tsx` (`Footer`): `hoursSummary` sale de `formatBusinessHoursSummary(
    settings.businessHours)` y la ciudad de `settings.city`. El footer **no se dibuja en la home**
    (solo cuando `pathname !== "/"`).
  - `src/app/(public)/page.tsx` (bloque "Información del restaurante", ~línea 680): la **dirección**
    (`settings.addressLine`, `settings.addressReference`), la **ciudad**, el **teléfono** y el enlace
    de mapas salen de `settings`; el **horario** sale de `operationalSource.hours`, que **ya** es el
    del local por defecto (T8 fase 7). O sea: el bloque hoy mezcla las dos fuentes.
- **Por qué es `decisión` y no bug**: no está roto — con un solo local coinciden. Con tres, la
  pregunta "¿qué horario y qué dirección muestra el footer?" es de producto:
  - **(a)** listar los locales activos con su horario y dirección;
  - **(b)** mostrar solo el **local por defecto** (el primero activo, la misma regla que usan el
    checkout y el servidor);
  - **(c)** un **horario general** del negocio, y el detalle por local solo al elegir en el checkout.
- **Decisión del owner (2026-09-12)**: la opción **(a)** — los datos de cada sucursal — para **los dos
  lugares** (el footer y el bloque "Información del restaurante" de la home), y **sin teléfono por
  sucursal**. Implementado por A-07 (commit `83d7433`).
- **Contrato a respetar** (cualquiera sea la opción): salir de `GET /api/locations` (que ya devuelve
  solo los activos y **no** expone teléfono ni WhatsApp internos del local), nunca hardcodear datos.
- **Estado**: cerrado con A-07. Lo que la implementación dejó afuera, con motivo escrito, está en la
  ficha de A-07 (el footer no existe a 375 px y el contacto del negocio sigue siendo el de la
  configuración).
- **Referencias**: `ops/project-state.md` §2 ("T8 · Fase 7, cierre" y "A-07 · la información de cada
  sucursal").

### A-07 · La información de cada sucursal en el footer y la home — `cerrado` (commit `83d7433`)

- **Qué se reportó** (owner, 2026-09-12, sobre el footer): *"acá debería salir la información de cada
  sucursal"*.
- **Es la implementación de la decisión (a) de A-01**: el footer deja de mostrar el horario y la
  ciudad de la configuración del negocio y pasa a listar **los locales activos**.
- **Alcance confirmado por el owner (2026-09-12)**: **los dos lugares** (footer **y** el bloque
  "Información del restaurante" de la home) y **sin teléfono por sucursal** (queda el contacto del
  negocio de la configuración; no se toca el contrato público de `/api/locations`).
- **Los datos ya están disponibles, no hace falta tocar la API**: `PublicLocation`
  (`src/modules/locations/features/list-public-locations/list-public-locations.ts`) ya expone por
  local: `name`, `addressLine`, `city`, `addressReference`, `mapsUrl`, `businessHours`,
  `isAcceptingOrders` y `closedMessage`. La home **ya** consume ese mismo endpoint para el cartel de
  "Abierto/Cerrado", así que el patrón existe.
- **Lo que NO sale hoy y se deja como está**: el **teléfono** y el **WhatsApp del local** existen en
  el modelo (`location.types.ts`) pero el endpoint público los excluye **a propósito** (comentario en
  `list-public-locations.ts`). Mostrarlos sería un cambio de contrato público de `/api/locations` y
  el owner eligió no hacerlo ahora.
- **Hallazgo de camino (relevante para el diseño)**: `getPublicFooterClassName()` es
  `hidden border-t … md:block`, así que **el footer no existe a 375 px**; y la home **no dibuja el
  footer** (`src/app/(public)/layout.tsx` lo omite cuando `pathname === "/"`). Por eso la información
  de los locales tiene que entrar en el **bloque de la home** (que sí se ve en celular) y en el
  footer de escritorio. Queda anotado, no escondido: si el owner quiere el footer también en
  celular, es un cambio aparte (el footer actual es de escritorio por diseño).
- **Criterio de aceptación**: por cada local activo se ve el nombre y su dirección, salidos de
  `/api/locations` (nada del negocio donde corresponde el local), sin datos hardcodeados; a **375 px**
  sin scroll horizontal y con enlaces táctiles de **≥ 44 px**; a **1280 px** en columnas. Test de
  componente (jsdom) + E2E de navegador real en los dos anchos.
- **Referencias**: A-01; `ops/project-state.md` §2 ("T8 · Fase 7, cierre").
- **Cierre (2026-09-12, commit `83d7433`)**:
  - `locationDirectionsHref` (dominio de locales) resuelve el "Cómo llegar" de **un** local: el mapa
    cargado, o una búsqueda armada con **su** dirección; sin ninguno de los dos devuelve `null`.
  - `PublicLocationsList` (componente compartido) lista cada local activo con nombre, dirección,
    horario y "Cómo llegar". En la home entra como sección "Sucursales"; en el footer de escritorio,
    como lista compacta.
  - La home deja de repetir la dirección del negocio cuando hay sucursales (antes se veían dos
    direcciones y dos "Cómo llegar"); **sin** sucursales cargadas se mantiene el respaldo de la
    configuración, igual que antes.
  - **Decisión extra del owner (2026-09-12)**: el footer **ya no imprime el horario ni la ciudad de
    la configuración** — con más de un local no corresponden a ninguno y el de cada sucursal está en
    la lista. Se quitaron los dos lugares donde se imprimían (uno de ellos oculto por CSS).
  - **Verificación**: 1560 unitarios en 245 archivos, lint, typecheck, `build:webpack` y
    `security:secrets` en verde. El test nuevo del footer (`layout.dom.test.tsx`) se confirmó **rojo**
    antes del arreglo, nombrando los dos lugares donde salía el horario del negocio. **CI verde** en el
    push (`verify` + `migrations` + `container` + `publish`, run `34767909489`), que es el que
    construye la imagen y la ejecuta contra Postgres.
  - **Pendiente al cerrar** → **saldado el 2026-09-13**: el E2E de navegador real en los dos anchos
    (375 px en la home, 1280 px en el footer) se corrió con el arnés local completo (Postgres 17 +
    migraciones + seed + `next start`) y la suite quedó **88 pasaron / 6 salteados / 0 fallos**. Al
    correrla apareció **un hallazgo real del cambio**: en `/checkout` la aserción de la dirección
    resolvía a dos elementos, porque el footer ahora lista la dirección de cada sucursal y el local
    demo hereda la de la configuración; se acotó la aserción a la fila del punto de retiro (commit
    `cef9a1c`, `fix(test)`), sin cambiar ninguna verificación de producto. El footer **no existe a
    375 px** (`hidden … md:block`), así que en celular la información por sucursal llega por la home.

### A-08 · El isotipo y el nombre del negocio en los headers — `cerrado` (commit `f0366c8`)

- **Qué se reportó** (owner, 2026-09-12): *"el isotipo de One Burger desapareció en los header[s] de
  la derecha… quiero que se mantenga ese header en las secciones principales: nombre del negocio e
  isotipo, arriba a la derecha"*.
- **Lo que se verificó, para no arreglar lo que no está roto** (2026-09-12):
  - **El isotipo no está roto en escritorio**: el header público (`/menu`) sí renderiza
    `<img src="https://images.casaantiguanic.com/img/…png">` y ese asset responde **200** (PNG de
    1254×1254, el isotipo negro sobre amarillo). No es un asset caído.
  - **En celular la marca no existe**: `getPublicHeaderClassName()` devuelve
    `"sticky top-0 z-50 hidden … md:block"`, así que **el header completo (isotipo + nombre) está
    oculto por debajo de `md`**. A 375 px la marca desaparece de verdad.
  - **La home no tiene isotipo**: su encabezado (`src/app/(public)/page.tsx`, ~línea 457) muestra el
    nombre (`<h1>`) y el badge Abierto/Cerrado, **sin `BrandMark`**.
  - **Posición**: en escritorio el isotipo va **a la izquierda, junto al nombre**; a la derecha están
    "Menú" y el carrito. El landing del apex no tiene header (solo frames), así que ahí no aplica.
- **Por qué entra acá y no se arregló a ciegas**: "desapareció" en el reporte, pero el asset está
  sano; lo que falta es **dónde se dibuja**. La interpretación visual exacta (isotipo a la derecha
  duplicado vs. marca consistente arriba) es una decisión de diseño del owner y se confirma antes de
  tocar el header, porque el header es compartido por toda la app pública.
- **Restricción dura de accesibilidad ya vigente**: el isotipo se dibuja con
  `aria-hidden="true"` a propósito (`brand-mark.tsx`) para no duplicar el anuncio del nombre; si se
  duplica la marca, **no** se le agrega un `alt` que repita el nombre (dos veces el mismo texto para
  un lector de pantalla).
- **Decisión del owner (2026-09-12)**: la marca (isotipo + nombre) tiene que verse **también en
  celular**, en el header, como en las secciones principales de escritorio. El isotipo a la derecha
  duplicado **no** es lo pedido: se mantiene una marca consistente arriba.
- **Criterio de aceptación**: la marca (isotipo + nombre) se ve en las superficies principales a
  **375 px y 1280 px**, con el asset configurado en `/admin/settings` (nunca hardcodeado), sin scroll
  horizontal y sin duplicar el anuncio accesible. Test de componente + E2E en los dos anchos.
- **Cierre (2026-09-13, commit `f0366c8`)**:
  - `getPublicHeaderClassName()` ya no oculta el header por debajo de `md`: **la marca se ve en todos
    los anchos**. La navegación de escritorio (Menú y carrito) sigue apareciendo desde `sm`, y en
    celular el resto de la navegación vive en la barra inferior, que no se tocó.
  - El isotipo conserva su `aria-hidden="true"`, así que el nombre accesible del enlace sigue siendo
    `<nombre> inicio` y el nombre no se anuncia dos veces.
  - **Cambio de contrato en un test**: `public-layout-helpers.test.ts` afirmaba que el header estaba
    oculto en celular; se reescribió para el contrato nuevo (el archivo explica el motivo).
  - **Verificación en el navegador real, con el rojo confirmado primero**: el caso nuevo
    `tests/e2e/public-header.spec.ts` se corrió contra el build servido con el código viejo y falló
    como debía (`la marca tiene que verse en /` → `element(s) not found` a 375 px, mientras el de
    1280 px ya pasaba). Después del cambio: verde en los dos anchos y en `/`, `/menu` y `/cart`, sin
    scroll horizontal.
  - **Suite completa**: 1560 unitarios en 245 archivos, lint, typecheck, `build:webpack` y
    `security:secrets` en verde; **E2E 88 pasaron / 6 salteados / 0 fallos**.
- **Queda a la vista, no escondido**: la home sigue mostrando el nombre del negocio como `<h1>` de la
  página (título + badge Abierto/Cerrado) además del nombre del header. Es deliberado: el `h1` es el
  título de la página y el header es la marca de navegación. Si el owner prefiere una sola aparición
  del nombre en la primera pantalla, es un cambio de diseño aparte (el mock de T2 ordena esa fila
  como encabezado de la home).
- **Referencias**: `ops/project-state.md` §2 ("Arreglo de branding: el logo y los colores no llegaban
  a toda la app" y "A-08 · la marca en el header"); `src/shared/ui/brand-mark.tsx`.

### A-02 · Datos de los locales de producción — `bloqueado` (sesión de owner)

- **Qué se reportó / hallazgo del drill**: dos datos mal cargados en `/admin/locations`:
  *Camino de Oriente* tiene el slug `one-burger-masaya` (no coincide con el nombre) y *Casa Antigua*
  tiene la ciudad `Jinoteoe`.
- **Receta**: `ops/production-readiness.md` §8.8. Se corrige en el admin, con la sesión del owner.
- **Riesgo**: nulo. El slug del local **no** se usa en ninguna URL pública ni se guarda en los
  pedidos (el público se maneja con `locationId`).
- **Verificación al cerrar**: releer los tres locales y confirmar nombre, slug y ciudad.

### A-03 · Cargar la carta completa — `bloqueado` (owner)

- **Qué falta**: el resto de la carta y las fotos. Hoy: 2 categorías con 6 productos (4 hamburguesas
  con C$35 de empaque y 2 bebidas).
- **Receta**: `ops/production-readiness.md` §6.3 y §6.4 (las fotos son URLs externas: no hay subida de
  archivos).
- **Nota**: si algún local vende distinto, el catálogo por local se ajusta en `/admin/locations/[id]`
  (precio propio, agotado, o no venderlo ahí).

### A-04 · Monitoreo externo — `bloqueado` (owner elige servicio)

- **Qué falta**: un uptime que pegue a `GET /api/readiness` (hace `SELECT 1` y responde **503** si la
  base no responde) y avise al canal del equipo.
- **Receta**: `ops/production-readiness.md` §8.5.
- **Qué puedo hacer yo**: dejar documentado el contrato del endpoint y la verificación del aviso; el
  alta del servicio la hace el owner.

### A-05 · Puertos expuestos de servicios ajenos — `bloqueado` (OK de otro admin)

- **Qué falta**: cerrar el *port mapping* de `capostgres` (5455) y `postimage` (8585) en el panel
  compartido. **No son de One Burger**.
- **Receta**: `ops/production-readiness.md` §8.4.

### A-06 · Rotar el `EASYPANEL_TOKEN` — `cerrado` (2026-09-17)

- **Por qué**: el token da acceso total al servidor y se pasó por chat **cinco veces** (2026-09-10,
  2026-09-12, dos veces el 2026-09-13 —el deploy de A-07/A-08 y el de A— y **dos veces más el
  2026-09-14**: el deploy de las comandas y el de B6).
- **Receta**: `ops/production-readiness.md` §8.3 (panel → Settings → API tokens: crear uno nuevo,
  usarlo y revocar el viejo).
- **Ojo**: el `inspectService` del panel devuelve el `env` completo del servicio (incluye
  `DATABASE_URL` con su contraseña y `NEXTAUTH_SECRET`), así que quien tenga el token ve también esos
  secretos: no es solo acceso al panel.
- **Cierre (2026-09-17)**: el owner **rotó** el token. El viejo se usó por última vez en los dos deploys
  de ese día (el cierre de la Fase 2 de UI y los modales y pantallas secundarias) y quedó revocado; el
  nuevo no viajó por chat.

### A-09 · El actor del cambio de estado no se muestra — `reportado` (agente)

- **Qué es**: en B5b cada cambio de estado queda firmado (`OrderStatusHistory.changedByUserId`, migración
  `20260914061058`) y **ninguna pantalla lo lee**: el detalle del pedido no muestra historial y la
  comanda tampoco. La pregunta «quién aceptó esto» hoy se responde **en la base**, no en el producto.
- **Evidencia**: `src/modules/orders/adapters/prisma-order-repository.ts` (`getOrderStatusHistory` lo
  devuelve) y ningún componente lo consume (`grep -rn "getOrderStatusHistory" src/app` no devuelve usos).
- **Por qué quedó así**: mostrarlo pide una vista de historial del pedido, que es una pantalla nueva, no
  un detalle del arreglo. Se dejó asentado a propósito.
- **Qué haría falta para cerrarlo**: decidir dónde se muestra (detalle del pedido vs. comanda) y con qué
  nombre (el id solo no sirve: hay que resolver el usuario).

### A-10 · La home del panel no existe para los roles sin Resumen — `decisión-pendiente`

- **Qué es**: `/admin` es solo del dueño (`canViewAdminOverview`); a un `manager` o una `kitchen` los
  redirige a `/admin/orders`. El owner anunció **POS e inventario** para tablets separadas: esos roles
  van a necesitar un lugar donde elegir sección, y hoy no lo tienen (B6 agregó «Ver el panel», que
  devuelve la barra lateral, pero esa barra para una cocina solo tiene Órdenes).
- **Evidencia**: `src/app/(admin)/admin/page.tsx` (redirección por rol),
  `src/app/(admin)/admin/admin-layout-helpers.ts` (`getAdminNavGroups`) y el `homeHref` del shell.
- **Por qué es `decisión` y no bug**: hoy nada está roto (la cocina solo tiene una sección). Lo que falta
  es producto: qué ve cada rol al entrar al panel cuando haya POS e inventario.

### A-11 · Timeouts de la QA de solo lectura — `a reproducir`

- **Qué pasó**: el 2026-09-14, dos corridas de la QA de solo lectura contra `menu.oneburgernic.com`
  fallaron por `page.goto` de 30 s —una **en masa** (33 casos de 34) y otra en un solo caso— y al
  repetirlas pasaron (30–31 de 34, 3 salteados).
- **Lo que se midió en ese momento**: las seis superficies públicas en 200 (`/api/health`,
  `/api/readiness`, `/api/menu`, `/api/locations`, `/`, `/menu`), `/api/readiness` con la base en 9 ms y
  cinco cargas de `/menu` con **0,7 s de media** (máx. 0,9 s). No hay evidencia de regresión de código.
- **Hipótesis**: saturación del burst de la suite (una réplica, muchos navegadores en paralelo) o de la
  red de quien la corre. **Qué haría falta**: correrla de nuevo midiendo tiempos, y si se repite, mirar
  recursos del contenedor en Easypanel (CPU/memoria) y el `replicas: 1` del runbook §7.

### A-12 · El filtro «solo sin aceptar» no se implementó — `decisión-pendiente`

- **Qué es**: el brief B4 listaba «filtros de forma de pago, **solo sin aceptar** y atrasados». Se
  implementaron la búsqueda, la forma de pago y «Atrasados»; **no** «solo sin aceptar», porque los
  carriles del tablero ya separan lo nuevo (un filtro que duplica un carril es un control de más).
- **Evidencia**: `ops/tasks/TASK-orders-console.md` §5 (fila B4) y
  `src/app/(admin)/admin/orders/page.tsx` (los filtros que sí van: `search`, `paymentMethod`, `late`).
- **Qué falta**: que el owner confirme que está bien así. Si lo quiere igual, es un toggle de la vista
  (mostrar solo el carril «Por aceptar») y entra como task nueva.

### A-13 · Dos módulos cascarón: `coupons` y `table-ordering` — `reportado` (agente)

- **Cómo apareció**: el guardrail de módulos de TASK-204 (`src/shared/contracts/module-contract.test.ts`)
  pasó **verde en la máquina de desarrollo y rojo en CI**, con `coupons: falta adapters, domain,
  features, ports` (y lo mismo para `table-ordering`). La causa no era el contrato sino cómo medía: su
  primera versión miraba si el **directorio** existía, y esas cuatro carpetas existen —vacías— en el
  disco local. **Git no versiona carpetas vacías**, así que en un clon esos dos módulos son un
  `README.md` y nada más. Ya corregido: una capa cuenta solo si tiene archivos.
- **Evidencia**: `git ls-files src/modules/coupons` → `src/modules/coupons/README.md` (ídem
  `table-ordering`); `Get-ChildItem -Directory src/modules/coupons` en local muestra `adapters`,
  `domain`, `features` y `ports` sin un solo archivo.
- **Por qué es deuda real**: el motor de cupones vive en `src/modules/orders/domain/promo-bogo.ts` y
  sus casos de uso en `src/modules/orders/features/`; el bootstrap de mesas, en
  `src/modules/tables/lib/casa-antigua-table-bootstrap.ts`. Los cascarones no tienen código y aun así
  aparecen como módulos en cualquier inventario (TASK-201 los contó como capas completas).
- **Qué falta**: decisión del owner — borrar los cascarones con su README o dejarlos como marcador. Hasta
  entonces quedan **congelados** en `LEGACY_PARTIAL_MODULES` con el motivo escrito.

### A-14 · El mapeo de errores repite el mismo bloque 12 veces — `reportado` (agente)

- **Qué es**: `src/shared/lib/http/error-response.ts` tiene un `if (error instanceof XError)` con el
  mismo cuerpo (`code`, `message`, `fields?` y `status`) repetido por cada módulo: 11 copias antes de
  TASK-301 y 12 después (se sumó `PosError` con el mismo patrón, para no inventar un camino distinto
  en el medio de otra tarea).
- **Por qué es deuda y no un bug**: funciona y cada copia está tipada distinto (`status` varía por
  módulo), así que no hay riesgo inmediato. El costo es que agregar un módulo nuevo obliga a copiar el
  bloque, y que un cambio de formato de respuesta hay que hacerlo 12 veces.
- **Qué falta**: una tabla de constructores (`[AuthError, BusinessSettingsError, …]`) que recorra y
  devuelva lo mismo, con el test que ya existe (`src/shared/lib/http/error-response.test.ts`) como red.
  Criterio de activación: cuando haya que tocar la forma de la respuesta de error o cuando entre un
  módulo más.

### A-15 · Un cobro de un pedido cancelado sigue contando en el arqueo — `decisión-pendiente` (owner)

- **Qué es**: el arqueo del turno trae los cobros por local y ventana de tiempo
  (`src/modules/orders/adapters/prisma-payment-repository.ts:85-97`) y **no mira el estado del pedido**.
  `update-order-status.ts` no toca pagos y **no existe `Refund`** ni ningún movimiento que compense. Si se
  cobra en el mostrador y después se rechaza/cancela el pedido, el esperado **sigue contando esa plata**;
  si el cajero la devuelve, el cierre marca **faltante** y no hay forma de registrarlo.
- **Reproducción**: cobrar una venta de mostrador (`POST /api/admin/pos/sale`), rechazar el pedido
  (`PATCH /api/admin/orders/[id]/status`) y cerrar la caja contando lo que hay. El `expectedAmount` incluye
  el cobro del pedido cancelado. (No se ejecutó contra producción: muta datos; el código está citado.)
- **Qué falta decidir**: si al cancelar un pedido cobrado se devuelve la plata (y cómo se registra: ¿una
  fila de devolución del medio original, un movimiento de caja, o se excluye el pedido del esperado?).
  Sin esa respuesta, cualquier implementación inventa producto.

### A-16 · No hay historial de cajas — `reportado` (agente)

- **Qué es**: `getCurrentShift` (`src/modules/orders/features/shift/get-current-shift.ts:21`) devuelve
  **solo la caja abierta**. `ShiftRepository.listShifts` (`ports/shift-repository.ts:49`) existe y el
  adaptador de Prisma ya devuelve los conteos (`prisma-shift-repository.ts:172-181`, con
  `include: {cashCounts: true}`), pero **ninguna API ni pantalla lo usa** (solo port, adaptadores y tests).
- **Consecuencia**: al cerrar, el resumen se ve en pantalla (estado del cliente) y **si se recarga
  desaparece**. Los datos están guardados en `Shift` + `ShiftCashCount` con el esperado **congelado**
  (`expectedAmount`), así que lo que falta es superficie de lectura, no datos.
- **Qué falta**: la pantalla/endpoint de historial y decidir si el detalle por moneda se recomputa o se
  guarda al cerrar (ver A-18).

### A-17 · La tarjeta no se reporta y la transferencia no se puede cobrar — `decisión-pendiente` (owner)

- **Qué es**: el cierre calcula el esperado **solo con efectivo** (`close-shift.ts:138-139`) —correcto,
  la tarjeta no está en el cajón— pero **nada** suma la tarjeta del día: ni la respuesta del cierre ni el
  reporte diario (`src/modules/dashboard/features/get-daily-report/get-daily-report.ts` solo agrega
  `Order`: totales, cantidad y estados de pedidos/reservas). Y el enum del cobro real
  (`PaymentMethodType`, `schema.prisma:347-353`) ya tiene `transfer`, `mixed` y `other`, pero el payload
  del POS solo acepta `cash|card` (`src/app/api/admin/pos/sale/sale-payload.ts:30`).
- **Qué falta decidir**: si el mostrador cobra transferencia y pago mixto, y qué se espera ver al cerrar
  de lo que **no** pasó por el cajón (¿informativo? ¿cuadre contra el banco/POS?).

### A-18 · El detalle por moneda del cierre no se persiste y no hay `Payment.shiftId` — `reportado` (agente)

- **Qué es**: `expectedByCurrency` se calcula al cerrar y viaja **solo en `meta`**
  (`close-shift.ts:113`); `Shift` no tiene columnas por moneda (`schema.prisma:762-788`) y `closeShift` del
  adaptador escribe `status`, `closedAt`, `closingAmount`, `expectedAmount`, `difference`, `notes` y los
  conteos (`prisma-shift-repository.ts:137-167`). Recomputar un cierre viejo usa la **tasa de hoy**.
- **Además**: `Payment` **no tiene `shiftId`** (`schema.prisma:732-753`; el único `shiftId` del esquema es
  `ShiftCashCount:802`) — la atribución es por ventana de tiempo, lo que hace que un cobro corregido o
  tardío caiga en el turno en curso. `plna.md:546` afirma lo contrario (desviación documental: A-21).
- **Qué falta**: decidir si el arqueo se congela por moneda al cerrar y si el cobro se ata al turno.

### A-19 · No existen los movimientos de caja — `decisión-pendiente` (owner)

- **Qué es**: no hay modelo `CashMovement` (ni equivalente) en `prisma/schema.prisma`; tampoco hay
  configuración de caja en ningún lado (ni en `BusinessSettings` ni en `Location`): no se puede expresar
  "se sacaron C$500 para el proveedor", "se ingresó cambio", "la propina no entra al cajón". Hoy la
  propina en efectivo **sí** entra al cajón (decisión implícita, `close-shift.ts:143-144`) y una caja
  abierta puede quedar abierta indefinidamente (no hay cierre automático ni aviso).
- **Qué falta decidir**: si hay retiros/ingresos con motivo y responsable, si la propina se queda o se
  reparte, y si se exige caja abierta para cobrar (hoy **no** se exige y esos cobros no entran a ningún
  arqueo).

### A-20 · No hay datos fiscales y el recibo solo se emite en el mostrador — `decisión-pendiente` (owner)

- **Qué es**: cero campos fiscales en el código (búsqueda de `ruc`, `taxId`, `fiscal`, `legalName`, `NIT`,
  `documentNumber`, `tax_id` en `prisma/` + `src/**`: **sin coincidencias**). `BusinessSettings` tiene
  identidad visual y contacto (`schema.prisma:677-704`) y `Customer` solo `fullName` + `whatsappNormalized`
  (`:59-69`). El recibo (`src/shared/lib/receipt-image.ts`, 183 líneas) es un **JPG de texto** en canvas
  (`renderReceiptJpeg:108-139`), **sin logo** (no lee `logoUrl`) y **sin RUC**; el texto lo arma la función
  pura `buildReceiptTextLines` (`:56-102`) y el archivo se comparte/descarga con
  `shareOrDownloadReceipt` (`:146-167`). **No hay librería de PDF** en las dependencias. El recibo se emite
  **solo desde el POS al cobrar** (`pos-client.tsx:260-294`): desde el detalle del pedido no se puede.
- **Qué falta decidir**: si se emite factura (implica RUC del negocio, documento del cliente y numeración),
  si el recibo debe salir del detalle, y si se acepta imprimir/PDF con la hoja del sistema (sin
  dependencia nueva) o se agrega una librería.

### A-21 · Cuatro documentos desactualizados (verificado) — `cerrado` (2026-09-15, Capa 0)

| Documento | Decía | Realidad medida | Estado |
|---|---|---|---|
| `DESIGN_SYSTEM.md §3.4:273` | «2 literales distintos» de carga | **18** literales distintos de «Cargando…», con `...` y `…` mezclados | **corregido**: §3.4 se reescribió y el número ya no existe |
| `DESIGN_SYSTEM.md §2.1:164` | 15 tokens huérfanos | **16**: también `--ring` (`globals.css:40`; su único `var()` está en `globals.css:153`) | **corregido**: §1.7 dice **16** |
| `AGENTS.md:109` | «`DESIGN_SYSTEM.md` §5 lo lista» (copy decorativo) | §5 **no** contenía esa lista | **corregido**: la lista está en `DESIGN_SYSTEM.md` §5 y un contrato lo verifica |
| `plna.md:546` | El cobro guarda «su `shiftId` nullable» | **No existe** `Payment.shiftId` (`schema.prisma:732-753`) | **no se puede corregir acá**: `plna.md` no está versionado. La falta del campo sigue anotada en **A-18** |

Los tres primeros se cerraron reescribiendo `DESIGN_SYSTEM.md` (484 → 250 líneas) y `AGENTS.md` (319 → 300):
los números y el puntero roto desaparecieron con el texto viejo, y
`src/shared/contracts/ui-rules-contract.test.ts` falla ahora si `AGENTS.md` cita una sección que no existe,
si los documentos pasan su tope de líneas o si el catálogo deja de tener la lista de copy decorativo.

### A-22 · Lo que no tiene guardrail se degrada — `reportado` (agente)

- **Qué es**: la paleta cruda de Tailwind (**70** apariciones, el mismo número que midió TASK-201),
  `style={{ fontFamily }}` (**30**), `rounded-[Npx]` (**37** con 9 valores), ~20 sombras `rgba()` a mano y
  **46** valores arbitrarios de espaciado **no tienen test**; `DESIGN_SYSTEM.md §6:370` lo admite. En
  cambio, lo que sí tiene contrato se mantiene: `#hex` de UI estable en **15**, **94** controles crudos con
  los techos del contrato **en sync (0 ofensas)** y los componentes de `_components/` registrados.
- **Además**: no existe primitivo de **Textarea, Toggle/switch, Modal, Dropdown, Tooltip, Toast ni
  Skeleton**, y la "sección" del panel no tiene primitivo (la misma cadena de clases **32 veces en 5
  variantes**), así que copiar `className` sigue siendo la ruta de menor resistencia.
- **Criterio de activación**: cuando se empiece UI nueva grande (el POS completo) y se quiera que no
  nazca con paleta cruda y radios arbitrarios.

### A-23 · Cuenta de prueba con rol `owner` en producción — `decisión-pendiente` (owner)

- **Qué es**: para verificar el POS con sesión se usó la cuenta `tester@oneburgernic.com`, que tiene rol
  **owner** y 3 locales asignados. Es un acceso total más (puede tocar configuración, usuarios y menú).
- **Qué falta decidir**: si se mantiene para QA, se degrada (por ejemplo a `cashier`, que es el rol que
  necesita el POS) o se borra cuando termine la puesta a punto. **La contraseña no se registra en el repo**;
  la administra el owner.

### A-24 · Controles crudos que todavía no son primitivos — `reportado` (agente)

- **Qué es**: después de la migración al sistema Stitch quedan **57 controles HTML crudos** repartidos
  en 21 archivos del admin. Los más cargados: `menu/categories` (9), `menu/marketing-blocks` (8),
  `menu/products/[id]` (8), `inventory/receive` y `inventory/waste` (3 cada uno), `locations/[id]` (3),
  `orders/page` (4). Los tokens ya son los del sistema: falta cambiar el control por `Select`,
  `Textarea`, `Checkbox`, `Toggle`, `ColorInput` o `Button` según corresponda.
- **Cómo se cierra**: un archivo por vez, bajando su número en `src/shared/config/design-tokens.allow.json`
  **y** en `LEGACY_RAW_CONTROLS` de `src/shared/contracts/ui-contract.test.ts` en el mismo commit (el
  contrato exige que un techo que baja se baje, y que a 0 se borre la fila).
- **Ojo**: `Categorías` usa `<input type="color">`; el primitivo `ColorInput` ya existe y se usa en
  Personalización, así que es el mismo reemplazo.

### A-25 · Los tres `window.confirm` — `reportado` (agente)

- **Qué es**: Usuarios (`users-client.tsx`), Locales (`locations/page.tsx`) y Promos confirman con el
  diálogo nativo. El guardrail lo dice textual: *«window.confirm (usá el primitivo Modal)»*.
- **Ojo con el E2E**: `tests/e2e/admin.spec.ts` y `tests/e2e/admin-order-scope.spec.ts` aceptan el
  diálogo con `page.on("dialog")`. El `<dialog>` nativo del primitivo `Modal` **no** dispara ese evento,
  así que los dos specs se actualizan en el mismo commit y el motivo se escribe en el cuerpo.
- **Cierre esperado**: `window-confirm` a 0 y la fila borrada del `allow.json`.

### A-26 · Partir `settings-client.tsx` — `reportado` (agente)

- **Qué es**: 951 líneas contra un techo de 400 (el componente solo pasaba las 700). La partición
  sugerida, toda por debajo del techo: `settings-form-helpers.ts` (tipos, `COLOR_FIELDS`, payload),
  `settings-fields.tsx` (`SettingsSection`/`SettingsField`), las secciones de identidad, contacto,
  operación y apariencia, y `settings-preview-card.tsx`.
- **De paso**: el error de `SettingsField` se anuncia con `role="alert"` pero no se asocia por
  `aria-describedby` al control (deuda chica, se arregla al partir el archivo).

### A-27 · E2E determinista alrededor de la medianoche — `reportado` (agente)

- **Qué pasa**: los specs crean un pedido y lo buscan en el tablero de «Hoy». Cerca de las 00:00 del
  huso del negocio (America/Managua), los minutos de preparación del local empujan el primer turno al
  día siguiente, el pedido queda «programado para otro día» y el tablero no lo muestra: fallan
  `admin-comandas`, `admin-order-actions` y `admin-order-scope` sin que haya nada roto en el producto.
- **Parche actual**: `admin-order-scope` comprueba el alcance del dueño por `GET /api/admin/orders` en
  vez de por el tablero, y la aserción de la fila de local se acota a su `article`.
- **Cierre esperado**: reloj congelado (`page.clock`) o un `dateFrom`/día de negocio fijo por test.

### A-28 · La barra superior del KDS y la regla del 20% — `reportado` (agente)

- **Qué es**: en `/admin/orders` la barra pegajosa (título, chips de vista, contadores, buscador, filtro
  de pago, atrasados y acciones) mide ~230 px a 1280×900 (~25% del alto) y en celular envuelve en varias
  filas. `design-system.md` §8.4 pide que cabecera, filtros y utilidades no pasen el 20%.
- **Cierre esperado**: compactar la barra (contadores y buscador en una fila, acciones al menú) sin
  perder ninguno de los anclajes que usan los E2E (`Local de las comandas`, `Buscar comanda`, `Atrasados`).

### A-35 · `publish` no va como required check — `cerrado` (2026-09-19)

- **Qué es**: la protección de `main` tiene que exigir los checks de validación (`verify`, `contracts`,
  `migrations`, `container`) y **no** el job `publish`. Ese job lleva
  `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`: **no se ejecuta en un PR**.
- **Por qué importa**: en GitHub, un *required check* que nunca reporta deja el PR en estado
  **«Expected — waiting for status» para siempre**: no hay forma de mergearlo, ni con la aprobación ni
  con permisos de admin (salvo saltear la protección, que es justo lo que no se quiere).
- **Evidencia**: el PR #2 corrió los cuatro jobs de validación y `publish` quedó **`skipped`**
  (run `35379018496`, `gh run view --json jobs`). El `if` está en
  `.github/workflows/publish-ghcr.yml`.
- **Cerrado el 2026-09-19**: `AGENTS.md` § *CI y protección de `main`* tiene la advertencia explícita y el
  ruleset `Protect main` (id `23673659`) quedó con **`verify`, `contracts`, `migrations` y `container`**
  como required checks (`strict: true`) y **sin `publish`**, aplicado con
  `gh api --method PUT repos/danielmaki123/one-burger-commerce/rulesets/23673659` y verificado leyéndolo de
  nuevo.

### A-36 · Verificar `feat/design-system` antes de tocar el sistema de diseño — `reportado` (agente, 2026-09-18)

- **Qué es**: hay una rama remota **`feat/design-system`** que no creó esta sesión (la rama aparece al
  hacer `git fetch origin`). El **rediseño del menú público (9 pantallas de Stitch)** —**pausado**: la
  próxima tarea es el POS— toca de lleno tokens, tipografía y componentes.
- **Por qué importa**: si esa rama cambia `globals.css`, `design-system.md` o los primitivos de
  `src/shared/ui/`, arrancar el rediseño desde `main` sin mirarla termina en un conflicto grande o en dos
  criterios de diseño distintos conviviendo. También puede explicar por qué el dueño pidió pausar.
- **Qué falta**: leerla (`git log origin/feat/design-system`, `git diff main...origin/feat/design-system`)
  y decidir con el owner si se mergea antes, se descarta o se trabaja encima. **Nada de esto se hace sin
  su confirmación**, porque el rediseño está pausado a pedido suyo.
- **Nota**: es una tarea de **coordinación con el otro dev**, no de código; si el dueño dice que la rama
  es de un experimento descartado, se cierra como *descartado* con ese motivo escrito.

### A-33 · El listado agrupado de Órdenes quedó inalcanzable — `reportado` (agente, 2026-09-18)

- **Qué es**: `src/app/(admin)/admin/orders/page.tsx` dibuja el listado **por grupos** del turno
  (`BUCKET_ORDER`: Programados, Nuevas, En cocina, Listas, Otras, Cerradas) solo cuando
  `!showBoard && statusFilter === "all"`. Desde el layout unificado del Punto 1 (2026-09-18),
  `showBoard = statusFilter !== "closed"`, así que:
  - con el filtro en «Todas» se ve el tablero y **no** el listado;
  - con «Cerradas» el tablero se apaga pero `groupByBucket` es falso (el filtro no es «all») y además
    la consulta manda `status=closed`, que deja fuera lo que no está cerrado;
  - con «Nuevas»/«Preparando»/«Listas» la lista plana se dibuja pero el rango del turno (`businessDate`)
    contra el filtro de estado deja fuera los pedidos programados para otro día.
- **Consecuencia**: el grupo «Programados» no se puede ver en ningún camino, y el caso D1 de
  `tests/e2e/public-order.spec.ts` perdió su segunda mitad (el `Ver en el listado`, que el Punto 1 se
  llevó). Ahí quedó anotado, con la verificación que sí es alcanzable (el aviso del tablero).
- **No se inventó producto**: dónde se mira el listado completo —¿un enlace desde el tablero?, ¿un tab
  propio?, ¿el Historial?— es una decisión del owner. El aviso «N comandas programadas para otro día»
  sí funciona desde el 2026-09-18 (`businessTurnRange` incluye mañana), así que la cocina no queda
  ciega: sabe que hay pedidos de otro día y cuántos.

### A-32 · El Historial depende del POS para dibujarse — `cerrado` (`f35755c`, 2026-09-18)

- **Qué era**: `withControlGroup` (`admin-layout-helpers.ts`) arrancaba con `if (!posAvailable) return
  groups`, y `posAvailable` se resuelve en el shell desde `GET /api/admin/pos/availability`. Sin mostrador
  prendido en ningún local, el grupo **Control** no se dibujaba y un manager perdía también el
  **Historial**, que no lee la caja del turno: lista cierres cerrados y facturas emitidas.
- **El arreglo**: cada ítem del grupo lleva **su propio permiso** y el grupo se dibuja si queda **al menos
  uno**. `POS` solo con el mostrador prendido; `Caja del día` con `canUsePOS` **y** mostrador prendido (es
  donde el cajero abre y cierra su turno: sin POS no tiene nada que hacer ahí y no administra caja, que es
  la mitad de auditoría de la pantalla); `Aprobaciones` con `canManageCash`; `Historial` con
  `canViewHistory`, sin mirar el POS.
- **Desvío respecto del pedido**: el brief pedía `Caja del día` con `canUsePOS` a secas. Con esa regla un
  cajero sin POS quedaba con un grupo Control de un solo ítem que lleva a una pantalla sin uso, y el
  propio caso de test del brief pedía lo contrario. Se agregó la condición del mostrador a ese ítem, que es
  el único que de verdad depende del POS.
- **Verificación**: el test se confirmó **rojo** por la razón correcta (`expected ['Operación',
  'Catálogo', …] to include 'Control'`). 2859 unitarios en 419 archivos, lint, typecheck, `build`,
  `security:secrets` y `prisma migrate diff` sin drift. Deploy a producción `build-20260918-154317`
  (commit `f35755c`), readiness `ready` y smokes **7/7** (menú) y **6/6** (hosts).

### A-37 · `canQuickAddProduct` deja pasar un grupo obligatorio sin opciones activas — `cerrado` (`af80d93`, 2026-09-19)

- **Qué era**: `canQuickAddProduct` (`src/shared/lib/product-quick-add.ts`) devolvía **`true`** cuando un
  grupo tiene `isRequired: true` pero **todas** sus opciones están inactivas (no habría qué elegir), y
  `createOrder` lo exigía igual: respondía **422 «Required modifier missing»**. El "+" de la home y del
  menú, y el **Agregar** del POS (vía `requiresOptions`), ofrecían agregar de un toque un producto que el
  alta rechazaba.
- **Decisión del owner (2026-09-19)**: `canQuickAddProduct` es la **fuente única** y `createOrder` la
  consume; la regla vive en el **dominio del módulo `menu`**.
- **El arreglo**: `isModifierSelectionRequired(group)` y `canQuickAddProduct(product)` en
  `src/modules/menu/domain/modifier-selection.ts` (la regla: obligatorio o con mínimo, **y con opciones
  activas**). El alta la importa y saltea los grupos que no exigen nada; los códigos y mensajes de los
  casos reales (obligatorio sin elegir, mínimo, máximo) quedan igual. `shared/lib/product-quick-add.ts`
  se queda solo con `buildQuickAddCartItem`.
- **Verificación**: test que fallaba con el error real (`OrderError: Required modifier missing`) y pasa
  después; suite completa **3010 tests en 434 archivos** verdes.

### A-38 · `applyLocationPricing` deja pasar un producto sin fila en `LocationProduct` — `cerrado` (`61d8ed5`, 2026-09-19)

- **Qué era**: el comentario del schema decía que sin fila en `LocationProduct` **el producto no se vende
  en ese local**, pero `applyLocationPricing` solo descarta el producto cuando **hay** fila y está
  `isActive: false`; sin fila lo deja pasar con el precio del negocio. Dos verdades sobre lo mismo, en la
  carta y en el mostrador.
- **Decisión del owner (2026-09-19)**: un producto sin fila **sí se vende** (con el precio del negocio).
  Se corrige **el comentario, no el código**, porque el comportamiento es el que se quiere.
- **El arreglo**: el comentario del modelo `LocationProduct` explica qué significa la ausencia de fila y
  cada campo (`priceOverride` en `null` = precio base, `isAvailable: false` = agotado en el local,
  `isActive: false` = ese local no lo vende), y nombra este ítem para dejar la traza.
- **Verificación**: `prisma validate` válido y `prisma migrate diff` **sin drift** (es un comentario).

### A-39 · Scroll horizontal a 375 px en producción por el selector de sucursal del historial de Caja — `cerrado` (2026-09-19, Fase 1b del rediseño de Caja)

- **Qué era**: en `admin.oneburgernic.com/admin/cash` a 375 px, `documentElement.scrollWidth` medía **438**
  contra un viewport de **375** (63 px de desborde). El responsable era el grupo de sucursales del bloque de
  historial (`cash-client.tsx:142-155` con el primitivo `TabsList`/`TabsTrigger` de `src/shared/ui/tabs.tsx`):
  con las **3** sucursales reales el grupo medía **426 px** y el botón «Casa Antigua» llegaba a `right: 434`.
- **Por qué el E2E no lo veía**: `admin-cash.spec.ts` ya medía el desborde a 375 px, pero la base local tiene
  **una** sucursal y el control estaba detrás de `locations.length > 1`: la aserción pasaba por ausencia.
- **El arreglo (Fase 1b)**: el historial de cierres salió de Caja y vive en `/admin/history/cierres`, donde el
  filtro de sucursal es un **`Select`** (ancho de columna, no un segmentado de botones con `whitespace-nowrap`).
  El control que desbordaba dejó de existir; en `/admin/cash` el selector de sucursal del turno también es un
  `Select`.
- **Cómo se reprodujo con 2 sucursales** (la base local tiene una): se creó una segunda sucursal con la **API
  real del panel** (`POST /api/admin/locations` → 201) durante la verificación, se midió en navegador real a
  375 px y se borró al terminar (`DELETE /api/admin/locations/{id}` → 200; `SELECT` posterior: **1** sucursal,
  sin residuo). Capturas: `ops/tasks/audit-ui/cash-fase1b-cierres-2sucursales-375.png` y
  `cash-fase1b-reporte-2sucursales-375.png`.
- **Qué se midió** (375×800, con 2 sucursales): `/admin/cash` → `scrollWidth` **375**, desborde **0**;
  `/admin/history/cierres` → **375 / 0**; `/admin/cash/report` (que ahora aloja la conciliación) → **375 / 0**.
  Cero elementos con `right > viewport` en las tres.
- **Alcance de la evidencia**: el arreglo está medido en local con la misma cantidad de sucursales (2) **y
  verificado en producción** con las **3 reales** (ver abajo).

#### Verificación en producción (2026-09-22, `build-20260922-142614`, commit `46282a7`)

- **`/admin/cash` a 375×800**: `scrollWidth` **375** contra viewport 375, desborde **0** y **0** elementos
  con `right > viewport`. La línea de base medida en la auditoría era **438** (63 px de desborde).
- **`/admin/history/cierres` a 375×800**: **375/0**, con el filtro de sucursal como `Select`
  («Sucursal de los cierres» + «Cajero de los cierres») — el segmentado de botones que desbordaba ya no
  existe. La lista muestra el **rango abierto→cerrado y el fondo** de cada turno
  (`Turno 18/09/2026, 07:54 a. m. → 18/09/2026, 08:00 a. m. · fondo C$1,000.00`) y ofrece **Exportar CSV**.
- **`/admin/cash/report` a 375×800**: **375/0**, con la **conciliación** montada (h2 «Conciliación» y su
  región).
- **`/admin/cash/config`**: accesible con la cuenta owner («Config de Caja» + «En construcción»).
- **CONTROL del sidebar**: `POS · Caja · Cierres · Aprobaciones · Config de Caja`.
- Capturas: `ops/tasks/audit-ui/cash-prod-cash-375.png`, `cash-prod-cash-1280.png`,
  `cash-prod-history-cierres-375.png`, `cash-prod-cierres-rango-csv-375.png`,
  `cash-prod-cash-report-375.png`, `cash-prod-cash-config-1280.png`.
- **Smokes del deploy**: menú **7/7** y hosts **6/6**.

### A-43 · La cabecera del panel mide 23,3% del viewport a 375 px — `reportado` (agente, 2026-09-19)

- **Qué es**: la cabecera de pantalla (`AdminPageHeader`, `admin-operational-ui.tsx`) mide **186 px** a
  375×800 = **23,3%** del alto, por encima del **≤20%** que pide `design-system.md` §8.4; a 1280×800 mide
  **114 px** (14,2%, dentro de la regla). Se midió en la pantalla de Caja, pero el componente es de **todas**
  las pantallas del panel (más el chrome del shell: 16 px a 375).
- **Contexto**: medido en la auditoría de `/admin/cash` y **otra vez después** de la Fase 1a del rediseño:
  **el número no cambió** (186 px antes y después), así que no lo introdujo el rediseño.
- **Decisión del owner (2026-09-19)**: deuda declarada, **otro PR** — no se toca en la Fase 1b.
- **Qué falta**: decidir si la descripción se colapsa a una línea, si la cabecera baja de tamaño en móvil o si
  la regla del 20% se reinterpreta para el panel (el encabezado no es una barra de filtros).

### A-40 · El cajero ve «Ver el turno abierto» y el detalle lo rebota — `cerrado` (2026-09-19, Fase 1a del rediseño de Caja)

- **Qué era**: `cash-drawer-panel.tsx:240-247` dibujaba el enlace **para todo el que veía el panel** (o sea
  también el cajero, `canUsePOS`), y `/admin/cash/history/[id]` redirige a `/admin/orders` a quien no tiene
  `canViewCashHistory` (`history/[id]/page.tsx:60-62`). El cajero tenía un enlace que lo sacaba de la
  pantalla sin explicar nada.
- **El arreglo**: el bloque del turno (`cash-turn-section.tsx`) recibe `canSeeShiftDetail` —que la página
  llena con `canAudit`— y dibuja el enlace **solo** a quien puede verlo.
- **Verificación**: TDD con **rojo observado** (`expected <a …></a> to be null` con el enlace sin condicionar)
  y verde después; el E2E del cajero suma la aserción de ausencia (`admin-cashier.spec.ts`).

### A-44 · Una lectura fallida se dibujaba como «sin caja abierta» — `cerrado` (2026-09-19, Fase 1a del rediseño de Caja)

- **Qué era**: `cash-drawer-panel.tsx:78-93` no miraba `response.ok` —un **401** (sesión vencida), un 403 o un
  500 se veían igual que una caja cerrada— y no limpiaba el `error` anterior al reintentar.
- **El arreglo**: `use-cash-shift.ts` chequea el estado, propaga el mensaje del servidor, limpia el error al
  leer bien y separa el **error de lectura** (que manda la pantalla al estado *error*, con «Reintentar») del
  **error de acción** (abrir/cerrar), que se muestra al lado de lo que se estaba haciendo.
- **Verificación**: TDD con **rojo observado** en el hook (`expected 'ready' to be 'error'`) y en la vista
  (el estado *error* no existía); verde después, incluido el reintento que devuelve la pantalla al estado real.

## 2b. Deuda de TDD medida por el gate (2026-09-17)

> **Qué es**: el gate `src/shared/contracts/tdd-contract.test.ts` (pedido del owner) mide qué código
> existe **sin test**. La deuda vieja quedó **congelada con su motivo** dentro del gate y **no crece**:
> un archivo nuevo sin test lo pone en rojo. Esta sección es el inventario para bajarla; **no se arregla
> ahora** (decisión del owner: va a backlog).

**Resumen**: **41 archivos** sin test — **11 rutas API**, **23 casos de uso** y **7 primitivos de UI**.

**🔴 Críticas (plata o sesión)**

| Qué | Archivo | Por qué es crítica |
|---|---|---|
| T-01 | `src/app/api/admin/pos/shift/route.ts` | Abrir y cerrar la caja (**ya tienen test** desde el 2026-09-18: `open/route.test.ts` y `close/route.test.ts`); falta el `GET` que lee el turno abierto. Hoy solo lo cubre el E2E del POS |
| T-02 | `src/app/api/coupons/validate/route.ts` | Valida el cupón que descuenta plata |
| T-03 | `src/app/api/auth/admin/logout/route.ts` | Cierra la sesión del panel |
| T-04 | `src/modules/pos/features/close-pos-shift/close-pos-shift.ts` | Resuelve el turno del local y delega el cierre |
| T-05 | `src/modules/auth/features/{get-admin-session,logout-admin,require-admin-session}` | La puerta de sesión del panel (hoy mockeada por los tests de ruta) |

**🟡 Medias (CRUD del admin y primitivos muy usados)**

| Qué | Archivo | Por qué |
|---|---|---|
| T-06 | `src/shared/ui/{input,card,badge,checkbox,radio-group,status-progress,public-confirmation-shell}.tsx` | **7 primitivos sin test propio**: los mide el E2E a 375/1280 px, no la unidad |
| T-07 | `src/modules/menu/features/{create,delete}-subcategory`, `update-category`, `create-marketing-block`, `get-admin-product`, `list-admin-{products,subcategories,marketing-blocks}` | ABM del catálogo: cubierto por el test de su ruta, sin test del caso de uso |
| T-08 | `src/modules/locations/features/{list-location-catalog,set-location-product}` | Precio por local |
| T-09 | `src/modules/dashboard/features/{get-daily-report,get-dashboard-summary,get-recent-activity,get-inventory-report}` | Reportes |

**🟢 Bajas (fuera del MVP)**

| Qué | Archivo | Por qué |
|---|---|---|
| T-10 | `src/app/api/admin/inventory/{items,receive,waste}/route.ts` | Inventario: fuera del MVP |
| T-11 | `src/app/api/admin/reservations/**` (3 rutas) | Reservas: fuera del MVP |
| T-12 | `src/app/api/customer/auth/{logout,verify-otp}/route.ts` | Auth de cliente sin proveedor real (503 en prod) |
| T-13 | `src/modules/orders/features/list-public-delivery-zones/list-public-delivery-zones.ts` | Delivery: fuera del MVP |
| T-14 | `src/modules/inventory/features/shared/inventory-idempotency.ts` | Inventario: fuera del MVP |

**Criterio de bajada**: el archivo que recibe su test borra su fila de `EXCEPTIONS` (si sobra, el
contrato falla). **Ninguna fila nueva se agrega**: eso es lo que el gate impide.

## 3. Registro de lo cerrado

| ID | Qué se cerró | Commit | Verificación |
|---|---|---|---|
| A-01 · A-07 | La home y el footer muestran la información de **cada sucursal activa** (nombre, dirección, horario y "Cómo llegar", de `GET /api/locations`) y el footer deja de imprimir el horario y la ciudad de la configuración del negocio | `83d7433` | 1560 unitarios en 245 archivos (el test del footer se confirmó **rojo** primero), lint, typecheck, `build:webpack` y `security:secrets` en verde; **CI verde** (`verify` + `migrations` + `container` + `publish`, run `34767909489`). **E2E de navegador corrido el 2026-09-13**: 88 pasaron / 6 salteados / 0 fallos (375 px home y 1280 px footer); dejó un hallazgo de arnés, arreglado en `cef9a1c`. **En producción desde el 2026-09-13** (`ea6be95`): los dos casos nuevos verdes contra `menu.oneburgernic.com` y las tres sucursales reales en pantalla |
| A-08 | La marca (isotipo + nombre) se ve **en todos los anchos**, incluido celular, en el header de las secciones principales | `f0366c8` | TDD en navegador real: el caso nuevo se confirmó **rojo** contra el build viejo (`element(s) not found` a 375 px) y verde después; 1560 unitarios en 245 archivos, lint, typecheck, `build:webpack`, `security:secrets`, **E2E 88/6/0** y **CI verde** (`verify` + `migrations` + `container` + `publish`, run `34770351646`). **En producción desde el 2026-09-13** (`ea6be95`): 2/2 contra `menu.oneburgernic.com` |
| A-40 · A-44 | **A-40**: el enlace «Ver el turno abierto» se ofrece solo a quien puede ver el detalle (el detalle rebotaba al cajero). **A-44**: una lectura fallida del turno ya no se dibuja como «sin caja abierta» — se chequea `response.ok`, se muestra el mensaje del servidor y hay estado de error con «Reintentar». Va con la Fase 1a del rediseño de Caja (cuatro estados, nombres de §14 y Control nuevo del sidebar) | rama `feat/cash-redesign` | TDD con **rojo observado** en los dos casos (A-40: `expected <a …></a> to be null`; A-44: `expected 'ready' to be 'error'`) y verde después; suite de `src/app/(admin)` + `src/modules/auth` en verde; la verificación completa de la fase (test, lint, typecheck, build, build:webpack, E2E y capturas 375/1280) queda en el PR |
| Carrito (bug de checkout, hallado en el Bloque 13.3 del POS) | **El carrito guardado se pisaba antes de leerlo**: entrar a `/checkout` con el carrito lleno mostraba «Tu carrito está vacío» (el efecto que guarda corría en el primer render y escribía `[]` encima de lo guardado; con el doble montaje de StrictMode el pedido se perdía) | `42c5d98` | Test primero en `src/shared/lib/cart.test.tsx` (5 casos, rojo por la razón correcta con el provider bajo `StrictMode`); suite completa 2318/2318; **E2E de comandas 5/5** (antes 3/5) contra el server de desarrollo, y medido en el navegador (`localStorage` `[]` en `/checkout` antes, carrito intacto después) |
