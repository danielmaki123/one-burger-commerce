# TASK: Checkout sin redundancias (carrito → checkout)

**Estado:** **CERRADA y desplegada** — cuatro commits (`2832a93`, `31457fd`, `9023b6f`,
`aba4156`), en producción desde el deploy `build-20260911-145656` · **Prioridad:** alta (era la
pantalla donde se pierde la venta)

> Resultado real, con las dos diferencias respecto de lo planeado:
>
> 1. **El total aparece una sola vez, no dos.** El plan decía "una vez por viewport", pero
>    en móvil la tarjeta del resumen y la barra fija quedaban visibles a la vez y el total
>    se veía duplicado. Se quitó la fila de total de la barra: el importe ya viaja en la
>    etiqueta del botón (`Confirmar pedido • C$380.00`).
> 2. **La verificación es más simple de lo previsto.** `getByRole` de Playwright ignora lo
>    que está oculto por CSS, así que "un solo botón visible" se afirma directo con
>    `toHaveCount(1)`; no hizo falta contar visibles. El plan pedía un test de conteo.
>
> Los tests nuevos se verificaron mutando el código a propósito: con dos CTA visibles a la
> vez fallan los dos (escritorio y 375 px) con "Expected: 1, Received: 2".

> Cómo arrancar esta tarea en un chat nuevo: pegar el prompt de §9.
> Antes de codificar leer `AGENTS.md`, `ops/project-state.md` y este archivo completo.

## 1. Objetivo

Que el área de pago (carrito y checkout) diga **cada cosa una sola vez**: un encabezado, un
resumen del pedido, un total y **una sola llamada a la acción visible** por tamaño de
pantalla. Hoy el usuario lee el mismo título dos veces, ve el total tres veces y tiene dos
botones idénticos para el mismo pedido.

Pedido textual del owner: *"mejorar el checkout y las redundancias de texto y botones en esa
área"*.

**Criterio de aceptación verificable (esto es lo que cierra la tarea):**

1. En un navegador real, **en cada viewport se ve exactamente un botón "Confirmar pedido"**,
   un `h1` y un solo bloque de totales (hoy se ven dos botones y tres totales).
2. El botón de confirmar **nunca está deshabilitado**: si falta un dato, al tocarlo marca el
   campo, lo enfoca y muestra un único mensaje.
3. Carrito y checkout usan **el mismo componente de resumen** y **el mismo sustantivo** para
   el pedido, y cuentan los productos con la misma regla.
4. No queda ninguna hora de retiro escrita en el código: los turnos salen de la
   configuración del negocio.

## 2. Inventario medido (no es una impresión: está contado)

Renderizando `/checkout` con dos productos en el carrito (`renderToStaticMarkup`) y contando
las apariciones en el HTML resultante:

| Texto | Apariciones | Dónde |
|---|---|---|
| `Confirmá tu pedido` | **2** | `page.tsx:226` (dentro del panel) y `page.tsx:639` (encabezado de la página) |
| `Tu pedido` (encabezado de sección) | **2** | `page.tsx:292` y `page.tsx:684` |
| `Total a pagar` | **3** | `page.tsx:307`, `737` y `784` |
| `Confirmar pedido` (botón) | **3** | `page.tsx:312`, `762` y `789` |
| `Subtotal` | **2** | `page.tsx:305` y `715` |
| `Empaque` | **2** | `page.tsx:306` y `721` |
| `Listo para confirmar ✓` | **2** | `page.tsx:315` y `748` |
| badge `items` | **2** | `page.tsx:293` y `686` |

Traducido a lo que ve una persona:

- **Siempre hay dos botones idénticos en pantalla.** En escritorio: el del panel
  (`page.tsx:312`) y el del resumen (`762`); en móvil: el del panel y el de la barra fija
  (`789`). Nunca queda uno solo.
- **En móvil se ven tres "Total a pagar"**: panel + tarjeta de resumen + barra fija.
- **El bloque de resumen está duplicado entero**: el panel (`page.tsx:290-309`) y el aside
  (`page.tsx:680-740`) repiten encabezado, contador, líneas y totales.

Y la prueba de que esto ya molesta está en el propio arnés: `tests/e2e/public-order.spec.ts`
tiene que desambiguar con `.filter({ visible: true }).first()` en el título (línea 22) **y**
en el botón (línea 39) porque hay duplicados.

### 2.1 El resumen del panel además miente

El panel no recibe el pedido: recibe **solo el primer producto**
(`itemLine={items[0]?.productName ?? ""}`, `page.tsx:664`; y `itemMeta` igual en `665`). Con
tres productos distintos el bloque dice "Hamburguesa Clásica · 1x" mientras el badge de al
lado dice "4 items" y el total cobra los cuatro. Y `Empaque` en ese mismo bloque está fijo
en `formatCurrency(0, currency)` (`page.tsx:306`), o sea **afirma cero siempre**, incluso
cuando el resumen de al lado muestra el empaque real.

## 3. Defectos de UX encontrados en el mismo barrido

### 3.1 El botón está deshabilitado y disfrazado de habilitado

