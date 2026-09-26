# Spec de pantalla — POS / Venta rápida (`/admin/pos`)

> **Plantilla**: [`TEMPLATE.md`](TEMPLATE.md).
>
> **Estado: `SCREEN-POS-QUICK-SALE-001.1` desplegada y con QA autenticada de producción cerrada** (2026-09-26):
> sobre `3c6951a`, sirviendo `build-20260926-202551`, con la QA en navegador real a los cuatro viewports del
> contrato (`1366×768`, `1280×720`, `768×1024`, `375×812`) contra producción y sesión de admin. La Venta rápida
> de la Fase 1 queda **completa**; la Fase 2 **no** se inició.
>
> **Corrección visual y contractual**: la referencia anterior queda **reemplazada** para composición, densidad y
> comportamiento responsive.
>
> **Referencia de UX/layout/comportamiento**: [`pos-quick-sale-reference.html`](pos-quick-sale-reference.html)
> (prototipo, **no** código productivo: se traduce a componentes reales, **no** se reinterpreta).
> **Es contrato** de composición, jerarquía, densidad, progressive disclosure y responsive: una divergencia
> material se corrige antes del merge o se para y se pregunta al owner.
>
> **Prohibiciones que esta spec respeta**: no inventa estados ni métricas, no toca dinero, no mueve reglas del
> dominio a React, no hardcodea sucursales ni moneda, y **no** implementa Checks, mesas, table service, waiter
> ni seats/courses.

---

## Reuse audit (`SCREEN-POS-QUICK-SALE-001.1`)

**Objetivo**: cerrar la Venta rápida del POS —composición, densidad y fidelidad visual— sin abrir Fase 2.

**Capacidad existente**: catálogo POS (`GET /api/admin/pos/catalog`), borrador y sus totales
(`modules/pos/domain/pos-draft`), cobro con multi-pago/vuelto/cupón/descuento (`POST /api/admin/pos/sale`),
caja y turno (`/api/admin/pos/shift*`), ventas en espera (`modules/pos/domain/pos-holds`) **y Órdenes** para
localizar y revisar pedidos.

**Se reutiliza**: todo lo anterior, sin cambios de dominio, endpoints ni permisos. El cierre de caja **enlaza**
a `/admin/cash`: el arqueo con su conteo y sus bancos es de esa pantalla.

**Realmente nuevo**: solo **composición visual y densidad** (barra de una línea, alto útil de viewport,
catálogo más denso, ticket que usa su alto) y los **guardrails documentales** de esta TASK.

**Lo que se elimina y por qué**: `Cobrar pedido del menú` sale del POS porque **localizar un pedido pertenece a
Órdenes** y **cobrar pertenece a POS** (`MODULE_ARCHITECTURE.md` §10.2, *one canonical flow*): un buscador de
pedidos dentro del mostrador era un segundo flujo para la misma operación. Su cobertura E2E queda como deuda
registrada (`A-67`) para la TASK que resuelva el camino desde Órdenes.

---

## Ruta

`/admin/pos` (pantalla única del mostrador). Sin rutas nuevas.

## Módulo

**`pos`** es el dueño de la venta de mostrador: borrador, líneas, totales, esperas, cobro, vuelto, cupón y
descuento manual ([`../../product/MODULE_ARCHITECTURE.md`](../../product/MODULE_ARCHITECTURE.md) §4–§5). La
pantalla **consume** `menu` (catálogo, modificadores), `orders` (tipos de pago, vuelto, alta del pedido),
`cash-config` (terminales), `business-settings` (moneda, zona horaria) y `auth` (puertas de permiso).

**La pantalla no es dueña de ninguna regla**: precios por sucursal, disponibilidad, cupón, descuento,
idempotencia, atomicidad y el bloqueo por turno viven en `src/modules/**` y en las rutas del servidor.

## Usuario / roles

| Rol | Qué hace acá |
|---|---|
| `owner` | todo, incluido el descuento manual |
| `manager` | todo, incluido el descuento manual |
| `cashier` | cobra y deja ventas en espera; **no** ve el descuento manual (lo resuelve el servidor) |
| `kitchen` | **no entra**: la página redirige a Órdenes (`canUsePOS`) |

## Propósito

Una frase: **armar y cobrar la venta del mostrador sin soltar el catálogo ni el ticket** — el catálogo siempre
utilizable, el ticket siempre accesible y el cobro con la máxima jerarquía de la pantalla.

## Preguntas

