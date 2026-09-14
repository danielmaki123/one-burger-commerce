---
# TASK-202 — Design system de One Burger Commerce.
#
# Fuente única para agentes y humanos. Deriva de `AGENTS.md` (que manda) y del inventario
# medido en `ops/tasks/TASK-201-ui-inventory.md`.
#
# `configurable: true` = el valor lo elige el negocio en `/admin/settings` y se inyecta por
# request; NO lo trates como valor fijo. El resto son del sistema.
version: 1
updated: 2026-09-14
source_of_truth: AGENTS.md
tokens_file: src/app/globals.css
inventory: ops/tasks/TASK-201-ui-inventory.md

principles:
  mobile_first: "La UI se verifica a 375 px. Los controles táctiles llevan min-h-11 (44 px)."
  whitelabel: "Nada del negocio hardcodeado: nombre, colores, tipografías, contacto, horarios, precios y propina salen de BusinessSettings."
  tokens_only: "Ningún #hex suelto en el código: solo tokens de globals.css."
  components_first: "Si el componente existe en src/shared/ui/, se usa; no se escribe HTML crudo equivalente."
  dense_operational: "En el panel, la cabecera y los filtros no deben comerse la pantalla: el flujo principal manda."
  no_leaks: "Un componente nuevo en _components/ se registra en este archivo antes de usarlo."

