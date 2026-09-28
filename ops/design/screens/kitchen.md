# Spec de pantalla — Cocina (`/admin/kitchen`)

> **Plantilla**: [`TEMPLATE.md`](TEMPLATE.md). **Estado**: creada por
> `TASK-ORDERS-KITCHEN-FOUNDATIONS-001` (docs-only, 2026-09-27) a partir de la **referencia aprobada por el
> owner el 2026-09-27**. **Nada de esta spec está implementado**: la superficie `/admin/kitchen` no existe
> hoy (Cocina vive como *modo* de `/admin/orders`) y su implementación es la TASK siguiente del
> [roadmap maestro](../../roadmap/PRODUCT-UX-ROADMAP.md).
>
> **Qué es**: la spec de una **superficie nueva del panel** que **proyecta** `orders`. No crea un módulo, no
> crea una sección de arquitectura y **no** es dueña de ninguna regla del pedido.
>
> **Prohibiciones que esta spec respeta**: no inventa estados ni métricas, **no toca dinero**, no mueve
> reglas del dominio a React, no hardcodea sucursales, y **no** da acceso a cobro, saldo, `Payments`, PIN
> financiero, `Invoice` ni a la retirada/cierre del pedido.
>
> **Reemplaza**: el modo cocina de [`orders.md`](orders.md) (el tablero de tres carriles deja de vivir en
> `/admin/orders`). `orders.md` queda como la spec de **Pedidos** (listado + detalle).

---

## Reuse audit

**Objetivo**: que la cocina mueva los pedidos del turno de *entró* a *listo* sin perder ninguno, viendo antes
lo que está por vencerse, y **sin ver dinero**.

**Capacidad existente**: el tablero (`order-comanda-board.tsx`, `order-comanda-card.tsx`), los carriles y la
urgencia (`comanda-helpers.ts`), los tabs y el modo inmersivo (`kitchen-tabs.ts`, `kitchen-mode.ts`,
`use-comanda-view.ts`), el orden de la cola (`sortQueueOrders`), el polling de 15 s, la frescura
(`formatUpdatedAgo`), el sonido (`admin-alert-sound.ts`), la búsqueda (`order-search.ts`), el alcance por
sucursal (`order-visibility.ts`) y las transiciones (`order-workflows.ts`).

**Se reutiliza**: todo lo anterior, con **un** cambio de regla (el carril de `confirmed`) y **un** cambio de
dueño (el mapa de carriles pasa a `orders/domain`, una sola vez). Los umbrales siguen saliendo de
`Location.acceptAlertMinutes` / `Location.prepAlertMinutes` y el flujo sigue saliendo de `order-workflows.ts`.

**Realmente nuevo**: la **ruta** `/admin/kitchen` y su entrada de navegación; el contrato de lectura
`KitchenOrderProjection`; y —por dependencia, no por gusto— el **canal de origen** (`Order.source`) que la
referencia muestra como etiqueta `MENÚ` / `POS` y que hoy **no existe** en el modelo.

**Lo que se elimina y por qué**: el **modo cocina dentro de `/admin/orders`** (una sola superficie con dos
usos). Cocina es una superficie distinta y Pedidos es un listado denso: mezclarlas obliga a que el detalle
con dinero esté a un clic de la cocina (**`A-60`**).

---

## Ruta

`/admin/kitchen` (**nueva**; se implementa en la TASK de Cocina runtime). Sin subrutas: el detalle del pedido
**no** es de esta superficie.

## Módulo

**Ninguno nuevo.** Cocina es una **proyección de `orders`**: el pedido, sus items, su ciclo de vida y sus
tiempos son de `orders` ([`../../product/MODULE_ARCHITECTURE.md`](../../product/MODULE_ARCHITECTURE.md) §5).
La pantalla **consume** además `locations` (umbrales del local) y `auth` (puertas). **Prohibido crear
`modules/kitchen`**: no hay responsabilidad de dominio nueva.

## Usuario / roles

| Rol | Qué hace acá | Ve dinero | Ve el detalle del pedido |
|---|---|---|---|
| `kitchen` | todo el tablero: aceptar, iniciar preparación, marcar listo | **nunca** | **no** (el detalle es de Pedidos) |
| `manager` | ídem, según su alcance por sucursal | no en esta superficie | por Pedidos |
| `owner` | ídem | no en esta superficie | por Pedidos |
| `cashier` | **no entra**: no opera cocina (`A-66` / `D-014`) | — | — |

