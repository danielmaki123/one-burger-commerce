---
# DESIGN_SYSTEM.md — el CATÁLOGO: tokens, componentes y "cuándo NO usar" cada uno.
# El ADN visual —los 10 patrones que deciden cómo se ve una pantalla— vive en
# `DESIGN_REFERENCES.md` (raíz) y GANA si hay conflicto con este archivo.
# Presupuesto de tamaño: 250 líneas, y lo mide `src/shared/contracts/ui-rules-contract.test.ts`.
# `configurable: true` = el valor lo elige el negocio en `/admin/settings` y se inyecta por request.
version: 2
updated: 2026-09-15
source_of_truth: DESIGN_REFERENCES.md
tokens_file: src/app/globals.css
inventory: ops/tasks/TASK-201-ui-inventory.md
registry: src/shared/ui/registry.json
max_lines: 250
---

# Design system — One Burger Commerce

> **Qué es.** El catálogo: qué tokens existen, qué componentes hay y **cuándo NO** usar cada uno.
> Deriva del [ADN visual](DESIGN_REFERENCES.md) y no lo contradice: lo aterriza.
> **Dónde vive.** En la raíz, versionado, al lado de `AGENTS.md`. **No** va en `docs/` (ignorada).
> **De dónde salen los datos.** Medidos en `ops/tasks/TASK-201-ui-inventory.md`, read-only. Acá nada
> es inventado: lo que no existe dice **NO EXISTE**, y lo que cambia se mide antes de escribirlo.

## 0. Los 10 patrones del ADN, en operativo

| # | Patrón | La regla dura |
|---|---|---|
| 1 | Números protagonistas | El dato principal **56 px Fraunces 700** (`text-display`); los secundarios **32 px** (`text-kpi`). Nada más grande que el hero |
| 2 | Cards con personalidad | **Máximo 2 tipos de card** por pantalla; nunca todas blancas |
| 3 | Íconos con fondo | Todo ícono lleva fondo de color **soft, 48×48, radio 12** |
| 4 | Color con significado | `-soft` de fondo y `-strong` de texto, por estado; el color comunica, no decora |
| 5 | Jerarquía de 5 niveles | Una pantalla usa **los cinco**: Hero, KPI, Título, Body, Label. Sin pasos intermedios |
| 6 | Badges de tendencia y estado | Todo dato principal lleva badge de comparación o estado, con ícono si es tendencia |
| 7 | Visualización | Serie → sparkline · proporción → donut · comparación → barras. **Sin datos, estado vacío** |
| 8 | Spacing generoso | **32 px** entre secciones · **24 px** dentro de cards · 12-16 px entre items |
| 9 | Radius consistente | Cards 16-20 · íconos 12 · badges pill · inputs 12. Nunca `rounded-[Npx]` |
| 10 | Dark mode siempre | Todo se ve en light **y** dark (`class="dark"` en `<html>`); si no, **no está terminado** |

## 1. Tokens

**1.1 Los 8 tokens semánticos del ADN** (§4 de `DESIGN_REFERENCES.md`): el par `-soft` es el fondo y `-strong` el texto/dato; existen en `:root`, en `.dark` y como utilidad (`bg-success-soft`):

| Fondo | Texto/dato | Significado | Light | Dark |
|---|---|---|---|---|
| `bg-success-soft` | `text-success-strong` | éxito, métrica positiva | `#e8f3ea` | `#12351f` |
| `bg-warning-soft` | `text-warning-strong` | atención moderada | `#f7ecd6` | `#2a1f0e` |
| `bg-danger-soft` | `text-danger-strong` | urgencia, problema | `#f7e4dc` | `#2a1612` |
| `bg-info-soft` | `text-info-strong` | información neutral | `#eaf1f6` | `#15232e` |

**1.2 Alias viejos (no sumar usos nuevos).** `--success`, `--warning`, `--danger` y sus `-foreground`
siguen vivos porque ~220 clases del código los usan: el fondo es el mismo color y el `-foreground`
apunta al `-strong` nuevo (así el modo oscuro arregla todos esos usos de una). Se eliminan cuando las
oleadas de la Capa 1.6-1.8 pasen cada pantalla a los nombres del ADN.

