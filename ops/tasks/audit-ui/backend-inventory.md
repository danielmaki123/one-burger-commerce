# Inventario del backend — admin y POS (con foco en el KDS)

> **Qué es.** El inventario de lo que el backend **ya tiene** hoy, medido sobre el código, para diseñar
> mockups sin diseñar fantasmas. **No propone cambios y no evalúa calidad: describe.**
>
> **Cuándo y sobre qué.** 2026-09-15/16, sobre `main` en `f5cadd9`. Tamaño del terreno: **35 modelos**
> Prisma, **12 enums**, **70 `route.ts`**, **30 páginas** de admin, **30 migraciones**.
>
> **Cómo se midió.** Las tablas 1 y 2 se generaron leyendo `prisma/schema.prisma` (cada fila dice la
> línea donde empieza su bloque); la tabla 3 leyendo cada `route.ts` con su caso de uso y su esquema
> zod; las secciones 4 y 5, con grep y lectura dirigida sobre `src/`, `prisma/` y `ops/`.
>
> **Marcas de honestidad.** `ruta:línea` cuando la cosa existe y se puede señalar; **NO EXISTE** cuando
> se buscó y no hay nada; **NO VERIFICABLE** cuando no se pudo confirmar; **AMBIGUO** cuando el código
> dice dos cosas distintas y no se puede elegir una sin inventar.
>
> **Lo que este documento NO es:** un plan, una lista de tareas ni una propuesta de diseño. Las
> complejidades de §4 son estimaciones de orden de magnitud, no compromisos.

---

## 0. Contexto: qué pantallas existen hoy

30 páginas bajo `src/app/(admin)/**` (`Get-ChildItem -Recurse -File -Path 'src/app/(admin)' -Filter page.tsx`).

| Ruta | Qué es | ¿En el MVP? | Notas |
|---|---|---|---|
| `/admin` | El turno: resumen del día (`AdminOverviewClient`) | Sí | Solo para roles con `canViewAdminOverview`; el resto va a `/admin/orders` (`src/app/(admin)/admin/page.tsx:12-14`). En la barra móvil se llama **«Turno»** (`admin-mobile-nav.tsx:52`) |
| `/admin/orders` | **El KDS**: tablero de comandas + historial, misma página en dos vistas | Sí | Vista `today` = tablero (3 carriles) y `history` = listado (`orders/page.tsx:309`, `:1150-1153`) |
| `/admin/orders/[id]` | Detalle de un pedido | Sí | Reloj propio cada 30 s, **sin** re-pedir datos (`orders/[id]/page.tsx:227-230`) |
| `/admin/pos` | El mostrador: venta, caja (abrir/cerrar turno), recibo JPG | Sí | **No existe `/admin/cash`**: la caja vive acá (`admin-mobile-nav.tsx:55`) |
| `/admin/menu` | Hub del catálogo | Sí | |
| `/admin/menu/categories` · `/subcategories` (dentro de la página) · `/products` · `/products/[id]` · `/modifier-groups` · `/modifier-groups/[id]` · `/marketing-blocks` | ABM del catálogo | Sí | 7 páginas |
| `/admin/locations` · `/admin/locations/[id]` | Sucursales: horarios, aceptación, POS, alertas, contacto y precios | Sí | Los umbrales de aviso por carril se editan acá (`locations/page.tsx:614-641`) |
| `/admin/promotions` | Cupones y promos | Sí | |
| `/admin/users` | Cuentas, roles y sucursales asignadas | Sí | |
| `/admin/settings` | Personalización del negocio (whitelabel) | Sí | |
| `/admin/login` | Login del panel | Sí | |
| `/admin/dashboard` | **Redirige a `/admin`** | — | Página legacy de una línea (`dashboard/page.tsx`). Diseñarla sería diseñar un fantasma |
| `/admin/[...missing]` | Catch-all de 404 del panel | — | |
| `/admin/inventory` · `/alerts` · `/count` · `/items` · `/receive` · `/waste` | Inventario | **No** (fuera del MVP) | 6 páginas; código presente, fuera de la navegación |
| `/admin/reservations` · `/reservations/[id]` | Reservas | **No** | 2 páginas |
| `/admin/tables` | Mesas | **No** | 1 página |
| `/admin/delivery-zones` · `/delivery-zones/[id]` | Zonas de envío | **No** | 2 páginas |

**Resumen:** 17 páginas del MVP (más 2 de infraestructura) y **11 páginas de módulos fuera del MVP**
que existen en el código y solo se alcanzan por URL directa (`AGENTS.md`: «No reactivarlos en la
navegación ni en las APIs públicas sin aprobación explícita»).

**Navegación real** (no la imaginada): la barra móvil tiene 5 destinos fijos —Turno, Órdenes, **Caja**,
Menú, Mesas— (`admin-mobile-nav.tsx:51-58`) y el resto cuelga de «Más»; el sidebar de escritorio se
arma por rol (`(admin)/admin/admin-layout-helpers.ts:74-99`) y su lista secundaria está **vacía** a
propósito (`ADMIN_SECONDARY_NAV_ITEMS = []`, `:45-47`). El link de la marca lleva a `/admin` para el
owner y a `/admin/orders` para el resto (`admin-shell.tsx:119`).

**No existen** (verificado por listado de rutas y grep): `/admin/cash`, `/admin/kds`, `/admin/reports`
(hay APIs de reportes, sin página), `/admin/shifts`, `/admin/kitchen`, `/admin/print`.

---

## 1. Modelo de datos (35 modelos de Prisma)

Una fila por modelo, con la línea donde empieza el bloque en `prisma/schema.prisma`. `Campos` y `Tipos`
van en el mismo orden; lo que está en `Nullable` es opcional en la base; `FK` lista las relaciones
declaradas (con `@relation`) y las listas inversas.

