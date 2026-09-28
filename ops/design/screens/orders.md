# Spec de pantalla — Pedidos (`/admin/orders`)

> **Plantilla**: [`TEMPLATE.md`](TEMPLATE.md).
>
> **Estado: spec corregida por `TASK-ORDERS-KITCHEN-FOUNDATIONS-001`** (docs-only, 2026-09-27) sobre el
> discovery de `TASK-ORDERS-001` (2026-09-26). **Nada de esta corrección está implementado**: lo entregado
> por `SCREEN-ORDERS-001` sigue siendo lo que corre en producción.
>
> **Qué cambió y por qué**:
>
> 1. **El tablero de comandas deja de vivir acá.** Cocina es una **superficie distinta** y tiene su propia
>    spec: [`kitchen.md`](kitchen.md). `/admin/orders` queda como el **read model denso y paginado** para
>    **localizar y revisar** pedidos.
> 2. **Se corrigen las premisas obsoletas del discovery**, incluida la afirmación de que «no se pide ningún
>    dato nuevo / no hay `FALTA`»: la auditoría de la TASK de fundaciones encontró **seis** datos que el
>    backend todavía no tiene (§ *Datos disponibles*).
> 3. **Referencia nueva aprobada por el owner el 2026-09-27**:
>    [`orders-desktop-reference.html`](orders-desktop-reference.html) (vistas de **listado** y **detalle**),
>    que **reemplaza** a `orders-prototype.html` como contrato de composición.
>
> **Prohibiciones que esta spec respeta**: no inventa estados ni métricas, **no calcula dinero**, no mueve
> reglas del dominio a React, no hardcodea sucursales y **no mezcla Caja, Cocina, Analytics ni configuración**
> dentro de Pedidos.

---

## Reuse audit

**Objetivo**: localizar un pedido (del turno o viejo) y revisarlo con su historia, sus items y su estado de
cobro, sin depender de la memoria del turno.

**Capacidad existente**: el listado y su saneamiento de filtros (`readAdminOrders`, `sanitizeOrderQuery`), la
búsqueda (`order-search.ts`), el alcance por sucursal (`order-visibility.ts`, `order-scope.ts`), el detalle y
su composición (`getOrder`, `get-order.ts`), los totales (`order-totals.ts`), el recorrido de estados
(`order-workflows.ts`), la factura (`invoices`) y **Cocina** para operar las comandas.

**Se reutiliza**: los filtros en la URL, el alcance, la búsqueda, el detalle y su `GET`, los totales del
pedido y el documento de factura. **No** se reutiliza la forma de la query actual como solución final (ver
*Fuera de scope*).

**Realmente nuevo**: los tres contratos de lectura (`OrderListProjection`, `OrderDetailProjection`,
`KitchenOrderProjection`) **sin dominios nuevos**; la paginación con KPI calculados sobre el **filtro
completo**; y el **canal de origen** (`Order.source`), que la referencia muestra y el modelo no tiene.

---

## Ruta

`/admin/orders` (listado denso y paginado), `/admin/orders/[id]` (detalle) y
`/admin/orders/[id]/invoice/print` (hoja de 80 mm, fuera de pantalla). Sin rutas nuevas.

## Módulo

**`orders`** es el dueño: `Order`, items, ciclo de vida, **scheduling y tiempos de etapa**
([`../../product/MODULE_ARCHITECTURE.md`](../../product/MODULE_ARCHITECTURE.md) §5). La pantalla **consume**
`locations` (umbrales y punto de retiro), **`payments`** (estado financiero: `pending` / `partial` / `paid`,
`paidAmount`, `outstandingAmount`), `money` (moneda y conversión), `invoices` (documento) y `auth` (puertas).
**Pedidos no es dueño de ninguna de esas reglas** y no las reimplementa.

## Usuario / roles

Modelo objetivo del owner (`D-014`); **el contrato de permisos se implementa en la TASK de esta superficie**,
no acá.

