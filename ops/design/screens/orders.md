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
completo**; y el **canal de origen** (`Order.source`), que la referencia pide y el modelo **ya tenía**.

> **Corrección de una premisa obsoleta (2026-10-01, `TASK-ORDERS-RUNTIME-5B`)**: esta línea decía que
> `Order.source` «el modelo no tiene». **Falso desde `TASK-ORDERS-KITCHEN-RUNTIME-002`**: el campo existe
> (`Order.source`, `OrderSource`, escrito por las dos puertas de creación) y el read model lo **consume**. Lo
> que sí faltaba era el estado financiero **en esta pantalla** —la proyección existe desde
> `TASK-MONEY-PAYMENTS-RUNTIME-001`— y la capacidad `canViewOrderFinancials`, que existía **sin consumidor**.

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

Hoy esto **ya se cumple** (`TASK-ORDERS-RUNTIME-5B`, 2026-10-01): la entrada y las dos API usan la puerta
nominal `canViewOrders` (owner · manager · cashier), el `cashier` lista y abre pedidos, `kitchen` recibe
**403** y aterriza en `/admin/kitchen` con el resolutor único de landing, y el detalle deja de mostrarle
montos, PIN, cobros y factura. `canViewOrderFinancials` —que existía sin consumidor— es la puerta del recorte,
aplicada **en el servidor**.

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
| `source` (canal: menú / POS) | `orders` — **existe** (`Order.source`, `D-015`); `null` = no declarado |
| `customerName`, `customerWhatsapp`, `locationName` | `orders` + `locations` |
| `pickupTime`, `pickupScheduled` | `orders` |
| `total` | `orders` (`calculateOrderTotals`) |
| `financialState`: `state` (`pending` \| `partial` \| `paid`), `paidAmount`, `outstandingAmount`, `unresolvedAmount` | **`payments`** — **existe** (`getOrderPaymentStatus`); `Pedidos runtime` es quien lo **consume** |
| `stageChangedAt` (chip de la etapa en curso) | `orders` (`resolveStageChangedAt`) |

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
| Etiqueta `MENÚ` / `POS` | se implementa, **depende de `Order.source`** | el dato **ya se escribe** (`D-015`); en un pedido histórico sin declarar la fila sale **sin** etiqueta |
| `PENDIENTE` / `PAGADO` y el KPI «N pendientes de pago» | se implementan, **dependen de `payments`** | **el estado financiero canónico ya existe** (`getOrderPaymentStatus`); lo que falta es **consumirlo** en esta pantalla, y eso es de `Pedidos runtime` (5b) |
| `PIN retiro` en el detalle | sólo con la capacidad financiera | cocina no lo ve (`A-60`) |
| Historial con «Pedido creado desde POS» | se implementa, depende de `Order.source` | el texto del evento se puede afirmar: el canal se escribe desde `TASK-ORDERS-KITCHEN-RUNTIME-002` |
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

## Estado de implementación (`TASK-ORDERS-RUNTIME-5B`, 2026-10-01)

**Implementado y corregido acá**: el **read model** canónico —`OrderListProjection` paginada con los KPI del
filtro completo y `OrderDetailProjection` con el recorte financiero en el servidor—, la puerta nominal
`canViewOrders` (owner · manager · cashier; `kitchen` no entra y aterriza en `/admin/kitchen`), el resolutor
único de landing por rol, los siete filtros en la URL, el historial real con actor y los sellos por etapa, y
el cierre de la fuga lateral de la factura (`A-70`).

Lo que este documento daba por faltante y **el repo ya tenía** (se verificó y se corrigió la premisa):
`Order.source` (`D-015`), el estado financiero canónico de `payments` (`getOrderPaymentStatus`), los sellos
por etapa (`resolveOrderStageTimes`) y la capacidad `canViewOrderFinancials` — que **existía sin un solo
consumidor** y es la que esta TASK empezó a aplicar.

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

## Deuda registrada

> **Cerrada por `TASK-ORDERS-RUNTIME-5B` (2026-10-01)**: `A-09` (el actor del cambio de estado ya se muestra
> en el historial real), `A-10` (la home por rol existe y es única: `resolveAdminLanding`), `A-60` (el recorte
> financiero del detalle se aplica en el servidor), `A-61` (el listado proyecta lo mínimo, pagina y agrega en
> el servidor), `A-62` (el filtro de estado vive en la URL), `A-63` (las fechas del detalle usan la zona del
> negocio), `A-66` (el cajero entra y cocina recibe 403 y aterriza en Cocina) y la autorización mínima de
> `A-70` (la factura y su hoja de impresión exigen capacidad financiera y alcance por sucursal). El
> **remanente** de `A-64` —un solo mapa estado→etapa y un solo formateador de tiempo— también queda cerrado:
> el recorrido del detalle sale del historial real.

- `A-12` (filtro «solo sin aceptar»): sigue **fuera**, por decisión ya tomada (los grupos de estado lo cubren).
- `A-76`/`A-78` (la anulación no marca la factura; `canPrintCashDocuments` sin guarda de servidor): son del
  orden 9 (Cierres / Facturas), no de Pedidos.