**1.3 Configurables por el negocio** (los inyecta el layout en cada request; no son valores fijos): `--brand`, `--accent`, `--background`, `--foreground`, `--card`, `--font-heading`, `--font-body`. Su valor efectivo sale de `/admin/settings`; los del CSS son el respaldo.

**1.4 Cuándo usar qué color:**

| Necesidad | Token / utilidad |
|---|---|
| Acción principal | `bg-brand text-brand-foreground hover:bg-brand-strong` |
| Lienzo de pantalla | `bg-background text-foreground` |
| Tarjeta o panel | `bg-card border border-border` |
| Texto de apoyo | `text-muted-foreground` |
| Éxito / aviso / error | `bg-success|warning|danger-soft` + `text-…-strong` |
| Estado de un pedido | `--status-*`, vía `AdminStatusSolid` (no clases sueltas) |
| Semáforo de retiro | `--pickup-*`, vía `AdminPickupTimingChip` |
| Series de gráfico | `--chart-1..5` |

**Prohibido** la paleta cruda de Tailwind (`red-*`, `stone-*`, `amber-*`, `emerald-*`, `sky-*`, `text-white`) donde hay token semántico: hoy son **36** apariciones en **12 archivos**.

**1.5 Tipografía — los 5 niveles** (`font-heading` es la clase; nunca `style={{ fontFamily }}`):

| Nivel | Utilidad | Tamaño | Familia | Uso |
|---|---|---|---|---|
| Hero | `text-display` | 56 px | Fraunces 700 | El dato principal de la pantalla |
| KPI | `text-kpi` | 32 px | Fraunces 700 | Los datos secundarios |
| Título | `text-headline` | 20 px | Inter 600 | Título de sección |
| Body | `text-body` | 14 px | Inter 400 | Texto normal |
| Label | `text-label` | 11 px | Inter 600 | Etiqueta uppercase, tracking 0.08 em |

`text-caption` (12 px) es el único paso fuera del ADN (metadatos); los números que cambian llevan `tabular-nums`. `text-display-lg` es el alias de escritorio del mismo Hero (lo usa la home pública) y **`text-kpi` todavía no tiene consumidor**: las pantallas que deben usarlo siguen en `text-3xl` (lo migra la Capa 1.6).

**1.6 Radios, sombras y espaciado.** `rounded-card` (16) y `rounded-panel` (24) son los únicos radios de contenedor; los controles usan el radio de su primitivo. La sombra es `shadow-card`; `shadow-raised` y `shadow-float` existen y **no se usan**. El espaciado usa la escala de Tailwind (no hay `--spacing-*`): 32 px entre secciones, 24 px dentro de cards.

**1.7 Los 16 tokens muertos: prohibidos.** `--primary`, `--popover`, `--destructive`, `--ring` y la familia `--sidebar-*` los eliminó C1-3 porque nadie los consumía; un token sin consumidor se borra del CSS en vez de quedar como superficie muerta, y un contrato lo verifica.

## 2. Las 20 reglas nuevas (C0-2b) — aprendidas en la sesión de Impeccable sobre `/admin/Inicio`

Salieron de medir el mockup, no de una opinión: cada una trae el defecto real que la originó. **Rigen para toda pantalla nueva**, no para el mockup.