| Rol | Qué hace acá | Qué **no** ve |
|---|---|---|
| `owner` | todo | — |
| `manager` | localiza, revisa y opera, según su alcance por sucursal | — |
| `cashier` | **localiza el pedido que tiene que cobrar** y lo cobra desde el flujo canónico | no opera Cocina, no administra ni anula el pedido, no ve la cola de cocina |
| `kitchen` | **no entra**: su superficie es [`kitchen.md`](kitchen.md) | nada de esta pantalla |

Hoy esto **no** se cumple: la entrada se le ofrece a los cuatro roles (`admin-layout-helpers.ts:97`), la API
le responde **403** al `cashier` (`api/admin/orders/route.ts:59`) y la pantalla lo muestra como «Sesión de
administrador requerida», que es falso (`A-66`). La puerta objetivo `canViewOrders` cierra esa contradicción;
la financiera (`canViewOrderFinancials`) es la que hoy falta y deja que `kitchen` lea montos, PIN, cobros y
factura (`A-60`).

## Propósito

Una frase: **encontrar un pedido y entender qué le pasó** —con su historia, su plata y su documento— sin
depender del turno. Operar la comanda es de Cocina (`kitchen.md`) y cobrar es del POS.

## Preguntas

1. **¿Cuál es el pedido que busco?** (número, cliente, WhatsApp, PIN, local, fecha, estado, pago)
2. **¿Cómo viene el conjunto?** (cuántos, cuántos activos, cuántos sin cobrar, cuántos programados)
3. **¿Qué le pasó a este pedido?** (recorrido con horas, quién lo movió, items, totales, cobros, factura)
4. **¿Qué puedo hacer con él?** (avanzar la etapa que no es de cocina, cobrar en el POS, emitir la factura)

## Decisiones

- Se decide **localizar y filtrar** (búsqueda, fecha, local, estado, pago, programados) y **revisar**.
- Se decide **cerrar la etapa del mostrador**: **Retirado** (`ready_for_pickup → picked_up`) y **Cerrar**
  (`picked_up → closed`) — la retirada **no** es de cocina.
- Se decide **rechazar** un pedido (`→ cancelled`, motivo obligatorio).
- Se decide **emitir la factura** e **imprimir** el ticket (sólo quien puede cobrar).
- **No** se decide acá: cocinar (Cocina), cobrar ni devolver (POS / Caja), anular un cobro (Aprobaciones),
  editar el menú ni tocar la configuración del local.

## Contratos de lectura (declarados, **no** implementados acá)

Tres proyecciones de `orders`, sin crear dominios. Ninguna reimplementa una regla de otro dueño.

### `OrderListProjection` (listado denso y paginado)

| Campo | Fuente |
|---|---|
| `id`, `orderNumber`, `status`, `createdAt` | `orders` |
| `source` (canal: menú / POS) | `orders` — **FALTA** el campo |
| `customerName`, `customerWhatsapp`, `locationName` | `orders` + `locations` |
| `pickupTime`, `pickupScheduled` | `orders` |
| `total` | `orders` (`calculateOrderTotals`) |
| `financialState`: `state` (`pending` \| `partial` \| `paid`), `paidAmount`, `outstandingAmount` | **`payments`** — **FALTA** |
| `elapsedInStage` (chip de la etapa en curso) | `orders` (`stageChangedAt`) |

- **Paginación**: `page`, `pageSize` y `total`. Entra en la implementación.
- **KPI del header** (`N pedidos · N activas · N pendientes de pago · N programadas`): se calculan sobre el
  **filtro completo**, **no** sobre la página visible: vienen del servidor en `meta`, como un agregado
  separado de la página.
- **Nunca** viajan: `orderLookupTokenHash`, `customerLat`/`customerLng`/`geoAccuracy`/`geoCapturedAt`, los
  items completos ni el historial de estados (`A-61`).

### `OrderDetailProjection` (detalle)