| `AdminUser` (`prisma/schema.prisma:19`) | id<br>name<br>email<br>passwordHash<br>role<br>createdAt<br>updatedAt<br>sessions<br>locations<br>shifts | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>AdminRole <sub>enum</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>AdminSession[] <sub>relación</sub><br>AdminUserLocation[] <sub>relación</sub><br>Shift[] <sub>relación</sub> | — | — |
| `AdminUserLocation` (`prisma/schema.prisma:36`) | adminUserId<br>locationId<br>createdAt<br>adminUser<br>location | String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>AdminUser <sub>relación</sub><br>Location <sub>relación</sub> | — | adminUser → AdminUser (`prisma/schema.prisma:19`)<br>location → Location (`prisma/schema.prisma:175`) |
| `AdminSession` (`prisma/schema.prisma:47`) | id<br>tokenHash<br>expiresAt<br>createdAt<br>userId<br>user | String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>String <sub>escalar</sub><br>AdminUser <sub>relación</sub> | — | user → AdminUser (`prisma/schema.prisma:19`) |
| `Customer` (`prisma/schema.prisma:59`) | id<br>fullName<br>whatsappNormalized<br>createdAt<br>updatedAt<br>orders<br>reservations<br>addresses<br>sessions | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order[] <sub>relación</sub><br>Reservation[] <sub>relación</sub><br>CustomerAddress[] <sub>relación</sub><br>CustomerSession[] <sub>relación</sub> | fullName | — |
| `CustomerAddress` (`prisma/schema.prisma:71`) | id<br>customerId<br>label<br>address<br>reference<br>isDefault<br>createdAt<br>updatedAt<br>customer | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Customer <sub>relación</sub> | label, reference | customer → Customer (`prisma/schema.prisma:59`) |
| `CustomerOtp` (`prisma/schema.prisma:86`) | id<br>whatsappNormalized<br>codeHash<br>expiresAt<br>attempts<br>consumedAt<br>createdAt<br>updatedAt | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub> | consumedAt | — |
| `CustomerSession` (`prisma/schema.prisma:101`) | id<br>customerId<br>tokenHash<br>expiresAt<br>revokedAt<br>lastSeenAt<br>createdAt<br>updatedAt<br>customer | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Customer <sub>relación</sub> | revokedAt, lastSeenAt | customer → Customer (`prisma/schema.prisma:59`) |
| `Category` (`prisma/schema.prisma:117`) | id<br>name<br>slug<br>sortOrder<br>isActive<br>color<br>createdAt<br>updatedAt<br>subcategories<br>products | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Subcategory[] <sub>relación</sub><br>Product[] <sub>relación</sub> | color | — |
| `Subcategory` (`prisma/schema.prisma:131`) | id<br>categoryId<br>name<br>slug<br>sortOrder<br>isActive<br>createdAt<br>updatedAt<br>category<br>products | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Category <sub>relación</sub><br>Product[] <sub>relación</sub> | — | category → Category (`prisma/schema.prisma:117`) |
| `Product` (`prisma/schema.prisma:147`) | id<br>categoryId<br>subcategoryId<br>name<br>description<br>basePrice<br>packagingFeeAmount<br>sortOrder<br>isAvailable<br>isActive<br>createdAt<br>updatedAt<br>category<br>subcategory<br>images<br>modifierGroups<br>bundleRules<br>locations | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Int <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Category <sub>relación</sub><br>Subcategory <sub>relación</sub><br>ProductImage[] <sub>relación</sub><br>ProductModifierGroup[] <sub>relación</sub><br>BundleRule[] <sub>relación</sub><br>LocationProduct[] <sub>relación</sub> | subcategoryId, description, packagingFeeAmount, subcategory | category → Category (`prisma/schema.prisma:117`)<br>subcategory → Subcategory (`prisma/schema.prisma:131`) |
| `Location` (`prisma/schema.prisma:175`) | id<br>name<br>slug<br>isActive<br>sortOrder<br>addressLine<br>city<br>addressReference<br>mapsUrl<br>latitude<br>longitude<br>phone<br>whatsapp<br>businessHours<br>pickupLeadMinutes<br>pickupMaxMinutes<br>acceptAlertMinutes<br>prepAlertMinutes<br>isAcceptingOrders<br>posEnabled<br>closedMessage<br>createdAt<br>updatedAt<br>products<br>orders<br>adminUsers<br>shifts | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Float <sub>escalar</sub><br>Float <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Json <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>LocationProduct[] <sub>relación</sub><br>Order[] <sub>relación</sub><br>AdminUserLocation[] <sub>relación</sub><br>Shift[] <sub>relación</sub> | addressLine, city, addressReference, mapsUrl, latitude, longitude, phone, whatsapp, pickupMaxMinutes, closedMessage | — |
| `LocationProduct` (`prisma/schema.prisma:216`) | id<br>locationId<br>productId<br>priceOverride<br>isAvailable<br>isActive<br>createdAt<br>updatedAt<br>location<br>product | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Location <sub>relación</sub><br>Product <sub>relación</sub> | priceOverride | location → Location (`prisma/schema.prisma:175`)<br>product → Product (`prisma/schema.prisma:147`) |
| `ProductImage` (`prisma/schema.prisma:232`) | id<br>productId<br>url<br>alt<br>sortOrder<br>isPrimary<br>product | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Product <sub>relación</sub> | alt | product → Product (`prisma/schema.prisma:147`) |
| `ModifierGroup` (`prisma/schema.prisma:244`) | id<br>name<br>isRequired<br>minSelections<br>maxSelections<br>sortOrder<br>createdAt<br>updatedAt<br>options<br>products | String <sub>escalar</sub><br>String <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>ModifierOption[] <sub>relación</sub><br>ProductModifierGroup[] <sub>relación</sub> | — | — |
| `ModifierOption` (`prisma/schema.prisma:257`) | id<br>modifierGroupId<br>name<br>priceDelta<br>isActive<br>sortOrder<br>modifierGroup | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>ModifierGroup <sub>relación</sub> | — | modifierGroup → ModifierGroup (`prisma/schema.prisma:244`) |
| `ProductModifierGroup` (`prisma/schema.prisma:269`) | id<br>productId<br>modifierGroupId<br>sortOrder<br>product<br>modifierGroup | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>Product <sub>relación</sub><br>ModifierGroup <sub>relación</sub> | — | product → Product (`prisma/schema.prisma:147`)<br>modifierGroup → ModifierGroup (`prisma/schema.prisma:244`) |
| `BundleRule` (`prisma/schema.prisma:282`) | id<br>productId<br>name<br>ruleType<br>config<br>isActive<br>sortOrder<br>createdAt<br>updatedAt<br>product | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Json <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Product <sub>relación</sub> | — | product → Product (`prisma/schema.prisma:147`) |
| `MenuMarketingBlock` (`prisma/schema.prisma:312`) | id<br>type<br>title<br>description<br>imageUrl<br>ctaLabel<br>ctaType<br>ctaTarget<br>isActive<br>sortOrder<br>startsAt<br>endsAt<br>createdAt<br>updatedAt | String <sub>escalar</sub><br>MenuMarketingBlockType <sub>enum</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>MenuMarketingBlockCtaType <sub>enum</sub><br>String <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub> | description, imageUrl, ctaLabel, ctaTarget, startsAt, endsAt | — |
| `Table` (`prisma/schema.prisma:383`) | id<br>label<br>qrToken<br>isActive<br>locationId<br>capacity<br>createdAt<br>updatedAt<br>orders<br>reservations | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order[] <sub>relación</sub><br>Reservation[] <sub>relación</sub> | — | — |
| `Coupon` (`prisma/schema.prisma:396`) | id<br>code<br>type<br>value<br>isActive<br>usageLimit<br>usedCount<br>expiresAt<br>buyQuantity<br>freeQuantity<br>scopeType<br>scopeId<br>createdAt<br>updatedAt<br>orders | String <sub>escalar</sub><br>String <sub>escalar</sub><br>CouponType <sub>enum</sub><br>Decimal <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order[] <sub>relación</sub> | expiresAt, buyQuantity, freeQuantity, scopeType, scopeId | — |
| `DeliveryZone` (`prisma/schema.prisma:416`) | id<br>name<br>description<br>baseFee<br>isActive<br>sortOrder<br>createdAt<br>updatedAt<br>orders | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order[] <sub>relación</sub> | description | — |
| `Order` (`prisma/schema.prisma:428`) | id<br>orderNumber<br>locationId<br>orderLookupTokenHash<br>idempotencyKey<br>type<br>status<br>customerName<br>customerWhatsapp<br>customerEmail<br>customerId<br>address<br>deliveryNotes<br>deliveryFeeStatus<br>deliveryFeeAmount<br>pickupTime<br>pickupScheduled<br>pickupNotes<br>tableId<br>paymentMethod<br>paidWithAmount<br>pickupPin<br>couponId<br>couponCode<br>subtotal<br>discount<br>packagingAmount<br>tipAmount<br>tipRate<br>total<br>deliveryZoneId<br>customerLat<br>customerLng<br>geoAccuracy<br>geoCapturedAt<br>createdAt<br>updatedAt<br>table<br>location<br>coupon<br>customer<br>deliveryZone<br>items<br>statusHistory<br>payments | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>OrderType <sub>enum</sub><br>OrderStatus <sub>enum</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>PaymentMethod <sub>enum</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Float <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Table <sub>relación</sub><br>Location <sub>relación</sub><br>Coupon <sub>relación</sub><br>Customer <sub>relación</sub><br>DeliveryZone <sub>relación</sub><br>OrderItem[] <sub>relación</sub><br>OrderStatusHistory[] <sub>relación</sub><br>Payment[] <sub>relación</sub> | orderLookupTokenHash, idempotencyKey, customerEmail, customerId, address, deliveryNotes, deliveryFeeStatus, pickupTime, pickupNotes, tableId, paidWithAmount, pickupPin, couponId, couponCode, tipRate, deliveryZoneId, customerLat, customerLng, geoAccuracy, geoCapturedAt, table, coupon, customer, deliveryZone | table → Table (`prisma/schema.prisma:383`)<br>location → Location (`prisma/schema.prisma:175`)<br>coupon → Coupon (`prisma/schema.prisma:396`)<br>customer → Customer (`prisma/schema.prisma:59`)<br>deliveryZone → DeliveryZone (`prisma/schema.prisma:416`) |
| `OrderItem` (`prisma/schema.prisma:500`) | id<br>orderId<br>productId<br>productName<br>quantity<br>unitPrice<br>packagingUnitAmount<br>packagingQuantity<br>packagingTotalAmount<br>notes<br>lineTotal<br>createdAt<br>order<br>modifiers | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Int <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order <sub>relación</sub><br>OrderItemModifier[] <sub>relación</sub> | notes | order → Order (`prisma/schema.prisma:428`) |
| `OrderItemModifier` (`prisma/schema.prisma:520`) | id<br>orderItemId<br>modifierOptionId<br>name<br>priceDelta<br>createdAt<br>orderItem | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>OrderItem <sub>relación</sub> | — | orderItem → OrderItem (`prisma/schema.prisma:500`) |
| `OrderStatusHistory` (`prisma/schema.prisma:532`) | id<br>orderId<br>status<br>note<br>changedByUserId<br>createdAt<br>order | String <sub>escalar</sub><br>String <sub>escalar</sub><br>OrderStatus <sub>enum</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order <sub>relación</sub> | note, changedByUserId | order → Order (`prisma/schema.prisma:428`) |
| `Reservation` (`prisma/schema.prisma:556`) | id<br>status<br>customerName<br>customerWhatsapp<br>customerId<br>reservationNumber<br>reservationLookupTokenHash<br>date<br>time<br>partySize<br>tableId<br>tableLabel<br>notes<br>createdAt<br>updatedAt<br>table<br>customer | String <sub>escalar</sub><br>ReservationStatus <sub>enum</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Int <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Table <sub>relación</sub><br>Customer <sub>relación</sub> | customerId, reservationNumber, reservationLookupTokenHash, notes, customer | table → Table (`prisma/schema.prisma:383`)<br>customer → Customer (`prisma/schema.prisma:59`) |
| `InventoryItem` (`prisma/schema.prisma:588`) | id<br>name<br>unit<br>category<br>currentEstimatedStock<br>lowStockThreshold<br>isActive<br>locationId<br>createdAt<br>updatedAt<br>counts<br>wasteRecords<br>receiveRecords | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>InventoryCount[] <sub>relación</sub><br>InventoryWasteRecord[] <sub>relación</sub><br>InventoryReceiveRecord[] <sub>relación</sub> | — | — |
| `InventoryCount` (`prisma/schema.prisma:607`) | id<br>inventoryItemId<br>countedQuantity<br>countedByUserId<br>countedAt<br>notes<br>createdAt<br>inventoryItem | String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>InventoryItem <sub>relación</sub> | notes | inventoryItem → InventoryItem (`prisma/schema.prisma:588`) |
| `InventoryWasteRecord` (`prisma/schema.prisma:621`) | id<br>inventoryItemId<br>quantity<br>reason<br>reportedByUserId<br>reportedAt<br>notes<br>createdAt<br>inventoryItem | String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>InventoryItem <sub>relación</sub> | notes | inventoryItem → InventoryItem (`prisma/schema.prisma:588`) |
| `InventoryReceiveRecord` (`prisma/schema.prisma:636`) | id<br>inventoryItemId<br>receivedQuantity<br>receivedByUserId<br>receivedAt<br>notes<br>createdAt<br>inventoryItem | String <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>InventoryItem <sub>relación</sub> | notes | inventoryItem → InventoryItem (`prisma/schema.prisma:588`) |
| `OutboxEvent` (`prisma/schema.prisma:650`) | id<br>eventType<br>aggregateType<br>aggregateId<br>status<br>payload<br>attemptCount<br>errorMessage<br>lockedAt<br>processedAt<br>createdAt<br>updatedAt | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>OutboxStatus <sub>enum</sub><br>Json <sub>escalar</sub><br>Int <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub> | errorMessage, lockedAt, processedAt | — |
| `BusinessSettings` (`prisma/schema.prisma:674`) | id<br>name<br>tagline<br>description<br>logoUrl<br>logoMarkUrl<br>faviconUrl<br>ogImageUrl<br>primaryColor<br>accentColor<br>backgroundColor<br>foregroundColor<br>surfaceColor<br>headingFont<br>bodyFont<br>phone<br>whatsapp<br>email<br>instagram<br>facebook<br>tiktok<br>addressLine<br>city<br>addressReference<br>mapsUrl<br>latitude<br>longitude<br>timezone<br>businessHours<br>currencyCode<br>currencySymbol<br>locale<br>usdExchangeRate<br>pickupLeadMinutes<br>pickupMaxMinutes<br>paymentInstructions<br>tipEnabled<br>tipRate<br>isAcceptingOrders<br>closedMessage<br>updatedAt<br>updatedByUserId | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Float <sub>escalar</sub><br>Float <sub>escalar</sub><br>String <sub>escalar</sub><br>Json <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>Float <sub>escalar</sub><br>Int <sub>escalar</sub><br>Int <sub>escalar</sub><br>String <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>Int <sub>escalar</sub><br>Boolean <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>String <sub>escalar</sub> | tagline, description, logoUrl, logoMarkUrl, faviconUrl, ogImageUrl, phone, whatsapp, email, instagram, facebook, tiktok, addressLine, city, addressReference, mapsUrl, latitude, longitude, usdExchangeRate, pickupMaxMinutes, paymentInstructions, closedMessage, updatedByUserId | — |
| `Payment` (`prisma/schema.prisma:732`) | id<br>orderId<br>method<br>amount<br>currency<br>tip<br>changeAmount<br>reference<br>createdAt<br>order | String <sub>escalar</sub><br>String <sub>escalar</sub><br>PaymentMethodType <sub>enum</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Order <sub>relación</sub> | currency, reference | order → Order (`prisma/schema.prisma:428`) |
| `Shift` (`prisma/schema.prisma:762`) | id<br>locationId<br>userId<br>status<br>openedAt<br>closedAt<br>openingAmount<br>closingAmount<br>expectedAmount<br>difference<br>notes<br>createdAt<br>updatedAt<br>location<br>user<br>cashCounts | String <sub>escalar</sub><br>String <sub>escalar</sub><br>String <sub>escalar</sub><br>ShiftStatus <sub>enum</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>String <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Location <sub>relación</sub><br>AdminUser <sub>relación</sub><br>ShiftCashCount[] <sub>relación</sub> | closedAt, closingAmount, expectedAmount, difference, notes | location → Location (`prisma/schema.prisma:175`)<br>user → AdminUser (`prisma/schema.prisma:19`) |
| `ShiftCashCount` (`prisma/schema.prisma:800`) | id<br>shiftId<br>kind<br>currency<br>denomination<br>quantity<br>createdAt<br>shift | String <sub>escalar</sub><br>String <sub>escalar</sub><br>ShiftCountKind <sub>enum</sub><br>String <sub>escalar</sub><br>Decimal <sub>escalar</sub><br>Int <sub>escalar</sub><br>DateTime <sub>escalar</sub><br>Shift <sub>relación</sub> | — | shift → Shift (`prisma/schema.prisma:762`) |

---

## 2. Enums y estados (12 enums)

