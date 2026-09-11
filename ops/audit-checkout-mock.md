# Auditoría del mock completo del checkout (fase 0)

> **Tarea:** `ops/tasks/TASK-checkout-v2.md` §5 · **Fecha:** 2026-09-12 · **Estado:** cerrada la
> medición; **pendiente la aprobación del owner** sobre el plan de §10.
> **Entrada:** `stitch_full_pwa_builder/stitch_full_pwa_builder/` (export de Stitch, marca
> "Casa Antigua", 7 pantallas + `artisanal_appetite/DESIGN.md`). El mock **no se versiona**.
> **Herramientas:** `scripts/audit-checkout-mock.mjs` (medición) y
> `scripts/audit-checkout-mock-interactions.mjs` (¿funciona?) — el JSON completo y las capturas
> quedan en `test-results/mock-audit/` (ignorado por git).

---

## 1. Resumen ejecutivo

El mock es un **PWA de delivery con dos sucursales** para otra marca, no una evolución de nuestro
checkout. Medido en un navegador real, aporta **dos cosas** y contradice **todo lo demás**:

1. **Aporta**: el **rango de preparación** ("20-30 min", "Listo en aprox. 20-30 min") — que es
   exactamente la fase 1 ya aprobada — y el **aviso de tiempo estimado en la confirmación**.
2. **Aporta**: un patrón de **edición por ítem dentro del resumen** (cantidad y quitar), que es la
   fase opcional del brief.

Y contradice, con evidencia medida:

- **El checkout del mock no tiene un solo `<input>`** (0 inputs, 0 selects, 0 `input[type=time]`).
  Quedó un comentario huérfano `<!-- Section: Datos de Contacto (Guest Checkout) -->` sin markup:
  la captura de **nombre y WhatsApp se perdió en el export**. Nuestro servidor los exige.
- **Tampoco tiene hora de retiro**: copiarlo borraría el retiro opcional/programable que ya está
  desplegado.
- **No es funcional**: en el checkout el CTA no tiene `onclick`, y tocar sucursal, método de pago o
  propina **no cambia nada** (comparación de estado visual antes/después: idéntica). En la
  confirmación, todos los botones están sin acción y los 4 enlaces de la barra son `href="#"`.
- **No es accesible** (medido en las 7): **bloquean el zoom** (`user-scalable=no`), **0 `role`** y
  **0 `aria-live`** en todo el mock, hasta **81 controles falsos** por pantalla (22 en el checkout,
  78 en la home y 81 en el menú: `<div>` con cursor de mano que no se alcanzan con teclado), 15 de
  16 controles del checkout por debajo de 44 px y **45 fallos de contraste verificables** en total.
- **No respeta su propio design system**: `DESIGN.md` declara 44 colores y el checkout usa 21, de
  los cuales **solo el 10 %** está declarado (la home, 9 %; el menú, 4 %). Cada pantalla trae su
  propio `tailwind.config` inline con su propia paleta.
- **No cierra sus cuentas**: en la pantalla de seguimiento, Subtotal C$795 + Empaque C$70 + Propina
  C$78 = **C$943**, pero el "Total Pagado" dice **C$858**. Y el conteo de productos se contradice
  entre pantallas ("2 productos" para 3 unidades en el checkout, "3 productos" para las mismas 3 en
  la confirmación).
- **No tiene escritorio**: `DESIGN.md` promete un contenedor de 1200 px con vista partida, pero el
  checkout se queda en **448 px** (`max-w-md`) y la confirmación **no tiene ancho máximo**: su CTA
  mide **1240 px** a 1280 px de viewport.
- **Depende de tres CDN** (`cdn.tailwindcss.com` compilando en el navegador, Google Fonts/Material
  Symbols y fotos en `lh3.googleusercontent.com`, una ya rota): nuestro build es hermético.

**Conclusión:** el mock sirve como **guía de intención** (qué quiere ver el owner y con qué tono),
no como especificación. De las 7 pantallas, **una sola toca esta tarea** (el checkout) y **una
segunda la complementa** (la confirmación). Las otras cinco son producto nuevo de otras áreas: se
registran en §9 como pendientes propios, no como fases de esta tarea.