El rol llega **por cliente** (la navegación filtra), pero **la autorización es del servidor**: la proyección
que alimenta esta pantalla no incluye un solo campo de dinero, así que un rol sin la capacidad financiera no
puede leerlo ni por API. La puerta nominal es `canOperateKitchen` (contrato en
[`../../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md`](../../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md)
§ *AUTORIZACIÓN*); **no se implementa acá**.

## Propósito

Una frase: **mover las comandas del turno de "entró" a "listo" lo antes posible, viendo primero lo que está
por vencerse** y sin ninguna decisión de plata. El estado del pedido después de *Listo* (retirada y cierre)
no se decide acá.

## Preguntas

1. **¿Qué tengo que hacer ahora?** (lo que nadie tomó, lo que ya está aceptado sin empezar, lo que se está
   cocinando)
2. **¿Cuánto falta para que algo se venza?** (tiempo en la etapa actual contra el umbral del local; y para lo
   programado, cuánto falta para el inicio recomendado)
3. **¿Qué se cocina?** (items, modificadores y notas, sin precios)
4. **¿Este es el pedido que busco?** (número, cliente, local)

## Decisiones

- Se decide **aceptar o rechazar** un pedido nuevo (`new → confirmed` / `→ cancelled`, con motivo).
- Se decide **iniciar la preparación** (`confirmed → preparing`).
- Se decide **terminar** (`preparing → ready_for_pickup`). **Cocina termina en *Listo*.**
- **No** se decide acá: cobrar, ver el saldo, anular un cobro, emitir la factura, la retirada
  (`ready_for_pickup → picked_up`) ni el cierre (`picked_up → closed`). Eso es de **Pedidos** y del **POS**.

## Flujo objetivo (retiro)

```text
new → confirmed → preparing → ready_for_pickup → picked_up → closed
```

Cocina opera **únicamente** estos tres pasos y ninguno más:

```text
new → confirmed          (aceptar)
confirmed → preparing    (iniciar preparación)
preparing → ready_for_pickup   (terminar · LISTO)
```

Las tres transiciones **ya** existen en el dominio (`order-workflows.ts:13-20`): lo que cambia es **el carril**
donde hoy se dibuja `confirmed`, no la máquina de estados.

## Datos disponibles

Todo sale de `orders` y de `locations`. Marcado **FALTA** lo que el backend todavía no tiene.

| Dato | Fuente | Estado |
|---|---|---|
| Número, tipo, estado, cliente, local | `Order` | existe |
| **Canal de origen** (`MENÚ` / `POS`) | `Order.source` | **FALTA** — no existe el campo; dueño `orders`; se escribe al crear (las dos puertas: checkout público y venta del POS) |
| Hora prometida y si es programado | `pickupTime`, `pickupScheduled` | existe, con dos límites: el retiro **programado** puede ser de otro día y el pedido del POS **no tiene hora** (`pickupTime` es `null`) |
| **Inicio recomendado** (`Retiro − pickupLeadMinutes`) | `pickupTime` + `Location.pickupLeadMinutes` | **FALTA** la función que lo deriva; dueño `orders`; se calcula **en un solo lugar** |
| Umbrales de urgencia | `Location.acceptAlertMinutes` (cola *Por aceptar*) y `Location.prepAlertMinutes` (cocina, incluye *Listos*) | existe |
| Tiempo en la etapa actual | `stageChangedAt` (último cambio de estado) | existe |
| Items, modificadores, notas | `OrderItem`, `OrderItemModifier`, `notes` | existe |
| **Preparación real por pedido** (`preparingAt → readyAt`) y «Preparación N min» en la tarjeta de Listos | `OrderStatusHistory` | **FALTA** la derivación por etapa; dueño `orders`; **nunca** desde `createdAt` |
| **Prep. promedio** del tablero | `averagePrepMinutes` | existe pero **con la ventana equivocada** (mide `createdAt → readyAt`, `order-stage-times.ts:78`): se corrige a `preparingAt → readyAt` |
| **Más larga** (la preparación más larga del tablero) | — | **FALTA** |
| Sonido, frescura, offline, polling | `admin-alert-sound.ts`, `lastUpdatedAt`, estado de error, 15 s | existe |