tokens:
  # --- Configurables por el negocio (se inyectan en <html> en cada request) ---
  configurable:
    - { name: "--brand",             default: "#2b6c96", role: "color de marca / CTA primario", source: "business-settings-style.ts:28" }
    - { name: "--accent",            default: "#eaf1f6", role: "tinte claro de apoyo",        source: "business-settings-style.ts:29" }
    - { name: "--background",        default: "#fbf9f5", role: "lienzo",                        source: "business-settings-style.ts:30" }
    - { name: "--foreground",        default: "#23303a", role: "texto principal",              source: "business-settings-style.ts:31" }
    - { name: "--card",              default: "#ffffff", role: "superficie de tarjeta",        source: "business-settings-style.ts:32" }
    - { name: "--font-heading",      default: "fraunces", role: "tipografía de títulos",       source: "business-settings-style.ts:34" }
    - { name: "--font-body",         default: "inter",    role: "tipografía de texto",        source: "business-settings-style.ts:35" }

  # --- Del sistema (no configurables) ---
  surface:
    - { name: "--card-foreground",   value: "var(--foreground)",  role: "texto sobre tarjeta" }
    - { name: "--secondary",         value: "#f1ece2",            role: "superficie secundaria" }
    - { name: "--secondary-foreground", value: "var(--brand-strong)", role: "texto sobre secundaria" }
    - { name: "--muted",             value: "#eef0f2",            role: "fondo apagado" }
    - { name: "--muted-foreground",  value: "#5b6670",            role: "texto secundario (≥4.5:1)" }
    - { name: "--border",            value: "#e4e2dc",            role: "borde por defecto" }
    - { name: "--input",             value: "var(--border)",      role: "borde de campo" }
    - { name: "--ring",              value: "var(--brand)",       role: "anillo de foco" }
  brand_derived:
    - { name: "--brand-strong",      value: "color-mix(in srgb, var(--brand) 84%, black)", role: "hover del primario" }
    - { name: "--brand-foreground",  value: "#f7fafc",            role: "texto sobre el primario", note: "un test de contrato lo compara con BRAND_FOREGROUND_COLOR" }
  accent_limited:
    - { name: "--terracotta",        value: "#b85f3a",  role: "promos / especiales (uso limitado)" }
    - { name: "--gold",              value: "#c8a96a",  role: "highlight poco frecuente" }
    - { name: "--cream",             value: "#f2ece0",  role: "superficie cálida secundaria" }
    - { name: "--coal",              value: "#16212a",  role: "overlay oscuro / texto más oscuro" }
    - { name: "--ink-green",         value: "#12351f",  role: "solo el wordmark de marca" }
  semantic:
    - { name: "--success",           value: "#e8f3ea", role: "éxito / fondo" }
    - { name: "--success-foreground", value: "#1f5c3f", role: "éxito / texto" }
    - { name: "--success-strong",    value: "var(--chart-4)", role: "éxito / borde" }
    - { name: "--warning",           value: "#f7ecd6", role: "aviso / fondo" }
    - { name: "--warning-foreground", value: "#7a5518", role: "aviso / texto" }
    - { name: "--warning-strong",    value: "var(--gold)", role: "aviso / borde" }
    - { name: "--danger",            value: "#f7e4dc", role: "error / fondo" }
    - { name: "--danger-foreground", value: "#8a3220", role: "error / texto" }
    - { name: "--danger-strong",     value: "#b8422b", role: "error / borde" }
  order_status:
    - { name: "--status-nueva",      value: "var(--brand)", role: "pedido nuevo" }
    - { name: "--status-preparando", value: "#b5701c",      role: "en cocina" }
    - { name: "--status-lista",      value: "#1f7a4d",      role: "listo" }
    - { name: "--status-cerrada",    value: "var(--muted-foreground)", role: "cerrado" }
    - { name: "--status-alerta",     value: "#b23c2a",      role: "requiere atención" }
  pickup_timing:
    - { name: "--pickup-on-time",    value: "#1f7a4d", role: "todavía no es la hora" }
    - { name: "--pickup-past",       value: "#b5701c", role: "pasó la hora, con margen" }
    - { name: "--pickup-late",       value: "#b23c2a", role: "muy tardado" }
  charts:
    - { name: "--chart-1", value: "var(--brand)",     role: "serie 1" }
    - { name: "--chart-2", value: "var(--terracotta)", role: "serie 2" }
    - { name: "--chart-3", value: "var(--gold)",      role: "serie 3" }
    - { name: "--chart-4", value: "#4f8a68",          role: "serie 4" }
    - { name: "--chart-5", value: "#7f95a3",          role: "serie 5" }

  # NO USAR: están declarados pero ningún archivo los consume (26 % de los tokens).
  # Ver `ops/tasks/TASK-201-ui-inventory.md` §1.2. Son sobrante de un scaffold tipo shadcn.
  orphan_forbidden:
    - --primary
    - --primary-foreground
    - --popover
    - --popover-foreground
    - --accent-foreground
    - --destructive
    - --ink-green-foreground
    - --sidebar
    - --sidebar-foreground
    - --sidebar-primary
    - --sidebar-primary-foreground
    - --sidebar-accent
    - --sidebar-accent-foreground
    - --sidebar-border
    - --sidebar-ring

radii:
  - { token: "--radius",       value: "0.625rem", utility: "base de la cadena" }
  - { token: "--radius-card",  value: "1rem",      utility: "rounded-card",  use: "tarjetas del público" }
  - { token: "--radius-panel", value: "1.5rem",    utility: "rounded-panel", use: "paneles destacados" }

shadows:
  - { token: "--shadow-card",   utility: "shadow-card",   use: "tarjeta en reposo" }
  - { token: "--shadow-raised", utility: "shadow-raised", use: "tarjeta elevada — hoy SIN USO" }
  - { token: "--shadow-float",  utility: "shadow-float",  use: "elemento flotante — hoy SIN USO" }