`page.tsx:672`, `765` y `792` deshabilitan el CTA mientras el formulario sea inválido — que
es **el estado inicial de la pantalla** (nombre y WhatsApp vacíos). Y la clase del botón
(`checkout-scale-helpers.ts:12`) anula la señal visual:

```
disabled:opacity-100 disabled:bg-brand/55 disabled:text-brand-foreground/80
```

`disabled:opacity-100` desactiva justamente la opacidad que avisa "esto no se puede tocar".
Resultado: un botón ámbar que parece normal, que no responde, con el texto "Falta completar
nombre." debajo — **repetido dos o tres veces** (`page.tsx:771` y `798`, más el recuadro rojo
de `754`). El usuario toca, no pasa nada, y tiene que adivinar cuál de los tres mensajes
iguales le habla.

### 3.2 Dos nombres y dos cuentas para lo mismo

| Dónde | Título | Contador |
|---|---|---|
| `/cart` | `Tu carrito` (`cart/page.tsx:35`) | `items.length` — **líneas** (`cart/page.tsx:15`) |
| Tarjeta del carrito | `Tu bolsa` (`cart-summary-card.tsx:28`) | — |
| `/checkout` | `Confirmá tu pedido` | `sum(quantity)` — **unidades** (`checkout/page.tsx:413`) |

Dos productos de 3 unidades cada uno: el carrito dice "2 productos" y el checkout "6 items".
El mismo pedido, dos números.

### 3.3 El aviso de pago, tres veces y con dos redacciones

- Carrito: dos filas de texto estático, `Entrega: Retirás en el local` y `Pago: Al retirar`
  (`cart-summary-card.tsx:44-55`).
- Checkout: `settings.paymentInstructions` — "Pagás en el local al retirar tu pedido. No se
  cobra nada online." (`checkout/page.tsx:742`).
- Y al lado: "Es opcional. Si no la marcás, no se cobra propina." (`checkout/page.tsx:707`).

Tres formas de decir lo mismo en la misma pantalla, y la única editable desde el admin es
una.

### 3.4 "Seguir viendo menú" es redundante con la barra de navegación

`cart-summary-card.tsx:73-79` ofrece un botón para ir al menú. La barra inferior
(`public-mobile-bottom-nav.tsx`) ya tiene "Menú" siempre visible en móvil, y el header tiene
"Menú" en escritorio. Es exactamente el razonamiento con el que el owner ya eliminó los
"accesos rápidos" de la home.

### 3.5 Código muerto que solo sigue vivo por sus tests

| Qué | Tamaño | Por qué está muerto |
|---|---|---|
| `CheckoutTablePanel` (`page.tsx:321-405`) | 85 líneas | `orderType` está fijo en `"pickup"` (`page.tsx:417`), así que la página nunca lo renderiza |
| `getGeoErrorMessage` (`page.tsx:43-61`) | 19 líneas | Geolocalización de delivery: no lo llama producción, solo su test |
| `checkoutSubtitle` (`page.tsx:435`) + condicional (`641-643`) | — | Es `""` literal |
| Rama `orderType !== "pickup"` (`page.tsx:630`) | — | Inalcanzable |
| Mensajes de error de delivery y mesa (`page.tsx:84-88`) | — | El MVP es solo retiro en el local |

`src/app/(public)/checkout/page.tsx` tiene **807 líneas** para una pantalla, con tres
componentes exportados de los que dos no se usan nunca.

## 4. Un hardcodeo que quedó de la tarea anterior (cae acá)

`TASK-whitelabel-branding.md` §2 ya había inventariado "opciones de hora de retiro
(`asap`/"19:30")" en el checkout, pero **no se arregló**: siguen escritas en el código.

```
src/app/(public)/checkout/page.tsx:179-182   ["19:30","20:00","20:30","21:00"]
src/app/(public)/checkout/page.tsx:257       option.value === "19:30"
src/app/(public)/checkout/page.tsx:430       pickupTime: "19:30"   (default del formulario)
src/app/(public)/checkout/page.tsx:668       value === "asap" ? "19:30" : value
```

La configuración ya tiene `businessHours` y `pickupLeadMinutes`, pero **no existe ningún
generador de turnos**: la lista es fija y la opción "Lo antes posible" en realidad manda las
19:30. Miente.

## 5. Propuesta de rediseño

Un principio: **un dato, un lugar; un viewport, una acción.**

1. **Un componente de resumen compartido** (`OrderSummaryCard`) usado por `/cart` y por
   `/checkout`: mismo encabezado, mismas filas, mismo total. El panel del formulario deja de
   repetir el pedido: solo pide los datos y dispara la acción.
2. **Un solo CTA visible por viewport**: en escritorio vive en la columna de resumen; en
   móvil, en la barra fija. Se elimina el botón de dentro del panel.
3. **Un solo encabezado**: `Confirmá tu pedido` una vez como `h1`; las secciones bajan a `h2`
   con nombres que no se repitan ("Tus datos" y "Tu pedido", sin repetir el título).