| `AdminRole` (`prisma/schema.prisma:11`) | owner · manager · kitchen · cashier | declarado en `prisma/schema.prisma:11` · 19 archivo(s) de código · `prisma/migrations/20260518120408_init_preview_schema/migration.sql:5` · `prisma/migrations/20260902145000_one_burger_admin_roles/migration.sql:1` · `prisma/migrations/20260914150000_add_cashier_role/migration.sql:5` · (+16) |
| `MenuMarketingBlockType` (`prisma/schema.prisma:297`) | promo · event · combo · featured · info | declarado en `prisma/schema.prisma:297` · 3 archivo(s) de código · `prisma/migrations/20260613152000_add_menu_marketing_blocks/migration.sql:2` · `src/modules/menu/domain/menu.types.ts:35` · `src/modules/menu/features/marketing-blocks/validate-marketing-block-input.ts:5` |
| `MenuMarketingBlockCtaType` (`prisma/schema.prisma:305`) | none · product · category · url | declarado en `prisma/schema.prisma:305` · 3 archivo(s) de código · `prisma/migrations/20260613152000_add_menu_marketing_blocks/migration.sql:5` · `src/modules/menu/domain/menu.types.ts:42` · `src/modules/menu/features/marketing-blocks/validate-marketing-block-input.ts:3` |
| `OrderType` (`prisma/schema.prisma:332`) | delivery · pickup · table | declarado en `prisma/schema.prisma:332` · 17 archivo(s) de código · `prisma/migrations/20260518120408_init_preview_schema/migration.sql:8` · `src/app/(admin)/admin/orders/[id]/page.tsx:34` · `src/app/(admin)/admin/orders/order-action-helpers.ts:2` · (+14) |
| `PaymentMethod` (`prisma/schema.prisma:339`) | cash · card | declarado en `prisma/schema.prisma:339` · 13 archivo(s) de código · `prisma/migrations/20260912000253_add_order_payment_method/migration.sql:2` · `prisma/migrations/20260914130000_add_payment/migration.sql:6` · `src/app/(admin)/admin/orders/[id]/page.tsx:18` · (+10) |
| `PaymentMethodType` (`prisma/schema.prisma:347`) | cash · card · transfer · mixed · other | declarado en `prisma/schema.prisma:347` · 4 archivo(s) de código · `prisma/migrations/20260914130000_add_payment/migration.sql:6` · `src/modules/orders/adapters/prisma-payment-repository.ts:4` · `src/modules/orders/domain/order.types.ts:229` · (+1) |
| `ShiftStatus` (`prisma/schema.prisma:356`) | open · closed | declarado en `prisma/schema.prisma:356` · 3 archivo(s) de código · `prisma/migrations/20260914140000_add_shift/migration.sql:10` · `src/modules/orders/adapters/prisma-shift-repository.ts:4` · `src/modules/orders/domain/order.types.ts:260` |
| `OrderStatus` (`prisma/schema.prisma:361`) | new · confirmed · preparing · ready · out_for_delivery · delivered · closed · ready_for_pickup · picked_up · accepted · served · cancelled | declarado en `prisma/schema.prisma:361` · 31 archivo(s) de código · `prisma/migrations/20260518120408_init_preview_schema/migration.sql:11` · `prisma/migrations/20260525000100_add_cancelled_order_status/migration.sql:1` · `prisma/migrations/20260914061058_add_status_history_actor/migration.sql:2` · (+28) |
| `CouponType` (`prisma/schema.prisma:376`) | percentage · fixed_amount · bogo | declarado en `prisma/schema.prisma:376` · 3 archivo(s) de código · `prisma/migrations/20260518120408_init_preview_schema/migration.sql:14` · `prisma/migrations/20260912011023_add_coupon_bogo/migration.sql:2` · `src/modules/orders/adapters/prisma-order-repository.ts:29` |
| `ReservationStatus` (`prisma/schema.prisma:547`) | requested · approved · rejected · seated · cancelled · no_show | declarado en `prisma/schema.prisma:547` · 16 archivo(s) de código · `prisma/migrations/20260518120408_init_preview_schema/migration.sql:17` · `src/app/(admin)/admin/reservations/reservation-status-ui.ts:1` · `src/app/(public)/reservations/reservation-success-view.tsx:41` · (+13) |
| `OutboxStatus` (`prisma/schema.prisma:581`) | pending · processing · processed · failed | declarado en `prisma/schema.prisma:581` · 1 archivo(s) de código · `prisma/migrations/20260518120408_init_preview_schema/migration.sql:20` |
| `ShiftCountKind` (`prisma/schema.prisma:795`) | opening · closing | declarado en `prisma/schema.prisma:795` · 1 archivo(s) de código · `prisma/migrations/20260915004004_add_shift_cash_counts/migration.sql:2` |

**Lo que hay que mirar dos veces en los estados:**

- **`OrderStatus` tiene 12 valores y el flujo depende del tipo de pedido** (`order-workflows.ts:3-28`).
  Para **retiro** (el caso del MVP): `new → confirmed → preparing → ready_for_pickup → picked_up →
  closed`. El estado `ready` genérico lo usa **delivery**, no el retiro (`order-workflows.ts:7` vs `:17`).
- **Hay vocabulario duplicado por tipo**: `confirmed` (delivery/pickup) vs `accepted` (table);
  `ready` vs `ready_for_pickup`; `delivered` vs `picked_up` vs `served`. La UI los agrupa en 3 carriles
  (`comanda-helpers.ts:40-46`) y 5 chips con contador (`orders/page.tsx:436-450`).
- **`PaymentMethod` (cash · card) y `PaymentMethodType` (cash · card · transfer · mixed · other) son
  enums distintos a propósito** (`schema.prisma:338-353`): el primero es lo que el cliente **declara**
  en el checkout; el segundo, lo que la caja **registra** al cobrar. El filtro del listado de pedidos
  usa el primero (`admin/orders/route.ts:53`), así que no se puede filtrar por transferencia ni mixto.
- **No hay un estado "en camino" para retiro** ni "listo para servir" para mesa fuera de los ya
  listados; tampoco hay estado de pago en `Order` (el cobro es una tabla aparte).

---

---

## 3. Endpoints disponibles (70 `route.ts`)

**Autenticación:** no hay `middleware.ts` en el repo. Cada handler de `/api/admin/**` llama a
`requireAdminSession()` y después a un chequeo de rol del mapa fijo de `admin-permissions.ts`.
Un endpoint sin esa llamada no queda cubierto por ninguna capa: no hay una red que los atrape a todos.

**Convención de la tabla:** una fila por **ruta + método** (un archivo con GET y POST son dos filas).
`ruta:línea` señala el handler y, cuando importa, el esquema zod, la regla de permisos y la forma de la
respuesta. Cuando una fila dice «errores comunes», son los de `createErrorResponse`
(`src/shared/lib/http/error-response.ts:16`): 401 `UNAUTHORIZED` sin sesión, 503 `SERVICE_UNAVAILABLE`
sin base y 500 `INTERNAL_SERVER_ERROR`.

### 3.1 Órdenes, comandas, POS y caja