typography:
  families: ["fraunces (serif)", "inter (sans)", "jakarta (sans)"]
  configurable_note: "headingFont y bodyFont los elige el negocio; el default es fraunces + inter."
  scale:
    - { utility: "text-display",     size: "1.875rem", weight: 800, use: "hero del público" }
    - { utility: "text-headline",    size: "1.375rem", weight: 700, use: "título de sección" }
    - { utility: "text-headline-md", size: "1.25rem",  weight: 700, use: "subtítulo" }
    - { utility: "text-title",       size: "1.0625rem", weight: 700, use: "título de tarjeta / dato mono" }
    - { utility: "text-title-sm",    size: "0.9375rem", weight: 600 }
    - { utility: "text-body-sm",     size: "0.875rem", weight: 400, use: "texto de apoyo" }
    - { utility: "text-caption",     size: "0.75rem",  weight: 400, use: "metadato" }
    - { utility: "text-label",       size: "0.875rem", weight: 700, use: "label de control" }
    - { utility: "text-label-sm",    size: "0.75rem",  weight: 600 }
    - { utility: "text-label-xs",    size: "0.75rem",  weight: 700, use: "píldora / overline" }
  unused_forbidden: ["text-display-lg", "text-headline-lg", "text-body"]
  numbers: "Cronómetros, contadores y códigos de pedido usan tabular-nums para que no salten."
---

# Design system — One Burger Commerce

> **Qué es este archivo.** La fuente única del sistema visual y de los componentes, para que un
> agente no invente UI. **`AGENTS.md` manda sobre este archivo**; si hay conflicto, gana `AGENTS.md`
> y este archivo se corrige.
>
> **De dónde salen los datos.** Los tokens y los componentes están **medidos** en
> `ops/tasks/TASK-201-ui-inventory.md` (inventario read-only con evidencia `ruta:línea`). Nada de
> acá es inventado: si algo no existe, dice `NO EXISTE`.
>
> **Ubicación.** Este archivo vive en la raíz y **se versiona**, al lado de `AGENTS.md`. No va en
> `docs/`: esa carpeta está entera en `.gitignore` y `AGENTS.md` la declara material heredado de
> otro proyecto.

---

## 1. Principios

1. **Mobile-first y táctil.** Se verifica a 375 px. Todo control táctil lleva `min-h-11` (44 px).
2. **Multi-negocio (whitelabel).** Nada del negocio hardcodeado. El nombre, los colores, las
   tipografías, el contacto, los horarios, los precios y la propina salen de `BusinessSettings` y se
   inyectan por request (`src/app/layout.tsx:137`). El test que lo hace cumplir es
   `src/modules/business-settings/anti-hardcode-contract.test.ts`.
3. **Solo tokens.** Ningún `#hex` suelto en el código: `src/app/globals.css` es la fuente.
4. **Componentes primero.** Si existe en `src/shared/ui/`, se usa. No se escribe el equivalente crudo.
5. **Densidad operativa.** En el panel, la cabecera y los filtros no se comen la pantalla: el flujo
   principal (el tablero, la tabla, la lista) manda.
6. **Sin fugas.** Un componente nuevo en `_components/` se registra en §3 **antes** de usarlo.

---

## 2. Tokens

Los 7 primeros son **del negocio**: su valor efectivo lo elige el owner en `/admin/settings`. Los
demás son del sistema. La tabla completa con evidencia está en el frontmatter de este archivo y en
`ops/tasks/TASK-201-ui-inventory.md` §1.

### 2.1 Los 15 tokens prohibidos

`--primary`, `--primary-foreground`, `--popover`, `--popover-foreground`, `--accent-foreground`,
`--destructive`, `--ink-green-foreground` y la familia `--sidebar-*` (8) **están declarados y nadie
los usa**. Son sobrante de un scaffold tipo shadcn. **No usarlos**: agregan superficie sin agregar
sistema (el inventario §1.2 tiene la búsqueda negativa).

### 2.2 Cuándo usar qué color