| # | Grupo | Qué | Por qué | Cómo verificar |
|---|---|---|---|---|
| R1 | Producto | **"Tarde"** = pasó la **hora prometida de retiro** (`pickupTime`). No cuenta desde `createdAt` | `TURNO_LATE_MINUTES` (20 min desde la creación) y la pantalla medían cosas distintas: dos definiciones de "tarde" en el mismo producto | Una sola definición en el dominio del pedido; el umbral por local sale de la configuración y la UI solo pinta lo que el dominio dice |
| R2 | Producto | **"Cobrado hoy"** = plata cobrada (`Payment` / arqueo del turno). **Nunca** `completedOrderValue` | El rótulo prometía cobros y el número sumaba órdenes completadas: el owner decidía con un dato que no era el que decía ser | El KPI y su leyenda salen del mismo total cobrado; su etiqueta explica qué incluye |
| R3 | Producto | Si el backend **no tiene el dato**, el copy no miente: se usa el nombre real ("Pedidos completados") y el pendiente se anota | Un número con el nombre equivocado es peor que no tenerlo: se decide sobre una ficción | El texto de la pantalla describe exactamente el cálculo que hace la consulta; la diferencia queda escrita como pendiente |
| R4 | A11y | `role="alert"` en los errores que aparecen solos | Un error que solo cambia de color no lo anuncia el lector de pantalla | Inspeccionar el estado de error: el mensaje tiene `role="alert"` (o `aria-live`) y no depende del color |
| R5 | A11y | `:focus-visible` **propio** en todos los interactivos, ≥3:1 | El anillo heredado daba **1.00:1** sobre un botón del mismo color que el anillo: foco invisible | Tabular por la pantalla: cada control tiene anillo propio, con halo del color del lienzo (`outline: 2px solid var(--brand-strong)` + `box-shadow: 0 0 0 4px var(--background)`), medido ≥3:1 |
| R6 | A11y | Barras de progreso con `role="progressbar"`, `aria-valuenow`/`min`/`max` | Una barra es un dato: sin los atributos, el lector de pantalla lee un rectángulo | Buscar cada barra en el DOM y comprobar los tres atributos |
| R7 | A11y | Headings sin saltos (`h1` → `h2` → `h3`) y **un solo `h1`** | Un salto de nivel rompe la navegación por encabezados, que es la forma de recorrer una pantalla larga | Un `h1` por página y ningún nivel salteado (hoy hay dos `h1` en `/admin/orders`) |
| R8 | A11y | Contraste de texto **≥4.99:1**, no solo 4.5:1 | El mínimo medido del sistema es 4.99:1: bajar a 4.5 deja el par aprobado a un redondeo de fallar | Medir los pares **compuestos** (lo que se ve, no lo declarado) y exigir 4.99 en light y dark |
| R9 | A11y | Controles de **≥44 px** de alto | Es la interfaz del salón, con tablet y a veces con guantes | Medir el rectángulo real de cada control, en 375 y en 1280 |
| R10 | A11y | **Sin scroll horizontal** entre 320 px y 1280 px | 320 px es el piso real de un teléfono chico y una palabra de 74 caracteres rompía la grilla | `documentElement.scrollWidth <= clientWidth` en cada ancho; probar con texto largo, no con datos cómodos |
| R11 | A11y | Menús operables con teclado: flechas, Home/End, `Escape` devuelve el foco | Un menú que solo responde al mouse deja la pantalla a medias para quien no usa mouse | Recorrer el menú con Tab y flechas: foco visible en cada opción, `Escape` cierra y devuelve el foco al disparador |
| R12 | A11y | Borde de los controles **3:1** en hover y focus (WCAG 1.4.11) | Hoy los bordes están en **1.23:1** (light) y 1.24-1.39:1 (dark): el control no se distingue del fondo | **Pendiente del owner**: `--border` es un token del ADN y subirlo cambia el tono de todo el producto, así que se reporta y no se cambia sin aprobación |
| R13 | A11y | `aria-live` solo en los valores que **cambian** solos | Anunciar todo deja al lector de pantalla hablando sin parar; no anunciar nada lo deja perdido | Identificar los datos que se refrescan (totales, contadores) y darles `aria-live="polite"`; el resto, no |
| R14 | A11y | Nombre accesible **con contexto** | "Ver", "Abrir", "Aceptar" repetidos no dicen nada fuera de su fila | Cada control con acción repetida incluye su objeto (`aria-label`/texto: "Ver comanda del pedido 0042") |
| R15 | A11y | Respetar `prefers-reduced-motion` | Hay gente a la que el movimiento le da náuseas, y la animación no aporta el dato | Emular la preferencia y comprobar que no queda ninguna animación corriendo |
| R16 | Estados | **5 estados obligatorios**: con datos, cargando, vacío, error y **"nada pendiente"** | El estado de calma (un turno sin nada en la cola) es el más frecuente de un día sano; sin él, un día tranquilo se ve como una pantalla rota | Recorrer los cinco en la misma pantalla: cada uno tiene su copy y su acción, y ninguno es un `null` que no pinta nada |
| R17 | Estados | El esqueleto de carga tiene la **estructura real** del contenido | Un esqueleto de una sola línea sobre un contenido de tres bloques salta al cargar | Comparar el esqueleto contra el estado con datos: mismos bloques y misma altura |
| R18 | Estados | Tooltips, menús y overlays **no desbordan** el viewport | En 375 px el tooltip del KPI se salía de la pantalla, justo donde el número está en el borde | Abrir cada overlay con la ventana en 320-375 px y comprobar que su rectángulo entra entero |
| R19 | Performance | Las fuentes de marca cargan **sin bloquear el primer paint** (`font-display: swap`) | Con la fuente bloqueando, la pantalla quedaba **en blanco** hasta que bajara el archivo | Medir el primer texto pintado sin la fuente disponible: se ve el texto de respaldo, no un vacío |
| R20 | Performance | **Sin `@import` de fuentes** que bloquee el render | El `@import` remoto era la causa de la pantalla en blanco sin red: la app no arrancaba offline | La página pinta completa con la red apagada y sin esperar a un tercero |

