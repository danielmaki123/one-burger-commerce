# Spec de pantalla — POS / Venta rápida (`/admin/pos`)

> **Plantilla**: [`TEMPLATE.md`](TEMPLATE.md). **Estado**: Fase 1 definida y adoptada por
> `SCREEN-POS-QUICK-SALE-001` (2026-09-26). El owner dejó la referencia canónica en el repo y esta spec la
> adopta: es la **misma** versión, no una segunda divergente.
>
> **Referencia de UX/layout/comportamiento**: [`pos-quick-sale-reference.html`](pos-quick-sale-reference.html)
> (prototipo, **no** código productivo: no se copia su HTML/CSS).
>
> **Prohibiciones que esta spec respeta**: no inventa estados ni métricas, no toca dinero, no mueve reglas del
> dominio a React, no hardcodea sucursales ni moneda, y **no** implementa Checks, mesas, table service, waiter
> ni seats/courses.

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

A 1280: dos columnas dentro del ancho del panel (`lg:grid-cols-[minmax(0,1fr)_minmax(360px,27rem)]`): el
catálogo toma el resto (~65–70 %) y **scrollea con la página**, mientras el panel de venta queda `sticky` con
su propio scroll interno: el ticket no se pierde mientras se navega el catálogo.

## Tablet

A 768: **el mismo par de columnas** con un panel de venta más angosto (320 px), porque el ancho real lo
soporta (768 − 264 de barra lateral = ~500 px de catálogo). Los controles táctiles se mantienen en 44 px y las
opciones secundarias nacen plegadas. **No** se comprime el desktop ni se apilan los paneles.

## Mobile

A 375: la vista primaria es el **catálogo** (más la barra de contexto con local/terminal/caja) y la venta vive
en un **sheet** que se abre desde la barra inferior persistente.

- **Primer viewport**: barra de contexto (caja), búsqueda, categorías, productos y la barra inferior con
  `N productos · Total` y **Ver venta** → se puede empezar la venta sin scrollear.
- **Sheet**: encabezado "Venta en curso" con **Cerrar venta**, líneas, total, cliente, pago, opciones
  secundarias y `Cobrar C$…` en el pie. Fondo con `inert`/`aria-hidden`, `role="dialog"`, `aria-modal`, foco
  al primer control, **Esc** cierra y el foco vuelve al disparador.
- Cero scroll horizontal (la fila de chips scrollea dentro de su contenedor).

## Qué se elimina

| Elemento actual | Clase | Por qué |
|---|---|---|
| Tarjeta grande permanente `Cobrar un pedido del menú` | **ELIMINAR** (queda como acción compacta `Cobrar pedido`) | Es una tarea ocasional, no parte de una venta normal |
| Bloque permanente de ventas en espera (aunque esté vacío) | **ELIMINAR** (queda `En espera (N)` + capa secundaria) | No ocupa espacio si no hay nada que revisar |
| Correo, promo, factura/RUC, descuento, dividir pago siempre abiertos | **PLIEGUE** | Progressive disclosure: no dominan una venta normal |
| Venta debajo del catálogo en móvil/tablet | **ELIMINAR** | En móvil la venta va al sheet; en tablet/desktop, al lado |
| Copy explicativo redundante de la cabecera | **ELIMINAR** | Presupuesto de texto del arquetipo Operational (0 subtítulos) |
| Botón primario de "Cobrar" duplicado | **MANTENER UNO SOLO** | Una acción primaria por contexto |

## Estado de implementación (`SCREEN-POS-QUICK-SALE-001`)

Entregado en la rama de la TASK, con test y capturas ([`pos-quick-sale-after-1280.png`](pos-quick-sale-after-1280.png),
[`pos-quick-sale-after-768.png`](pos-quick-sale-after-768.png), [`pos-quick-sale-after-375.png`](pos-quick-sale-after-375.png)):

| Cambio | Evidencia |
|---|---|
| Workspace `CATÁLOGO \| VENTA` con el ticket `sticky` en desktop y en tablet | QA de navegador 1280/768 + E2E |
| Barra inferior `N productos · Total · Ver venta` y sheet de checkout con foco atrapado y Esc | Test del sheet + QA 375 |
| Progressive disclosure de correo/promo/factura/descuento/dividir pago/en espera | Tests de las opciones + E2E de promo y descuento |
| `Cobrar pedido` compacto en diálogo (la tarjeta grande se elimina) | E2E del cobro de un pedido del menú |
| `En espera (N)` en vez del bloque permanente | E2E de esperas |
| Reparto por responsabilidades (`quick-sale/`, `use-pos-catalog`, `use-pos-shift`, `use-pos-sale`) | `pos-client.tsx` baja de 1.005 a < 400 líneas |

## Fuera de scope

- **Checks/Open Checks, mesas, table service, waiter, seats/courses/rondas**: no se implementan.
- **Corrección USD del cobro de pedidos existentes** y **aplicar promo a un pedido ya creado**: Fase 2.
- **Rediseño final de `Cobrar pedido`**: se conserva la funcionalidad actual detrás de una acción compacta.
- **Nueva entidad financiera, `Payment` ↔ banco/procesador, política de cash drawer, rediseño de facturación**:
  fuera.
- **Migraciones y cambios de base**: ninguno.
- **Dominio, puertos y endpoints**: no se tocan. Si la Fase 1 hubiera necesitado alguno, la TASK se detiene.