| Necesidad | Token / utilidad |
|---|---|
| Acción principal | `bg-brand text-brand-foreground hover:bg-brand-strong` |
| Fondo de pantalla | `bg-background text-foreground` |
| Tarjeta o panel | `bg-card border border-border` |
| Texto de apoyo | `text-muted-foreground` |
| Superficie cálida secundaria | `bg-cream` / `bg-secondary` |
| Éxito / aviso / error | `bg-success|warning|danger` + `-foreground` (texto) + `-strong` (borde) |
| Estado de un pedido | `--status-*` (usar `AdminStatusSolid`, no clases sueltas) |
| Semáforo de retiro | `--pickup-*` (usar `AdminPickupTimingChip`) |
| Series de gráfico | `--chart-1..5` |

**Prohibido** usar la paleta cruda de Tailwind (`red-*`, `stone-*`, `amber-*`, `emerald-*`, `sky-*`,
`text-white` suelto) donde existe un token semántico. Hoy hay **70 apariciones** de esas clases; el
caso testigo es `src/shared/ui/button.tsx:21` (`danger: "bg-red-600 …"`) contra
`src/shared/ui/badge.tsx:16` (`danger: "… bg-danger text-danger-foreground"`).

### 2.3 Tipografía

- Títulos: `font-heading` (la **clase**, no `style={{ fontFamily }}`).
- Texto: la familia del negocio, ya aplicada en `body` (`globals.css:316`).
- Números que cambian (cronómetros, contadores, códigos): `tabular-nums`.
- Usar la escala de §frontmatter. **Prohibido** `text-display-lg`, `text-headline-lg` y `text-body`:
  hoy no se usan, así que introducirlos es sumar un paso sin necesidad.

### 2.4 Espaciado, radios y sombras

- **Espaciado: NO EXISTE escala propia.** Se usa la de Tailwind. No inventar `--spacing-*`.
- Radios: `rounded-card` (tarjetas del público) y `rounded-panel` (paneles). **Prohibido** sumar
  `rounded-[Npx]` arbitrarios: ya hay 37 apariciones con 9 valores distintos.
- Sombras: `shadow-card`. **`shadow-raised` y `shadow-float` existen y NO se usan** (solo en tests):
  no introducirlos.

---

## 3. Catálogo de componentes

### 3.1 `src/shared/ui/` — usar siempre que exista

| Componente | Cuándo usarlo | Cuándo **no** |
|---|---|---|
| `Button` (`button.tsx:8`) | Toda acción con texto o ícono. Variantes: `primary`, `secondary`, `outline`, `ghost`, `danger`; tamaños `sm`, `md`, `lg`, `icon` y **`pill`** (chip de filtro: pastilla + mínimo táctil; el radio va en el tamaño porque `rounded-full` por `className` pierde la cascada contra `rounded-md`) | Nunca escribir `<button>` a mano. **Excepciones legítimas**: un overlay de cierre o un `role="switch"`, que no son botones de acción, y una **fila de lista multilínea** (ancho completo, contenido apilado y alineado a la izquierda), que no tiene primitivo todavía |
| `Input` (`input.tsx:8`) | Campo de texto con `label` y `error` | No sirve para `type="color"` ni `type="date"`: **NO EXISTE** primitivo para esos |
| `Select` (`select.tsx:28`) | Elección entre 4+ opciones, con `label`, `error` y `options` (o `children`); `placeholder` para el caso opcional | No para 2–3 opciones visibles (eso es `RadioGroup`) ni para elegir fecha o color, que no tienen primitivo |
| `Checkbox` (`checkbox.tsx:7`) | Booleano | Nunca `<input type="checkbox">` a mano |
| `RadioGroup` + `RadioGroupItem` (`radio-group.tsx:3,7`) | Elección exclusiva entre 2–3 opciones visibles | No para 4+ opciones: ahí va `Select` |
| `WhatsAppInput` (`whatsapp-input.tsx:35`) | Teléfono del cliente, con prefijo | No para teléfonos internos del negocio |
| `Card` + `CardHeader/Title/Description/Content/Footer` (`card.tsx:3-33`) | Contenedor con borde y sombra | No para filas de lista compactas (para eso, `CartLineCard` o una fila propia) |
| `Badge` (`badge.tsx:7`) | Etiqueta corta de estado o categoría (6 variantes) | No para el estado de un pedido del panel: para eso está `AdminStatusSolid` |
| `BrandMark` (`brand-mark.tsx:25`) | Logo del negocio o sus iniciales | No para íconos de acción |
| `StatusProgress` (`status-progress.tsx:36`) | Progreso de un pedido en el historial del cliente | No en el panel: ahí el estado se muestra con `AdminStatusSolid` |
| `PublicLocationsList` (`public-locations-list.tsx:29`) | Lista de sucursales del público | — |
| `PublicMobileBottomNav` (`public-mobile-bottom-nav.tsx:10`) | Navegación inferior móvil del público | No en el admin ni en las rutas de túnel de conversión |
| `Tabs` + `TabsList` + `TabsTrigger` (`tabs.tsx:3,7,15`) | Pestañas del panel | **`TabsContent` no se usa y es huérfano: no introducirlo** |
| `PublicConfirmationShell` (`public-confirmation-shell.tsx:15`) | **NO USAR: es huérfano** (nadie lo importa) y tiene el literal `OB` hardcodeado | — |

