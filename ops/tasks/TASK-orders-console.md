# TASK-orders-console — B: la consola de pedidos (lo que la cocina necesita)

> **Estado: DISEÑO (2026-09-13), sin arrancar.** Arranca al cerrar A (ya cerrada y desplegada el
> 2026-09-13, commit `982da3f`). Decisiones ya tomadas por el owner para esta tarea: **avisos =
> sonido + aviso dentro del panel** · **el modo cocina vive dentro de `/admin/orders`** (no una
> pantalla aparte) · **el orden es A → B** (A ya está).

## 1. Qué pidió el owner

> «La sección de órdenes de menú es muy básica, debería caer órdenes, ver tiempo de preparación,
> aceptar sencillo o rechazar… notificaciones… filtros avanzados, de qué está preparando qué se está
> preparando. Pedidos con mucho tiempo.»

## 2. Lo que ya existe (no se rehace)

- **Aceptar / Rechazar con motivo obligatorio** en el detalle (`/admin/orders/[id]`), con las
  transiciones de `order-workflows.ts` y la validación en el servidor (409 si la transición ya no
  aplica).
- **Semáforo contra la hora prometida** (verde, naranja al pasarse, rojo a los 15 min) y la etiqueta
  «Retiro 8:00 p. m. · Programado / ~Lo antes posible».
- **Agrupación por turno**: Programados · Nuevas · En cocina · Listas · Otras · Cerradas.
- **Filtros**: estado, tipo, fecha (hoy / historial con presets) y local —este último arreglado en A,
  con el alcance del usuario—.
- `aria-busy` mientras carga y el conteo de pedidos abiertos de días anteriores.
- Detalle con ítems, modificadores, notas, punto de retiro, PIN, forma de pago y vuelto.

## 3. Funciones (una fase por commit, TDD en cada una)

### B1 · Que caigan solas: auto-refresh y avisos
- Poll cada 15 s **solo con la pestaña visible** (se pausa con `visibilitychange` y refresca al
  volver), más un botón «Actualizar» y un «Actualizado hace Xs».
- Banner `aria-live` «N pedidos nuevos» con acción para verlos; el aviso se dispara **una vez por
  pedido**, no una vez por poll.
- **Sonido**: un beep corto con `WebAudio` (sin asset nuevo), apagado hasta que la persona toque
  «Activar sonido» (el navegador bloquea el audio sin gesto), con el estado recordado.
- Nunca se reordena ni se pierde el ticket que se está leyendo: los nuevos entran arriba de su grupo.
- **Datos**: el endpoint actual alcanza (la lista del día es chica); la comparación de ids es en el
  cliente. Sin websockets (replicas 1, sin store compartido): polling, como el outbox.
- **Aceptación**: con la bandeja abierta, un pedido nuevo aparece en ≤15 s, el banner lo cuenta y el
  sonido suena una sola vez; con la pestaña oculta no hay tráfico.

### B2 · Aceptar y rechazar desde la fila
- En «Nuevas»: **Aceptar** y **Rechazar** (el rechazo pide el motivo en un sheet inline, reusando
  `admin-edit-sheet`; el motivo sigue siendo obligatorio en el servidor).
- En el resto: un botón con **el próximo paso** según `getAllowedNextStatuses` (Confirmada →
  «Empezar», Preparando → «Lista», Lista → «Entregada/Recogida») y «más» para cancelar con motivo.
- La fila se actualiza en su lugar, con confirmación leída por lector de pantalla; si la API
  responde 409 (alguien ya la movió), se refresca y se explica.
- **Aceptación**: aceptar o rechazar no obliga a abrir el detalle; el detalle sigue existiendo para
  lo avanzado (ítems, PIN, pago, historial).

### B3 · Modo Cocina (dentro de `/admin/orders`)
- El toggle Hoy/Historial suma **Cocina**: cada ticket muestra **los ítems** con cantidad,
  modificadores y notas, la hora prometida, el **tiempo en la etapa actual** («sin aceptar hace 3
  min», «en cocina hace 6 min») y el CTA del próximo paso.
- Los precios y el total **no** se muestran en modo cocina (no son información de cocina); el PIN
  tampoco (es de caja) — ver §5.
- **Datos**: la lista ya devuelve los ítems con modificadores; falta el **último cambio de estado**,
  que sale de `OrderStatusHistory` en **una sola lectura** para toda la lista (sin N+1).
- **Aceptación**: a 375 px un pedido completo entra sin scroll horizontal, con blancos táctiles de
  44 px y el tiempo por etapa verificado con reloj fijo en unitarios.

