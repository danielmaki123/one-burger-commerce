# TASK-multi-location — T8: multi-sucursal **con menú y precios por local**

> **Estado: alcance aprobado por el owner el 2026-09-12 (decisión D-T8)**. Pendiente de implementar
> por fases, una por commit. Este brief es el diseño acordado; si algo cambia, se actualiza acá
> primero.

## 1. Qué pidió el owner

El mock muestra una tarjeta de sucursal en la home y en el checkout. Hoy `BusinessSettings` es **una
sola fila** (`id = "default"`) con 41 campos: identidad, apariencia, contacto, horario, moneda,
operación y auditoría.

El owner eligió el alcance más grande: **el menú y los precios son por local**, no solo el horario y
el contacto. Es la tarea más grande del plan (`ops/tasks/TASK-mock-adoption.md` §5, T8).

## 2. Modelo propuesto

### 2.1 Global vs. por local

| Se queda **global** (una sola vez, en `BusinessSettings`) | Pasa a ser **por local** (`Location`) |
|---|---|
| Nombre, tagline, descripción, logos, favicon, OG | Dirección, ciudad, referencia, `mapsUrl`, lat/long |
| Colores, tipografías | Teléfono y WhatsApp del local |
| Moneda, símbolo, locale | Horario (`businessHours`) |
| Propina (`tipEnabled`, `tipRate`), texto de pago | `isAcceptingOrders`, `closedMessage` |
| Zona horaria (**un negocio, una zona**: si algún día abre en otra, se agrega al local) | `pickupLeadMinutes`, `pickupMaxMinutes` |
| Promos con código (`Coupon`), categorías y subcategorías | Qué productos ofrece y a qué precio |

**Categorías y subcategorías se quedan globales**: el menú se organiza igual en todos los locales; lo
que cambia es qué productos se ofrecen y a qué precio. Un local que no vende un plato lo oculta, no
necesita otra categoría.

### 2.2 Tablas nuevas

```
model Location {
  id, name (único por negocio), slug (único, para URLs y anclas), isActive, sortOrder
  addressLine, city, addressReference, mapsUrl, latitude, longitude
  phone, whatsapp
  businessHours Json
  pickupLeadMinutes Int @default(25)
  pickupMaxMinutes Int?
  isAcceptingOrders Boolean @default(true)
  closedMessage String?
  createdAt, updatedAt
}

model LocationProduct {
  id, locationId, productId
  priceOverride Decimal?   // null = usa Product.basePrice
  isAvailable Boolean @default(true)
  isActive Boolean @default(true)   // false = este local no lo ofrece
  @@unique([locationId, productId])
}
```

- **Precio**: `priceOverride` opcional sobre `Product.basePrice`. Un solo lugar donde vive el precio
  base (el producto) y un override explícito por local; así el owner no tiene que cargar el mismo
  precio N veces y "sin override" significa "el mismo en todos".
- **Disponibilidad**: `isAvailable` (agotado hoy) e `isActive` (este local no lo vende) separados, como
  ya están separados en `Product`.
- **Sin fila `LocationProduct` el producto se vende al precio base** (regla cambiada al implementar la
  fase 4, ver esa fila de la tabla): el local guarda **excepciones**, no una copia del menú. El brief
  decía lo contrario ("sin fila no hay producto", copiando el catálogo al crear un local) y eso rompía
  el caso real de un negocio de **un solo local**: no tendría filas y el menú público quedaría vacío.
  Con la regla nueva no hace falta copiar nada, un producto nuevo se vende en todos los locales, y
  "acá no lo vendo" es una excepción explícita (`isActive: false`).

### 2.3 `Order.locationId`

- Columna **obligatoria** con backfill al local primario en la misma migración.
- El checkout manda `locationId`; el servidor valida que el local exista, esté activo y acepte pedidos
  (hoy esa validación es sobre la configuración global).
- El admin filtra por local y la cocina ve el suyo. Los cupones y la propina siguen globales.

### 2.4 Local primario

- El primer local se llama **"Principal"** y hereda **todos** los valores operativos actuales de
  `BusinessSettings` (dirección, contacto, horario, aceptación, minutos de preparación). La migración
  no inventa datos: los copia.
- No se puede borrar el último local activo ni dejar el negocio sin ninguno (regla en el caso de uso,
  no solo en la UI).
- Las órdenes viejas apuntan a "Principal".

## 3. Qué cambia en cada superficie

| Superficie | Antes | Después |
|---|---|---|
| `/admin/settings` | Todo mezclado (marca + local) | Marca, apariencia, moneda, propina y zona horaria |
| `/admin/locations` (**nueva**) | — | CRUD de locales: datos, horario, operación, productos (qué ofrece y a qué precio) |
| Home / menú / producto | Un horario y un precio | Los del local elegido (el primario si no se eligió ninguno) |
| Checkout | "El local atiende …" | Selector de local + dirección y horario del elegido; la hora de retiro se calcula con **su** preparación |
| Confirmación / historial | Sin local | Fila con el local de retiro |
| `/admin/orders` | Una lista | Filtro por local (y "todos") |
| Promos | Globales | Globales (documentado; `scopeLocationId` queda como mejora futura) |

