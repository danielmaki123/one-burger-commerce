# TASK: Adopción del mock completo (programa de UI)

**Estado:** plan **aprobado** (D-A, D-B y D-C resueltas el 2026-09-12) · **en ejecución**: **T1 (tokens),
T2 (home), T3 (menú), T3.1 (color por categoría) y T4 (producto) cerradas**; sigue
**T5 (carrito + checkout)** · **Fecha:** 2026-09-12 · **Origen:** pedido del owner sobre
`stitch_full_pwa_builder/` ("copiar los órdenes, los colores, todos; los botones que no tengamos API
se valorarán para implementar y que no queden solo como texto; mantener el orden; TDD por fase, por
tarea").

> **Este brief manda sobre el rediseño.** `TASK-checkout-v2.md` queda **absorbida** como la tarea
> **T5** de la ola 1: sus fases (rango de preparación, campo explicado, dirección, edición por ítem)
> pasan a ser los primeros incrementos de T5.
> Evidencia medida del mock: [`ops/audit-checkout-mock.md`](../audit-checkout-mock.md).
> Herramientas: `scripts/audit-checkout-mock.mjs` y `scripts/audit-checkout-mock-interactions.mjs`.

## 1. Qué significa "usar el mock"

**Se adopta:** el **orden visual** de cada pantalla (de arriba hacia abajo, sin reordenar secciones),
los **colores**, la **jerarquía tipográfica**, los **componentes** (tarjetas, pills, chips, timeline,
CTA con importe) y el **copy**.

**No se adopta:** su **comportamiento** (medido: no funciona), sus **dependencias** (Tailwind y
fuentes por CDN, fotos en `lh3.googleusercontent.com`), sus **defectos de accesibilidad** (zoom
bloqueado en las 7 pantallas, 0 `role`, 0 `aria-live`, 45 fallos de contraste, controles de 24 px) y
**sus promesas fuera del MVP** sin tu OK explícito (§5).

## 2. Las cinco reglas del programa

1. **Ningún control decorativo.** Cada control del mock termina (a) **implementado** con su
   API/estado y **cubierto por un test**, o (b) **eliminado** con el motivo escrito acá. Se acabó el
   "solo texto": si no puede funcionar, no se dibuja.
2. **Nada de datos del negocio en el código** (contrato anti-hardcode, `AGENTS.md`): nombre, colores,
   tipografía, contacto, horarios, moneda y propina salen de `/admin/settings`.
3. **La paleta entra como preset y pasa el test de contraste.** El mock tiene 45 fallos de contraste
   medidos; donde falle, se ajusta el tono. El preset nuevo tiene que quedar verde en
   `color-contrast.test.ts` (el caso "todos los presets son legibles", que ya existe).
4. **TDD por fase y por tarea**: el primer test rojo está en la tabla de cada tarea (§4) y se corre
   **antes** de implementar, con la salida roja en el commit.
5. **375 px y 1280 px en navegador real.** El mock **no tiene versión de escritorio** (el checkout
   está anclado a 448 px y la confirmación no tiene ancho máximo): el escritorio lo diseñamos
   nosotros, y el E2E lo verifica.

## 3. Matriz de adopción (mock → nuestro control → API/estado → test)

Es la herramienta que hace verificable "todo lo que muestra el mock": sin esta matriz, la única forma
de saber si algo quedó "solo como texto" es mirarlo a ojo.

### 3.1 Home (`home_favoritos_e_info_casa_antigua`)

| Mock | Nuestro control | API / estado hoy | Test |
|---|---|---|---|
| "● Abierto" + horario de hoy | Estado operativo | `businessHours` + `isAcceptingOrders` (settings) | `order-acceptance.test.ts` · E2E home |
| "Retiro: 15-25 min" | Estimado de retiro | `pickupLeadMinutes` (+ `pickupMaxMinutes`, T5) | `pickup-slots.test.ts` |
| Destacado "Especialidad de la Casa" | Bloque de marketing | `marketing-blocks` (existe en admin) | `get-public-menu.test.ts` |
| Chips de categoría (🥩🍟🥤) | Accesos a categorías | menú público | `page.test.ts` (home) |
| Grilla "Tus Favoritos" | Sección de productos del menú | menú público | `page.test.ts` (home) |
| ❤️/🤍 favoritos | — | **no hay modelo ni cuenta** | ola 2 |
| ⭐ 4.9 (480+) reseñas | — | **no hay modelo** | ola 2 |
| "PROMO B2G1" | — | **no hay motor de promos** (`Coupon` existe, promo 2x1 no) | ola 2 |
| Info del local (dirección, horario) | Bloque de información | settings | E2E home |
| "Cómo llegar" / "Llamar" | Enlaces de contacto | `mapsUrl` / `phone` | E2E home |

### 3.2 Menú (`men_gastron_mico_casa_antigua`)

| Mock | Nuestro control | API / estado hoy | Test |
|---|---|---|---|
| Buscador que filtra | Buscador client-side | menú público (`GET /api/menu`) | `menu/page.test.tsx` |
| Riel de categorías con imagen | Riel de categorías | menú público | `menu/page.test.tsx` |
| Grilla 2 columnas, color por categoría | Grilla | menú público | E2E menú (375 px) |
| Precio por platillo | Precio | `price` + `formatCurrency` | `format-currency.test.ts` |
| "+" por platillo (24 px en el mock) | Botón de agregar (≥44 px) | carrito (`useCart`) | `cart` tests + E2E |
| Aviso "Platillo agregado" | Aviso accesible | — | `aria-live` + E2E |

### 3.3 Producto (`personalizar_platillo_casa_antigua`)

| Mock | Nuestro control | API / estado hoy | Test |
|---|---|---|---|
| Cantidad (−/+) | Cantidad | carrito | `cart-scale-helpers.test.ts` |
| "Tipo de Carne" (radios con delta) | Grupo de modificadores (obligatorio) | `modifier-groups` / `modifier-options` | `page.test.ts` (producto) |
| "Extras" (checks con delta) | Modificadores opcionales | ídem | ídem |
| "Instrucciones especiales" | Notas del ítem | `notes` en el ítem del carrito | `create-order.test.ts` |
| CTA fijo "Agregar al carrito · C$295" | CTA con importe | carrito | E2E a 375 px |
| Input nativo de 1×1 no clickeable | — | **defecto del mock**: nosotros usamos overlay de opacidad 0 | `pickup-schedule-field.test.tsx` |

### 3.4 Carrito + checkout (`carrito_y_checkout_casa_antigua`) → **T5**

| Mock | Nuestro control | API / estado hoy | Test |
|---|---|---|---|
| Filas con nombre, cantidad, chips de modificadores | Resumen compartido | carrito | `order-summary-card` · E2E |
| "Eliminar" y stepper de cantidad | Edición por ítem | carrito (`removeItem`/`updateQuantity`) | `cart/page.test.ts` |
| "¿Algo más para acompañar?" | Upselling | menú público | E2E (decisión D4 del brief anterior) |
| "Cambio: C$142" duplicado | — | **no aplica** (se cobra en caja) | — |
| Tarjeta de sucursal (dirección + horario) | Punto de retiro | settings (`addressLine`, `city`, `businessHours`) | `checkout/page.test.tsx` |
| Selector de 2 sucursales | — | **una sola fila de configuración** | ola 2 |
| "Efectivo / Tarjeta·POS" | — | **`Order` no tiene método de pago** | ola 2 (decisión) |
| "Pagaré con / Cambio" | — | no existe | ola 2 |
| "Propina voluntaria para el repartidor" (premarcada) | Propina **opt-in desmarcada** | servidor (`tipRate`) | `create-order.test.ts` (la política del servidor manda) · `order-summary-card.test.ts` |
| Resumen (Subtotal/Empaque/Propina/Total) | Resumen | `calculateOrderTotals` | `order-summary-card.test.ts` · `create-order.test.ts` |
| CTA fijo con importe | CTA único por viewport | `POST /api/orders` | E2E checkout |
| Barra inferior de 4 destinos | — | se retira (el checkout ya tiene CTA fijo y "Editar carrito") | — |
| **Nombre y WhatsApp** (ausente en el mock) | Inputs obligatorios | `POST /api/orders` los exige | `checkout/page.test.tsx` |
| **Hora de retiro** (ausente en el mock) | Control opcional/programable | `pickupTime` + `resolveOrderAcceptance` | `pickup-schedule-field.test.tsx` |

### 3.5 Confirmación (`confirmaci_n_de_pedido_casa_antigua`) → **T6**

| Mock | Nuestro control | API / estado hoy | Test |
|---|---|---|---|
| "#CA-4821" | Número de pedido | `orderNumber` | `order-success-view.test.ts` |
| "PIN de Retiro 4821 · Díctalo en caja" | Código para retirar | **no hay PIN**; hay `orderNumber` + `orderLookupToken` | ola 2 (decisión) |
| "Listo en aprox. 20-30 min · 2:45 PM" | Hora/ rango estimado | `pickupTime` (+ máximo, T5) | `order-success-view.test.ts` |
| Resumen con cantidades | Resumen | `GET /api/orders/[id]` | `order-success-view.test.ts` |
| "Ver Seguimiento en Vivo" | Enlace al seguimiento | `/orders/[id]` | E2E |
| "Volver a la Carta" | Enlace al menú | `/menu` | E2E |
| "¡Orden confirmada!" + "¡Recibimos tu pedido!" | **Un solo** mensaje | — | `order-success-view.test.ts` |
| Barra inferior con `href="#"` | — | enlaces muertos: se retiran | — |

### 3.6 Seguimiento (`historial_de_pedidos_casa_antigua`) y 3.7 Historial (`pedidos_anteriores_casa_antigua`) → **T7**

| Mock | Nuestro control | API / estado hoy | Test |
|---|---|---|---|
| Timeline 4 pasos (Recibido → Cocina → Preparando → Listo) | Timeline de estado | `OrderStatus` (`new`/`confirmed`/`preparing`/`ready`) | `order-status` tests · E2E |
| "Paso 3 de 4", "Listo aprox. 2:35 PM" | Progreso y hora | estado + `pickupTime` | E2E |
| "Código para retirar en caja" | Código de retiro | `orderNumber` | E2E |
| Buscador del historial (inerte en el mock) | Buscador que **sí** filtra | pedidos del dispositivo | `activity` tests |
| "Pedir nuevamente" | Reordenar (agrega al carrito) | carrito, client-side | `cart/page.test.ts` |
| "Recibo" | Recibo del pedido | pedido guardado | `activity` tests |
| "Efectivo (Pagas C$1.000 · Vuelto…)" | — | no aplica | ola 2 |
| "Retiro en Tienda · GRATIS" | — | no hay envío: se retira la fila | — |

## 4. Ola 1 — tareas (con modelos y APIs de hoy)

Una tarea por commit (o un commit por fase dentro de la tarea). **El orden es el del mock.**

| # | Tarea | Primer test rojo | Toca contrato |
|---|---|---|---|
| **T1** | **Tokens** (tres commits) | | |
| T1.1 | Paleta del mock como preset, con **sus colores reales** y el test de contraste vigente | `color-contrast.test.ts` (incluye el caso "todos los presets son legibles") | No |
| T1.2 | **Plus Jakarta Sans** como **tercera opción** de `/admin/settings` (decisión D-A) — **cerrada**: 400 y 700 en `src/app/fonts/plus-jakarta-sans-{regular,bold}.ttf`, `--font-jakarta`, y las dos listas fijas de dos que mandaban la tercera opción a Inter, corregidas | `business-settings.schema.test.ts` (acepta la fuente nueva) · `business-settings-style.test.ts` · `settings-client.test.tsx` | No |
| T1.3 | Escala tipográfica, radios y sombras del mock mapeados a tokens de `globals.css` | `business-settings-style.test.ts` | No |
| **T2** | **Home** (`/`): estado abierto, estimado de retiro, buscador que filtra, destacado, categorías, grilla de productos con "+" que agrega, e info del local con contacto — **cerrada**: el "+" del mock (24 px, muerto) es un botón real de 44 px cuando el producto no obliga a elegir; con opciones obligatorias la tarjeta lleva a elegirlas | `app/(public)/page.test.ts` · `home-page-helpers.test.ts` · `page.dom.test.tsx` | No |
| **T3** | **Menú** (`/menu`): buscador que filtra, riel de categorías con foto, grilla de 2 columnas, "+" de ≥44 px con aviso `aria-live` — **cerrada**: el "+" agrega de verdad cuando el producto no obliga a elegir (compartido con la home en `src/shared/lib/product-quick-add.ts`); con opciones obligatorias no se dibuja y la tarjeta lleva a elegirlas. **No se adopta** el color por categoría ni los rótulos fijos del mock: no existen en el modelo (candidato a campo de categoría) | `menu/page.test.tsx` · `menu-product-card.test.tsx` · `menu-page-helpers.test.ts` | No |
| **T4** | **Producto** (`/menu/[productId]`): cantidad, modificadores como tarjetas con delta, notas, CTA fijo con importe — **cerrada**: cantidad primero (orden del mock), nota con `label` propio y anillo de foco visible en las tarjetas de modificador (los dos huecos de accesibilidad que el mock tiene) | `menu/[productId]/page.test.ts` | No |
| **T3.1** | **Color por categoría** (pedido del owner el 2026-09-12) — **cerrada**: `Category.color` con migración, validación `#rrggbb` en la API, campo con vista previa y aviso de contraste en `/admin/menu`, y las tarjetas del menú teñidas con el texto más legible de los dos de la casa. `null` = diseño del sistema | `category-color.test.ts` · `menu-product-card.test.tsx` · `categories/[id]/route.test.ts` | **Sí** (migración `add_category_color`) |
| **T5** | **Carrito + checkout** (absorbe `TASK-checkout-v2`): rango de preparación, dirección del local, resumen, edición por ítem, propina opt-in, nombre/WhatsApp, hora de retiro | `business-settings.schema.test.ts` → `pickupMaxMinutes`; después `pickup-slots.test.ts` → formato del rango | **Sí** (migración) |
| **T6** | **Confirmación** (`/success`): código de retiro, rango estimado, resumen, enlaces a seguimiento y menú | `order-success-view.test.ts` | No |
| **T7** | **Seguimiento e historial** (`/orders`, `/activity`): timeline de 4 pasos, buscador que filtra, "Pedir nuevamente", "Recibo" | `orders/orders-page-helpers.test.ts` · `activity/page.test.ts` | No |

Reglas de cierre por tarea: `npm run test`, `lint`, `typecheck`, `build`, `security:secrets`, y el E2E
completo a **375 px y 1280 px**. Si la paleta o los tokens cambian, se re-verifica que ninguna
superficie quede por debajo de AA.

## 5. Ola 2 — necesita contrato nuevo

**Decisión del owner (2026-09-12): la ola 2 se hace completa, sin reseñas y sin delivery.** Lo que
sigue, entonces, es el alcance aprobado; las reseñas y el delivery quedan **fuera** (y `AGENTS.md`
sigue prohibiendo reactivar delivery sin pedido explícito posterior).

| # | Cosa del mock | Qué implica | Costo |
|---|---|---|---|
| **T8** | **Multi-sucursal** (la más grande) | `BusinessSettings` es **una sola fila** (`id = "default"`): pasa a multi-local, con horario, datos de contacto y órdenes por local, más el selector en el checkout y el admin eligiendo local | **Alto** (migración + admin + operación) |
| **T9** | **Promos** (B2G1) | Motor de promos: hoy solo hay `Coupon` de % o monto fijo, no combos 2x1 | Medio |
| **T10** | **Favoritos** ❤️ | ⚠️ **Descartada por decisión del owner (2026-09-12): "mantengamos el login tal cual lo tenemos"**. Los favoritos exigen cuenta de cliente y el login real (OTP) seguiría sin proveedor; el ❤️ del mock no se dibuja | — |
| **T11** | **Método de pago** (efectivo/tarjeta) | `Order` **no tiene** el campo: migración + campo informativo en checkout y ticket | Bajo |
| **T12** | **Vuelto** ("pagaré con / cambio") | Campo para el monto con el que paga el cliente y cálculo del cambio; sirve en caja, no en cocina | Bajo |
| **T13** | **PIN de retiro** | Hoy hay `orderNumber` + `orderLookupToken`; el PIN corto es una columna nueva y se dicta en caja | Bajo/medio |

> **Orden y dependencias:** T11-T13 son migraciones chicas e independientes; T8 toca el modelo entero y
> conviene decidirla con la operación delante (¿el menú y los precios también por local?); T10 está
> bloqueada hasta que exista login de cliente.

## 5.1 Lo que queda fuera (decidido)

- **Reseñas** (⭐ 4.9): fuera por decisión del owner (requiere modelo, moderación y pantalla).
- **Delivery**: fuera; el MVP es solo retiro y `AGENTS.md` prohíbe reactivarlo sin pedido explícito.
- **Propina "para el repartidor" premarcada**: no entra (contradice `AGENTS.md`).

## 6. Lo que no entra ni con OK

- **Controles que mienten** (propina premarcada, cualquier control sin efecto).
- **Dependencias por CDN** (Tailwind, Google Fonts, fotos externas): el build es hermético.
- **Zoom bloqueado** (`user-scalable=no`) y cualquier patrón que impida ampliar.
- **Textos de otro negocio** (Casa Antigua, sucursales, "repartidor") y **precios/datos** hardcodeados.
- **Los defectos que no se arrastran** de `ops/audit-checkout-mock.md` §6 (18 puntos con evidencia).

## 7. Decisiones · **resueltas el 2026-09-12**

| # | Decisión | Resolución |
|---|---|---|
| **D-A** | **Tipografía** | **Plus Jakarta Sans como tercera opción** de `FONT_CHOICES` (no reemplaza a Fraunces ni a Inter: el owner sigue eligiendo). Se implementa en T1.2 |
| **D-B** | **Ola 2** | **Completa, sin reseñas y sin delivery** (§5, tareas T8-T13). ⚠️ **Favoritos (T10) queda bloqueado** hasta que exista login de cliente real: el OTP responde 503 en producción |
| **D-C** | **Orden** | Confirmado: **tokens primero** y después las pantallas en el orden del mock (T2 → T7) |

## 8. Cómo se verifica

```bash
node scripts/audit-checkout-mock.mjs               # re-medir el mock (375 y 1280 px)
node scripts/audit-checkout-mock-interactions.mjs  # ¿los controles del mock responden?

npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets

# Camino real (Postgres + seed + server), incluido el E2E a 375 px
docker compose up -d && npx prisma generate && npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx tsx prisma/seed.ts
DATABASE_URL="..." APP_ENV=production NODE_ENV=production ADMIN_LOGIN_RATE_LIMIT=200 npx next start -p 3210
BASE_URL=http://127.0.0.1:3210 E2E_ALLOW_MUTATIONS=true npm run test:e2e:prod:full
```

**No se despliega a producción sin confirmación del owner.**
