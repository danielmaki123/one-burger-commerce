# TASK-orders-console — B: las comandas de la sucursal

> **Estado: DISEÑO ACORDADO (2026-09-13), sin arrancar.** Arranca al cerrar A (cerrada y desplegada:
> commit `982da3f`). **Decisiones del owner**: avisos = **sonido + aviso en el panel** · la vista vive
> **dentro de `/admin/orders`** (no una pantalla aparte) · **sin Telegram** por ahora · **sin
> aceptación automática**: se **acepta o se rechaza** · luego **un botón**: preparación → terminado ·
> la comanda va **bien detallada** (cliente, hora de entrada, tiempo de preparación) sin necesidad de
> ver el plato completo · la sección **ocupa toda la pantalla**, ordenada, con buenas prácticas de
> UX/UI · **si se va el wifi se mantiene el orden y la lista** · **pasados 15 minutos la comanda
> cambia de color** para dar urgencia.

## 1. Qué pidió el owner

> «Literalmente la sección de órdenes ahora será como **comandas**: es lo que cada sucursal verá y con
> lo que va a trabajar. Sin Telegram nada por el momento. No acepta automático: se puede aceptar o
> rechazar, después queda un botón de preparación o preparando, terminado… No es necesario ver todo el
> plato, pero sí la comanda bien detallada, nombre de cliente, etc. Tiempo de entrada, tiempo de
> preparación. Eso debería ser una sección que abarque toda la pantalla, ordenado, con buenas prácticas
> UX/UI. Si el wifi se va, debe mantener el orden. Si la orden pasa 15, ya cambia de color la comanda,
> para que dé sentido de urgencia.»

## 2. Lo que ya existe (no se rehace)

- Aceptar / Rechazar **con motivo obligatorio** (hoy solo en el detalle) y las transiciones de
  `order-workflows.ts`, validadas en el servidor (409 si la transición ya no aplica).
- Semáforo contra la **hora prometida** y la etiqueta «Retiro 8:00 p. m. · Programado / ~Lo antes
  posible»; agrupación por turno; filtros de estado/tipo/fecha/local (con el alcance del usuario, A);
  `aria-busy` mientras carga; detalle con ítems, modificadores, notas, punto de retiro, PIN, pago.
- El **sistema de diseño** ya está comprometido en `globals.css` (paleta validada por contraste, 13
  pasos tipográficos, radios y sombras del mock, T1): el diseño de abajo **no inventa tokens**.

## 3. El flujo de la comanda (decidido)

```
Nueva ──[Aceptar]──▶ Confirmada ──[Preparando]──▶ Preparando ──[Terminado]──▶ Lista ──[Entregar]──▶ Entregada
   └───[Rechazar + motivo]──▶ Cancelada
```

- **Aceptar** = `new → confirmed`. **Rechazar** pide el motivo (obligatorio) en un sheet inline.
- **Preparando** = `confirmed → preparing`. **Terminado** = `preparing → ready_for_pickup`.
- La comanda de cocina **termina en «Lista»**: ahí pasa a manos del mostrador (`picked_up` y `closed`
  desde la vista de caja / el detalle). Un solo botón primario por etapa, ancho completo y ≥44 px.

## 4. Cómo se ve

### 4.1 Estructura: toda la pantalla

- La vista ocupa **todo el alto útil** (`min-h-dvh`) y todo el ancho del área de contenido, con el
  scroll **adentro** (por columna en escritorio, vertical en celular). Sin encabezado de página grande
  que se coma la pantalla.
- **Barra superior compacta y sticky** (48–56 px): sucursal (con selector si el usuario ve más de una)
  · contadores **Nuevas · Preparando · Listas** · estado de conexión · `[🔔 Sonido]` ·
  `[⛶ Pantalla completa]` · `[↻]`.
- **Escritorio (≥1024 px)**: **tres columnas** —Por aceptar · En preparación · Listas—, cada una con
  encabezado sticky (título + contador) y scroll propio.