| Ruta | Método | Qué hace | Qué acepta | Qué devuelve |
|---|---|---|---|---|
| `/api/admin/orders` (`admin/orders/route.ts:56`) | GET | Lista los pedidos del panel con el alcance por sucursal del usuario; delega en `listAdminOrders` (`list-admin-orders.ts:8`) | Query `querySchema` (`:16`): `type` (delivery/pickup/table) · `status` (**uno solo** de los 12) · `dateFrom`, `dateTo` (string que pase `Date.parse`) · `search` (recortado, máx. 60, `:50`) · `paymentMethod` (cash/card, `:53`). `locationId` está declarado en el esquema (`:47`) pero **no se valida**: se lee crudo (`:99`) y lo resuelve `resolveOrderListLocationIds` (`order-visibility.ts:40`), que ignora en silencio una sucursal ajena | `{ data: AdminOrder[], meta: { count, averagePrepMinutes, locationIds, locationScope } }` (`:116-123`). `AdminOrder` = `OrderQueueRecord` + `locationName` (`list-admin-orders.ts:6`), con `stageChangedAt` y `readyAt` (`ports/order-repository.ts:26`). 403 si el rol no pasa `canManageOrderOperations` (`:59`); 400 con `fields` por campo (`:73-88`) |
| `/api/admin/orders/:id` (`admin/orders/[id]/route.ts:15`) | GET | Detalle de un pedido con su punto de retiro y sus cobros; delega en `getOrder` (`get-order.ts:25`) | Ruta: `id`. Sin query ni body | `{ data: OrderRecord + pickupLocation + payments }` (`:37`, `get-order.ts:20-23`). 403 por rol (`:18`) o por sucursal fuera de alcance (`:29`, `order-scope.ts:17`); 404 si no existe (`get-order.ts:39`) |
| `/api/admin/orders/:id/status` (`admin/orders/[id]/status/route.ts:36`) | PATCH | **El cambio de estado del KDS**: valida la transición y publica `OrderStatusChanged`; delega en `updateOrderStatus` | Ruta: `id`. Body `statusSchema` (`:18`): `status` (obligatorio, los mismos 12 valores) + `note` (string o null, opcional) | `{ data: OrderRecord, meta: { note } }` (`update-order-status.ts:41-44`). 403 por rol o por sucursal fuera de alcance, **antes** de mutar (`:88-94`); 422 si es `cancelled` sin nota (`:65-78`); 404; **409 `CONFLICT`** si la transición no es válida para el tipo de pedido (`order-workflows.ts`) |
| `/api/admin/orders/:id/delivery-fee` (`admin/orders/[id]/delivery-fee/route.ts:19`) | PATCH | Revisa el costo de envío y publica `DeliveryFeeReviewed`; delega en `reviewDeliveryFee` | Ruta: `id`. Body `deliveryFeeSchema` (`:14`): `deliveryFeeAmount` (≥ 0) + `deliveryFeeStatus` (pending_manual_validation/confirmed) | `{ data: OrderRecord, meta: { sourceOfTruth: "backend" } }`. 422 por monto negativo o estado incoherente; 409 si el pedido no es `delivery`. **No aplica el chequeo de sucursal** que sí tienen las otras dos rutas de `[id]` |
| `/api/admin/pos/availability` (`admin/pos/availability/route.ts:19`) | GET | Dice si el usuario tiene mostrador en algún local, para mostrar u ocultar «Caja» en la navegación (`pickPosLocations`, `pos-locations.ts:13`) | Nada | `{ data: { available: boolean } }` con `no-store`. 403 si el rol no pasa `canUsePOS` (`:22`) |
| `/api/admin/pos/catalog` (`admin/pos/catalog/route.ts:16`) | GET | Catálogo vendible del local, con el precio por sucursal ya resuelto; delega en `searchPosCatalog` | Query: `locationId` (obligatorio de hecho: vacío → 400, `:23`) y `query` (texto libre, default `""`) | `{ data: { products, total, query } }` con `PosCatalogProduct` (`ports/pos-catalog.ts:10-25`) y `no-store`. 403 si el local está fuera del alcance, el POS está apagado o el local no existe |
| `/api/admin/pos/sale` (`admin/pos/sale/route.ts:19`) | POST | **Cobra una venta de mostrador**: registra el alta y los cobros en un paso; delega en `registerPosSale` | Body `saleSchema` (`sale-payload.ts:35`, parseado en `:72`): `locationId`; `customer` (`name` ≤ 120, `whatsapp` ≤ 30, `email` ≤ 160 opcional); `lines` (mín. 1) con `productId`, `name`, `unitPrice`, `packagingUnitAmount?`, `quantity` (≥ 1), `notes?`; `payments` (mín. 1) con `method` (**cash o card**, `:29`), `currency` (3 letras), `amount` (> 0); `idempotencyKey?` | **201** `{ data: { orderId, orderNumber, total, paid, change, payments[] } }` con `no-store`. 422 si el pago no cubre el total (`register-pos-sale.ts:74`); 409 si el total real supera lo cobrado (`:107-112`). `request.json()` **sin `.catch()`** (`:26`): un body no-JSON termina en 500 |
| `/api/admin/pos/shift` (`admin/pos/shift/route.ts:12`) | GET | Devuelve la caja **abierta** del local, o `null`; delega en `getCurrentShift` | Query: `locationId` (obligatorio de hecho) | `{ data: ShiftRecord \| null }` con `cashCounts` (`prisma-shift-repository.ts:119`) y `no-store`. «No hay caja abierta» **no es error**: es `data: null` |
| `/api/admin/pos/shift/open` (`admin/pos/shift/open/route.ts:13`) | POST | Abre la caja contando billetes; el fondo lo deriva el servidor del conteo (`cashCountsTotalInBusinessCurrency`, `shift-cash.ts:95`) | Body `shiftPayloadSchema` (`shift-payload.ts:20`): `locationId`; `counts[]` con `currency` (3 letras), `denomination` (> 0), `quantity` (entero ≥ 0) —las filas con 0 se descartan (`:45-51`)—; `notes` ≤ 300 | **201** `{ data: ShiftRecord }` con `no-store`. 422 si el conteo no valida (moneda no contada, billete inexistente o repetido) o si hay dólares sin tasa (`shift-cash.ts:110-122`); 404 si el local no existe; **409 si ya hay una caja abierta** en ese local (índice único parcial, `prisma-shift-repository.ts:99-108`). Body sin `.catch()` → 500 |
| `/api/admin/pos/shift/close` (`admin/pos/shift/close/route.ts:18`) | POST | Cierra la caja abierta contando lo que hay; el esperado (solo efectivo, dólares convertidos, vuelto descontado) lo calcula el servidor | Body: el mismo `shiftPayloadSchema` | **200** `{ data: ShiftRecord \| null, meta: { expectedByCurrency } }` (`close-shift.ts:113`) con `no-store`; `data` es `null` si el turno no existía o ya estaba cerrado (`:79-83`). 409 si no hay caja abierta; 422 por conteo inválido o cierre negativo. Body sin `.catch()` → 500 |
| `/api/orders` (`orders/route.ts:88`) | POST | **El alta pública** (retiro): límite por IP, resuelve el local, evalúa el gate de horario y aceptación, toma la propina de la configuración y delega en `createOrder` | Header `x-idempotency-key` opcional (`:47-51`). Body `orderSchema` (`:60`): `type` (solo `pickup`), `locationId`, `customerName`, `customerWhatsapp`, `items[]` (`productId`, `quantity` ≥ 1, `modifierOptionIds`, `notes`), `couponCode`, `pickupTime`, `pickupNotes`, `paymentMethod` (cash/card), `paidWithAmount`, `tipOptIn`, más los campos de delivery y mesa (fuera del MVP) | `{ data: OrderRecord + orderLookupToken, meta: { sourceOfTruth, reused } }`; **201** si es nuevo y **200** si la clave de idempotencia reusó uno (`:197`). 429 con `Retry-After` (10/min por IP, `ORDER_CREATE_RATE_LIMIT`); 409 con `fields.acceptance` si el local no acepta (`:172-175`); 422 por modificadores |
| `/api/orders/track` (`orders/track/route.ts:28`) | POST | Busca un pedido por número y lo autoriza con WhatsApp o con el token de consulta | Body `trackOrderSchema` (`:18`): `orderNumber` + (`customerWhatsapp` o `orderLookupToken`), con un `refine` que exige uno de los dos (`:24`) | `{ data: { orderNumber, type, status, statusLabel, updatedAt, items[], subtotal, discount, packagingAmount, deliveryFeeAmount, tipAmount, tipRate, total } }` (`track-order.ts:65-84`), con `statusLabel` en español (`:8-23`). 429 (20/min); 404 si no existe o no coincide |
| `/api/orders/:id` (`orders/[id]/route.ts:11`) | GET | Detalle público, validando el token de consulta | Ruta: `id`. Query: `token` (sin él, 401) | `{ data: PublicOrderDetail }` (`order.types.ts:149`): sin `locationId` ni hash de token, y con `pickupPin` (`get-public-order.ts:71`). 401 sin token; 404 si el hash no coincide (`timingSafeEqual`, `:35-42`) |
| `/api/orders/:id/items` (`orders/[id]/items/route.ts:22`) | POST | Agrega ítems a un pedido de tipo `table` (fuera del MVP de retiro, por eso **exige sesión de staff** pese al prefijo público, `:24-30`) | Ruta: `id`. Body `itemsSchema` (`:18`) | `{ data: OrderRecord }`. 409 si no es `table`, está `closed` o el producto no está disponible; 422 por modificadores |

> **Diferencia verificada en esta carpeta** (no es `AMBIGUO`: es una comprobación que falta en una
> ruta): `[id]/route.ts:29` y `[id]/status/route.ts:88` aplican el alcance por sucursal;
> `[id]/delivery-fee/route.ts` no lo aplica y `reviewDeliveryFee` tampoco compara el local del pedido.

### 3.2 Catálogo, inventario y menú público

| Ruta | Método | Qué hace | Qué acepta | Qué devuelve |
|---|---|---|---|---|
| `/api/admin/menu/categories` (`admin/menu/categories/route.ts:25`) | GET | Lista las categorías (`listAdminCategories`) | Nada | `{ data: CategoryRecord[] }` (`menu.types.ts:109`) |
| `/api/admin/menu/categories` (`:36`) | POST | Crea una categoría (`createCategory`) | Body `categorySchema` (`:11`): `name`, `slug`, `sortOrder` ≥ 0, `isActive`, `color` (`^#[0-9a-fA-F]{6}$`, nullable) | 201 `{ data, meta: { updatedAt } }`. 403 por rol; 409 si el slug ya existe (`create-category.ts:32`) |
| `/api/admin/menu/categories/:id` (`categories/[id]/route.ts:23`) | PATCH | Actualiza una categoría (`updateCategory`) | Ruta: `id`. Body `updateCategorySchema` (`:10`), todo opcional | 200 `{ data, meta }`. 404; 409 si el slug nuevo existe (`update-category.ts:32`) |
| `/api/admin/menu/subcategories` (`subcategories/route.ts:19`) | GET | Lista subcategorías (`listAdminSubcategories`) | Query `categoryId`; `isActive` (`"true"`/`"false"`; otro valor = ausente) | `{ data: SubcategoryRecord[] }` (`menu.types.ts:98`), con `productCount` opcional |
| `/api/admin/menu/subcategories` (`:35`) | POST | Crea una subcategoría (`createSubcategory`) | Body `subcategorySchema` (`:11`): `categoryId`, `name`, `slug`, `sortOrder`, `isActive` | 201 `{ data, meta }`. 404 si la categoría no existe; 409 si el slug ya existe en esa categoría (`create-subcategory.ts:45`) |
| `/api/admin/menu/subcategories/:id` (`subcategories/[id]/route.ts:19`) | PATCH | Actualiza y, si cambia de categoría, **mueve sus productos** | Ruta: `id`. Body opcional (`:11`) | 200 `{ data, meta: { updatedAt, movedProducts? } }` (`update-subcategory.ts:64`) |
| `/api/admin/menu/subcategories/:id` (`:62`) | DELETE | Borra una subcategoría | Ruta: `id` | **204** sin cuerpo. 409 si tiene productos (`delete-subcategory.ts:19`) |
| `/api/admin/menu/products` (`products/route.ts:44`) | GET | Lista productos con filtros (`listAdminProducts`) | Query (`:49`): `categoryId`, `subcategoryId`, `isActive`, `isAvailable` (`"true"`/`"false"`), `search` (truncado a 200) | `{ data: ProductRecord[] }` (`menu.types.ts:79`) |
| `/api/admin/menu/products` (`:70`) | POST | Crea un producto con imágenes, modificadores y reglas de bundle | Body `productSchema` (`:31`): `categoryId` (cuid), `subcategoryId?`, `name` ≤ 200, `description` ≤ 2000, `basePrice` ≥ 0, `packagingFeeAmount?`, `images[]`, `availability`, `modifierGroups[]`, `bundleRules[]` | 201 `{ data, meta }`. 422 por precio, por `bundleRules` **no vacío** o por modificadores; 404 de categoría o subcategoría; 409 si la subcategoría no pertenece a la categoría |
| `/api/admin/menu/products/:id` (`products/[id]/route.ts:46`) | GET | Devuelve un producto (`getAdminProduct`) | Ruta: `id` validado como **cuid** (`:31`) | 200 `{ data: ProductRecord }`. 400 si el id no es cuid (`:55`); 404 |
| `/api/admin/menu/products/:id` (`:68`) | PATCH | Actualiza un producto | Ruta: `id` (cuid). Body `updateProductSchema` (`:33`), todo opcional | 200 `{ data, meta }`; los mismos 422/404/409 que el POST |
| `/api/admin/menu/modifier-groups` (`modifier-groups/route.ts:27`) | GET | Lista los grupos con sus opciones | Nada | `{ data: ModifierGroupRecord[] }` (`menu.types.ts:9,16`) |
| `/api/admin/menu/modifier-groups` (`:39`) | POST | Crea un grupo con sus opciones | Body `createModifierGroupSchema` (`:18`): `name`, `isRequired`, `minSelections`, `maxSelections`, `sortOrder`, `options[]` (mín. 1) | 201. 422 por `min > max`, sin opciones o sin ninguna activa (`create-modifier-group.ts:41-69`) |
| `/api/admin/menu/modifier-groups/:id` (`modifier-groups/[id]/route.ts:28`) | GET | Devuelve un grupo | Ruta: `id` (sin validar formato) | 200 `{ data }`; 404 |
| `/api/admin/menu/modifier-groups/:id` (`:44`) | PATCH | Actualiza el grupo y **reemplaza sus opciones** | Ruta: `id`. Body opcional (`:19`) | 200. 422 por `min > max`, opciones vacías, sin opción activa o id de opción ajeno; 409 si el repositorio rechaza |
| `/api/admin/menu/marketing-blocks` (`marketing-blocks/route.ts:35`) | GET | Lista los bloques de marketing | Nada | `{ data: MenuMarketingBlockRecord[] }` (`menu.types.ts:48`) |
| `/api/admin/menu/marketing-blocks` (`:46`) | POST | Crea un bloque | Body (`:21`): `type` (promo/event/combo/featured/info), `title`, `description?`, `imageUrl?`, `ctaLabel?`, `ctaType` (none/product/category/url), `ctaTarget?`, `isActive`, `sortOrder`, `startsAt?`, `endsAt?` | 201. 422 por `sortOrder` < 0, `endsAt` anterior a `startsAt` o `ctaTarget` inválido; 404 si el producto o la categoría del CTA no existe o está inactivo |
| `/api/admin/menu/marketing-blocks/:id` (`marketing-blocks/[id]/route.ts:34`) | PATCH | Actualiza un bloque | Ruta: `id`. Body opcional (`:20`) | 200; las mismas validaciones que el POST. **`null` no borra** `description`/`imageUrl`/`ctaLabel`/`ctaTarget` (ver §5) |
| `/api/menu` (`menu/route.ts:11`) | GET | **La carta pública**, con precios y disponibilidad del local (`getPublicMenu`) | Query (`:14`): `category` (slug), `locationId`, `includeUnavailable` (`"true"`) | 200 `{ categories, marketingBlocks, generatedAt }` con `no-store` (`:26`); `basePrice` ya resuelto al precio del local (`apply-location-pricing.ts:42,60`) |
| `/api/admin/inventory/items` (`inventory/items/route.ts:21`) | GET | Lista items de inventario | Query (`:26`): `isActive`, `lowStockOnly`, `search` (sin truncar) | `{ data: InventoryItemRecord[], meta: { total } }` (`inventory.types.ts:1`). **Sin chequeo de rol** (`:23`) |
| `/api/admin/inventory/items` (`:39`) | POST | Crea un item | Body `itemSchema` (`:12`): `name`, `unit`, `category`, `currentEstimatedStock` ≥ 0, `lowStockThreshold` ≥ 0, `isActive?` | 201 `{ data }` (**sin `meta`**). 403 solo owner (`canManageCriticalConfig`, `:43`) |
| `/api/admin/inventory/alerts` (`inventory/alerts/route.ts:10`) | GET | Lista las alertas de stock bajo | Nada | `{ data: InventoryAlert[], meta: { total } }`, con `severity` warning/critical (`inventory.types.ts:45`). 403 por rol (`:14`) |
| `/api/admin/inventory/counts` (`inventory/counts/route.ts:17`) | POST | Registra un conteo y **ajusta el stock** | Body `countSchema` (`:11`): `inventoryItemId`, `countedQuantity` ≥ 0, `notes?`. Header `x-idempotency-key` opcional (`:47`) | 201 `{ data: InventoryCountRecord }`; `countedByUserId` sale de la sesión (`:51`) |
| `/api/admin/inventory/waste` (`inventory/waste/route.ts:18`) | POST | Registra una merma y **descuenta stock** | Body `wasteSchema` (`:11`): `inventoryItemId`, `quantity` ≥ 0, `reason`, `notes?`. Header `x-idempotency-key` (`:48`) | 201 `{ data: InventoryWasteRecord }`; 404 si el item no existe (`:38`) |
| `/api/admin/inventory/receive` (`inventory/receive/route.ts:17`) | POST | Registra una recepción y **suma stock** | Body `receiveSchema` (`:11`): `inventoryItemId`, `receivedQuantity` ≥ 0, `notes?`. Header `x-idempotency-key` (`:47`) | 201 `{ data: InventoryReceiveRecord }` |
| `/api/admin/inventory/movements` (`inventory/movements/route.ts:17`) | GET | Lista movimientos de inventario | Query `querySchema` (`:11`): `inventoryItemId?`, `type` (count/receive/waste), `limit` (1-200, default 50) | `{ data: InventoryMovementRecord[], meta: { total, limit } }` (`inventory.types.ts:54`) |

