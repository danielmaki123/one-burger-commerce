# Módulo `locations`

**T8 — multi-sucursal con menú y precios por local.** Un local es donde el cliente retira: su
dirección y su mapa, su contacto, su horario, sus minutos de preparación, si está tomando pedidos, y
**qué productos ofrece y a qué precio**. La marca, los colores, la moneda, la propina y las promos
siguen siendo del negocio entero (`business-settings`).

Ver `ops/tasks/TASK-multi-location.md` (diseño y fases) y `ops/project-state.md` §2 (qué se cerró).

## Estructura

```
domain/
  location.types.ts            LocationRecord, LocationProductRecord (+ su Input)
  location-rules.ts            validación, slug, orden, `resolveLocation`, punto de retiro
  location-product-rules.ts    precio y disponibilidad de un producto en un local
  location-errors.ts           LocationError
ports/
  location-repository.ts       locales + catálogo por local
adapters/
  prisma-location-repository.ts
  in-memory-location-repository.ts  (doble completo del puerto, para tests)
features/
  create-location/  update-location/  delete-location/
  list-location-catalog/  set-location-product/   catálogo por local (admin)
  list-public-locations/                          lo que ve el cliente (solo activos)
```

## Reglas

- **Sin fila en `LocationProduct`, el producto se vende al precio base** del negocio. Es la decisión
  de diseño de la fase 4: con un solo local no hay filas y "sin fila no se vende" habría dejado el
  menú público vacío. La fila guarda la **excepción** (precio propio, agotado, no se vende acá), y
  `priceOverride: null` significa "precio del negocio" — `0` es gratis, no "sin precio".
- **Un local inactivo no se ofrece ni se puede pedir contra él.** `resolveLocation` rechaza el local
  pedido si no existe o está apagado y **nunca cae al primario**: caer al primario sería mandar la
  comida al local equivocado sin avisar. Sin local elegido, se usa el **primario** (el primero activo
  por orden manual y, si empatan, por nombre).
- **El pedido guarda solo el `locationId`.** El nombre y la dirección se resuelven **al leer**
  (`describePickupLocation`), así una corrección del owner llega a los pedidos en curso. De un local
  solo sale lo del punto de retiro: teléfono y WhatsApp internos no se exponen al público.
- **Los precios los resuelve el servidor**: el cliente manda `locationId` y `productId`, nunca un
  precio. El menú público (`/api/menu?locationId=`) devuelve el catálogo ya cotizado para ese local,
  y el checkout re-preciá el carrito con **ese** payload (no reimplementa reglas de precios).
- **No se puede borrar un local con pedidos** (la FK de `Order.locationId` es `Restrict` a propósito:
  la historia no se pierde). El caso de uso lo detecta antes y responde **409** con el motivo. Tampoco
  se puede borrar el último local activo.
- **Escribir es solo del owner** (`canManageBusinessSettings`); leer lo puede hacer cualquier admin
  con sesión. El `GET` público devuelve solo activos y solo datos del punto de retiro.
- **La zona horaria no vive acá**: es del negocio (`BusinessSettings.timezone`) y el horario de cada
  local se interpreta en esa zona.

## Superficies

| Superficie | Qué hace |
|---|---|
| `/admin/locations` | CRUD de locales (datos, horario, operación, estado) — solo owner |
| `/admin/locations/[id]` | catálogo del local: precio propio, agotado, o no venderlo acá |
| `/api/admin/locations[/[id][/products/[productId]]]` | API del admin (escritura solo owner) |
| `/api/locations` | locales activos, solo datos del punto de retiro (público) |
| `/api/menu?locationId=` | catálogo del negocio con las excepciones de ese local aplicadas |
| `/api/orders` | valida el local del pedido y usa **su** horario y su interruptor de pedidos |
| `/checkout` | selector de local (solo si hay más de uno), dirección y horarios del elegido |
| `/admin/orders` | filtro por local y el local en cada pedido, en el detalle y en la confirmación |

## Migración

`prisma/migrations/20260912020000_add_locations`: crea `Location` y `LocationProduct`, agrega
`Order.locationId` en tres pasos (nullable → backfill al primario → `NOT NULL`) y **crea el local
primario** con los datos que estaban en `BusinessSettings`, así una base nueva nunca queda sin
ninguno. Sin BOM (hay test que lo verifica).