- **Celular (375 px)**: **un carril por vez** con conmutador segmentado (`Nuevas 3 · Preparando 4 ·
  Listas 2`) con tipografía grande: la cocina mira una lista, no tres columnas apretadas.
- **Pantalla completa**: botón que entra al *Fullscreen API* y **oculta la barra lateral del panel solo
  en esta vista** (clase en `<html>`), pensado para el tablet de pared. Se sale con Esc o el botón.

### 4.2 Anatomía de la comanda

De arriba hacia abajo, jerarquía para leer a un brazo de distancia:

1. **Número** (`text-title`, 17/700, cifras tabulares) + **hora de entrada** («Entró 8:12 p. m.») +
   **tiempo en la etapa** en chip («hace 6 min»).
2. **Cliente** (`text-body`) — lo primero que se canta.
3. **Ítems**: `2 × Hamburguesa Doble`, con sus **modificadores** entre paréntesis y la **nota del
   cliente** en línea propia (con ícono). **Sin fotos ni descripciones del producto**: no son
   información de cocina.
4. **Retiro**: hora prometida + `Programado` / `Lo antes posible`, y el tipo (`Retiro`).
5. **Acciones**: una primaria a lo ancho (`Aceptar` · `Preparando` · `Terminado`) y, cuando
   corresponde, `Rechazar` en color de peligro y **separada** de la primaria.

**Sin precios ni total en la comanda** (son de la caja: el detalle y la vista de mostrador los
muestran). Sin PIN (es de caja).

### 4.3 Urgencia: los 15 minutos

| Tiempo en la etapa actual | Tratamiento |
|---|---|
| menos de 10 min | tarjeta normal (`bg-card` + `border-border`), chip neutro |
| 10 a 15 min | fondo `bg-warning` + borde `--warning-strong` + chip «hace 12 min» con ícono de reloj |
| **15 min o más** | fondo `bg-danger` + chip **«Atrasado hace 17 min»** + ícono + aviso `aria-live` al cruzar |

- El reloj es **el tiempo en la etapa actual** (sin aceptar · preparando · listo) y el umbral sale de la
  **configuración del local** (B5); nada hardcodeado.
- **El color nunca va solo**: siempre texto + ícono (regla de accesibilidad y de la casa).
- Nada de `border-left` de color (prohibido por la guía): la urgencia se expresa con **fondo y borde
  completo**.

### 4.4 Estados y bordes

- **Cargando**: esqueleto de 3 comandas (no un spinner que borra el contexto).
- **Sin conexión**: se **conserva la última lista** y aparece un banner sticky «Sin conexión · última
  actualización hace 40 s»; las acciones quedan **deshabilitadas con el motivo** visible (nadie toca un
  botón y se queda esperando).
- **Vacío por etapa**: «No hay comandas nuevas. Cuando entre un pedido, aparece acá.» (estado que enseña).
- **Transición vieja (409)**: se refresca, se avisa con `aria-live` y la comanda queda donde corresponde.
- **Recién llegada**: resaltado de fondo ~1,2 s + aviso «1 pedido nuevo» (y el sonido, si está activado).
- **Ruido disciplinado**: el sonido suena una vez por pedido nuevo (ids vistos en el dispositivo) y
  **no** suena en los cambios de etapa.

### 4.5 Accesibilidad y rendimiento

- Blancos ≥44 px con ≥8 px de separación; foco visible (`ring-brand`); orden de tabulación = orden visual.
- `aria-live="polite"` para lo que aparece solo (pedidos nuevos, cambios de estado).
- Cifras **tabulares** en horas y tiempos (no saltan de ancho).
- Solo `transform`/`opacity`, 150–250 ms, con alternativa para `prefers-reduced-motion`.
- Polling **pausado con la pestaña oculta** (batería y datos del local) y refresco al volver.

### 4.6 Tokens (nada nuevo)