**Lo que NO existe en estas dos carpetas** (verificado por listado completo de archivos): no hay rutas
de **bundles** (solo el campo `bundleRules`, que los casos de uso rechazan con 422 si viene con
elementos); no hay `DELETE` de productos, categorías, grupos de modificadores ni bloques de marketing;
no hay `GET` de detalle de categoría ni de subcategoría; el inventario no tiene **detalle, edición ni
borrado** de items (`items/[id]` no existe) ni lectura de conteos; y los `GET` de menú leen sus query
params **sin zod** (`products/route.ts:49`, `subcategories/route.ts:23`, `menu/route.ts:14`), así que
no hay una lista de valores válidos que documentar más allá de `"true"`/`"false"`.

### 3.3 El resto: configuración, locales, usuarios, promos, reportes, auth, público y staging

49 combinaciones ruta+método en 39 archivos.

| Ruta | Método | Qué hace | Qué acepta | Qué devuelve |
|---|---|---|---|---|
| `/api/admin/business-settings` (`admin/business-settings/route.ts:22`) | GET | Lee la fila única de configuración del negocio; si no existe, devuelve los defaults | Nada | 200 `BusinessSettingsRecord` completo (`business-settings.types.ts:55-108`: nombre, colores, fuentes, contacto, horarios, moneda, `usdExchangeRate`, propina, aceptación). 403 si el rol no es `owner` |
| `/api/admin/business-settings` (`:47`) | PUT | Guarda un parche de la configuración y audita `updatedByUserId` | Body parche con ~30 campos opcionales (`business-settings.schema.ts:129-246`), incluido `businessHours` por día y `usdExchangeRate` | 200 el registro completo. 400 si el body no es un objeto; 422 con `fields` por campo (o `pickupMaxMinutes < pickupLeadMinutes`, `:38-45`) |
| `/api/admin/dashboard/summary` (`admin/dashboard/summary/route.ts:9`) | GET | Contadores del tablero (`getDashboardSummary`) | Nada | 200 `{ data: { ordersToday, ordersPending, reservationsToday, reservationsPendingAction, inventoryCriticalAlerts, recentActivityCount }, meta: { generatedAt } }`. El «hoy» se calcula con `setHours` sobre la hora del servidor, **no** con la zona del negocio (`get-dashboard-summary.ts:4-8`) |
| `/api/admin/overview/performance` (`admin/overview/performance/route.ts:17`) | GET | Tablero de operación del período (`getAdminOverviewPerformance`), con la zona del negocio | Query: `period` (today/7d/30d/month, default 7d) y `channel` (all/delivery/pickup) | 200 `{ data: { metrics: { completedOrderValue, completedOrderCount, averageTicket }, series, topProducts }, meta: { timeZone, period, channel, ranges } }`. 400 si `period`/`channel` no están en el enum |
| `/api/admin/activity/recent` (`admin/activity/recent/route.ts:18`) | GET | Últimos movimientos unificados (órdenes, reservas, inventario) | Query `limit` (1..100, ausente = 20) | 200 `{ data: [{ type, id, description, occurredAt }], meta: { limit, count } }`. 403 si el rol no es `owner` |
| `/api/admin/locations` (`admin/locations/route.ts:18`) | GET | Lista los locales; **usa Prisma directo, sin caso de uso** (`:22-25`) | Nada | 200 `{ data: LocationRecord[] }` con horarios, `posEnabled`, `acceptAlertMinutes`, `prepAlertMinutes`, etc. (`location.types.ts:13-51`) |
| `/api/admin/locations` (`:31`) | POST | Crea un local (`createLocation`) | Body `locationSchema` (`location-payload.ts:26-58`): nombre, slug, horarios de los 7 días, `pickupLeadMinutes` 0-180, `pickupMaxMinutes` 0-240, `acceptAlertMinutes` 1-120 (10), `prepAlertMinutes` 1-120 (15), `isAcceptingOrders`, `posEnabled`, `closedMessage` | 201 `{ data, meta }`. 403 solo owner; 409 si el slug existe; 422 con `fields` |
| `/api/admin/locations/:id` (`admin/locations/[id]/route.ts:20`) | PATCH | **Reemplaza el local completo** (no es parche) | Ruta: `id`. Body: el mismo `locationSchema` | 200. 404; 409 si el slug lo usa otro local **o si intenta apagar el último local activo** (`:47-59`) |
| `/api/admin/locations/:id` (`:48`) | DELETE | Borra un local (inyecta el repo de pedidos para contar) | Ruta: `id` | 200 `{ data: { id }, meta }`. 409 si es el único local, el último activo o **si tiene pedidos** (`delete-location.ts:33-50`) |
| `/api/admin/locations/:id/products` (`locations/[id]/products/route.ts:16`) | GET | Catálogo del local: precio y disponibilidad por producto | Ruta: `id` | 200 `{ data: [{ productId, name, basePrice, price, hasPriceOverride, isAvailable, isSold }], meta: { location, total, sold, unavailable, overridden } }` |
| `/api/admin/locations/:id/products/:productId` (`…/[productId]/route.ts:25`) | PUT | Fija precio y disponibilidad de un producto en ese local | Ruta: `id`, `productId`. Body: `priceOverride` (número o null), `isAvailable`, `isActive` | 200 `{ data: LocationProductRecord \| null, meta }` (`null` si no hay excepción que guardar). 422 si el precio es negativo o tiene más de dos decimales (`location-product-rules.ts:29-41`) |
| `/api/admin/delivery-zones` (`admin/delivery-zones/route.ts:19`) | GET | Lista las zonas de reparto (`listAdminDeliveryZones`) | Nada | 200 `{ data: DeliveryZoneRecord[] }` (nombre, descripción, `baseFee`, `isActive`, `sortOrder`; `order.types.ts:77-86`) |
| `/api/admin/delivery-zones` (`:31`) | POST | Crea una zona de reparto (`createDeliveryZone`) | Body `createDeliveryZoneSchema` (`:11-17`): `name`, `description?`, `baseFee` ≥ 0, `isActive`, `sortOrder` | 201 `{ data, meta: { updatedAt } }`. 403 si el rol no es `owner`; 409 si ya hay una zona con ese nombre, sin distinguir mayúsculas (`create-delivery-zone.ts:36-41`) |
| `/api/admin/delivery-zones/:id` (`delivery-zones/[id]/route.ts:19`) | GET | Devuelve una zona (`getAdminDeliveryZone`) | Ruta: `id` | 200 `{ data: DeliveryZoneRecord }`; 404 si no existe |
| `/api/admin/delivery-zones/:id` (`:35`) | PATCH | Actualiza parcialmente una zona (`updateDeliveryZone`) | Ruta: `id`. Body `updateDeliveryZoneSchema` (`:11-17`), todo opcional | 200 `{ data, meta: { updatedAt } }`. 404; 409 si el nombre choca con otra zona |
| `/api/admin/users` (`admin/users/route.ts:27`) | GET | Lista los usuarios del panel | Nada | 200 `{ data: [{ id, name, email, role, locationIds }] }` (`admin-user-view.ts:13-21`; el hash nunca sale). 403 si el rol no es `owner` |
| `/api/admin/users` (`:42`) | POST | Crea un usuario (hashea la contraseña y valida sucursales) | Body `createUserSchema` (`:12-25`): `name` 1-120, `email`, `password` 8-200, `role` (owner/manager/kitchen/cashier), `locationIds` ≤ 50 | 201 `{ data }`. 400 si el correo existe o alguna sucursal no existe; 403 si el rol no es `owner` |
| `/api/admin/users/:id` (`admin/users/[id]/route.ts:35`) | PATCH | Cambia rol y/o sucursales de un usuario | Ruta: `id`. Body `updateUserSchema` (`:18-33`): `role?`, `locationIds?`, con `refine` que exige al menos uno | 200 `{ data }`. 400 si se intenta dejar el sistema sin owner; el error de zod **siempre** dice `fields.role` aunque el campo inválido sea otro (`:45-49`) |
| `/api/admin/users/:id` (`:81`) | DELETE | Borra un usuario | Ruta: `id` | 200 `{ data: { id } }`. 400 si intenta borrarse a sí mismo o es el último owner; 403 si el rol no es `owner` |
| `/api/admin/promotions` (`admin/promotions/route.ts:21`) | GET | Lista promos con su estado resuelto | Nada | 200 `{ data: AdminPromotion[] }` = cupón + `status` (active/inactive/expired/exhausted) (`list-promotions.ts:13-15`) |
| `/api/admin/promotions` (`:34`) | POST | Crea una promo | Body `promotionSchema` (`promotion-payload.ts:11-23`): `code` 3-24, `type` (percentage/fixed_amount/bogo), `value`, `usageLimit`, `expiresAt`, `buyQuantity`, `freeQuantity`, `scopeType`, `scopeId` | 201. 403 si no es owner ni manager; 409 si el código existe; 422 por las reglas de promo (`promotion-rules.ts:33-78`) |
| `/api/admin/promotions/:id` (`:20` / `:63`) | PATCH / DELETE | Reemplaza una promo completa / la borra | Ruta: `id`. PATCH: mismo `promotionSchema` | 200. 409 si el código lo usa otra promo (PATCH); 404 |
| `/api/admin/reports/daily` (`admin/reports/daily/route.ts:19`) | GET | Reporte diario agregado | Query: `dateFrom` y `dateTo` **obligatorios** (deben parsear) | 200 `{ data: { orders: { totalCount, totalRevenue, byStatus }, reservations: { totalCount, byStatus } }, meta }`. 403 si el rol no es `owner` |
| `/api/admin/reports/inventory` (`admin/reports/inventory/route.ts:19`) | GET | Reporte de movimientos de inventario del rango | Query: `dateFrom`, `dateTo` obligatorios | 200 `{ data: { movements: { counts, receives, wastes, total }, items: [{ itemId, itemName, netChange }] }, meta }`. 403 si no es owner ni manager |
| `/api/admin/reservations` (`admin/reservations/route.ts:10`) | GET | Lista reservas (fuera del MVP) | Query `status` y `date` **sin zod** (`:18-20`) | 200 `{ data: ReservationRecord[], meta: { count } }`. 403 si el rol no es `owner` |
| `/api/admin/reservations/:id` (`:10`) | GET | Devuelve una reserva | Ruta: `id` | 200 `{ data }`; 404 |
| `/api/admin/reservations/:id/status` (`reservations/[id]/status/route.ts:24`) | PATCH | Cambia el estado de la reserva; publica `ReservationApproved` | Ruta: `id`. Body: `status` (6 valores) + `reason?` | 200 `{ data, meta: { reason } }`. 409 si la transición no es válida (`reservation-workflows.ts:3-10`) |
| `/api/admin/tables` (`admin/tables/route.ts:28`) | GET | Lista las mesas **con `getPrismaClient()` directo en el handler** (`:32-45`) | Nada | 200 `{ data: [{ id, label, isActive, capacity, locationId, qrToken, … }], meta: { total } }` |
| `/api/admin/tables` (`:56`) | POST | Crea una mesa con Prisma directo; genera `qrToken` y reintenta hasta 5 veces | Body `createTableSchema` (`:10-15`): `label`, `capacity` 1-100, `locationId?`, `isActive?` | 201. 403 si el rol no es `owner`; 500 si los 5 intentos fallan |
| `/api/admin/tables/:id` (`tables/[id]/route.ts:16`) | PATCH | Actualiza una mesa con Prisma directo | Ruta: `id`. Body opcional (`:9-14`) | 200. 400 si no manda ningún campo; 403 si no es owner. **Un `id` inexistente no está mapeado a 404** |
| `/api/admin/outbox/events` (`admin/outbox/events/route.ts:10`) | GET | Lista los eventos de la outbox de notificaciones | Query `status` y `eventType` **sin zod ni validación de enum** (`:18-20`) | 200 `{ data }` **sin `meta`** (aunque su test espera `meta.count`); 403 si el rol no es `owner` |
| `/api/auth/admin/login` (`auth/admin/login/route.ts:30`) | POST | Login del panel: escribe la cookie `ob_admin_session` | Body: `email`, `password` | 200 `{ data: { user } }` + `Set-Cookie`. 401 «Correo o contraseña incorrectos.»; **429** (10/min por IP, `ADMIN_LOGIN_RATE_LIMIT`) |
| `/api/auth/admin/logout` (`auth/admin/logout/route.ts:8`) | POST | Revoca la sesión y borra la cookie | Cookie opcional | **204** sin cuerpo. Sin `try/catch`: un fallo del repo no se mapea |
| `/api/auth/admin/session` (`auth/admin/session/route.ts:9`) | GET | Devuelve la sesión actual | Cookie | 200 `{ data: { isAuthenticated: true, user } }`; 401 «Admin session expired» |
| `/api/coupons/validate` (`coupons/validate/route.ts:33`) | POST | Valida un código de promo (informativo: el descuento real lo aplica `POST /api/orders`) | Body: `code` | 200 `{ data: { code, type, value, buyQuantity, freeQuantity, scopeType, scopeId } }` con `no-store`. 404 «No encontramos ese código.»; 409 si existe pero no es usable; 429 (20/min) |
| `/api/customer/auth/request-otp` (`customer/auth/request-otp/route.ts:25`) | POST | Pide un OTP por WhatsApp | Body: `whatsapp` | 200 `{ data: { ok: true, maskedWhatsapp, expiresInSeconds } }`. 429 (5/min por IP o cooldown por WhatsApp); 503 `PROVIDER_NOT_CONFIGURED` en producción sin remitente real |
| `/api/customer/auth/verify-otp` (`customer/auth/verify-otp/route.ts:30`) | POST | Verifica el OTP, crea/actualiza el cliente y escribe `ca_customer_session` | Body: `whatsapp`, `code`, `fullName?` | 200 `{ data: { customer, session } }` + `Set-Cookie`. 401 «Invalid verification code»; 429 (10/min) |
| `/api/customer/auth/logout` (`customer/auth/logout/route.ts:8`) | POST | Revoca la sesión de cliente | Cookie | 204. Sin `try/catch` |
| `/api/customer/me` (`customer/me/route.ts:9`) | GET | Sesión del cliente actual | Cookie | 200 `{ data: { isAuthenticated, customer } }`; 401 |
| `/api/locations` (`locations/route.ts:16`) | GET | Locales activos para el checkout (**público, sin auth**) | Nada | 200 `{ data: [{ id, name, addressLine, city, businessHours, pickupLeadMinutes, isAcceptingOrders, closedMessage, … }] }` con `no-store` |
| `/api/health` (`health/route.ts:8`) | GET | Salud del proceso; **no consulta la base** | Nada | 200 `{ status: "ok", service, timestamp, version }` con `no-store` |
| `/api/readiness` (`readiness/route.ts:9`) | GET | Readiness: hace `SELECT 1` | Nada | 200 `{ status: "ready", checks: { database: { status: "ok", latencyMs } } }`; **503** `{ status: "unavailable", checks: { database: { status: "error" } } }` |
| `/api/internal/outbox/process` (`internal/outbox/process/route.ts:117`) | POST | Procesa el lote de eventos pendientes de la outbox (Telegram / n8n) | Header `x-outbox-processor-secret` (comparación en tiempo constante). Config por entorno (`OUTBOX_PROCESSOR_*`) | 200 `{ data: { processed, failed } }`. 403 «Processor disabled»; 401 si el secreto no coincide; 412 si el sender no está configurado |
| `/api/internal/staging/admin-qa` (`internal/staging/admin-qa/route.ts:68`) | POST | Crea o borra el admin temporal de QA (solo `APP_ENV=staging`) | Header `x-staging-admin-qa-token`. Body: `action` (create/delete) | 200 con la contraseña temporal en `create`. 403 fuera de staging; 401 con token inválido |
| `/api/internal/staging/persistent-admin` (`…/persistent-admin/route.ts:80`) | POST | Alta o baja del admin persistente de staging | Header token. Body: `action` (upsert/disable) | 200 con `outcome`; 500 `SERVER_MISCONFIGURATION` si faltan las credenciales |
| `/api/internal/staging/seed` (`…/seed/route.ts:60`) | POST | Siembra datos de demo (`STG-*`) en staging, con `dryRun` | Header token. Body: `dryRun` obligatorio. Requiere `STAGING_SEED_CONFIRM` | 200 `{ data: { plan, simulatedOrApplied, current } }`; 403 fuera de staging |
| `/api/internal/staging/seed-cleanup` (`…/seed-cleanup/route.ts:51`) | POST | Borra los datos sembrados `STG-*` | Header token. Requiere `STAGING_SEED_CLEANUP_CONFIRM` | 200 `{ data: { removed: { reservations, tables, products, inventoryItems } } }` |
| `/api/internal/staging/inventory-qa-cleanup` (`…/inventory-qa-cleanup/route.ts:51`) | POST | Borra tres registros de inventario de QA con ids fijos | Header token | 200 con `precheck`, `deleted` y `postcheck` |