### B4 · Búsqueda y filtros avanzados
- Buscar por **número de pedido, nombre, WhatsApp o PIN** (parámetro `search` en el servidor).
- Filtros nuevos: **forma de pago**, **solo sin aceptar**, **atrasados**, además de los actuales.
- Los filtros y la vista **viven en la URL** (compartir un enlace con lo que se está mirando y
  sobrevivir a un recargado).
- **Aceptación**: buscar el PIN encuentra el pedido; los filtros se combinan; sin resultados se
  explica y se ofrece limpiar.

### B5 · Demoras con umbrales configurables
- Dos campos nuevos **por local**: `acceptAlertMinutes` (sin aceptar) y `prepAlertMinutes` (en
  cocina), con defaults en el módulo de defaults y editables en `/admin/locations`. **Nada
  hardcodeado.**
- La bandeja suma un contador de **atrasados** y destaca esos pedidos con el lenguaje del semáforo
  que ya existe; la antigüedad se mide **desde el último cambio de estado**, no desde la creación.
- **Aceptación**: unitarios del resolvedor puro con umbrales fijos; E2E: se cambia el umbral en el
  admin y la bandeja lo refleja.

### B6 · Telegram por sucursal (aparte, con OK del owner)
- `Location.telegramChatId` y el ruteo del evento `OrderCreated` al chat **de esa sucursal** (hoy hay
  uno global). El motor existe (outbox + sender de Telegram); está en pausa por decisión del owner y
  necesita bot token + chat ids. **No entra sin su OK y sus credenciales.**

## 4. Cómo se ve

**375 px (el celular de la cocina y de la caja)**

```
Órdenes · bandeja de turno
[ hoy 12 ]  nuevas 3 · preparando 4 · listas 2      ← métricas (2 columnas)
( Nuevas 3 ) ( Preparando 4 ) ( Listas 2 ) ( Todas ) ← chips con contador (ya existe)
[ Cocina ]  [ Mostrar filtros ]  [ 🔔 Activar sonido ] [ ↻ ]   ← toolbar
│ 3 pedidos nuevos                              Ver │  ← banner aria-live
┌──────────────────────────────────────────────────┐
│ OB-123        Retiro ~8:00 p. m.     ⏱ en 12 min │
│ Ana · +505 8888 7777 · PIN 4821                  │
│ 1× Hamburguesa Doble · sin cebolla               │  ← modo cocina: ítems y notas
│ [ Empezar ]                        [ ⋯ ]         │  ← 44 px
└──────────────────────────────────────────────────┘
```

**1280 px (el mostrador)**: la misma información en **columnas por etapa** —Por aceptar · En cocina ·
Listas— con las tarjetas apiladas, la barra superior con contadores, búsqueda y filtros, y el
**detalle sigue siendo la página** `/admin/orders/[id]` (no se duplica en un panel lateral).

**Lenguaje visual**: todo con los tokens semánticos que ya existen (`bg-card`, `text-foreground`,
`bg-brand`, `border-border`) y el semáforo `--pickup-on-time/past/late`. «Sin aceptar» usa el mismo
esquema de aviso (`warning`) que la bandeja ya usa para lo que pide atención: **ningún color nuevo**.

**Estados**: cargando (`aria-busy`, ya está) · vacío por etapa · error con reintento y «última
actualización» · sin conexión (el banner no miente: dice que no se pudo actualizar) · transición
vieja (409 → refresca y explica).

## 5. Crítica de la idea (2026-09-13): qué le mejoraría

El owner define la sección como **«comandas»: lo que ve cada sucursal y con lo que trabaja**. La
dirección es correcta (deja de ser un visor y pasa a ser la herramienta del turno), pero hay cinco
cosas que le cambiaría antes de codear, ordenadas por impacto y con la evidencia del código:

1. **Son dos trabajos, no uno.** Una comanda es de **cocina**; la **caja/mostrador** necesita otra
   cosa (cobrar el vuelto, dictar/verificar el PIN, entregar). Hoy la misma pantalla sirve a los dos
   con el mismo layout. Mejora: un solo lugar, **dos vistas con default por rol** (cocina aterriza en
   Comandas; gerente/dueño en Pedidos) y un **traspaso explícito**: la cocina termina en «Lista» y la
   caja entrega. Sin eso, el modo cocina va a ser una versión recortada de la vista del mostrador
   —mediocre para los dos—.
2. **La cola está al revés.** `listOrders` ordena por `createdAt desc`, así que dentro de cada grupo
   el pedido **más nuevo aparece primero**. En una cocina manda la **hora prometida**: el que hay que
   empezar ya, primero. Mejora: ordenar por `pickupTime` ascendente (desempate por creación) y, para
   responder de verdad «qué se está preparando ahora», sumar una **vista por plato** (agregada: «2 ×
   Doble, 3 × Birria») además de la vista por pedido. Con 10 pedidos abiertos, el cocinero no lee 10
   comandas: mira la producción.