---

## 2. Qué es el mock

| Pantalla (carpeta) | Qué es | Pantalla del producto |
|---|---|---|
| `carrito_y_checkout_casa_antigua` | Carrito **y** checkout en una sola pantalla, con sucursales, método de pago y propina | `/cart` + `/checkout` (hoy son dos) |
| `confirmaci_n_de_pedido_casa_antigua` | Confirmación con PIN de retiro, tiempo estimado y resumen | `/success/[orderId]` |
| `historial_de_pedidos_casa_antigua` | **Seguimiento** del pedido en curso (timeline de 4 pasos, código para retirar) | `/orders/[id]` · `/orders/track` |
| `pedidos_anteriores_casa_antigua` | Historial con buscador, "Pedir nuevamente" y "Recibo" | `/activity` |
| `home_favoritos_e_info_casa_antigua` | Home con destacado, favoritos y datos del local (marco de iPhone de altura fija) | `/` |
| `men_gastron_mico_casa_antigua` | Menú con buscador, riel de categorías y grilla de 2 columnas | `/menu` |
| `personalizar_platillo_casa_antigua` | Detalle con cantidad, tipo de carne, extras y notas | `/menu/[productId]` |
| `artisanal_appetite/DESIGN.md` | Design system declarado ("Artisanal Appetite": Plus Jakarta Sans, crimson, canvas crema, radios 16/24 px) | `globals.css` + tokens de `/admin/settings` |

Es material de diseño de **otra marca y otro modelo de negocio** (delivery, dos sucursales, pago en
la puerta, propina para el repartidor, favoritos y reseñas). Está en la carpeta de trabajo del owner
y **no se commitea**.

---

## 3. Cómo se midió (y los límites de la medición)

`node scripts/audit-checkout-mock.mjs` abre cada pantalla en **Chromium real** (Playwright 1.62.1)
en dos resoluciones —**375×812** y **1280×900**— espera `networkidle` más 2,5 s (Tailwind se compila
en el navegador y hay que dejarlo asentar) y extrae: textos con su sección, controles con su caja
real, objetivos táctiles, contraste WCAG calculado con el fondo efectivo, desborde horizontal,
capas fijas/sticky, imágenes rotas, hosts externos, landmarks, ARIA y estado de foco. Después,
`node scripts/audit-checkout-mock-interactions.mjs` **usa** los controles para ver si responden.

Límites declarados, para no afirmar de más:

- **Contraste sobre degradado.** Cuando hay un `background-image` (degradado) el color de fondo real
  no es plano. Esos casos se marcan y **no se afirman**: en la confirmación hay 2 fallos aparentes
  (1,08:1 y 1,20:1) que caen en esta categoría y quedan fuera del informe como problemas.
- **Los `screen.png` no se usaron como fuente.** Todo lo que dice este informe sale de medir el DOM
  renderizado; las capturas de las 7 pantallas quedan en `test-results/mock-audit/` para comparar a
  ojo si hace falta.
- **Un mock no es una app**: que un control no responda se reporta como "no funcional", no como bug
  de producto. Lo que se adopte se implementa con manejadores reales y tests.

---

## 4. Inventario y clasificación · checkout (`carrito_y_checkout_casa_antigua`)

375×812, alto de documento 1544 px, sin desborde horizontal. **16 controles, 15 por debajo de 44 px.
22 controles falsos. 3 fallos de contraste verificables. 1 imagen rota de 6. 0 inputs.**