## 3. Catálogo de componentes

`src/shared/ui/registry.json` es el **espejo declarado** de esta sección (mismo inventario, con `file`,
`variants`, `sizes`, `use_when` y `dont_use_when`), y un contrato exige que los dos digan lo mismo.

### 3.1 `src/shared/ui/` — usar siempre que exista

| Componente | Cuándo SÍ | Cuándo **NO** |
|---|---|---|
| `Button` (`button.tsx`) | Toda acción con texto o ícono. `variant`: primary, secondary, outline, ghost, danger · `size`: sm, md, lg, icon, pill | Nunca `<button>` a mano. Excepciones: overlay de cierre, `role="switch"` y la fila de lista multilínea (no tiene primitivo) |
| `Input` (`input.tsx`) | Campo de texto con `label` y `error` asociados | No sirve para `type="color"` ni `type="date"`: **NO EXISTEN** primitivos |
| `Select` (`select.tsx`) | Elección entre 4+ opciones, con `label`, `error` y `options` | No para 2-3 opciones visibles (eso es `RadioGroup`) ni para fecha o color |
| `Checkbox` (`checkbox.tsx`) | Booleano que se guarda al enviar | Nunca `<input type="checkbox">` a mano |
| `RadioGroup` + `RadioGroupItem` (`radio-group.tsx`) | Elección exclusiva entre 2-3 opciones visibles | No para 4+ opciones: ahí va `Select` |
| `Toggle` (`toggle.tsx`) **C1-1** | Interruptor `role="switch"` que guarda al tocarlo (con `saving`) | No para elegir entre dos opciones de formulario (`RadioGroup`) ni para un booleano que se envía (`Checkbox`) |
| `Textarea` (`textarea.tsx`) **C1-1** | Texto de varias líneas, con `label`, `error` y `description` | No para una línea: eso es `Input` |
| `WhatsAppInput` (`whatsapp-input.tsx`) | Teléfono del cliente, con prefijo | No para teléfonos internos del negocio |
| `Modal` (`modal.tsx`) **C1-1** | Diálogos y confirmaciones: `<dialog>` nativo, foco atrapado, `Escape`, título obligatorio | No para un formulario largo (`AdminEditSheet`) ni para avisos sin decisión (`Toast`) |
| `Card` + subcomponentes (`card.tsx`) | Contenedor con borde y sombra | No para filas de lista compactas |
| `Badge` (`badge.tsx`) | Etiqueta corta de estado o categoría | No para el estado de un pedido del panel: eso es `AdminStatusSolid` |
| `BrandMark` (`brand-mark.tsx`) | Logo del negocio o sus iniciales, de la configuración | No para íconos de acción |
| `Skeleton` + `SkeletonAnnouncement` (`skeleton.tsx`) **C1-1** | Carga de una pantalla con datos: huesos con la estructura real | No para "no hay datos" (`AdminEmptyState`) ni para esperas de una acción (el `saving` del botón) |
| `Toast` (`toast.tsx`) **C1-1** | Resultado de una acción que acaba de hacer el usuario | No para errores de validación de un campo ni para información permanente |
| `HelpText` (`help-text.tsx`) **C1-1** | Aclaración bajo un campo, referenciada por `aria-describedby` | No para mensajes de error ni para copy decorativo |
| `StatusProgress` (`status-progress.tsx`) | Progreso de un pedido en el historial del cliente | No en el panel: ahí el estado es `AdminStatusSolid` |
| `Tabs` + `TabsList` + `TabsTrigger` (`tabs.tsx`) | Pestañas del panel | **`TabsContent` no se usa y es huérfano: no introducirlo** |
| `PublicLocationsList` (`public-locations-list.tsx`) | Lista de sucursales del público | — |
| `PublicMobileBottomNav` (`public-mobile-bottom-nav.tsx`) | Navegación inferior móvil del público | No en el admin ni en las rutas de túnel de conversión |
| `PublicConfirmationShell` (`public-confirmation-shell.tsx`) | **NO USAR: es huérfano** (nadie lo importa) y tiene el literal `OB` hardcodeado | — |