**No se muestra** (no existe, no corresponde o está prohibido): totales, subtotales, propina, medio de pago,
cobros, `Payment`, saldo (`pending`/`partial`/`paid`), PIN de retiro, factura, ticket con importes, y **el
detalle del pedido** (es de Pedidos). La tarjeta del KDS ya excluye totales y PIN
(`order-comanda-card.tsx:23`): **eso se conserva y se extiende a toda la superficie**.

**Copy que no miente**: un pedido sin hora prometida (venta de POS) dice **«Retiro: lo antes posible»**; no
se le inventa una hora estimada. La etiqueta de canal sólo se dibuja si `Order.source` tiene valor; en un
pedido histórico sin declarar se dibuja **sin etiqueta**, nunca una adivinada.

## Jerarquía

```text
1. QUÉ HACER AHORA   → carriles + contadores + señales de atraso
2. EL PEDIDO          → número, canal, cliente, hora prometida, urgencia, items
3. LA ACCIÓN          → una sola acción primaria por pedido (y ninguna en Listos)
4. ENCONTRARLO        → búsqueda + «Solo atrasadas»
5. CONTEXTO DEL TURNO → preparación promedio, objetivo del local, más larga, frescura, sonido
```

## Carriles (regla canónica)

El mapa estado→carril se escribe **una sola vez** en `orders/domain` y lo consumen **Cocina y Pedidos**
(hoy hay cinco mapas: `A-64`).

| Carril | Estados | Grupos internos |
|---|---|---|
| **ENTRADA** | `new`, `confirmed` (+ `accepted`, equivalente de mesa) | **Ahora** (se puede tomar ya) · **Programados** (retiro de otro día o con hora futura) |
| **PREPARANDO** | `preparing` | — |
| **LISTOS** | `ready_for_pickup` (+ `ready`, equivalente de delivery) | — |

- `confirmed` **sale** del carril de preparación y entra en **ENTRADA**: aceptado todavía no es «en el fuego».
- Un pedido **cerrado, retirado o cancelado** no está en el tablero.
- `accepted` y `ready` se conservan en el carril de su equivalente (`confirmed` / `ready_for_pickup`) para no
  dejar sin superficie a un estado del esquema, aunque mesa y delivery estén fuera del MVP.

## Acciones

| Acción | Label | Dónde |
|---|---|---|
| Aceptar | **ACEPTAR** | Tarjeta en ENTRADA, estado `new` |
| Rechazar | **Rechazar** → **Confirmar rechazo** (motivo obligatorio) | Tarjeta en ENTRADA, estado `new` |
| Iniciar preparación | **INICIAR PREPARACIÓN** | Tarjeta en ENTRADA, estado `confirmed` |
| Terminar | **TERMINADO** | Tarjeta en PREPARANDO |
| Buscar | **Buscar número o cliente** | Toolbar |
| Filtrar atrasadas | **Solo atrasadas** | Toolbar |
| Sonido | **Sonido activado / desactivado** | Cabecera |
| Actualizar | **Actualizar** | Cabecera |
| Volver al panel | **Salir** (modo inmersivo) | Cabecera |

**Una sola acción primaria por tarjeta.** Las tarjetas de **LISTOS no tienen acción**: el pedido ya salió de
cocina y su retirada es de Pedidos.

## Estados

Cargando · con datos · carril vacío (copy propio por carril) · sin coincidencias (con el término buscado) ·
error sin datos · error con datos (bandeja vieja: «No se pudo actualizar el tablero. Última actualización hace
N min.» + reintentar) · sin permiso (mensaje propio de permiso, **no** de sesión).

## Empty / error / loading

- **Carril vacío**: copy por carril («No hay comandas nuevas. Cuando entre un pedido, aparece acá.» ·
  «Nada en el fuego. Aceptá una comanda para empezar.» · «Todavía no hay nada listo para entregar.»).
- **Sin coincidencias**: «Sin coincidencias» + «Ninguna comanda coincide con «{término}».»
- **Sin permiso**: mensaje de permiso. Prohibido mostrar «Sesión de administrador requerida» cuando hay
  sesión y lo que falta es la capacidad (hoy ocurre en Órdenes: `A-66`).

## Desktop

A 1280 y 1366: tres columnas (ENTRADA · PREPARANDO · LISTOS) con scroll **propio** por carril; cabecera de
una línea (título + local + métricas + reloj + sonido + actualizar) y toolbar de una línea (buscador +
«Solo atrasadas»). El scroll de página es **0**: el alto útil es el del viewport.