Todo lo del listado **más**: items con modificadores, notas y precio por línea; punto de retiro; recorrido
completo de estados con **hora y actor** (`OrderStatusHistory.changedByUserId`, hoy guardado y no mostrado:
`A-09`); los sellos de etapa (`confirmedAt`, `preparingAt`, `readyAt`, `pickedUpAt`, `closedAt`, derivados en
**un** lugar de `orders`); los cobros y el **estado financiero** de `payments`; el `pickupPin` y la factura de
`invoices`. **Prohibido** que el detalle derive el saldo comparando `Order.total` contra los pagos en React.

### `KitchenOrderProjection`

Contrato de Cocina, **sin un solo campo de dinero**: [`kitchen.md`](kitchen.md) § *Datos disponibles*.

## Datos disponibles

> **Corrección expresa de una premisa obsoleta.** El discovery de `TASK-ORDERS-001` afirmaba: «No se pide
> ningún dato nuevo y **no hay `FALTA`** para esta sección». **Es falso.** La auditoría de
> `TASK-ORDERS-KITCHEN-FOUNDATIONS-001` encontró **seis** datos que el backend no tiene, y todos tienen dueño
> y dependencia:

| # | `FALTA` | Dueño | Depende de |
|---|---|---|---|
| 1 | **Canal de origen** (`Order.source`): la etiqueta `MENÚ` / `POS` del listado y del detalle | `orders` | migración aditiva + escritura en las **dos** puertas de creación (checkout público y venta del POS). **Prohibido** inferirlo |
| 2 | **Estado financiero del pedido** (`pending` / `partial` / `paid`, `paidAmount`, `outstandingAmount`) | `payments` | la consolidación de Money/Payments; **no** se calcula en React |
| 3 | **Sellos por etapa** (`confirmedAt`, `preparingAt`, `readyAt`, `pickedUpAt`, `closedAt`) | `orders` | derivación desde `OrderStatusHistory` en una sola función |
| 4 | **Inicio recomendado** del programado (`pickupTime − Location.pickupLeadMinutes`) | `orders` + `locations` | la función que lo deriva, una sola vez |
| 5 | **Paginar y agregar**: `page`/`pageSize`/`total` y los cuatro KPI del header | `orders` | el read model del listado |
| 6 | **Hora prometida en los pedidos del POS**: hoy `pickupTime` es `null` | `orders` | decisión de producto si el POS debe prometer una hora; hasta entonces el copy dice «lo antes posible» |

Lo que **sí** existe hoy (y se reutiliza): estado, `stageChangedAt`, `readyAt`, `pickupTime`,
`pickupScheduled`, items con modificadores y notas, totales, medio de pago declarado, PIN, `locationName`,
`payments[]` (detalle) y `averagePrepMinutes` (meta).

**No se muestra** (no existe o no corresponde): quién cambió el estado (el dato **existe** y esta spec lo
suma al detalle: `A-09`), y el historial crudo como tabla (se muestra como recorrido).

## Jerarquía

```text
1. ENCONTRARLO         → búsqueda + filtros en la URL
2. CÓMO VIENE EL DÍA   → los cuatro KPI del filtro completo
3. EL PEDIDO           → número, canal, cliente, cuándo, estado, total y si está cobrado
4. EL DETALLE          → recorrido, items, retiro, cobros, documentos
5. LA ACCIÓN           → una sola acción primaria por contexto
```

## Listado (composición)

| Columna | Contenido |
|---|---|
| **Pedido** | número en `font-mono` + etiqueta de **canal** (`MENÚ` / `POS`) |
| **Cliente** | nombre + WhatsApp · local |
| **Cuándo** | hora prometida + `ASAP` / `PROGRAMADO` |
| **Estado** | chip del estado, con el tiempo en la etapa cuando está en preparación |
| **Total / pago** | total en `font-mono` + `PAGADO` / `PENDIENTE` / `SIN COBRO` |
| — | flecha de apertura del detalle |

Fila **densa** (≈84 px), encabezado fijo, scroll **del listado** (no de la página), orden por más recientes.
Filtros en la **URL**: búsqueda, fecha (hoy · ayer · 7 días · 30 días), local, estado, pago y programadas
(hoy el de estado es estado de React: `A-62`).