### 3.2 `(admin)/admin/_components/` — panel

| Componente | Cuándo SÍ | Cuándo **NO** |
|---|---|---|
| `AdminShell` (`admin-shell.tsx`) | Layout del panel (lo usa el layout) | No desde una página |
| `AdminMobileNav` (`admin-mobile-nav.tsx`) | Navegación móvil del panel (la usa el shell) | No desde una página |
| `AdminSessionControls` (`admin-session-controls.tsx`) | Bloque de sesión (lo usa el shell) | No desde una página |
| `AdminPageHeader` (`admin-operational-ui.tsx`) | **Toda** cabecera de pantalla del panel | No para encabezados internos de una card |
| `AdminEmptyState` (`admin-operational-ui.tsx`) | **Todo** estado vacío del panel | No para "cargando" (eso es `Skeleton`) |
| `AdminCompactToolbar` (`admin-operational-ui.tsx`) | Fila de filtros compactos | No para contenido: solo herramientas |
| `AdminStatusSolid` (`admin-operational-ui.tsx`) | Estado de un pedido o reserva | No para estados genéricos: eso es `Badge` |
| `AdminPickupTimingChip` (`admin-operational-ui.tsx`) | Semáforo del retiro prometido | No si el pedido no es de retiro |
| `AdminEditSheet` (`admin-edit-sheet.tsx`) | Edición en hoja (mobile) o diálogo (desktop) | No para confirmaciones simples: eso es `Modal` |
| `AdminOverviewTrendChart` (`admin-overview-trend-chart.tsx`) | Gráfico de tendencia del resumen | No en pantallas sin serie de tiempo |
| `AdminOverviewClient` (`admin-overview-client.tsx`) | Pantalla de resumen (la usa la página) | No reusarlo como widget |
| `AdminStatusDonut` (`admin-status-donut.tsx`), `AdminMetricStrip` y `AdminStatusPill` (`admin-operational-ui.tsx`) | **NO USAR: huérfanos** (usar `AdminStatusSolid` o `Badge`) | — |

### 3.3 `_components/` del público