1. **¿Qué le vendo?** (búsqueda, categorías, productos del local con su precio y su disponibilidad)
2. **¿Qué lleva y cuánto es?** (líneas, cantidades, subtotal, empaque, descuentos, total)
3. **¿A nombre de quién y cómo paga?** (nombre, teléfono, forma de pago, monto, vuelto)
4. **¿Puedo cobrar ahora?** (caja abierta, cierre obligatorio pendiente, conexión)

## Decisiones

- Se decide **qué entra a la venta**, **cuánto lleva**, **quién es el cliente**, **con qué paga** y **cuándo se
  cobra**.
- Bajo demanda (no ocupan la venta normal): correo, promo, factura/RUC, descuento manual, dividir el pago,
  ventas en espera.
- **No** se decide acá: cobrar un pedido del menú (acción secundaria, su rediseño es Fase 2), administrar la
  caja (vive en Caja), ni nada de la operación de cocina.

## Datos disponibles

Todo lo que la spec necesita **ya existe**: `GET /api/admin/pos/catalog` (productos con precio del local,
agotados y chips de categoría con contador), `GET /api/admin/pos/shift` (turno/terminal),
`POST /api/admin/pos/coupon` (cotización), `POST /api/admin/pos/sale` (alta con idempotencia), el cobro del
pedido existente (`GET /api/admin/orders?search=` + `POST /api/admin/orders/:id/payment`), las esperas y el
borrador en el dispositivo y las puertas `canUsePOS`/`canDiscountPosSale`. **No se pide ningún dato nuevo** y
**no hay `FALTA`** para esta sección.

## Jerarquía

```text
1. CATÁLOGO        → búsqueda, categorías, productos (siempre utilizable)
2. VENTA           → líneas, cantidades, subtotal, TOTAL
3. COBRO           → forma de pago + `Cobrar C$…` (una sola acción primaria)
4. CLIENTE         → nombre y teléfono (obligatorios), siempre visibles
5. ESTADO          → local, terminal, caja, conexión, cierre obligatorio
6. BAJO DEMANDA    → correo · promo · factura/RUC · descuento · dividir pago · En espera (N) · Cobrar pedido
```

Cómo se logra: **posición y tamaño**, no color. El total es el número más grande después del título del
panel; `Cobrar C$…` es el único botón `primary` del contexto y mide 48 px de alto.

## Acciones

| Acción | Label | Nivel | Dónde |
|---|---|---|---|
| Cobrar | **Cobrar C$…** | **primaria (única)** | Pie del panel de venta y del sheet |
| Agregar producto | **Agregar** (`aria-label` "Agregar {producto} a la venta") | secundaria | Tarjeta del catálogo |
| Cantidad | **−** / **+** y **Sacar** | secundaria | Fila de la línea |
| Abrir la venta (375) | **Ver venta** | primaria en móvil | Barra inferior persistente |
| Cerrar la venta (375) | **Cerrar venta** | terciaria | Encabezado del sheet |
| Dejar en espera | **Guardar en espera** / **En espera (N)** | secundaria | Opciones de la venta |
| Cobrar pedido del menú | **Cobrar pedido** → diálogo `Cobrar un pedido del menú` | secundaria compacta | Barra de contexto |
| Ver la caja | **Ver la caja** / **Abrir la caja** | navegación | Barra de contexto |

## Estados

Cargando catálogo · venta vacía · con líneas · catálogo vacío (local sin carta) · sin resultados de búsqueda ·
error de catálogo (con **Reintentar**) · caja cerrada · cierre obligatorio pendiente · sin conexión · cobrando ·
cobro exitoso · venta recuperada del dispositivo · esperas llenas.

## Empty / error / loading

- **Venta vacía**: "Agregá productos del catálogo para armar la venta." (sin CTA: el catálogo está al lado).
- **Catálogo vacío**: "El local no tiene productos vendibles" + "Cargá la carta del local en Menú y volvé a entrar."
- **Sin resultados**: "Sin resultados" + "Probá con otro nombre o con la categoría."
- **Error de catálogo**: "No se pudo cargar el catálogo" + el motivo del servidor + **Reintentar**.
- **Caja cerrada**: "Caja cerrada" + "El cobro requiere abrir el turno antes: un cobro con la caja cerrada no
  entra a ningún arqueo." + enlace **Abrir la caja**.
- **Cierre obligatorio**: el motivo lo arma `shift-close-policy` (sucursal con cierre diario y turno de otro
  día) y el botón queda bloqueado.