## Detalle (composición)

`Pedido` (items con modificadores y notas) · `Cliente` (nombre, WhatsApp, PIN de retiro) · `Retiro`
(modalidad, hora, local) · `Historial real` (línea de tiempo con hora y actor) · `Pago` (subtotal, empaque,
descuento, total, **pagado**, **pendiente**, medio) · `Operación` (creado, confirmado, inicio de preparación,
terminado, tiempo de preparación, listo desde) · `Documentos` (factura + ticket del cliente).

Los paneles **Pago**, **Documentos** y el **PIN** se dibujan sólo con la capacidad financiera; el recorte se
aplica **en el servidor** (`A-60`), no escondiendo el bloque en React.

## Estados

Cargando · con datos · sin pedidos en el rango · sin coincidencias (con el término buscado) · error sin datos ·
error con datos (bandeja vieja: «No se pudo actualizar. Última actualización hace N min.» + reintentar) · sin
permiso (mensaje de permiso, **no** de sesión) · página fuera de rango.

## Empty / error / loading

- **Vacío**: «Sin pedidos en este rango» + «No hay pedidos para los filtros seleccionados.»
- **Sin coincidencias**: «Sin coincidencias» + «Ningún pedido coincide con «{término}».»
- **Sin permiso**: mensaje propio de permiso. Prohibido «Sesión de administrador requerida» con sesión válida
  (`A-66`).
- **Error con datos**: se conserva lo último leído y se dice **cuándo** se leyó.

## Desktop

A 1280 y 1366: cabecera compacta en una línea (título + contexto de sucursal + KPIs + actualizar), filtros en
una línea, encabezado de tabla fijo y el resto del alto para el listado. El detalle en dos columnas
(izquierda: pedido, cliente, retiro, historial; derecha: pago, operación, documentos). Scroll de página **0**.

## Tablet

A 768: los filtros envuelven en dos filas y el detalle pasa a **una** columna.

## Mobile

A 375: buscador a todo el ancho, filtros plegados, filas en dos líneas sin scroll horizontal, barra inferior
del panel respetada (`pb-24`); el detalle en una columna con los documentos al final.

## Viewport contract

| Viewport | Listado | Detalle |
|---|---|---|
| `1366×768` | cabecera, filtros, encabezado de tabla y ≥6 filas | los paneles principales en el primer viewport |
| `1280×720` | ídem | ídem |
| `768×1024` | cabecera, filtros en dos filas y ≥5 filas | una columna, sin scroll horizontal |
| `375×812` | cabecera, buscador, el KPI del filtro y la primera fila | estado + acción principal arriba |

En todos: scrollea el **listado** (o el detalle), nunca la página.

## Referencia aprobada

[`orders-desktop-reference.html`](orders-desktop-reference.html) — **aprobada por el owner el 2026-09-27**,
versionada acá sin modificarla. Contiene las dos vistas (**listado** y **detalle**) y `Reference Fidelity`
la trata como contrato de composición, jerarquía, densidad y responsive: se traduce a los componentes reales
(**no** se copia el HTML).

**Reemplaza** a [`orders-prototype.html`](orders-prototype.html), que queda como **prototipo histórico** de
`TASK-ORDERS-001` (no es contrato y no se cita como autoridad).

**Divergencias declaradas de entrada** (las decide el owner, no el código):

| Elemento de la referencia | Qué se hace | Por qué |
|---|---|---|
| Etiqueta `MENÚ` / `POS` | se implementa, **depende de `Order.source`** | el dato no existe hoy; en un pedido histórico sin declarar la fila sale **sin** etiqueta |
| `PENDIENTE` / `PAGADO` y el KPI «N pendientes de pago» | se implementan, **dependen de `payments`** | no existe un estado financiero canónico; hasta entonces el pago no se muestra |
| `PIN retiro` en el detalle | sólo con la capacidad financiera | cocina no lo ve (`A-60`) |
| Historial con «Pedido creado desde POS» | se implementa, depende de `Order.source` | el texto del evento no se puede afirmar sin el dato |
| «Factura — se genera al completar el cobro» | **no** se implementa | hoy la factura **no** se automatiza al cobrar; el copy miente |

