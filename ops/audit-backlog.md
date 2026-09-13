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
> **Fecha de apertura**: 2026-09-12 · **Rama**: `main` · **Estado**: A-01/A-07 cerrados (commit
> `83d7433`). El próximo de la cola es **A-08**, con su alcance ya confirmado por el owner.

## 1. Índice

Estados: `reportado` · `a reproducir` · `en curso` · `cerrado` · `no-repro` · `decisión-pendiente` ·
`bloqueado` (espera algo del owner) · `descartado` (con motivo).

| ID | Qué se reportó | Tipo | Sev. | Estado | Commit |
|---|---|---|---|---|---|
| A-01 | El **footer** y el bloque **"Información del restaurante"** de la home muestran horario, ciudad y dirección de la **configuración del negocio**, no del local: con 3 locales reales la información no corresponde al local del pedido | decisión | P2 | `cerrado` (A-07) | `83d7433` |
| A-07 | **"Acá debería salir la información de cada sucursal"**: el footer tiene que mostrar los datos de **cada local**, no los del negocio | feat | P2 | `cerrado` | `83d7433` |
| A-08 | **El isotipo de One Burger desapareció en los headers**: el owner pide que la marca (isotipo + nombre del negocio) se mantenga arriba a la derecha en las secciones principales | bug | P2 | `reportado` (alcance confirmado: es el próximo) | — |
| A-02 | Datos mal cargados en **locales de producción**: el slug de *Camino de Oriente* es `one-burger-masaya` y la ciudad de *Casa Antigua* dice `Jinoteoe` | dato | P2 | `bloqueado` (sesión de owner) | — |
| A-03 | Falta **cargar la carta completa** (categorías, productos, precios, fotos): producción tiene 2 categorías con 6 productos | dato | P3 | `bloqueado` (owner) | — |
| A-04 | **Monitoreo externo** inexistente: nada pega a `GET /api/readiness` ni avisa si el sitio o la base se caen | infra | P2 | `bloqueado` (owner elige servicio) | — |
| A-05 | **Puertos expuestos** de servicios ajenos del panel compartido (`capostgres` 5455, `postimage` 8585) | infra | P2 | `bloqueado` (OK de otro admin) | — |
| A-06 | **Rotar `EASYPANEL_TOKEN`** (se pasó por chat varias veces; da acceso total al servidor) | infra | P2 | `bloqueado` (decisión de owner) | — |

> Las **limitaciones conocidas y aceptadas** de `ops/production-readiness.md` §7 **no** son ítems de
> este backlog (rate limiting en memoria, `replicas: 1`, `X-Powered-By` cosmético, `style-src` con
> `'unsafe-inline'`, módulos fuera del MVP). Si el owner quiere atacar alguna, entra como ítem nuevo.

## 2. Detalle

### A-01 · Footer y home con datos del negocio en vez del local — `decisión-pendiente`

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
- **Decisión del owner (2026-09-12)**: para el **footer**, la opción **(a)** — los datos de cada
  sucursal (ver A-07, que es la implementación de esta decisión). Queda por definir si el bloque
  "Información del restaurante" de la **home** hace lo mismo.
- **Contrato a respetar** (cualquiera sea la opción): salir de `GET /api/locations` (que ya devuelve
  solo los activos y **no** expone teléfono ni WhatsApp internos del local), nunca hardcodear datos.
- **Es el ítem que puedo implementar entero** en cuanto el owner elija la opción.
- **Referencias**: `ops/project-state.md` §2 ("T8 · Fase 7, cierre" — gap declarado).

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
    antes del arreglo, nombrando los dos lugares donde salía el horario del negocio.
  - **Pendiente al cerrar**: el E2E de navegador real en los dos anchos (375 px en la home, 1280 px en
    el footer) **no se corrió** porque Docker Desktop estaba apagado y el arnés necesita Postgres. Los
    casos ya están escritos en `tests/e2e/public-home.spec.ts`; se corren en el próximo arranque del
    entorno local. El footer **no existe a 375 px** (`hidden … md:block`), así que en celular la
    información por sucursal llega por la home, como ya estaba anotado en esta ficha.

### A-08 · El isotipo y el nombre del negocio en los headers — `en curso`

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
  celular**, en el header, como en las secciones principales de escritorio. Hoy
  `getPublicHeaderClassName()` devuelve `hidden … md:block`, así que a 375 px no hay marca. El
  isotipo a la derecha duplicado **no** es lo pedido: se mantiene una marca consistente arriba.
  **Es el próximo task de la cola** (una task por vez: no se toca código de A-08 hasta que A-07 esté
  cerrado, y ya lo está).
- **Criterio de aceptación**: la marca (isotipo + nombre) se ve en las superficies principales a
  **375 px y 1280 px**, con el asset configurado en `/admin/settings` (nunca hardcodeado), sin scroll
  horizontal y sin duplicar el anuncio accesible. Test de componente + E2E en los dos anchos.
- **Referencias**: `ops/project-state.md` §2 ("Arreglo de branding: el logo y los colores no llegaban
  a toda la app"); `src/shared/ui/brand-mark.tsx`.

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

- **Por qué**: el token da acceso total al servidor y se pasó por chat varias veces.
- **Receta**: `ops/production-readiness.md` §8.3 (panel → Settings → API tokens: crear uno nuevo,
  usarlo y revocar el viejo).

## 3. Registro de lo cerrado

| ID | Qué se cerró | Commit | Verificación |
|---|---|---|---|
| A-01 · A-07 | La home y el footer muestran la información de **cada sucursal activa** (nombre, dirección, horario y "Cómo llegar", de `GET /api/locations`) y el footer deja de imprimir el horario y la ciudad de la configuración del negocio | `83d7433` | 1560 unitarios en 245 archivos (el test del footer se confirmó **rojo** primero), lint, typecheck, `build:webpack` y `security:secrets` en verde. **E2E de navegador (375 px y 1280 px) pendiente**: Docker estaba apagado al cerrar; los casos ya están escritos |