### 3.2 `(admin)/admin/_components/` — panel

| Componente | Cuándo usarlo | Cuándo **no** |
|---|---|---|
| `AdminShell` (`admin-shell.tsx:23`) | Layout del panel (lo usa el layout) | No desde una página |
| `AdminMobileNav` (`admin-mobile-nav.tsx:57`) | Navegación móvil del panel (la usa el shell) | No desde una página |
| `AdminSessionControls` (`admin-session-controls.tsx:18`) | Bloque de sesión (lo usa el shell) | No desde una página |
| `AdminPageHeader` (`admin-operational-ui.tsx:46`) | **Toda** cabecera de pantalla del panel | No para encabezados internos de una tarjeta |
| `AdminEmptyState` (`admin-operational-ui.tsx:148`) | **Todo** estado vacío del panel | No para "cargando" (eso es un texto simple) |
| `AdminCompactToolbar` (`admin-operational-ui.tsx:128`) | Fila de filtros compactos | No para contenido: solo herramientas |
| `AdminStatusSolid` (`admin-operational-ui.tsx:213`) | Estado de un pedido/reserva en el panel | No para estados genéricos (para eso `Badge`) |
| `AdminPickupTimingChip` (`admin-operational-ui.tsx:264`) | Semáforo del retiro | No si el pedido no es de retiro |
| `AdminEditSheet` (`admin-edit-sheet.tsx:39`) | Edición en hoja (mobile) / diálogo (desktop) | No para confirmaciones simples |
| `AdminOverviewTrendChart` (`admin-overview-trend-chart.tsx:25`) | Gráfico de tendencia del overview | No en otras pantallas sin datos de serie |
| `AdminOverviewClient` (`admin-overview-client.tsx:156`) | Pantalla de resumen (la usa la página) | No reusarlo como widget |
| `AdminStatusDonut` (`admin-status-donut.tsx:26`) | **NO USAR: es huérfano** (y hay un test que exige que el overview no lo use) | — |
| `AdminMetricStrip` (`admin-operational-ui.tsx:78`) | **NO USAR: es huérfano** | — |
| `AdminStatusPill` (`admin-operational-ui.tsx:237`) | **NO USAR: es huérfano** (usar `AdminStatusSolid` o `Badge`) | — |

### 3.3 `(public)/_components/` y `cart/_components/` — público

| Componente | Cuándo usarlo |
|---|---|
| `OrderSummaryCard` (`order-summary-card.tsx:64`) | **El** resumen de pedido: lo comparten `/cart` y `/checkout` |
| `CartLineCard` (`cart-line-card.tsx:22`) | Fila de producto del carrito |
| `EmptyCartState` (`empty-cart-state.tsx:8`) | Carrito vacío |
| `OrderTrackingSessionProvider` + `useOrderTrackingSession` (`order-tracking-session.tsx:13,32`) | Sesión de seguimiento del pedido en el público |

