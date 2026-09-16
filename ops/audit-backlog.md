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
> **Fecha de apertura**: 2026-09-12 · **Rama**: `main` · **Estado (2026-09-15)**: **A-01/A-07**
> (commit `83d7433`) y **A-08** (commit `f0366c8`) cerrados. **A-02 a A-06** están **bloqueados**: son
> datos, infraestructura o decisiones del owner, así que no hay task técnica para atacar sin que él diga
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
| A-06 | **Rotar `EASYPANEL_TOKEN`** (se pasó por chat cinco veces; da acceso total al servidor) | infra | P2 | `bloqueado` (decisión de owner) | — |
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
| A-19 | **No existen los movimientos de caja**: sin `CashMovement` (retiro/ingreso con motivo y responsable) ni configuración de caja en ningún lado; la propina en efectivo entra al cajón por decisión implícita (`close-shift.ts:143-144`) y la caja puede quedar abierta para siempre | decisión | P3 | `decisión-pendiente` (owner) | — |
| A-20 | **No hay un solo campo fiscal** (`ruc`/`taxId`/`fiscal`/`legalName`/`documentNumber`: cero coincidencias en `prisma/` + `src/**`) y `Customer` solo tiene nombre + WhatsApp (`schema.prisma:59-69`). El recibo es un **JPG sin logo y sin RUC** (`src/shared/lib/receipt-image.ts`) y **solo se emite desde el POS al cobrar**, no desde el detalle del pedido | decisión | P3 | `decisión-pendiente` (owner) | — |
| A-21 | **Documentación desactualizada en cuatro puntos verificados**: `DESIGN_SYSTEM.md §3.4:273` decía "2 literales de carga" (había **18** distintos), `§2.1:164` decía 15 tokens huérfanos (había **16**: también `--ring`, `globals.css:40`), `AGENTS.md:109` mandaba a `DESIGN_SYSTEM.md §5` por la lista de copy decorativo y **§5 no la tenía**, y `plna.md:546` afirma un `Payment.shiftId` que no existe. **Cerrado el 2026-09-15** (Capa 0 del plan de UI): los tres puntos del repo se corrigieron reescribiendo `DESIGN_SYSTEM.md` (los números viejos ya no existen: §2.1 y §3.4 se reescribieron) y `AGENTS.md` (el puntero a `§5` ahora es verdadero), y un contrato falla si `AGENTS.md` cita una sección que no existe. El cuarto punto es de `plna.md`, un documento **no versionado**: queda anotado en A-18 | documentación | P3 | `cerrado` | commit de la Capa 0 |
| A-22 | **Lo que no tiene guardrail se degrada**: la paleta cruda de Tailwind (**70** usos, igual que en TASK-201), `style={{ fontFamily }}` (**30**), `rounded-[Npx]` (**37** con 9 valores), ~20 sombras `rgba()` a mano y **46** valores arbitrarios de espaciado no tienen test; `DESIGN_SYSTEM.md §6:370` lo admite. En cambio lo que sí tiene contrato (`#hex`, controles crudos, registro de componentes) se mantiene estable | deuda | P3 | `reportado` (agente) | — |
| A-23 | **Cuenta de prueba con rol `owner` en producción** (`tester@oneburgernic.com`, 3 locales): es un acceso total más. Decidir si se mantiene, se degrada (p. ej. a `cashier`) o se borra | dato / infra | P3 | `decisión-pendiente` (owner) | — |

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

### A-06 · Rotar el `EASYPANEL_TOKEN` — `bloqueado` (decisión de owner)

- **Por qué**: el token da acceso total al servidor y se pasó por chat **cinco veces** (2026-09-10,
  2026-09-12, dos veces el 2026-09-13 —el deploy de A-07/A-08 y el de A— y **dos veces más el
  2026-09-14**: el deploy de las comandas y el de B6).
- **Receta**: `ops/production-readiness.md` §8.3 (panel → Settings → API tokens: crear uno nuevo,
  usarlo y revocar el viejo).
- **Ojo**: el `inspectService` del panel devuelve el `env` completo del servicio (incluye
  `DATABASE_URL` con su contraseña y `NEXTAUTH_SECRET`), así que quien tenga el token ve también esos
  secretos: no es solo acceso al panel.

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

## 3. Registro de lo cerrado

| ID | Qué se cerró | Commit | Verificación |
|---|---|---|---|
| A-01 · A-07 | La home y el footer muestran la información de **cada sucursal activa** (nombre, dirección, horario y "Cómo llegar", de `GET /api/locations`) y el footer deja de imprimir el horario y la ciudad de la configuración del negocio | `83d7433` | 1560 unitarios en 245 archivos (el test del footer se confirmó **rojo** primero), lint, typecheck, `build:webpack` y `security:secrets` en verde; **CI verde** (`verify` + `migrations` + `container` + `publish`, run `34767909489`). **E2E de navegador corrido el 2026-09-13**: 88 pasaron / 6 salteados / 0 fallos (375 px home y 1280 px footer); dejó un hallazgo de arnés, arreglado en `cef9a1c`. **En producción desde el 2026-09-13** (`ea6be95`): los dos casos nuevos verdes contra `menu.oneburgernic.com` y las tres sucursales reales en pantalla |
| A-08 | La marca (isotipo + nombre) se ve **en todos los anchos**, incluido celular, en el header de las secciones principales | `f0366c8` | TDD en navegador real: el caso nuevo se confirmó **rojo** contra el build viejo (`element(s) not found` a 375 px) y verde después; 1560 unitarios en 245 archivos, lint, typecheck, `build:webpack`, `security:secrets`, **E2E 88/6/0** y **CI verde** (`verify` + `migrations` + `container` + `publish`, run `34770351646`). **En producción desde el 2026-09-13** (`ea6be95`): 2/2 contra `menu.oneburgernic.com` |