3. **«Aceptar» puede ser fricción pura.** Si el negocio no rechaza pedidos (cobra al retirar, no hay
   delivery ni pago online), un pedido esperando aceptación **no está en la comanda**: es exactamente
   la confusión que querés resolver. Mejora: interruptor **por local** «Aceptar pedidos
   automáticamente» —el pedido nace «Confirmada» y cae directo a la comanda— y el modo manual sigue
   disponible para quien quiera la puerta. No lo doy por hecho: es decisión de producto.
4. **Un hipo de wifi borra la bandeja.** En los tres caminos de error la pantalla hace
   `setOrders([])`: con la conexión floja del local, la cocina se queda **sin comandas** y sin saber
   si hay pedidos. Mejora: conservar la última lista y mostrar «sin conexión · última actualización
   hace X» (el aviso no miente), más dos cosas que una cocina real necesita: **pantalla que no se
   duerme** (`wakeLock`, con fallback) y un **ticket imprimible** (`window.print` con hoja de
   impresión) como respaldo de papel cuando no hay pantalla.
5. **Nadie sabe quién hizo qué.** `OrderStatusHistory` guarda estado, nota y fecha, **pero no el
   usuario**. Si las acciones pasan a la fila y la cocina comparte una cuenta, «¿quién aceptó esto?»
   queda sin respuesta. Mejora: guardar el actor (`changedByUserId`) en la misma migración de B5; el
   dato ya está en la sesión y es barato ahora.

**Detalles chicos que también cambiaría**

- **Nombres**: «Comandas» es palabra de cocina; para el mostrador, «Pedidos». Propongo etiqueta **por
  rol** (cocina ve «Comandas», el resto «Pedidos») sin tocar la ruta `/admin/orders`.
- **Modo cocina sin tablero**: en esa vista no van las métricas, ni los chips de estado, ni el botón
  «Mostrar filtros». La cocina necesita la cola, no un panel de control.
- **Tipografía de comanda**: número e ítems con la escala grande (se lee a un brazo de distancia); hoy
  la fila es `text-xs` y está pensada para leer de cerca.
- **Ruido disciplinado**: un sonido para «pedido nuevo» (una vez por pedido, recordando los ids ya
  vistos en el dispositivo) y **nada** para los cambios de etapa; si todo suena, deja de significar.
- **Número corto y dictable** para cantar la comanda (el `OB-…` es largo); el PIN sigue siendo de caja.
- **Un número que vas a pedir la semana que viene**: tiempo promedio de preparación de hoy, que sale
  del historial y es barato de calcular.

**Lo que NO haría**: websockets/SSE (con `replicas: 1` y sin store compartido, el polling documentado
alcanza), notificar al cliente, rehacer el detalle del pedido, ni «asignar la comanda a un cocinero»
si la cocina es de dos personas: agrega datos y hoy no resuelve nada.

## 6. Decisiones que necesito del owner

De la idea original:

1. **«Aceptar»**: ¿un toque = `Nueva → Confirmada` y después «Empezar», o un solo botón «Aceptar y
   empezar» (`Nueva → Preparando`, salteando «Confirmada»)? Lo segundo cambia la máquina de estados y
   el historial.
2. **Umbrales por defecto** de B5 (propuesta: 3 min sin aceptar, 15 min en cocina) y confirmar que se
   editan en `/admin/locations`.
3. **Modo cocina**: ¿ocultamos precios/total y el PIN? (propuesta: sí; el detalle los sigue mostrando).
4. **Sonido**: ¿lo dejamos apagado hasta que alguien toque «Activar sonido»? (es lo único que permite
   el navegador).
5. **Telegram**: ¿se retoma, con un chat por sucursal? Necesita bot token + chat ids.

De la crítica de esta sección:

6. **¿Aceptación automática por local** (interruptor) o se queda manual?
7. **¿Vista agregada por plato** además de la vista por pedido?
8. **¿Guardamos quién cambió el estado** (`changedByUserId`, migración chica)?
9. **¿Ticket imprimible + pantalla que no se duerme?** (recomiendo sí para los dos).
10. **Nombres por rol** (cocina «Comandas», resto «Pedidos»): ¿ok?

## 7. Fuera de alcance

- Realtime con websockets/SSE (replicas 1, sin store compartido): se usa polling documentado.
- Notificar al cliente (WhatsApp/SMS): no está pedido; el seguimiento ya existe en la web.
- Reservas, mesas, delivery e inventario: fuera del MVP.
- Rehacer el detalle del pedido: se mantiene como está (B2 le quita la obligación de pasar por ahí).