- **Sin conexión**: "Sin conexión: el cobro no se va a registrar. La venta en curso queda guardada en este
  dispositivo; recuperá la red y volvé a cobrar." (único `animate-pulse` admitido, con la venta en curso).

## Desktop

A 1280 y 1366: dos columnas (`lg:grid-cols-[minmax(0,1fr)_minmax(340px,25rem)]`). El **catálogo scrollea
dentro de su panel** y el **ticket queda anclado al viewport con todo su alto útil** (`max-h: 100vh − 1.5rem`):
el total y `Cobrar C$…` no se van de la pantalla.

## Viewport contract

Lo que tiene que verse **sin scrollear la página** en una venta normal de 1–3 productos:

| Viewport | Qué entra | Qué scrollea |
|---|---|---|
| `1366×768` | barra operativa, búsqueda, categorías, ≥1 fila de catálogo, líneas, total, cliente, pago y `Cobrar` | catálogo (dentro de su panel); líneas (dentro del ticket) si crecen; opciones abiertas |
| `1280×720` | ídem | ídem |
| `768×1024` | barra, buscador, chips, catálogo amplio y la barra `N productos · Total · Ver venta` | el catálogo; el ticket vive en el sheet |
| `375×812` | barra, buscador, chips, productos y la barra inferior | el catálogo; el sheet al abrirse |

**Prohibido**: scrollear la página para llegar a `Cobrar`; reservar una zona alta vacía para las líneas con
0–3 productos.

## Tablet

A 768: **patrón de celular** (barra + sheet), no dos columnas. Motivo medido: a 768 la barra lateral del panel
todavía ocupa 264 px y dos columnas dejaban las tarjetas de producto en ~110 px —ilegibles—; la referencia
permite el patrón mobile cuando dos columnas comprometen la legibilidad. Los controles táctiles se mantienen en
44 px.

## Mobile

A 375: la vista primaria es el **catálogo** (más la barra operativa con local/terminal/estado de caja) y la
venta vive en un **sheet** que se abre desde la barra inferior persistente, al pie del viewport.

- **Primer viewport**: barra operativa, búsqueda, categorías, productos y la barra inferior con
  `N productos · Total` y **Ver venta** → se puede empezar la venta sin scrollear.
- **Sheet**: encabezado "Venta en curso" con el conteo y **Cerrar venta**, líneas, total, cliente, pago,
  opciones secundarias y `Cobrar C$…` en el pie anclado. Cerrado **no hay formulario en el DOM**; abierto es un
  `<dialog open>` con nombre accesible, foco al primer control, **Esc** cierra y el foco vuelve al disparador.
- Cero scroll horizontal (la fila de chips scrollea dentro de su contenedor).

## Qué se elimina

| Elemento actual | Clase | Por qué |
|---|---|---|
| Hero `CAJA / Punto de venta / Armá la venta…` | **ELIMINAR** | Es una herramienta operativa, no una página: la cabecera no consume el primer viewport |
| Bloque de Local en fila propia + mensaje permanente `Sin caja abierta…` + enlace `Abrir la caja` | **ELIMINAR** | El contexto va en **una línea** y la acción de caja aparece **solo donde bloquea** (el checkout) |
| Tarjeta o acción `Cobrar pedido del menú` | **ELIMINAR** | Localizar pedidos pertenece a **Órdenes** (*one canonical flow*); el POS no reconstruye ese flujo |
| Bloque permanente de ventas en espera (aunque esté vacío) | **ELIMINAR** (queda `En espera (N)` + capa secundaria) | No ocupa espacio si no hay nada que revisar |
| Correo, promo, factura/RUC, descuento, dividir pago siempre abiertos | **PLIEGUE** | Progressive disclosure: no dominan una venta normal |
| Venta debajo del catálogo en móvil/tablet | **ELIMINAR** | En móvil/tablet la venta va al sheet; en escritorio, al lado |
| Zona alta vacía dentro del ticket con 0–3 productos | **ELIMINAR** | Las líneas se llevan el espacio libre; el CTA queda anclado al pie |
| Botón primario de "Cobrar" duplicado | **MANTENER UNO SOLO** | Una acción primaria por contexto |

## Estado de implementación (`SCREEN-POS-QUICK-SALE-001.1`)

**En la rama de la TASK** (2026-09-26): corrección visual y contractual sobre el release anterior
(`build-20260926-170322`). Lo entregado:

| Cambio | Evidencia |
|---|---|
| Hero eliminado; barra operativa de **una línea** (`POS · Local · Terminal · ● Caja abierta`) | Tests del workspace + capturas 1366/1280 |
| Caja: **estado** en la barra, **acción** en el checkout (`Abrir caja`; `Cierre pendiente → Cerrar caja`, que enlaza a Caja) | `pos-cash-action.test.tsx` + tests del workspace + E2E de caja |
| `Cobrar pedido del menú` **eliminado** del POS (sin reemplazo: pertenece a Órdenes) | lint/typecheck sin referencias + spec § *Reuse audit* |
| Ticket con **alto útil**: las líneas se llevan el espacio libre y el CTA queda anclado al pie | Tests del workspace + medición en los cuatro viewports |
| Catálogo más **denso** (foto compacta, sin repetir la categoría de los chips, **tres columnas** en escritorio y dos abajo de `lg`, como la referencia) | `pos-catalog-card.test.tsx` + capturas |
| Scroll de página eliminado en operación normal; el scroll vive en el catálogo y en las líneas | QA de navegador: `1366×768`, `1280×720`, `768×1024`, `375×812` |
| Guardrails nuevos (reuse-first, one canonical flow, reuse audit, reference fidelity, viewport contract) | `MODULE_ARCHITECTURE.md` §10.1–§10.3, `DESIGN_SYSTEM.md` §12, `TEMPLATE.md`, skills `screen-design` / `new-task` |
| **Correcciones del QA de producción** (2026-09-26, sobre `262962c`): el catálogo ocupa **todo el alto útil** de su columna (antes quedaba a su alto natural, 496 px de 668), la grilla es de **tres columnas** (cuatro dejaba la tarjeta en 147 px y el nombre partido) y el CTA dice **`Cobrar C$…`** con su espacio (antes: `CobrarC$…`) — corregidas en `3c6951a` y verificadas otra vez en producción a los cuatro viewports | Medición en navegador (antes y después) + `pos-charge-panel.test.tsx` (con RED observado) |
| **Venta real cobrada en producción**: `COCA COLA` (primer producto **sin** modificadores), efectivo con «Exacto», turno abierto en el camino (el `Cobrar` estaba deshabilitado por `Caja cerrada`, que es el bloqueo correcto) → **`Venta P-MUIW4IS4 cobrada por C$44.57 · Sin cambio`** | Captura `pos-quick-sale-prod-cobro-1366.png` + el turno en `/admin/cash` |

**Divergencias respecto de la referencia, decididas y medidas** (una divergencia material sin decisión sería
Stop Condition; estas están justificadas por la propia spec aprobada, que permite el patrón mobile cuando dos
columnas comprometen la legibilidad):

1. **A 768×1024 se usa el patrón de celular**, no dos columnas: la barra lateral del panel ocupa 264 px y las
   tarjetas quedaban en ~110 px.
2. **El panel de escritorio se ancla con `position: fixed` medido, no con `sticky`**: un `<dialog open>` con
   `sticky` no se pega (medido en Chromium) y el `<dialog>` es la forma correcta frente a la ley que prohíbe el
   rol de diálogo escrito a mano.
3. **La foto del producto mide 80 px fijos** (la referencia usa 84 px): la tarjeta real tiene el nombre en
   dos renglones y el precio con `tabular-nums`, así que la proporción se ajustó para conservar la densidad
   de la referencia sin cortar nombres reales.

**Estado previo (Fase 1, `be4c051`, `build-20260926-170322`)**: cerrada y desplegada con los cuatro checks de
CI verdes, `/api/health` con la versión nueva, `/api/readiness` `ready` y los dos smokes (7/7 y 6/6).

## Fuera de scope

- **Checks/Open Checks, mesas, table service, waiter, seats/courses/rondas**: no se implementan.
- **Órdenes / Pedidos / Cocina**: no se tocan. La capacidad de **cobrar un pedido del menú** se resolverá en la
  siguiente fase desde Órdenes → Pedido → Cobrar en POS; su cobertura E2E queda como `A-67`.
- **Corrección USD del cobro de pedidos existentes** y **aplicar promo a un pedido ya creado**: Fase 2.
- **Nueva entidad financiera, `Payment` ↔ banco/procesador, política de cash drawer, rediseño de facturación**:
  fuera.
- **Migraciones y cambios de base**: ninguno.
- **Dominio, puertos y endpoints**: no se tocan. Si la Fase 1 hubiera necesitado alguno, la TASK se detiene.