## Tablet

A 768: un carril por vez con conmutador; la toolbar envuelve en dos filas.

## Mobile

A 375: un carril por vez, conmutador visible, buscador a todo el ancho, barra inferior del panel respetada
(`pb-24`) y sin scroll horizontal. Es una superficie de **escritorio y tablet** en el uso real; el celular
tiene que poder abrirla y avanzar, no ser la vista primaria.

## Viewport contract

| Viewport | Qué entra en el primer viewport | Qué scrollea |
|---|---|---|
| `1366×768` | cabecera, toolbar, los **tres** carriles con sus contadores y al menos dos tarjetas por carril | el cuerpo de **cada** carril (nunca la página) |
| `1280×720` | ídem | ídem |
| `768×1024` | cabecera, toolbar y **un** carril completo con su conmutador | el cuerpo del carril |
| `375×812` | cabecera compacta, buscador, conmutador, estado del carril y la **primera tarjeta con su acción** | el cuerpo del carril |

## Referencia aprobada

[`kitchen-reference.html`](kitchen-reference.html) — **aprobada por el owner el 2026-09-27**, versionada acá
sin modificarla. Es **contrato** de composición, jerarquía, densidad, *progressive disclosure* y
comportamiento responsive: se traduce a los componentes reales (**no** se copia el HTML) y una divergencia
material la decide el owner **antes** de implementar.

**Divergencias declaradas de entrada** (no se resuelven en el código):

| Elemento de la referencia | Qué se hace | Por qué |
|---|---|---|
| Etiqueta `MENÚ` / `POS` en la tarjeta | se implementa, **depende de `Order.source`** | hoy el dato no existe (FALTA); sin él, la tarjeta sale sin etiqueta |
| `Retiro estimado ~HH:MM` en un pedido de POS | para un pedido del POS dice **«Retiro: lo antes posible»** | el POS crea el pedido sin hora prometida: mostrar una hora sería inventarla |
| `Objetivo 18 min` | el «objetivo» es el **umbral del local** (`prepAlertMinutes`) | no existe un objetivo de negocio separado; el copy tiene que decir de dónde sale |

**Correcciones de esta spec al implementar la TASK de runtime** (`TASK-ORDERS-KITCHEN-RUNTIME-002`): dos
detalles quedaban descriptos de forma genérica y la **referencia aprobada** los fija. Se corrige **la spec**,
no el código, porque la referencia es contrato de composición y comportamiento:

| Punto | Antes decía | Queda |
|---|---|---|
| Cronómetro del carril PREPARANDO | «tiempo en la etapa actual» (`hace N min`) | **`PREP N m`** (el rótulo de la referencia), con la **misma** cuenta: desde `preparingAt`, el sello que deriva `orders/domain` |
| **Más larga** (cabecera) | dato **FALTA** en el carril LISTOS | se deriva de **`preparingAt → readyAt`** de los pedidos listos del turno, con la misma medición que el promedio; sin preparaciones medidas dice «sin datos», no `0` |

Dos datos del inventario original ya **existen** y la TASK los consume sin inventar nada: los **sellos por
etapa** (`confirmedAt`, `preparingAt`, `readyAt`, `pickedUpAt`, `closedAt` desde `OrderStatusHistory`) y el
**inicio recomendado** (`pickupTime − Location.pickupLeadMinutes`), los dos en `orders/domain`.

## Qué se elimina

El **modo cocina de `/admin/orders`** (el tablero de tres carriles con su conmutador, su toolbar y su punto
de «Nuevas»), el enlace de la tarjeta al detalle del pedido para el rol de cocina y el pulso en reposo
(queda sólo el del SLA vencido). Nada de eso cambia lo que el usuario puede hacer: cambia **dónde** lo hace.

## Fuera de scope

- **Dinero**: cobrar, saldo, `Payments`, propina, PIN financiero, factura y ticket con importes. Prohibido en
  esta superficie, en su proyección y en sus endpoints.
- **Retirada y cierre** (`ready_for_pickup → picked_up → closed`): Pedidos.
- **El detalle del pedido**: Pedidos. Cocina no enlaza a un detalle con dinero.
- **`/admin/orders`**: su listado denso y su detalle son de [`orders.md`](orders.md).
- **Estados de entrega y mesa** (fuera del MVP): no se reactivan por esta spec.