## 4. Fases (una por commit)

| Fase | Qué | Tests que abren |
|---|---|---|
| **1** | Modelo y migración: `Location`, `LocationProduct`, `Order.locationId` con backfill al local primario. Sin UI: los datos se siguen leyendo de la config para no cambiar comportamiento — **CERRADA** (commit `feat(locales): el modelo de locales y el backfill (T8, fase 1)`) | `location-rules.test.ts` · `locations-migration-contract.test.ts` · `create-order.test.ts` (bloque T8) |
| **2** | Casos de uso y API de locales (`/api/admin/locations`): CRUD, "no se puede borrar el último" — **CERRADA** (reglas de validación + `create/update/delete-location` + las rutas `GET/POST` y `PATCH/DELETE [id]`). Escribir es **solo owner** (`canManageBusinessSettings`), leer lo puede hacer cualquier admin con sesión. **La copia del catálogo no se hace**: la fase 4 la volvió innecesaria (sin fila, el producto se vende al precio base) | `location-validation.test.ts` · `create-location.test.ts` · `update-location.test.ts` · `delete-location.test.ts` · `route.test.ts` (x2) · `error-response.test.ts` |
| **3** | `/admin/locations`: pantalla con datos, horario, operación — **CERRADA**. Lista con estado, dirección y horario de hoy; formulario completo (datos, 7 días de horario, preparación, aceptación, estado); validación local con las mismas reglas del servidor; borrar con confirmación y el motivo cuando no se puede. Entra en la navegación del admin **solo para el owner** | `location-helpers.test.ts` · `page.test.tsx` · `admin-layout-helpers.test.ts` · `tests/e2e/admin-locations.spec.ts` |
| **4** | Productos por local: precio y disponibilidad por sucursal — **CERRADA**: reglas puras, puerto y adaptadores, casos de uso `list-location-catalog`/`set-location-product`, las rutas `GET …/products` + `PUT …/products/[productId]` y la **pantalla `/admin/locations/[id]`** (lista el menú del negocio con el precio de este local, y deja poner precio propio, marcarlo agotado o sacarlo del local). **Cambio de diseño documentado**: sin fila en `LocationProduct` el producto **se vende al precio base**, en vez de "sin fila no se vende" — con un solo local no hay filas y el menú público habría quedado vacío. Se guarda la **excepción**, y "volver al precio base" borra la fila (sin tocar la disponibilidad que el owner no pidió cambiar) | `location-product-rules.test.ts` · `location-catalog.test.ts` · `route.test.ts` (x2) · `catalog-helpers.test.ts` · `page.test.tsx` · `tests/e2e/admin-locations.spec.ts` |
| **5** | Lectura pública: home, menú y producto resuelven precios y disponibilidad del local elegido — **CERRADA**: el menú público (`/api/menu`, y por lo tanto la home, la carta y la ficha de producto) aplica las excepciones del local —precio propio, agotado, no se vende— sobre el catálogo del negocio. Sin `locationId` usa el local por defecto, y sin locales activos muestra los precios del negocio. El `basePrice` del menú público pasa a ser **el precio que se cobra en ese local** | `apply-location-pricing.test.ts` · `get-public-menu.test.ts` · `tests/e2e/admin-locations.spec.ts` (375 px) |
| **6** | Checkout: selector de local, horario y preparación del local, `locationId` en el pedido | `checkout/page.test.tsx` · `create-order.test.ts` · E2E |
| **7** | Operación: filtro por local en `/admin/orders`, detalle y ticket; confirmación e historial del cliente | `page.test.tsx` · `order-*.test.ts` · E2E |

**Dependencia con D1 (fase 4 de `TASK-checkout-v2`):** el selector de días futuros calcula turnos por
día **y por local**, así que conviene hacerlo **después** de T8 para no tocar el control de retiro dos
veces. Queda anotado en `ops/tasks/TASK-checkout-v2.md`.

## 5. Reglas que no se negocian

- Nada de negocio hardcodeado: los locales salen de la base, no de constantes (`anti-hardcode-contract`).
- Un local inactivo no se ofrece en el checkout y no se puede pedir contra él (409, como el gate
  operativo de hoy).
- Los precios los resuelve el **servidor**: el cliente manda `locationId` y `productId`, nunca el
  precio.
- Migración **sin BOM** (test que lo verifica) y con backfill que no deje órdenes sin local.
- Verificación a **375 px y 1280 px** en cada fase con UI.
- Sin deploy a producción sin confirmación del owner.