`--brand` · `--brand-strong` · `--brand-foreground` · `--background` · `--foreground` · `--card` ·
`--border` · `--muted` / `--muted-foreground` · `--accent` · `--success` · `--warning` · `--danger`
(con sus `-foreground` y `-strong`) · `--pickup-on-time` / `--pickup-past` / `--pickup-late` · escala
`display / headline / title / body / body-sm / label / label-sm / caption` · `--radius-card`,
`--radius-panel` · `--shadow-card`, `--shadow-raised`.

### 4.7 Lo que NO se hace

- Rejilla de tarjetas con métricas decorativas: los KPIs son del **Resumen** (dueño), no de la cocina.
- Emojis como íconos: se usan los íconos de `lucide-react` que ya usa el panel, con el mismo grosor.
- Secuencias de animación al cargar: la cocina no mira cargar la pantalla.
- Escribir colores o datos del negocio a mano: hay un contrato que lo verifica.

## 5. Fases (una por commit, TDD en cada una)

| Fase | Qué agrega | Qué necesita |
|---|---|---|
| **B0 · Base** | Orden de la cola por **hora prometida** (hoy ordena por creación descendente: el más nuevo primero) y **no vaciar la bandeja** cuando falla la red (hoy `setOrders([])` en los tres caminos de error) + banner «sin conexión» | Nada nuevo: son defectos |
| **B1 · Que caigan solas** | Poll cada 15 s con la pestaña visible, aviso «N pedidos nuevos», «Actualizado hace Xs», botón de refresco y **sonido** opcional (WebAudio, se activa con un toque) | La lista actual |
| **B2 · Aceptar y rechazar en la fila** | Los botones del flujo (§3) en la comanda, con el motivo obligatorio inline y aviso si la transición ya no aplica | `order-workflows.ts` |
| **B3 · Comandas** | La vista completa: tres columnas / carril en celular, anatomía de §4.2, urgencia de §4.3, esqueleto, vacíos y pantalla completa | El **último cambio de estado** por pedido (`OrderStatusHistory`) en una sola lectura |
| **B4 · Búsqueda y filtros** | Buscar por número, nombre, WhatsApp o PIN; filtros de forma de pago, «solo sin aceptar» y «atrasados»; el estado de la vista en la URL | Un parámetro `search` en el servidor |
| **B5 · Umbrales por local** | `acceptAlertMinutes` y `prepAlertMinutes` por local, editables en `/admin/locations`, y el tiempo promedio de preparación del día | Migración aditiva + el actor del cambio de estado |

## 6. Decisiones que quedan

**Ya resueltas por el owner**: sonido + aviso en el panel · la vista dentro de `/admin/orders` · sin
Telegram · sin aceptación automática · flujo aceptar/rechazar → preparando → terminado · comanda
detallada sin el plato completo · pantalla completa · la lista se mantiene sin wifi · urgencia a los
15 minutos.

**Faltan tres confirmaciones** (arranco con estos supuestos si no decís lo contrario):

1. **El reloj de los 15 minutos**: cuenta el **tiempo en la etapa actual** (sin aceptar · preparando ·
   listo), no desde que entró el pedido. Es lo que hace visible «esto se está enfriando».
2. **Quién cierra el pedido**: la cocina termina en «Lista» y el **mostrador** marca `Entregada` (y
   `Cerrada`) desde la misma vista o el detalle. ¿Ok, o querés que «Terminado» cierre el pedido?
3. **Pantalla completa**: ¿oculto también la barra lateral del panel en esta vista? (propuesta: sí,
   solo en `/admin/orders`, para el tablet de pared).

## 7. Fuera de alcance

- **Telegram**: en pausa por decisión del owner; el motor existe y se retomaría con un chat por
  sucursal si algún día lo pide.
- Realtime con websockets/SSE (replicas 1, sin store compartido): polling documentado.
- Notificar al cliente, rehacer el detalle del pedido, «asignar la comanda a un cocinero».
- Reservas, mesas, delivery e inventario: fuera del MVP.