**Lo que NO existe como ruta** (se buscó por nombre y por listado completo de archivos):
`/api/admin/settings`, `/api/admin/exchange-rate` y `/api/admin/auth/**` **NO EXISTEN**: la
configuración del negocio vive en `/api/admin/business-settings` (con `usdExchangeRate` adentro,
`business-settings.schema.ts:193-198`) y la autenticación del panel en `/api/auth/admin/**`.

### 3.4 Cosas que el inventario de endpoints deja a la vista

- **`AMBIGUO` — Prisma dentro del handler:** `admin/tables/route.ts:4,32,86` y
  `admin/tables/[id]/route.ts:4` importan `getPrismaClient()` y consultan la base en el route handler,
  contra la regla explícita de `AGENTS.md` («Prohibido importar `getPrismaClient()` o `@prisma/client`
  desde un `route.ts`»). También `admin/locations/route.ts:22-25` consulta con el repositorio directo,
  sin caso de uso.
- **`AMBIGUO` — el error de `PATCH /api/admin/users/:id`:** responde siempre
  `fields: { role: "Rol o sucursales inválidas" }` (`:45-49`), incluso cuando el campo inválido es
  `locationIds` o el body viene vacío. La UI que quiera pintar el error en el campo correcto no tiene
  de dónde sacarlo.
- **`AMBIGUO` — `outbox/events` sin `meta`:** el caso de uso devuelve `{ data }`
  (`list-outbox-events.ts:10-12`) mientras su test afirma `body.meta.count`
  (`admin/outbox/events/route.test.ts:73-85`).
- **Sin validación de query:** `admin/reservations` (`status`, `date`) y `admin/outbox/events`
  (`status`, `eventType`) pasan los strings crudos al adaptador. `PATCH /api/admin/tables/[id]` con un
  `id` inexistente **no** devuelve 404 mapeado.
- **Los locales y las mesas no tienen chequeo de rol para leer**: `GET /api/admin/locations` y
  `GET /api/admin/tables` solo piden sesión (cualquier rol), a diferencia del resto del panel.

---

### 3.5 Lo que quedó sin verificar (`NO VERIFICABLE`)

Tres cosas no se pudieron confirmar leyendo el código. Quedan listadas para que nadie las dé por hechas
al diseñar:

- **El status HTTP con un valor fuera del enum** en `GET /api/admin/outbox/events` (`status`) y
  `GET /api/admin/reservations` (`status`): el handler pasa el string crudo y el adaptador lo castea a
  Prisma (`prisma-outbox-repository.ts:63-65`, `prisma-reservation-repository.ts:89-95`), pero no hay
  test que lo fije y no se ejecutó la aplicación.
- **El status de `PATCH /api/admin/tables/[id]` con un `id` inexistente**:
  `prisma.table.update` (`tables/[id]/route.ts:64-77`) no mapea «no encontrado» y
  `createErrorResponse` solo traduce el error de inicialización de Prisma
  (`error-response.ts:162-172`); el test cubre 200/400/401/403.
- **La forma exacta que devuelve `PrismaBusinessSettingsRepository.update`** respecto del tipo
  `BusinessSettingsRecord` (si normaliza algún valor): no se leyó el adaptador completo.

Aclaración de alcance: el total de `route.ts` bajo `src/app/api` es **70** (verificado por listado de
archivos); las 49 combinaciones de §3.3 son consistentes con ese total.

## 4. Qué NO existe pero sería útil