## Qué se elimina

- El **tablero de comandas** de esta pantalla (carriles, conmutador, modo cocina, «Esperando solicitudes»):
  vive en [`kitchen.md`](kitchen.md).
- La **tarjeta resumen «Órdenes en vista»** y los contadores duplicados: los KPI son del filtro completo.
- La **descripción larga** de la cabecera: la pantalla es una bandeja, no una landing.
- El pulso en reposo (queda sólo el SLA vencido, y en Cocina).
- El copy «hoja A4» (la hoja es de **80 mm**).
- Los **cinco mapas estado→etapa** y los cuatro formateadores de tiempo: un mapa canónico en
  `orders/domain` y un formateador de «hace cuánto».
- El enlace a `/api/admin/orders/[id]/delivery-fee` sin llamador (**al backlog**, no se toca).

## Fuera de scope

- **Cocina** (`/admin/kitchen`): otra superficie, otra spec.
- **Cobrar** (POS), **devolver** (Caja) y **anular un cobro** (Aprobaciones).
- **Reformar `Invoice`**, su snapshot o su puerta de emisión.
- **Cambiar el esquema**: `Order.source` se declara acá y lo implementa la TASK de Cocina runtime.
- **Reescribir el módulo `orders`**: la spec no cambia dominio, puertos ni endpoints.
- **La forma actual de la query como solución final**: hoy trae `items` + `modifiers` + el historial completo
  de **todas** las filas y **no** pagina (`prisma-order-repository.ts:503-518`): es una premisa a **corregir**
  por el read model, no la base de la pantalla nueva.

## Estado de implementación (`SCREEN-ORDERS-001`, ya en producción)

Entregado con test y capturas ([`orders-after-1280.png`](orders-after-1280.png),
[`orders-after-375.png`](orders-after-375.png), detalle incluido):

| Cambio | Evidencia |
|---|---|
| Pulso fuera de reposo: chip «Esperando solicitudes» y punto de «Nuevas» | Test de la toolbar y del carril + QA de navegador |
| Copy de la factura: hoja de **80 mm**, no A4 | `order-invoice-panel.test.tsx` |
| Radio del panel (`rounded-stitch-md`) en bloques de estado y error | Contrato de UI |
| Anuncio accesible de atraso con el **umbral del local** | Test que discrimina por umbral del local |
| Barra compacta en celular | QA 375/768/1280, sin scroll horizontal |

## Design Freeze

Aprobadas esta spec y [`orders-desktop-reference.html`](orders-desktop-reference.html) (owner, **2026-09-27**),
quedan **congeladas** la composición, la information architecture y el comportamiento principal del listado y
del detalle. Una desviación **material** modifica **primero** la spec y la decide el owner; si aparece durante
la implementación, es **Stop Condition**.

## Deuda registrada (no corregida acá)

- `kitchen` lee montos, PIN, cobros y factura en el detalle (`A-60`).
- `GET /api/admin/orders` proyecta de más y filtra de menos, sin paginar (`A-61`).
- El filtro de estado no vive en la URL (`A-62`).
- Las fechas del detalle usan la zona del navegador (`A-63`).
- Cinco mapas estado→etapa y cuatro formateadores duplicados (`A-64`).
- Alias históricos (`text-st-*`) y colores semánticos viejos, con techo propio (`A-65`).
- El `cashier` ve la entrada y recibe 403, con un mensaje que miente (`A-66`).
- El actor del cambio de estado se guarda y no se muestra (`A-09`).
- **Nuevos de la auditoría de fundaciones**: la ruta de la factura sin puerta de rol ni alcance por sucursal,
  y el cobro de un pedido existente sin clave de idempotencia (`A-70` y `A-71`).