| Elemento | Qué es | Clasificación | Toca contrato | Fase / nota |
|---|---|---|---|---|
| Cabecera "Tu Carrito" + badge "2 productos" | Contador del carrito | **APLICA CON CAMBIO** | No | El mock cuenta **líneas** (dice 2 con 3 unidades) y su propia confirmación cuenta **unidades** (3). Nosotros ya contamos unidades: se mantiene lo nuestro |
| Avatar de perfil (32×32) | Identidad del usuario | **FUERA DE ALCANCE** + **BUG** | No | Nuestro checkout es de invitado (el OTP responde 503 en producción). La imagen además está **rota** (`naturalWidth = 0`) |
| Botón "Volver" 40×40 | Navegación | **APLICA** | No | Objetivo táctil por debajo de 44 px |
| Ítem: nombre, `2 × C$295`, total de línea, chips de modificadores | Línea del carrito | **APLICA** | No | Ya lo tenemos en el resumen compartido |
| "Eliminar" 62×17 · "−/2/+" 24×24 | Edición por ítem en el resumen | **APLICA CON CAMBIO** | No | Es la fase opcional del brief. **Recomendación: no en el checkout** (ver §7); si se quiere, va en `/cart` |
| Riel "¿Algo más para acompañar?" (3 productos, "+C$45/+C$35/+C$60", botones 24×24) | Upselling dentro del carrito | **APLICA CON CAMBIO** | Requiere que el checkout lea el menú | Decisión **D4**. En el checkout contradice el "un solo resumen" de `TASK-checkout-ux` |
| Sección "Modalidad de Entrega" con "Retiro en tienda" | Modalidad del pedido | **APLICA** (ya es la nuestra) | No | El MVP es solo retiro: la sección no aporta nada nuevo |
| Selector de sucursal (Jinotepe / Managua Los Robles, con horario y "15–25 min") | Elección de local | **FUERA DE ALCANCE** | **Sí** (varias sucursales) | La configuración es **una sola fila** (`BusinessSettings id = "default"`) |
| Dirección + horario + estimado del local | Punto de retiro | **APLICA** | No | **Candidata nueva (fase 3)**: nuestro checkout muestra el horario pero **no la dirección** |
| "Cambio: C$142" en la cabecera de la sección de entrega | Vuelto | **BUG** | — | Está **duplicado** (también en Método de Pago) y en la sección equivocada |
| "Método de Pago": Efectivo / Tarjeta·POS (divs con círculo dibujado) | Preferencia de pago | **APLICA CON CAMBIO** / **BUG** | **Sí** si se persiste | Decisión **D7**. Los dos son `<div>` no enfocables y **no responden al click**; el documento tiene 0 inputs |
| "Pagaré con: C$1,000" + "Cambio: C$142" | Calculadora de vuelto | **FUERA DE ALCANCE** | **Sí** | Decisión **D8**. Se cobra en el local; el monto con el que paga el cliente no aporta a la cocina |
| "Propina voluntaria para el **repartidor**" (un solo botón 10 %, **ya seleccionado**) | Propina | **APLICA CON CAMBIO** + **BUG** | No (monto) | Contradice `AGENTS.md`: la propina es **opcional y desmarcada**, y acá está premarcada y es **para el repartidor** (no hay reparto). Además el mock calcula 10 % de 780 = **C$78** (subtotal + empaque) y nuestro servidor calcula 10 % de **subtotal − descuento** = **C$71**: copiar el importe rompería la cuenta |
| "Resumen del Pedido": Subtotal / Empaque térmico / Propina / Total final | Resumen | **APLICA** | No | Coincide con `OrderSummaryCard`; "Empaque térmico" ≈ nuestro "Empaque" |
| CTA fijo "Confirmar Pedido · C$858" | Acción principal | **APLICA** | No | Ya lo tenemos, con el importe en la etiqueta. **En el mock no tiene `onclick`** |
| Barra inferior con 4 destinos (26×37) | Navegación | **APLICA CON CAMBIO** | No | Objetivos bajo 44 px; en el checkout ya tenemos CTA fijo y "Editar carrito" |
| **Hora de retiro** | Programar el retiro | **AUSENTE** | — | **No existe en el mock.** Copiarlo borraría una función desplegada |
| **Nombre y WhatsApp** | Datos del cliente | **AUSENTE** | — | El comentario `Datos de Contacto (Guest Checkout)` quedó sin markup; el servidor los exige |

### Las cuentas del checkout sí cierran