### 3.4 Lo que **NO EXISTE** (y por eso no se puede inventar)

Antes de escribir HTML crudo por falta de primitivo, esto es lo que falta y lo que se hace hoy:

| Falta | Estado hoy | Qué hacer mientras tanto |
|---|---|---|
| `Select` | **EXISTE desde TASK-206** (`select.tsx`): etiqueta asociada, error con `aria-describedby` y mínimo táctil de 44 px en el primitivo. Quedan **27 `<select>` crudos en `src/app`** y **5 archivos** con su propia copia literal de `SELECT_CLASS` (`locations`, `menu/categories`, `menu/marketing-blocks`, `menu/products`, `users-client`) | Usar `Select`; migrar los crudos cuando se toque cada pantalla |
| `Textarea` | **NO EXISTE**: 6 crudos | Ídem, sin inventar variantes |
| Cabecera pública | **NO EXISTE**: 6 implementaciones | Usar `font-heading` + la escala, no `style` inline |
| Estado vacío público | **NO EXISTE** | Reusar el patrón de `AdminEmptyState` |
| Estado de carga | **NO EXISTE**: 2 literales distintos | Usar el literal de `rounded-2xl` con borde |
| Barra fija de CTA | **NO EXISTE**: 5 implementaciones con offsets y `z-index` distintos | Reusar `publicCheckoutScaleClasses` |
| Selector de fecha / color | **NO EXISTE** | `<input type="date">` / `type="color"` crudo |

> Registrar en esta tabla lo que falta es parte de la tarea: si un agente necesita un primitivo y no
> está, se documenta acá en vez de crear el 6.º `className` distinto.

---

## 4. Ejemplos reales de composición

**Cabecera de pantalla del panel** (`AdminPageHeader`, usado en 11 pantallas):

```tsx
<AdminPageHeader
  label="Operación"
  title="Promociones"
  description="Los códigos que el cliente puede aplicar en el checkout."
  actions={<Button onClick={openSheet}>Nueva promo</Button>}
/>
```

**Píldora de estado de un pedido** (no escribir clases a mano):

```tsx
<AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
  {order.status}
</AdminStatusSolid>
```

**Formulario dentro de la hoja de edición** (label + control, patrón que hoy se repite 18 veces):

```tsx
<label className="grid gap-1.5 text-sm font-medium text-foreground">
  <span>Nombre</span>
  <Input value={name} onChange={…} error={errors.name} />
</label>
```

**Fila de lista tocable** (respeta el mínimo táctil):

```tsx
<button className="flex min-h-14 w-full flex-col gap-1 border-t border-border px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-brand">
```

---

## 5. Do NOT