Complejidad estimada, en orden de magnitud (**Fácil** ≤ 1 día · **Media** 2-5 días · **Difícil** >
1 semana). La estimación es mía y no incluye diseño ni QA.

| Feature | ¿Existe? | Complejidad | Notas |
|---|---|---|---|
| **Tiempo real** (SSE o WebSocket) para el KDS | NO EXISTE | Difícil | Hoy el tablero se refresca cada **15 s** (`orders/page.tsx:132`). Con una sola réplica, SSE sería **Media**; multi-réplica pide un bus de eventos |
| **Contadores por estado en el servidor** | NO EXISTE (sí en el cliente) | Fácil | `ordersStatusCounts` y `comandaCounters` se calculan en el navegador sobre la lista completa (`page.tsx:436`, `:566`, `comanda-helpers.ts:66-80`) |
| **Paginación** en los listados del panel | NO EXISTE | Media | `listOrders` no tiene `take`/`skip` (`prisma-order-repository.ts:401-453`). Hay **topes** (inventario `limit` ≤ 200, actividad ≤ 100), que no son páginas |
| **Historial de cajas** (turnos pasados con su arqueo) | PARCIAL | Fácil | `listShifts` existe en el puerto y en los dos adaptadores (`shift-repository.ts:49`, `prisma-shift-repository.ts:172`) y **ningún endpoint ni pantalla lo usa**: solo se puede ver el turno abierto |
| **Movimientos de caja** (retiro / ingreso con motivo) | NO EXISTE | Media | No hay modelo; cambia el esperado del arqueo, así que toca el cierre |
| **Devoluciones / reembolsos** | NO EXISTE | Difícil | Un pedido **cobrado y luego cancelado sigue sumando al arqueo**: `updateOrderStatus` no toca los pagos (`update-order-status.ts:32-44`) |
| **Atribuir un cobro a un turno** (`Payment.shiftId`) | NO EXISTE | Fácil | Hoy la atribución es por **ventana de tiempo** (`openedAt`/`closedAt`). Es A-18 del backlog |
| **Imprimir la comanda o el ticket** | NO EXISTE | Media | Sin `window.print` ni librería térmica. Lo único imprimible es el **JPG del recibo** por la hoja del sistema (`receipt-image.ts:142-144`) |
| **Log de auditoría general del staff** | PARCIAL | Media | Hay actor en el historial de estados (`OrderStatusHistory.changedByUserId`), en settings (`updatedByUserId`) y en inventario. No hay una tabla transversal ni un visor; el feed de actividad **no dice quién** |
| **Modo kiosco** (ruta propia del KDS, sin shell del panel) | NO EXISTE | Fácil | Existe pantalla completa + «modo inmersivo» **dentro** de `/admin/orders` (`use-comanda-view.ts:14-25,45-84`) |
| **Notificaciones del navegador** (Web Push) | NO EXISTE | Media | Hay service worker de PWA (`pwa-update-gate.tsx:190`) pero sin `pushManager` ni `showNotification` |
| **Sonido configurable** (elegir tono o volumen) | PARCIAL | Fácil | Un solo tono sintetizado (dos notas), on/off guardado en `localStorage` (`admin-alert-sound.ts:14-15,26-37`) |
| **Filtrar por varios estados a la vez** | NO EXISTE | Fácil | `status` es un valor único en el query (`admin/orders/route.ts:18-33`) |
| **Filtrar por método de cobro real** (transferencia, mixto, otro) | NO EXISTE | Fácil | El filtro usa `PaymentMethod` (cash/card), no `PaymentMethodType` (`admin/orders/route.ts:53`) |
| **Exportar** (CSV/Excel) | NO EXISTE | Fácil | Nada exportable salvo la imagen del recibo |
| **Buscar por monto, tipo o rango de fecha del cobro** | NO EXISTE | Fácil | La búsqueda es por número, nombre, WhatsApp y PIN (`order-search.ts:37-43`) |
| **Sellos de tiempo por etapa como columnas** (`confirmedAt`, `readyAt`) | NO EXISTE | Media | Se derivan del historial; el promedio ya se calcula así (`order-stage-times.ts:29-59`) |
| **Páginas de reportes** | NO EXISTE (las APIs sí) | Fácil | `/api/admin/reports/daily` y `/api/admin/reports/inventory` existen **sin página** |
| **Cierre de caja con desglose por medio de pago** | NO EXISTE | Fácil | El esperado del cierre **solo cuenta efectivo** (`close-shift.ts:139`); tarjeta y transferencia no se reportan (A-17) |
| **Propina por el mostrador** | NO EXISTE | Fácil | El POS manda `tipOptIn: false` (`register-pos-sale.ts:97`), así que `Payment.tip` siempre es 0 por ese camino |
| **Interruptor de modo oscuro** | NO EXISTE | Media | Los tokens `.dark` existen y un contrato los mide, pero **nada en la app activa la clase** (ver §5) |
| **Multi-idioma** | NO EXISTE | Difícil | Todo el copy está en español, en el código |

**Lo que sí se puede hacer hoy sin tocar nada** (para no pedir features que ya están): ver el KDS con
todas las sucursales a la vez (owner sin filtro), filtrar por sucursal, buscar por PIN, pantalla
completa, sonido de pedido nuevo, promedio de preparación y umbrales de urgencia por local.

---

## 5. Qué existe diferente a lo esperado

| Esperado | Real | Diferencia |
|---|---|---|
| Una pantalla de **KDS** con su ruta | **NO EXISTE** `/admin/kds`: el KDS es la vista `today` de `/admin/orders` (dos vistas en la misma página, `orders/page.tsx:309`, `:1150-1153`) | Comparte URL con el historial; el «modo tablero» es un estado de la página, no una pantalla |
| Una pantalla de **caja** en `/admin/cash` | La caja vive dentro de **`/admin/pos`** (`admin-mobile-nav.tsx:55`); no hay `/admin/cash` ni `/admin/shifts` | La venta y el arqueo comparten pantalla |
| Estado **`ready`** para un pedido de retiro | Para **retiro** el estado es **`ready_for_pickup`**; `ready` es del flujo de **delivery** (`order-workflows.ts:7` vs `:17`) | Un KDS que filtre por `ready` **no ve los pedidos de retiro listos**. La UI los agrupa en el carril «Listas» (`comanda-helpers.ts:43`) |
| Método de pago **«contra entrega»** | **NO EXISTE**. El pago es **en el local al retirar**; `PaymentMethod` solo tiene `cash`/`card` declarados y `PaymentMethodType` (al cobrar) suma `transfer`/`mixed`/`other` (`schema.prisma:338-353`) | Lo que un KDS llamaría «pago pendiente al retirar» acá es el flujo por defecto, no un método |
| Número de pedido correlativo (`0042`) | `orderNumber` es **`P-` / `D-` / `T-` + el timestamp en base 36**, generado en el alta (`create-order.ts:445-446`) | No es correlativo ni corto: no sirve para ordenar la cola por número |
| **Timestamps de cada etapa** en el pedido | **NO EXISTEN** como columnas: `Order` solo tiene `createdAt`/`updatedAt` (`schema.prisma:477-478`); las etapas salen de `OrderStatusHistory` (`:532-545`) | Para saber cuándo pasó a «listo» hay que leer el historial; el promedio ya lo hace así |
| **PIN de retiro** | Existe (`Order.pickupPin`, `schema.prisma:463`) y es buscable (`order-search.ts:43`), pero **no autoriza nada**: identifica, no autentica (la autorización es `orderNumber` + token, `:461-463`) | Un mockup que use el PIN como contraseña del mostrador inventa una regla |
| Un cobro **atado a un turno** | `Payment` **no tiene `shiftId`** (`schema.prisma:732-753`): el arqueo atribuye los cobros por **ventana de tiempo** | Recalcular un cierre viejo usa la tasa de cambio de hoy (A-18) |
| **Modo oscuro** funcionando | Los tokens y el bloque `.dark` existen y los contratos los miden, pero **no hay interruptor ni detección del sistema**: la clase `dark` no la pone nadie en la app (grep de `setTheme`/`prefers-color-scheme`/`classList`: 0 en componentes) | El mockup tiene barra Light/Dark; **el producto no**. En dark, el panel hoy se ve claro |
| Los 8 tokens del ADN en uso | Están declarados y expuestos como utilidad, pero **casi ninguna pantalla los usa**: el código aplica los alias viejos (`bg-success`, `text-danger-foreground`) y `text-kpi` **no lo usa nadie** (Tailwind no emite esa clase) | Los tokens nuevos son el destino de la migración, no el presente |
| `POST /api/orders/:id/items` público | **Exige sesión de staff** (`orders/[id]/items/route.ts:24-30`): es para pedidos de mesa, fuera del MVP | El prefijo público engaña |
| `/api/admin/settings` y `/api/admin/exchange-rate` | **NO EXISTEN** como rutas: la configuración es `PUT /api/admin/business-settings` y el tipo de cambio es un campo adentro | Diseñar una pantalla de «tipo de cambio» aparte es diseñar contra una API que no está |
| Roles «owner/manager/kitchen» | Son **cuatro**: owner, manager, kitchen y **cashier** (`admin-role.ts:1-7`), y el alcance por sucursal tiene una regla contraintuitiva: **sin sucursales asignadas, ve todas** (a propósito, `order-visibility.ts:8-15`) | Un mockup de permisos tiene que contemplar `cashier` |
| Un solo semáforo de urgencia | Hay **dos**: urgencia **por etapa** (`acceptAlertMinutes`/`prepAlertMinutes` del local, `comanda-helpers.ts:150-183`) y **retiro prometido** (`--pickup-*`, `admin-pickup-timing.ts:27,81`) | Confundirlos cambia el color de la fila entera |
| `bundleRules` como feature de combos | El zod lo acepta (`products/route.ts:41`) y el caso de uso lo **rechaza con 422** si viene con elementos (`create-product.ts:78`) | **AMBIGUO**: el contrato del schema y el de la regla no dicen lo mismo. No hay rutas de bundles |
| `null` para borrar un campo de un bloque de marketing | `PATCH` con `null` **conserva** el valor previo (usa `??`, `update-marketing-block.ts:38-42`), salvo en `startsAt`/`endsAt` que sí distinguen `null` de `undefined` (`:45-46`) | Dos comportamientos para el mismo `null` en la misma ruta |
| El dashboard «de hoy» en la zona del negocio | `/api/admin/dashboard/summary` calcula el día con `setHours` sobre la **hora del servidor** (`get-dashboard-summary.ts:4-8`), a diferencia de `overview/performance` que sí usa la zona del negocio | Dos definiciones de «hoy» en el mismo panel |
| Las mesas y los locales como el resto del panel | `admin/tables/**` usa **Prisma directo** en el handler (`tables/route.ts:4,32,86`) y `GET /api/admin/locations` consulta el repo sin caso de uso; `GET` de locales y mesas **no chequean rol** | Contradice las reglas de `AGENTS.md` (AMS: `AMBIGUO`, no una decisión de producto) |
| `meta` en las respuestas | `GET /api/admin/outbox/events` devuelve solo `{ data }` aunque su test espera `meta.count`; y el error de `PATCH /api/admin/users/:id` siempre nombra `role` | Inconsistencias que un mockup de tabla puede dar por hechas |

---

## 6. Las 27 preguntas del KDS

### Modelo de Order

**1. ¿Qué campos tiene `Order`?** Los 47 campos, en `prisma/schema.prisma:428-498`:

| Campo | Tipo | Nullable | Nota |
|---|---|---|---|
| `id` | String (cuid) | no | PK |
| `orderNumber` | String **@unique** | no | `P-`/`D-`/`T-` + timestamp base 36 (`create-order.ts:445-446`) |
| `locationId` | String | no | FK a `Location` (`:480`) |
| `orderLookupTokenHash` | String | sí | Hash del token de consulta pública (`:434`) |
| `idempotencyKey` | String **@unique** | sí | Clave de operación del cliente (`:435-438`) |
| `type` | `OrderType` | no | delivery · pickup · table |
| `status` | `OrderStatus` | no | default `new` |
| `customerName` | String | no | |
| `customerWhatsapp` | String | no | |
| `customerEmail` | String | sí | Lo pidió el owner para el mostrador (`:443-444`) |
| `customerId` | String | sí | FK a `Customer` (`:482`) |
| `address`, `deliveryNotes` | String | sí | Delivery (fuera del MVP) |
| `deliveryFeeStatus` | String | sí | default `pending_manual_validation` |
| `deliveryFeeAmount` | Decimal(10,2) | no | default 0 |
| `pickupTime` | DateTime | sí | **Existe siempre** (lo antes posible = ahora + preparación) |
| `pickupScheduled` | Boolean | no | `false` = «lo antes posible» (`:451-454`) |
| `pickupNotes` | String | sí | |
| `tableId` | String | sí | FK a `Table` (`:479`) |
| `paymentMethod` | `PaymentMethod` | no | Lo que **declara** el cliente (cash/card) |
| `paidWithAmount` | Decimal(10,2) | sí | Para el vuelto (T12) |
| `pickupPin` | String | sí | Código corto para dictar; **no autoriza** (`:461-463`) |
| `couponId`, `couponCode` | String | sí | |
| `subtotal`, `discount`, `packagingAmount`, `tipAmount`, `total` | Decimal(10,2) | no | `tipAmount` default 0 |
| `tipRate` | Decimal(5,2) | sí | |
| `deliveryZoneId`, `customerLat`, `customerLng`, `geoAccuracy`, `geoCapturedAt` | varios | sí | Delivery |
| `createdAt`, `updatedAt` | DateTime | no | **Los únicos sellos del pedido** |

Relaciones: `table`, `location`, `coupon`, `customer`, `deliveryZone`, `items[]`,
`statusHistory[]`, `payments[]` (`:479-487`). Índices por `type`, `status`, `createdAt`, `locationId`,
`pickupTime`, `tableId`, `couponId`, `customerId`, `deliveryZoneId` (`:489-497`).

**2. ¿Tiene `orderNumber`? ¿Formato?** **SÍ** (`:430`). Formato
`` `${prefix}-${Date.now().toString(36).toUpperCase()}` `` con prefijo `D` (delivery), `P` (pickup) o
`T` (mesa) (`create-order.ts:444-446`). Ejemplo del formato: `P-M8F3K2ZQ`. **No es correlativo.**

**3. ¿Tiene `customerWhatsapp`?** **SÍ**, `String` obligatorio (`:442`).

**4. ¿Tiene `pickupPin`?** **SÍ**, `String?` (`:463`), un código corto para dictar en caja; se
devuelve en el detalle público (`get-public-order.ts:71`) y es buscable (`order-search.ts:43`).

**5. ¿Tiene `customerName`?** **SÍ**, `String` obligatorio (`:441`).

**6. ¿Timestamps de cada etapa?** **NO EXISTEN como columnas.** El pedido solo tiene `createdAt` y
`updatedAt` (`:477-478`). Los sellos de etapa viven en **`OrderStatusHistory`** (`:532-545`): `status`,
`note?`, `changedByUserId?` (sin FK, a propósito) y `createdAt`. De ahí se derivan el primer «listo»
y la etapa actual (`order-stage-times.ts:30-59`).

**7. ¿Tiene `locationId`?** **SÍ**, obligatorio con FK a `Location` (`:433`, `:480`), con índice
(`:492`).

### Estados

**8. ¿Qué valores tiene `OrderStatus`?** **12** (`schema.prisma:361-374`): `new`, `confirmed`,
`preparing`, `ready`, `out_for_delivery`, `delivered`, `closed`, `ready_for_pickup`, `picked_up`,
`accepted`, `served`, `cancelled`.

**9. ¿Existen `new`/`confirmed`/`preparing`/`ready`/`delivered`/`cancelled`?** Los seis **SÍ**, pero no
todos aplican al mismo tipo de pedido: el flujo de **retiro** es `new → confirmed → preparing →
ready_for_pickup → picked_up → closed` (+ `cancelled`) y **no pasa por `ready` ni por `delivered`**,
que son del flujo de delivery (`order-workflows.ts:3-20`). `served` y `accepted` son del flujo de mesa.

### Pagos

**10. ¿Qué valores tiene `PaymentMethod`?** **2**: `cash`, `card` (`schema.prisma:339-342`). Es lo que
el cliente **declara** en el checkout y sigue existiendo por compatibilidad (`:344-346`).

**11. ¿Qué valores tiene `PaymentMethodType`?** **5**: `cash`, `card`, `transfer`, `mixed`, `other`
(`:347-353`). Es lo que acepta un **cobro registrado** (`Payment.method`).

**12. ¿Existe «Contra entrega»?** **NO EXISTE** ningún valor así en ninguno de los dos enums. El modelo
del negocio es **pago en el local al retirar** (`AGENTS.md`: «Pago: en el local al retirar. No hay
pasarela»), y el POS solo puede cobrar `cash` o `card` (`sale-payload.ts:29`).

### Filtros y búsqueda

Todo sobre `GET /api/admin/orders` (`admin/orders/route.ts:16-53`):

**13. ¿Filtro por sucursal?** **SÍ**: `locationId` (`:47`, leído en `:99`), resuelto por
`resolveOrderListLocationIds` (`order-visibility.ts:40-55`), que **aplica el alcance del usuario** e
ignora en silencio una sucursal ajena. La respuesta informa `meta.locationIds` (el filtro aplicado) y
`meta.locationScope` (lo que puede ver; `null` = todas).

**14. ¿Filtro por estado?** **SÍ**, pero **un solo valor** (enum de los 12, `:18-33`). No hay
multi-estado ni «abiertos».

**15. ¿Filtro por método de pago?** **SÍ, limitado a `cash`/`card`** (`:53`, el enum `PaymentMethod`).
**No** se puede filtrar por `transfer`, `mixed` ni `other`, que son valores de cobro reales.

**16. ¿Búsqueda por texto? ¿En qué campos?** **SÍ**: `search` (máx. 60 caracteres, `:50`), que compara
por **contiene** contra `orderNumber`, `customerName` y `customerWhatsapp`
(`order-search.ts:37-39`).

**17. ¿Búsqueda por PIN?** **SÍ**: se extraen los dígitos del término y se comparan contra `pickupPin`
(`order-search.ts:41-43`), así que escribir el PIN con espacios también funciona.

### Métricas

**18. ¿Existe «preparación promedio»?** **SÍ**: `meta.averagePrepMinutes` en el listado
(`admin/orders/route.ts:120`), calculado en el dominio (`order-stage-times.ts:61-93`) como
`createdAt → primer ready/ready_for_pickup`, en minutos enteros, **`null` si todavía no hay ninguno
listo** (la pantalla dice «sin datos todavía») y descartando los que pasan **240 min**
(`MAX_PREP_MINUTES`, `:62`).

**19. ¿Existe «último timestamp de sync»?** **PARCIAL**: existe en la **UI**, no en la API. El tablero
guarda `lastUpdatedAt` en el cliente y muestra «Actualizado ahora / hace N s»
(`orders/page.tsx:189`, `:864-865`, `:1060-1061`, `:1302`). Ninguna respuesta del servidor trae un
timestamp de sincronización (sí trae `generatedAt` el overview y el menú público).

**20. ¿Existen contadores por estado?** **SÍ, pero calculados en el cliente** sobre la lista que ya
llegó: `ordersStatusCounts` (total, nuevas, preparando, listas, cerradas; `page.tsx:436-450`) y
`comandaCounters` por carril (`comanda-helpers.ts:66-80`). El servidor **no** devuelve contadores por
estado (solo `meta.count` y el promedio).

### Tiempo real

**21. ¿Hay WebSocket o SSE?** **NO EXISTE**: cero coincidencias de `WebSocket`, `EventSource`,
`text/event-stream` o `socket.io` en `src/`. El panel es **pull**.

**22. ¿Hay polling? ¿Cada cuánto?** **SÍ**: el **tablero de comandas cada 15 s** (`POLL_INTERVAL_MS`,
`orders/page.tsx:132`, `:485-503`) y el reloj interno cada 5 s (`CLOCK_TICK_MS`, `:133`). El **POS cada
3 s** (`POS_REFRESH_MS`, `pos-client.tsx:54`, `:221-230`). El detalle del pedido late cada 30 s pero
**no re-pide datos** (`orders/[id]/page.tsx:227-230`). `/admin` (overview) y el público **no** se
refrescan solos.

### Acciones

**23. ¿Cambio de estado desde el admin? ¿Qué rutas?** **SÍ**: `PATCH /api/admin/orders/:id/status`
(`[id]/status/route.ts:36`) con `{ status, note? }`. Valida la transición según el tipo
(`order-workflows.ts`) y devuelve **409** si no es válida; **422** si se cancela sin nota. Permisos:
`canManageOrderOperations` (owner, manager, kitchen) y el pedido tiene que estar en el alcance del
usuario. Hay además `PATCH …/delivery-fee` (solo delivery).

**24. ¿Notificaciones sonoras?** **SÍ**: `playNewOrderAlert()` genera dos notas con WebAudio
(`admin-alert-sound.ts:14-15`, `:56-87`) y se dispara cuando entra un pedido nuevo en el tablero
(`orders/page.tsx:871-880`, `:1074-1081`). Es **opt-in** (preferencia en `localStorage`) y **solo en la
pantalla de comandas**.

**25. ¿Modo pantalla completa?** **SÍ**: `useFullscreen()` sobre `document.documentElement`
(`use-comanda-view.ts:45-84`), usado en el tablero (`page.tsx:229`, `:900`). Es un modo **dentro** de
`/admin/orders`; el «modo inmersivo» (esconder la barra lateral con una clase en `<html>`) es otra cosa
(`:14-25`). El POS **no** lo tiene.

### Multi-sucursal

**26. ¿Un usuario ve todas las sucursales o solo la suya?** Depende del rol y de la asignación
(`order-visibility.ts:21-31`): el **owner ve todas** (su asignación se ignora); **manager o kitchen con
sucursales asignadas ve solo esas**; **sin asignar, ve todas** —a propósito, para no dejar a nadie
ciego— y el panel lo muestra explícito («Sin asignar · ve todas»). El corte se aplica **en la API**
(la consulta filtra por `locationId in (...)`, `prisma-order-repository.ts:419-422`), no solo en la
UI, y también en el detalle y en el cambio de estado (`order-scope.ts:17`). **No** se aplica en
dashboard, reportes, menú, inventario, reservas ni feed de actividad.

**27. ¿El KDS filtra por sucursal?** **SÍ, y por defecto NO filtra**: la página arma `locationId` solo
si hay un filtro activo (`orders/page.tsx:315`) y dibuja el selector solo cuando el usuario tiene más
de una sucursal en alcance (`:460-472`), usando `meta.locationScope` del servidor. Sin filtro, el
**owner ve todas las sucursales juntas** y cada comanda muestra su `locationName`
(`list-admin-orders.ts:6`); los umbrales de urgencia, en ese caso, son los defaults (10 y 15 min).