`2 × C$295 + 1 × C$120 = C$710` (subtotal) `+ C$70` (empaque) `+ C$78` (propina 10 % de 780)
`= C$858`; y `C$1.000 − C$858 = C$142` de vuelto. Es la única pantalla cuyas cuentas cierran
(ver §6 para la que no).

---

## 5. Inventario y clasificación · las otras seis pantallas

Se resumen por lo que **decide**, no elemento por elemento (el detalle completo está en
`test-results/mock-audit/inventory.json`).

### 5.1 Confirmación (`confirmaci_n_de_pedido_casa_antigua`)

| Elemento | Clasificación | Toca contrato | Nota |
|---|---|---|---|
| "¡Orden Confirmada con Éxito!" **y** "¡Recibimos tu Pedido!" | **APLICA CON CAMBIO** | No | Dos mensajes de éxito: es la clase de redundancia que arregló `TASK-checkout-ux`. Nosotros ya tenemos uno |
| "Tiempo Estimado: Listo en aprox. **20-30 min** · 2:45 PM" | **APLICA** | No | **Refuerza la fase 1** (rango mín–máx) y su lugar: la confirmación |
| "PIN de Retiro · 4821 · Díctalo en caja · Escaneo rápido" | **APLICA CON CAMBIO** | **Sí** (un PIN real es una columna) | Decisión **D5**. Hoy tenemos número de pedido + token de consulta |
| "#CA-4821 · Enviado a cocina" | **APLICA** | No | Ya mostramos el número de pedido |
| Resumen con "Pagas con C$1,000 · Tu cambio exacto C$142" | **FUERA DE ALCANCE** | Sí | Igual que D8 |
| "Ver Seguimiento en Vivo" / "Volver a la Carta" | **APLICA** | No | Ya existen en `/success`; acá **no tienen acción** |
| Barra inferior de 4 enlaces | **BUG** | No | Los 4 son `href="#"` (enlaces muertos) |
| Barra de estado falsa (9:41, wifi, batería) | **FUERA DE ALCANCE** | No | Es chrome del mock, no UI |
| Sin ancho máximo a 1280 px | **BUG** | No | Su CTA mide **1240 px** de ancho |

### 5.2 Seguimiento del pedido en curso (`historial_de_pedidos_casa_antigua`)

Timeline de 4 pasos (**Recibido ✓ → Cocina ✓ → Preparando → Listo**), "Paso 3 de 4", "Listo aprox.
2:35 PM", bloque del local con horario, "Código para retirar en caja #CA-4821", resumen y
"Volver a pedir (Reorder)" / "¿Necesitas ayuda con tu pedido?".

- **APLICA CON CAMBIO (fuera de esta tarea):** el timeline de 4 pasos y el código de retiro son una
  mejora real para `/orders/[id]` y `/orders/track`. **No es checkout**: se registra en §9.
- **BUG — las cuentas no cierran:** Subtotal **C$795** + Empaque **C$70** + Propina **C$78** =
  **C$943**, y el "Total Pagado" dice **C$858**. Es el mismo defecto que tenía el mock anterior.
  Además el contador "Resumen de Productos (**3**)" cuenta líneas, no unidades (2+1+1 = 4), al revés
  que la confirmación.
- **FUERA DE ALCANCE:** "Retiro en Tienda (Jinotepe) — GRATIS" (una línea de envío en un pedido de
  retiro), "Efectivo (Pagas C$ 1.000 · Vuelto estimado…)", "GRATIS".
- 7 fallos de contraste verificables (el peor: "Paso 3 de 4" 3,36:1 y "Preparando" 3,36:1 a 10-12 px).

### 5.3 Historial (`pedidos_anteriores_casa_antigua`)

Lista de pedidos con estado, fecha, total, ítems, "Pedir nuevamente", "Recibo", buscador y pestañas
"En Curso (1) / Anteriores (8)".

- **APLICA CON CAMBIO (fuera de esta tarea):** "Pedir nuevamente" y "Recibo" son producto nuevo para
  `/activity` (§9). El aviso "Orden duplicada en el carrito" al repetir un pedido **sí funciona**.