| Prohibición | Por qué (evidencia) |
|---|---|
| **NO** `<button>`, `<input>`, `<select>`, `<textarea>` crudos si el componente existe | En 22 archivos el componente ya estaba importado y se usó el crudo igual |
| **NO** `#hex` en el código | 10 apariciones de UI fuera de `globals.css`; `#8aa060` no sigue la apariencia configurada |
| **NO** paleta cruda de Tailwind donde hay token | 70 apariciones (`red-*`, `stone-*`, `amber-*`, `emerald-*`, `sky-*`, `text-white`) |
| **NO** `style={{ fontFamily }}` | La utilidad `font-heading` existe; el público lo hace 29 veces y el admin usa la clase |
| **NO** `rounded-[Npx]` nuevos | 37 arbitrarios con 9 valores; existen `rounded-card` y `rounded-panel` |
| **NO** usar los 15 tokens huérfanos | §2.1 |
| **NO** usar `text-display-lg`, `text-headline-lg`, `text-body`, `shadow-raised`, `shadow-float`, `rounded-4xl` | Declarados y sin uso: suman superficie sin sumar sistema |
| **NO** `font-mono` | **NO EXISTE** el token; usar `tabular-nums` |
| **NO** hardcodear datos del negocio (nombre, iniciales, colores, contacto, precios) | `anti-hardcode-contract.test.ts`; el caso vivo es el `OB` de `public-confirmation-shell.tsx:55` |
| **NO** clases sueltas para estados de pedido o de retiro | Usar `AdminStatusSolid` / `AdminPickupTimingChip` |
| **NO** crear un componente nuevo sin registrarlo acá | §3 es el catálogo; un componente sin fila es una fuga |
| **NO** duplicar la hoja de edición | `AdminEditSheet` existe; hoy hay 2 reimplementaciones, una sin focus trap ni Escape |
| **NO** dos `<h1>` en la misma página | `admin/orders/page.tsx:785` convive con `AdminPageHeader` (`:982`) |
| **NO** reactivar el bloque `.dark` | 31 tokens que **nunca se aplican** (no hay clase `dark` en el DOM) |
| **NO** tocar el tema oscuro ni los tokens del mock sin pedido | El mock vive fuera del producto |

---

## 6. Cómo se hace cumplir

| Regla | Guardrail |
|---|---|
| Sin literales del negocio | `src/modules/business-settings/anti-hardcode-contract.test.ts` |
| Contraste legible | `src/modules/business-settings/domain/color-contrast.test.ts` (todos los presets ≥4.5:1) |
| `--brand-foreground` igual al contrato | `color-contrast.test.ts:120-126` |
| La escala del mock llega al navegador | `tests/e2e/design-tokens.spec.ts` |
| Contratos de UI del panel | `src/app/(admin)/admin/admin-ui-contract.test.ts` (lee el fuente) |
| HTML crudo, `#hex` y registro de componentes | `src/shared/contracts/ui-contract.test.ts` (techos por archivo que solo bajan) |
| Route handlers: 50 líneas y sin Prisma | `src/shared/contracts/route-contract.test.ts` |
| Módulos: capas con archivos y dirección de las dependencias | `src/shared/contracts/module-contract.test.ts` |
| Documentos sincronizados (`AGENTS.md` sin rutas rotas y frescura contra `schema.prisma`/`src/shared/ui/`) | `src/shared/contracts/docs-sync-contract.test.ts` |
| La suma del total vive en un solo lugar | `src/shared/lib/order-totals-contract.test.ts` |
| Los cinco corren como check propio, con historia completa, y bloquean `publish` | job `contracts` de `.github/workflows/publish-ghcr.yml` |

**Todavía sin guardrail automático:** las 70 clases de paleta cruda, los 29 `style` de tipografía y
los 37 `rounded-[Npx]` siguen dependiendo de este documento y de la revisión (§5). Dos excepciones de
color necesitan **aprobación del owner** porque cambian el tono visible: `Button.danger`
(`red-600`/`red-700`) y el error de `Input` (`text-red-500`), que deberían salir de los tokens
`--danger-*`.

---

## 7. Documentos obsoletos

Estos tres describen el sistema visual **antes** de este archivo y contienen afirmaciones que el
código ya no cumple. Se conservan como historia; **no son fuente de verdad**:

| Documento | Por qué queda obsoleto |
|---|---|
| `design/DESIGN.md` | Su línea base apunta a `origin/staging @ bc98c04`, una rama y un commit que **no existen** en este repo; reporta hallazgos ya resueltos |
| `design/DESIGN_SYSTEM.md` | Declara `shadcn/ui` en el stack (no está instalado) e incluye "QR ordering", que está fuera del MVP |
| `docs/ui/admin-design-system.md` | Se autodeclara "ley del admin" desde una carpeta no versionada; este archivo toma ese rol |

El cuarto (`stitch_full_pwa_builder/.../DESIGN.md`) es del **mock**, no del producto: no se toca.