| Componente | Cuándo SÍ |
|---|---|
| `OrderSummaryCard` (`order-summary-card.tsx`) | **El** resumen de pedido: lo comparten `/cart` y `/checkout` |
| `CartLineCard` (`cart-line-card.tsx`) | Fila de producto del carrito |
| `EmptyCartState` (`empty-cart-state.tsx`) | Carrito vacío |
| `OrderTrackingSessionProvider` + `useOrderTrackingSession` (`order-tracking-session.tsx`) | Sesión de seguimiento del pedido en el público |

### 3.4 Lo que **NO EXISTE** (y por eso no se inventa)

| Falta | Qué hacer mientras tanto |
|---|---|
| Selector de fecha y de color | `<input type="date">` / `type="color"` crudo, con `label` y `min-h-11` |
| Carga pública (spinner/skeleton) | `Skeleton` existe y todavía no se usa en el público: migrar, no copiar el literal de `rounded-2xl` |
| Cabecera pública y estado vacío público | Reusar `AdminPageHeader` como referencia de estructura y el patrón de `AdminEmptyState` |
| Barra fija de CTA del público | 5 implementaciones con offsets y `z-index` distintos: reusar `publicCheckoutScaleClasses` |
| Grilla de conteo de billetes (arqueo por denominación) | Una fila por billete con `Input` numérico y el total calculado por el dominio (`cashCountsTotal`) |

> Si necesitás un primitivo que no está, **se documenta acá** en vez de crear el 6.º `className`.

## 4. Cinco composiciones reales (`ruta:línea`)

Copy y estructura salen de acá. Las cinco que pide C0-4, con lo que hoy existe de verdad:

**1. Card de KPI** — `src/app/(admin)/admin/_components/admin-overview-client.tsx:316-331`: `section`
con `aria-label`, label de 11 px uppercase, el número en `text-3xl font-bold tabular-nums` y el delta
"vs. ayer" al lado. **Desviación anotada:** usa `text-3xl` (Inter) y no `text-kpi` (32 px Fraunces);
migrarlo es de la Capa 1.6, no de una pantalla suelta.

**2. Card de alerta** — `src/app/(admin)/admin/inventory/alerts/page.tsx:76-81`: una card por
severidad, con `border-danger-strong/30 bg-danger` cuando es crítica, `bg-warning` cuando hay avisos y
`bg-muted` cuando no hay nada. Es el patrón correcto de "color con significado" (Patrón 4).

**3. Formulario con error** — `src/app/(admin)/admin/locations/page.tsx:447-453`:
`<Input label="Nombre" value={form.name} error={fieldErrors.name} … />`. El `error` lo pinta el
primitivo con su `aria-describedby`; la pantalla no escribe el mensaje de error a mano.

**4. Lista con estado vacío (y los otros cuatro estados)** — `src/app/(admin)/admin/promotions/page.tsx:308-321`:
`loading` → card con "Cargando promos…", `loadError` → `AdminEmptyState`, lista vacía → `AdminEmptyState`
con CTA. Es el ejemplo de R16 en el código que ya está en producción.

**5. Modal de confirmación** — **NO EXISTE todavía**. El primitivo `Modal` está (`modal.tsx`, con
`<dialog>` nativo, foco y `Escape`) y es `pending-migration`: **0 consumidores** en `src/app`. Lo que
hoy hace esa función son **4 `window.confirm`** (`locations/page.tsx:218`,
`menu/products/[id]/page.tsx:191`, `promotions/page.tsx:219`, `users/users-client.tsx:280`), que es
exactamente lo que el `Modal` viene a reemplazar en la Capa 1.6.

## 5. Do NOT