4. **El CTA nunca se deshabilita.** Al tocar con datos faltantes: valida, **enfoca el primer
   campo con problema** y muestra **un** mensaje junto al campo (no tres copias del mismo).
   `Procesando…` sigue deshabilitando, que es el único caso en que corresponde.
5. **El total aparece una vez por viewport**, y además dentro del botón (`Confirmar pedido •
   C$380.00`), que es el patrón correcto de acción con importe.
6. **Turnos de retiro generados desde la configuración**: una función pura en el dominio
   (`buildPickupSlots({ businessHours, pickupLeadMinutes, now })`) que devuelve los horarios
   reales de hoy, con "Lo antes posible" calculado como *ahora + `pickupLeadMinutes`*
   redondeado al siguiente múltiplo. Si el local está cerrado, se dice, no se ofrecen horas
   inventadas. El backend ya acepta cualquier fecha válida (`create-order.ts:113-116`), así
   que esto no rompe nada.
7. **Unificar el contador**: contar unidades en las dos pantallas (`sum(quantity)`), y
   llamarlo igual ("N productos").
8. **Unificar el sustantivo**: "Tu carrito" en todos lados; se elimina "Tu bolsa".
9. **El aviso de pago, una vez**, desde `settings.paymentInstructions`, dentro del resumen —
   y se quitan las filas estáticas "Entrega/Pago" del carrito.
10. **Borrar el código muerto** de §3.5 y los tests que solo lo cubrían, explicando en el
    commit que se borran porque el código que cubrían **no existe en el MVP** (no es "borrar
    tests para que pasen", que es lo que prohíbe `AGENTS.md`).

## 6. Fases (cada una con TDD, validación completa y su commit)

1. **Turnos de retiro en el dominio** (sin UI): función pura + tests de borde (local cerrado,
   antes de abrir, después de cerrar, `pickupLeadMinutes` 0). Riesgo bajo, no cambia nada
   visible.
2. **Resumen compartido y carrito**: extraer `OrderSummaryCard`, usarlo en `/cart`, unificar
   contador y sustantivo, sacar "Seguir viendo menú" y las filas estáticas.
3. **Checkout**: una sola copia del resumen, un solo CTA por viewport, CTA habilitado con
   validación al tocar y foco en el campo, y el título repetido eliminado.
4. **Limpieza**: borrar el código muerto de §3.5, bajar el tamaño de `page.tsx`, y simplificar
   los E2E quitando los `.filter({ visible: true }).first()` que ya no hacen falta.

## 7. Fuera de alcance (para que no se expanda solo)

- Validar en el **servidor** que la hora de retiro caiga dentro del horario del local. Es un
  hueco real (`create-order.ts` solo verifica que la fecha sea parseable), pero es una decisión
  aparte: **anotarlo en `ops/project-state.md`, no implementarlo acá**.
- Delivery, mesas y reservas: fuera del MVP, no se reactivan.
- Los colores y tipografías del checkout ya salen de la configuración; no se toca el sistema
  de diseño.
- El contenido de `paymentInstructions` lo elige el owner desde el admin: la tarea cambia
  **dónde** se muestra, no **qué** dice.

## 8. Riesgos y cuidados

- **El aviso de pago no puede desaparecer del checkout.** `TASK-whitelabel-branding` lo exige
  visible antes de confirmar y `tests/e2e/public-order.spec.ts:29` lo verifica. Si se mueve
  al resumen compartido, tiene que seguir renderizándose **en el checkout**.
- **La propina sigue siendo opt-in y desmarcada**, y la fila "Propina (N%)" solo aparece si
  está marcada (`public-order.spec.ts:32`).
- **Órdenes reales**: el E2E de creación de pedido corre solo con `E2E_ALLOW_MUTATIONS=true`.
- Los tests de contrato de clases (`checkout-scale-helpers.test.ts`, `cart/page.test.ts`)
  afirman textos y clases actuales: se actualizan explicando el cambio de contrato.
- Verificar a **375 px y 1280 px**: el bug es de CSS (`lg:hidden` vs `hidden lg:block`), así
  que un test de HTML estático no alcanza para probar "un solo botón visible".

## 9. Prompt para pegar en el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-checkout-ux.md`.
> La tarea a ejecutar es **TASK-checkout-ux**: eliminar las redundancias de texto y de
> botones del carrito y del checkout, y generar los turnos de retiro desde la configuración
> en vez de tenerlos escritos en el código. El inventario medido, el rediseño y las fases
> están en el brief.
> Trabajá con **TDD** (test que falla primero), en español, con commits propios y la
> validación mínima (`npm run test`, `lint`, `typecheck`, `build`, `security:secrets`) antes
> de cerrar cada fase. La verificación de "un solo botón visible" va en navegador real
> (Playwright) a 375 px y 1280 px, no en HTML estático.
> Al terminar cada fase: actualizá `ops/project-state.md` y cerrá con **rama + PR hacia `main` + los 4
> checks verdes + merge `--squash`** (nunca push directo a `main`), y confirmá que el CI quedó verde.
> **No despliegues a producción sin pedirme confirmación.**