- **BUG:** el buscador **no filtra** (4 bloques antes y 4 después de escribir "CA-4682"); el input
  mide **199×16 px** (objetivo táctil) y no tiene etiqueta asociada.
- **BUG:** "Recibo" no hace nada.
- 14 de 15 controles por debajo de 44 px.

### 5.4 Home (`home_favoritos_e_info_casa_antigua`)

Destacado con reseñas (**⭐ 4.9 (480+)**), chips de categoría con emoji, **PROMO B2G1**, grilla de
favoritos con ❤️/🤍, "Información del Restaurante" (dirección, horario, "Retiro Express en Barra"),
"Cómo llegar" / "Llamar".

- **FUERA DE ALCANCE:** reseñas/calificaciones, promociones, favoritos: no existen en el modelo y
  los favoritos necesitan cuenta de cliente (no hay login real en producción).
- **APLICA CON CAMBIO:** el **estado "● Abierto"**, el **estimado de retiro** y el bloque de
  información del local ya están resueltos en nuestro sitio con datos de `/admin/settings`.
- **BUG estructural:** la pantalla está dentro de un marco de altura **fija de 844 px** con scroll
  interno; a 375×812 la **barra inferior queda fuera del viewport** (termina en y = 818). Y tiene
  **78 controles falsos** (los `<div>` con emoji) y **13 fallos de contraste** verificables
  ("Fuego Vivo" 2,54:1; "Las mejores Smash Burgers…" 3,56:1).
- **BUG de datos:** los emojis se usan como iconos (🍔🍟🥩🥤) con contraste de 2,25-4,15:1 y sin
  semántica.

### 5.5 Menú (`men_gastron_mico_casa_antigua`)

Buscador (**sí filtra**: 9 tarjetas en el DOM, 1 visible al buscar "brownie"), riel de 7 categorías
con imagen, grilla de 2 columnas con tarjetas de color por categoría, precio y "+" por platillo.

- **APLICA CON CAMBIO (fuera de esta tarea):** la grilla de 2 columnas con color por categoría es
  una dirección de diseño para `/menu` (§9).
- **BUG:** los "+" miden **24×24**; el buscador **no tiene etiqueta asociada** (solo placeholder) y
  hay **81 controles falsos** (las tarjetas son `<article>` con cursor de mano y sin `role`).
- **BUG:** el aviso "1 Platillo agregado" existe en el DOM pero al tocar "+" el **badge del carrito
  sigue en 2**; el aviso no está en una región `aria-live` (0 en todo el mock), así que un lector de
  pantalla nunca se entera.
- **BUG:** 13 fallos de contraste verificables, todos en las tarjetas de color (blanco sobre
  `#E8581C` a 12 px: 3,59:1; "+" verde: 3,33:1).

### 5.6 Personalizar platillo (`personalizar_platillo_casa_antigua`)

Cantidad, **"Tipo de Carne"** (3 radios con delta de precio), **"Extras"** (3 checkboxes con delta),
"Instrucciones especiales" y CTA fijo.

- **APLICA** y **es la pantalla más sana del mock**: es la única que **funciona** (medido: CTA en
  C$295 de base; "+" de cantidad → C$590, o sea 2 unidades; marcar "+C$35 Bacon Ahumado" → C$660;
  cambiar a "Doble Carne Smash +C$90" → C$840; desmarcar el bacon → C$770) y usa **radios y
  checkboxes nativos dentro de etiquetas de 335×52 px**.