| Prohibición | Por qué |
|---|---|
| **NO** `<button>`, `<input>`, `<select>`, `<textarea>` crudos si el primitivo existe | Hoy quedan 97 controles crudos en 34 archivos: es el defecto que más se repite |
| **NO** `#hex`, `rgba()` ni paleta cruda donde hay token | 36 usos de paleta cruda en 12 archivos; `Button.danger` sigue en `red-600` |
| **NO** `style={{ fontFamily }}` | Existe la utilidad `font-heading`: 29 usos inline en 15 archivos |
| **NO** `rounded-[Npx]`, `text-[Npx]`, `shadow-[…]` | 37 radios, 97 tamaños y 26 sombras arbitrarias; existen los tokens |
| **NO** volver a declarar los 16 tokens muertos | §1.7: se eliminaron en C1-3 y un contrato los rechaza |
| **NO** `font-mono` | No existe el token: para cifras alineadas se usa `tabular-nums` |
| **NO** hardcodear datos del negocio (nombre, iniciales, colores, contacto, precios) | `anti-hardcode-contract.test.ts`; el caso vivo es el `OB` de `public-confirmation-shell.tsx` |
| **NO** clases sueltas para estados de pedido o de retiro | Usar `AdminStatusSolid` / `AdminPickupTimingChip` |
| **NO** registrar un componente nuevo sin su fila acá y en `registry.json` | §3 es el catálogo: un componente sin fila es una fuga |
| **NO** dos `<h1>` en la misma página | `admin/orders/page.tsx` tiene dos: uno propio y el de `AdminPageHeader` |
| **NO** declarar un token sin su valor en los dos modos | Patrón 10: `dark-mode-contract.test.ts` lo mide |
| **NO** **texto decorativo**: "Bienvenido", "Descubrí lo mejor de…", subtítulos que repiten el título, o cualquier frase que no cambie una decisión del usuario | Copy que no cambia nada ocupa el lugar del dato. Las excepciones son las que sí informan (una leyenda que aclara qué incluye un KPI) |
| **NO** controles decorativos ni botones que no hacen nada | Cada control se implementa con su estado y su test, o se elimina con el motivo escrito |

## 6. Cómo se hace cumplir

| Regla | Guardrail |
|---|---|
| Las 20 reglas de §2, el tamaño de este archivo y el de `AGENTS.md`, y las reglas de "Tarde" y "Cobrado" escritas | `src/shared/contracts/ui-rules-contract.test.ts` |
| Los 8 tokens del ADN en `:root` y `.dark`, los 16 muertos fuera y el contraste ≥4.5:1 | `src/shared/contracts/dark-mode-contract.test.ts` |
| El registro y el catálogo dicen lo mismo (rutas, exports, variantes y tamaños reales) | `src/shared/contracts/registry-contract.test.ts` |
| HTML crudo, `#hex` y todo componente de `_components/` registrado | `src/shared/contracts/ui-contract.test.ts` |
| Paleta cruda, `fontFamily` inline, radios/tamaños/sombras arbitrarios, `window.confirm` y `role` a mano, con **techo por archivo que solo baja** | `src/shared/contracts/design-guardrails-contract.test.ts` + `src/shared/config/design-tokens.allow.json` |
| `AGENTS.md` sin rutas rotas y frescura de este archivo contra `schema.prisma` y `src/shared/ui/` | `src/shared/contracts/docs-sync-contract.test.ts` |
| Sin literales del negocio; contraste de todos los presets de color | `anti-hardcode-contract.test.ts`, `color-contrast.test.ts` |
| La suma del total y las transiciones de estado, en un solo lugar | `order-totals-contract.test.ts`, `order-workflows.ts` |
| Todo lo anterior corre como job propio y bloquea `publish` | job `contracts` de `.github/workflows/publish-ghcr.yml` |

## 7. Documentos obsoletos: eliminados (C0-5)

`design/DESIGN.md`, `design/DESIGN_SYSTEM.md` y `docs/ui/admin-design-system.md` describían el sistema
visual **antes** de este archivo y afirmaban cosas que el código ya no cumple (una rama `origin/staging`
inexistente, `shadcn/ui` en el stack cuando no está instalado, "QR ordering" fuera del MVP). Los tres
vivían en carpetas enteras en `.gitignore`, así que **se borraron del disco y no dejan commit**: no
había nada versionado que eliminar. Este archivo toma su rol, y un contrato falla si alguno reaparece.

> **Los 3 documentos del mock** (`stitch_full_pwa_builder/…`) son material de diseño, no del producto.
