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
> **Fecha de apertura**: 2026-09-12 · **Rama**: `main` · **Estado**: esperando los ítems del owner.

## 1. Índice

Estados: `reportado` · `a reproducir` · `en curso` · `cerrado` · `no-repro` · `decisión-pendiente` ·
`bloqueado` (espera algo del owner) · `descartado` (con motivo).

| ID | Qué se reportó | Tipo | Sev. | Estado | Commit |
|---|---|---|---|---|---|
| A-01 | El **footer** y el bloque **"Información del restaurante"** de la home muestran horario, ciudad y dirección de la **configuración del negocio**, no del local: con 3 locales reales la información no corresponde al local del pedido | decisión | P2 | `decisión-pendiente` | — |
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
- **Contrato a respetar** (cualquiera sea la opción): salir de `GET /api/locations` (que ya devuelve
  solo los activos y **no** expone teléfono ni WhatsApp internos del local), nunca hardcodear datos.
- **Es el ítem que puedo implementar entero** en cuanto el owner elija la opción.
- **Referencias**: `ops/project-state.md` §2 ("T8 · Fase 7, cierre" — gap declarado).

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
| — | *(todavía sin ítems cerrados en este ciclo)* | — | — |