- **APLICA CON CAMBIO:** los deltas de precio en la tarjeta ("Res Smash Clásica +C$0", "🥓 Bacon
  Ahumado +C$35") son la misma idea que nuestros modificadores; el diseño en tarjeta es una
  dirección.
- **BUG conocido y ya resuelto en nuestro repo:** el input nativo es de **1×1 px** y **no es
  directamente clickeable** (Playwright no puede hacer `check()`): solo funciona tocando la
  etiqueta. Es exactamente el defecto que `TASK-checkout-ux` ya arregló en el arnés con un overlay de
  opacidad 0. No se reintroduce.
- **BUG menor:** "Obligatorio" 3,59:1, "0/3" 2,77:1, emojis como iconos.

---

## 6. Bugs y datos del mock que **no se arrastran** (con evidencia)

| # | Defecto | Evidencia medida |
|---|---|---|
| 1 | **El checkout no tiene datos del cliente** | 0 `input`/`select` en el DOM; comentario `Datos de Contacto (Guest Checkout)` sin markup |
| 2 | **No hay hora de retiro** | 0 `input[type=time]`, 0 `select`; ninguna mención a programar |
| 3 | **Controles que no responden** | Click en 2.ª sucursal, "Tarjeta / POS" y propina: estado visual idéntico antes/después. CTA sin `onclick`. "Eliminar" y "+" no cambian el carrito. "+" del upselling no cambia el contador |
| 4 | **Enlaces muertos** | La confirmación tiene 4 `<a href="#">` |
| 5 | **Las cuentas no cierran** | Seguimiento: 795 + 70 + 78 = 943 ≠ 858 "Total Pagado" |
| 6 | **El conteo se contradice entre pantallas** | Checkout "2 productos" (3 unidades) vs confirmación "3 productos" (3 unidades) vs seguimiento "(3)" (4 unidades) |
| 7 | **Propina premarcada y mal atribuida** | Único botón "10 %" ya seleccionado (`rgb(211,47,47)`) y rotulado "para el repartidor" |
| 8 | **Base de la propina distinta de la nuestra** | Mock: 10 % de 780 (subtotal + empaque) = C$78. Servidor: 10 % de subtotal − descuento = C$71 |
| 9 | **Zoom bloqueado** | `maximum-scale=1.0, user-scalable=no` en **7/7** pantallas (WCAG 1.4.4) |
| 10 | **Controles no alcanzables con teclado** | 22 (checkout), 78 (home), 81 (menú) `<div>` con cursor de mano, sin `role` ni `tabindex` |
| 11 | **Sin semántica ni anuncios** | 0 `role` y 0 `aria-live` en las 7 pantallas (los avisos de "agregado" no se anuncian) |
| 12 | **Objetivos táctiles chicos** | 15/16 (checkout), 6/8, 14/15, 11/12, 13/21, 10/18, 9/11; los peores: "+" de 24×24 y "Eliminar" de 62×**17** |
| 13 | **Contraste insuficiente** | 3+2+7+13+13+1+6 = **45 fallos verificables** (el peor verificado: "Eliminar" 2,52:1; "Fuego Vivo" 2,54:1) |
| 14 | **No usa su design system** | `DESIGN.md` declara 44 colores; el checkout usa 21 con **10 %** declarado, la home 46 con 9 %, el menú 27 con 4 % |
| 15 | **Escritorio sin implementar** | Checkout anclado a 448 px; confirmación sin `max-width` (CTA de 1240 px); home en un marco fijo de 844 px con la barra inferior fuera del viewport a 375×812 |
| 16 | **Buscador inerte** | Historial: 4 bloques antes y después de buscar |
| 17 | **Recurso roto y efímero** | Avatar `aida-public` roto (32×32); todas las fotos salen de `lh3.googleusercontent.com` |
| 18 | **Dependencias no herméticas** | `cdn.tailwindcss.com` (compilador en el navegador), `fonts.googleapis.com`, `fonts.gstatic.com` |

---

## 7. Lo que **no** se hace, y por qué

| Se descarta | Motivo |
|---|---|
| Delivery, segunda sucursal, direcciones por sucursal, propina para el repartidor | El MVP es **solo retiro** en **un** local; la configuración es una sola fila |
| Pasarela de pago, "Tarjeta / POS" como pago online | Se paga **en el local al retirar**; no hay cobro online |
| Calculadora de vuelto ("Pagaré con… / Cambio") | Dato no autoritativo que la cocina no usa y que hoy no existe en el modelo (D8) |
| Propina premarcada, y "para el repartidor" | `AGENTS.md`: propina **opcional y desmarcada por defecto**; y no hay reparto |
| Reseñas (⭐ 4.9), promociones (PROMO B2G1), favoritos ❤️ | No existen en el modelo; los favoritos necesitan cuenta de cliente y el login real no está activo |
| Pin de retiro con "Escaneo rápido" como está | Implica un PIN persistido y un lector en el local; hoy tenemos número de pedido + token (D5) |
| Barra de estado falsa, marco de iPhone de altura fija, iconos Material Symbols y emojis | Chrome del mock; nuestros iconos son SVG en línea y los tokens salen de `/admin/settings` |
| Fuentes y Tailwind por CDN | El build es **hermético**; nuestras tipografías son Fraunces/Inter del build |
| La paleta del mock como color por defecto | Rompería el contrato whitelabel (colores editables). Como **preset** opcional sí (D6) |
| Merge de carrito y checkout en una sola pantalla | `TASK-checkout-ux` dejó un resumen compartido y un solo CTA visible por viewport; un carrito editable dentro del checkout lo deshace |
| Edición por ítem **dentro del checkout** | Se puede, pero el carrito ya es la pantalla de edición y el checkout debe cerrar la venta. El mock la tiene en su carrito: si se quiere, va en `/cart` |
| Timeline de seguimiento, "Reorder" y "Recibo" como fases de esta tarea | Son de `/orders` y `/activity`, no del checkout: van a §9 |

---

## 8. Lo que **sí** se toma, adaptado a nuestro proyecto

| Idea del mock | Cómo se adapta | Toca contrato | Fase |
|---|---|---|---|
| **Rango de preparación** ("20-30 min", "Listo en aprox. 20-30 min") | `pickupMaxMinutes` opcional + copy "listo entre X y Y" en el checkout y en la confirmación; la hora guardada sigue siendo el mínimo | **Sí** (migración + zod) | **1** (ya aprobada) |
| **Tiempo estimado visible en la confirmación** | La fila "Hora de retiro" de `/success` pasa a "listo entre X y Y" cuando hay máximo | No | **1** |
| **El local y su horario junto al retiro** | Mostrar la **dirección** del local (ya está en la configuración) donde hoy solo se muestra el horario | No | **3 (nueva, candidata)** |
| **Edición por ítem en el resumen** | Reutilizar `updateQuantity`/`removeItem`; **recomendación: en `/cart`, no en el checkout** | No | **7 (opcional)** |
| **Tarjetas de opción con delta de precio** (personalizar) | Ya es el patrón de nuestros modificadores; se conserva el overlay de opacidad 0 que hace clickeable el input nativo | No | — (referencia) |
| **Paleta crimson + canvas crema** | Como **preset** nuevo en `color-presets.ts` (con sus avisos de contraste), no como default | No | Decisión **D6** |
| **"Volver a la carta" + seguimiento** en la confirmación | Ya existen en `/success` | No | — |
| Timeline de 4 pasos, "Reorder", "Recibo", menú con buscador | Otras áreas | — | **§9 (pendientes nuevos)** |

---

## 9. Lo que el mock confirma del trabajo ya hecho (no tocar)

Copiar el mock **borraría** funciones desplegadas. Nuestro checkout ya tiene y el mock no:

| Nuestro | Por qué no se pierde |
|---|---|
| **Nombre y WhatsApp** en el checkout | El servidor los exige; no hay sesión de cliente (el OTP responde 503 en producción) |
| **Hora de retiro opcional y programable** | El servidor la valida contra el horario del día y la guarda; la cocina la ve en el ticket |
| **Gate operativo** ("Aceptando pedidos" + horario + hora pasada) | El mock no tiene ninguno; nosotros rechazamos con 409 y el checkout bloquea antes |
| **Propina opcional desmarcada** con el monto calculado en el servidor | `AGENTS.md`; el mock la premarca y la calcula distinto |
| **Aviso "pagás en el local al retirar"** | El mock no lo dice en ninguna pantalla |
| **Un solo encabezado, un resumen, un CTA visible por viewport, contador por unidades** | `TASK-checkout-ux`, desplegado |
| **Datos del negocio desde `/admin/settings`** | El mock hardcodea nombre, dirección, horarios, moneda y colores en cada pantalla |

---

## 10. Plan propuesto

**Dentro de esta tarea (checkout), en orden, una fase por commit:**

| Fase | Qué | Toca contrato | Bloqueada por |
|---|---|---|---|
| **1** | Rango de preparación mín–máx (configuración + copy en checkout y confirmación) | Migración + zod | — (aprobada) |
| **2** | El campo de preparación se explica solo: ayuda real + vista previa en vivo de turnos y "última orden" | No | — (aprobada) |
| **3** | **Nueva (candidata):** el punto de retiro en el checkout — dirección del local junto al horario | No | Aprobación del owner |
| **4** | Pedidos para días futuros | Sí (UI + admin) | **D1** |
| **5** | Presets de propina con lista cerrada y validación en el servidor | Sí (payload) | **D2** |
| **6** | Deuda menor: prefijo de WhatsApp `+505` y qué hacer con `mockup/` + `stitch_full_pwa_builder/` | No / **sí** si el prefijo se configura | **D3** |
| **7** | Opcional: edición por ítem (recomendado: en `/cart`) | No | Aprobación del owner |

**Decisiones que hay que responder ahora** (las tres del brief más las que agrega esta auditoría):

| # | Decisión | Recomendación |
|---|---|---|
| **D1** | ¿Pedidos para días futuros? | **No** por ahora (fase más grande, negocio de retiro inmediato) |
| **D2** | ¿Presets de propina con lista cerrada? | **Sí**, si el negocio quiere; el mock los sugiere y el servidor sigue calculando el monto |
| **D3** | ¿Se versiona `mockup/` (y `stitch_full_pwa_builder/`)? | **Ignorar ambos** en `.gitignore`: son carpetas de trabajo; lo versionado es este informe |
| **D4** | ¿Upselling "¿Algo más para acompañar?"? | **No en el checkout**; si se quiere, en `/cart` |
| **D5** | ¿PIN/código de retiro en la confirmación? | **No** por ahora: mostrar el número de pedido; un PIN real es una columna nueva |
| **D6** | ¿La paleta del mock como preset de apariencia? | **Sí**: es barato, aislado y no cambia el default |
| **D7** | ¿"Método de pago" (efectivo/tarjeta) en el checkout? | **No**: se cobra en caja; el dato no aporta a la cocina |
| **D8** | ¿Calculadora de vuelto? | **No**: dato no autoritativo, sin uso en la operación |

**Fuera de esta tarea pero registrado como pendiente** (el mock los sugiere y son producto nuevo, no
checkout): timeline de seguimiento de 4 pasos y código de retiro en `/orders/[id]`; "Pedir
nuevamente" y "Recibo" en `/activity`; buscador que filtre y grilla de 2 columnas en `/menu`;
arreglar el marco de altura fija y la barra inferior cortada de la home.

---

## 11. Cómo se verificó

```bash
node scripts/audit-checkout-mock.mjs               # inventario medido en Chromium real (375 y 1280 px)
node scripts/audit-checkout-mock-interactions.mjs  # ¿los controles responden?
```

- Salidas: `test-results/mock-audit/inventory.json` (inventario completo), `*-mobile.png` y
  `*-desktop.png` (7 pantallas × 2 resoluciones). Las dos herramientas se commitean para que la
  medición sea reproducible.
- **Ninguna afirmación de este informe sale de leer el HTML a ojo**: los números se midieron en el
  DOM renderizado y las sondas se ejecutaron contra el mock real. Los dos casos de contraste que no
  se pudieron verificar (fondos con degradado) están declarados en §3 y excluidos.
- **No se escribió código de producto**: solo las dos herramientas de auditoría y este informe. El
  mock no se commiteó.

**Criterios de cierre de la fase 0** (`TASK-checkout-v2.md` §5.4): inventario completo (✔ §4-5),
clasificación por elemento con contrato separado de UI/copy (✔ §4-6), lo descartado con motivo
(✔ §7), plan propuesto (✔ §10) y **aprobación del owner** (pendiente).
