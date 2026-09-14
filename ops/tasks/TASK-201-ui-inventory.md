# TASK-201 — Inventario de UI (read-only)

> **Qué es este documento:** el inventario medido de la UI real de este repo, hecho **antes** de tocar
> nada. Es la entrada de TASK-202 (consolidar el design system). No propone cambios: describe lo que
> hay, con evidencia `ruta:línea`.
>
> **Alcance:** `src/app/globals.css` (tokens), `src/shared/ui/`, `src/app/(admin)/admin/_components/`,
> `src/app/(public)/_components/`, `src/app/(public)/cart/_components/` y las pantallas que usan esos
> componentes. **Método:** solo lectura; cada afirmación lleva evidencia. Lo que no existe dice
> `NO EXISTE`.
>
> **Números de línea:** contados con `@(Get-Content -LiteralPath $f).Count` (líneas físicas).
> `Measure-Object -Line` omite líneas vacías y subcuenta, así que no se usó.

---

## 1. Catálogo de tokens

Fuente única: **`src/app/globals.css` (338 líneas)**. **NO EXISTE** ningún otro archivo `.css` de
tokens en la app: el único `@import` de CSS en `src/` es `src/app/globals.css:1` → `@import "tailwindcss";`.

### 1.1 Tokens de `:root` (58 declarados, líneas 12-73)

| # | Token | Valor | Línea | Uso | ¿Huérfano? |
|---:|---|---|---:|---|---|
| 1 | `--brand` | `#2b6c96` | 12 | 228 utilidades `*-brand` | No |
| 2 | `--brand-strong` | `color-mix(in srgb, var(--brand) 84%, black)` | 13 | 28 utilidades | No |
| 3 | `--brand-foreground` | `#f7fafc` | 14 | 51 utilidades | No |
| 4 | `--terracotta` | `#b85f3a` | 15 | 1 (`(public)/page.tsx:147`) | No |
| 5 | `--ink-green` | `#12351f` | 16 | 9 utilidades | No |
| 6 | `--ink-green-foreground` | `#f4efe6` | 17 | — | **SÍ** |
| 7 | `--cream` | `#f2ece0` | 18 | 28 utilidades | No |
| 8 | `--gold` | `#c8a96a` | 19 | 1 + interno (`--warning-strong`) | No |
| 9 | `--coal` | `#16212a` | 20 | 3 utilidades | No |
| 10 | `--background` | `#fbf9f5` | 23 | 14 utilidades · **configurable** | No |
| 11 | `--foreground` | `#23303a` | 24 | 343 utilidades · **configurable** | No |
| 12 | `--card` | `#ffffff` | 25 | 186 utilidades · **configurable** | No |
| 13 | `--card-foreground` | `var(--foreground)` | 26 | 1 | No |
| 14 | `--popover` | `var(--card)` | 27 | — | **SÍ** |
| 15 | `--popover-foreground` | `var(--foreground)` | 28 | — | **SÍ** |
| 16 | `--primary` | `var(--brand)` | 29 | — | **SÍ** |
| 17 | `--primary-foreground` | `var(--brand-foreground)` | 30 | — | **SÍ** |
| 18 | `--secondary` | `#f1ece2` | 31 | 36 utilidades | No |
| 19 | `--secondary-foreground` | `var(--brand-strong)` | 32 | 9 utilidades | No |
| 20 | `--muted` | `#eef0f2` | 33 | 10 utilidades + `var()` directo | No |
| 21 | `--muted-foreground` | `#5b6670` | 34 | 362 utilidades | No |
| 22 | `--accent` | `#eaf1f6` | 35 | 55 utilidades · **configurable** | No |
| 23 | `--accent-foreground` | `var(--brand-strong)` | 36 | — | **SÍ** |
| 24 | `--destructive` | `oklch(0.577 0.245 27.325)` | 37 | — (solo en `design/**` no importado) | **SÍ** |
| 25 | `--border` | `#e4e2dc` | 38 | 285 utilidades + `@apply` interno | No |
| 26 | `--input` | `var(--border)` | 39 | 3 utilidades | No |
| 27 | `--ring` | `var(--brand)` | 40 | solo interno (`globals.css:312`) | No |
| 28 | `--chart-1` | `var(--brand)` | 41 | donut + trend chart | No |
| 29 | `--chart-2` | `var(--terracotta)` | 42 | idem | No |
| 30 | `--chart-3` | `var(--gold)` | 43 | solo `admin-status-donut.tsx` | No |
| 31 | `--chart-4` | `#4f8a68` | 44 | idem + interno (`--success-strong`) | No |
| 32 | `--chart-5` | `#7f95a3` | 45 | solo `admin-status-donut.tsx` | No |
| 33 | `--success` | `#e8f3ea` | 46 | 23 utilidades | No |
| 34 | `--success-foreground` | `#1f5c3f` | 47 | 26 utilidades | No |
| 35 | `--success-strong` | `var(--chart-4)` | 48 | 19 utilidades | No |
| 36 | `--warning` | `#f7ecd6` | 49 | 28 utilidades | No |
| 37 | `--warning-foreground` | `#7a5518` | 50 | 35 utilidades | No |
| 38 | `--warning-strong` | `var(--gold)` | 51 | 21 utilidades | No |
| 39 | `--danger` | `#f7e4dc` | 52 | 41 utilidades | No |
| 40 | `--danger-foreground` | `#8a3220` | 53 | 52 utilidades | No |
| 41 | `--danger-strong` | `#b8422b` | 54 | 41 utilidades | No |
| 42 | `--status-nueva` | `var(--brand)` | 56 | 1 | No |
| 43 | `--status-preparando` | `#b5701c` | 57 | 1 | No |
| 44 | `--status-lista` | `#1f7a4d` | 58 | 3 | No |
| 45 | `--status-cerrada` | `var(--muted-foreground)` | 59 | 2 | No |
| 46 | `--status-alerta` | `#b23c2a` | 60 | 3 | No |
| 47 | `--pickup-on-time` | `#1f7a4d` | 62 | 1 | No |
| 48 | `--pickup-past` | `#b5701c` | 63 | 1 | No |
| 49 | `--pickup-late` | `#b23c2a` | 64 | 2 | No |
| 50 | `--radius` | `0.625rem` | 65 | base de la cadena de radios | No (interno) |
| 51 | `--sidebar` | `oklch(0.985 0 0)` | 66 | — | **SÍ** |
| 52 | `--sidebar-foreground` | `oklch(0.145 0 0)` | 67 | — | **SÍ** |
| 53 | `--sidebar-primary` | `oklch(0.205 0 0)` | 68 | — | **SÍ** |
| 54 | `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | 69 | — | **SÍ** |
| 55 | `--sidebar-accent` | `oklch(0.97 0 0)` | 70 | — | **SÍ** |
| 56 | `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | 71 | — | **SÍ** |
| 57 | `--sidebar-border` | `oklch(0.922 0 0)` | 72 | — | **SÍ** |
| 58 | `--sidebar-ring` | `oklch(0.708 0 0)` | 73 | — | **SÍ** |

Además, `src/app/globals.css:6` → `color-scheme: light;` (propiedad, no token).

### 1.2 Huérfanos: 15 de 58 (26 %)

`--ink-green-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`,
`--accent-foreground`, `--destructive`, y la familia `--sidebar-*` completa (8).

Evidencia de la búsqueda negativa: las utilidades derivadas (`bg-popover`, `text-primary`,
`bg-sidebar`, `var(--destructive)`, …) dan `total=0` en `src/`, `tests/`, `public/` y `design/`.
`--destructive` solo aparece en CSS **no importado** (`design/admin-redesign/mock.css:26`,
`design/admin-redesign/v2/v2.css:80`).

> Interpretación verificable: el bloque `--sidebar-*`, `--popover*`, `--primary*` y `--destructive`
> es el sobrante de un scaffold tipo shadcn que nunca se usó (y `design/DESIGN_SYSTEM.md:7` todavía
> declara `shadcn/ui` — ver §5.2).

### 1.3 Tokens configurables en runtime (no son del sistema: son del negocio)

`src/modules/business-settings/domain/business-settings-style.ts:28-35` inyecta 7 variables en el
`<html>` (`src/app/layout.tsx:137` → `style={businessSettingsStyleVariables(settings)}`):

| Token | Línea | Valor por defecto (`business-settings-defaults.ts`) |
|---|---:|---|
| `--brand` | 28 | `primaryColor: "#2b6c96"` (43) |
| `--accent` | 29 | `accentColor: "#eaf1f6"` (44) |
| `--background` | 30 | `backgroundColor: "#fbf9f5"` (45) |
| `--foreground` | 31 | `foregroundColor: "#23303a"` (46) |
| `--card` | 32 | `surfaceColor: "#ffffff"` (47) |
| `--font-heading` | 34 | `headingFont: "fraunces"` (48) |
| `--font-body` | 35 | `bodyFont: "inter"` (49) |

La vista previa de `/admin/settings` repite 5 de esos tokens inline (`settings-client.tsx:925-929`).

**Consecuencia para el design system:** estos 7 tokens **no se pueden documentar como valor fijo**:
su valor efectivo lo elige el negocio. Los demás 51 sí son del sistema.

### 1.4 Dos bloques `@theme inline`

- **Bloque 1 (`:137-204`)**: expone los 58 tokens como utilidades de Tailwind (`--color-*`), los 7
  radios y las 2 familias (`--font-sans` → `var(--font-body)`, `--font-heading` sin resolver).
- **Bloque 2 (`:215-274`)**: la escala del mock "Artisanal Appetite" — 13 pasos tipográficos con
  `--text-<paso>--line-height|font-weight|letter-spacing`, más `--radius-card`, `--radius-panel` y
  3 sombras (`--shadow-card`, `--shadow-raised`, `--shadow-float`), teñidas con `var(--brand)`.

Escala tipográfica (13 pasos, `:216-262`): `display` 1.875rem/800, `display-lg` 2.5rem/800,
`headline` 1.375rem/700, `headline-lg` 1.75rem/700, `headline-md` 1.25rem/700,
`title` 1.0625rem/700, `title-sm` 0.9375rem/600, `body` 1rem/400, `body-sm` 0.875rem/400,
`caption` 0.75rem/400, `label` 0.875rem/700, `label-sm` 0.75rem/600, `label-xs` 0.75rem/700.

**Sin uso**: `text-headline-lg`, `text-body`, `--radius-4xl` (`rounded-4xl`), `--shadow-raised` y
`--shadow-float` (estos dos últimos solo aparecen en tests: `business-settings-style.test.ts:228`,
`tests/e2e/design-tokens.spec.ts:104`).

### 1.5 Clases propias (no Tailwind): 9

| Clase | Línea | Uso |
|---|---:|---|
| `.brand-canvas` | 86 | 10 |
| `.brand-surface` | 93 | 1 |
| `.brand-photo` | 100 | 3 |
| `.brand-hero-fallback` | 107 | 1 |
| `.brand-overlay` | 114 | 1 |
| `.brand-shadow-soft` | 121 | **0 (huérfana)** |
| `.brand-shadow-floating` | 125 | 1 |
| `.brand-shadow-cta` | 129 | 2 |
| `.brand-drop-shadow` | 133 | 2 |

Más 3 reglas de gancho para la vista de comandas (`:328`, `:332`, `:336`), activadas por
`html.comandas-view` (`src/app/(admin)/admin/orders/use-comanda-view.ts:22`).

### 1.6 Radios, sombras y espaciado

- **Radios:** cadena `--radius` → `sm 0.6×`, `md 0.8×`, `lg 1×`, `xl 1.4×`, `2xl 1.8×`, `3xl 2.2×`,
  `4xl 2.6×` (`:197-203`) + `--radius-card: 1rem` y `--radius-panel: 1.5rem` (`:266-267`).
- **Sombras:** `--shadow-card|raised|float` (`:271-273`) + 4 `.brand-*`.
- **Espaciado: NO EXISTE.** `globals.css` no declara ningún `--spacing*` (0 coincidencias en 338 líneas).

### 1.7 Tema oscuro: existe en el CSS, **no se aplica nunca**

- `@custom-variant dark (&:is(.dark *))` (`:3`) y un bloque `.dark` (`:276-308`) que redefine 31 tokens.
- **La clase `.dark` no se aplica en ningún lado**: no hay `classList.add("dark")` ni
  `className="dark"` en `src/`. El `<html>` recibe solo las variables de fuente
  (`layout.tsx:136`) y el estilo del negocio (`:137`).
- **NO EXISTE** ninguna `@media` en el archivo (ni `prefers-color-scheme` ni `prefers-reduced-motion`).

### 1.8 Tipografías

`next/font/local` en `src/app/layout.tsx:2` con 3 familias y 2 pesos cada una:
`fraunces` (`:24-38`), `inter` (`:40-54`), `jakarta` (`:61-75`); archivos en `src/app/fonts/` (6 `.ttf`).
Catálogo elegible: `FONT_CHOICES = ["fraunces", "inter", "jakarta"]` (`business-settings.types.ts:30`).
`--font-body` **no está en `globals.css`**: lo inyecta el layout. `body` lo usa en `:316`.

---

## 2. Catálogo de componentes

Total de archivos de componente: **13 en `src/shared/ui/`** (22 exports) + **8 en
`(admin)/admin/_components/`** + **3 en `(public)/_components/`** + **1 en `cart/_components/`**.

### 2.1 `src/shared/ui/` — 22 componentes en 13 archivos

| Componente | Archivo:línea | Props | Líneas | Test |
|---|---|---|---|---|
| `Badge` | `badge.tsx:7` | `variant: default\|secondary\|outline\|success\|warning\|danger` | 20 | NO EXISTE |
| `BrandMark` | `brand-mark.tsx:25` | `brand, variant?, className?, fallbackClassName?` | 56 | `brand-mark.test.tsx` |
| `Button` | `button.tsx:8` | `variant: primary\|secondary\|outline\|ghost\|danger`, `size: sm\|md\|lg\|icon` | 34 | NO EXISTE |
| `Card` | `card.tsx:3` | `HTMLAttributes<HTMLDivElement>` | 35 | NO EXISTE |
| `CardHeader` | `card.tsx:12` | idem | 35 | NO EXISTE |
| `CardTitle` | `card.tsx:16` | `HTMLAttributes<HTMLHeadingElement>` | 35 | NO EXISTE |
| `CardDescription` | `card.tsx:25` | `HTMLAttributes<HTMLParagraphElement>` | 35 | NO EXISTE |
| `CardContent` | `card.tsx:29` | idem div | 35 | NO EXISTE |
| `CardFooter` | `card.tsx:33` | idem div | 35 | NO EXISTE |
| `Checkbox` | `checkbox.tsx:7` | `InputHTMLAttributes + label?` | 32 | NO EXISTE |
| `Input` | `input.tsx:8` | `InputHTMLAttributes + label?, error?` | 37 | NO EXISTE |
| `PublicConfirmationShell` | `public-confirmation-shell.tsx:15` | `badgeLabel, badgeVariant?, title, description, primaryAction, secondaryAction?, children` | 67 | NO EXISTE |
| `PublicLocationsList` | `public-locations-list.tsx:29` | `locations, variant: list\|compact, className?` | 87 | `public-locations-list.test.tsx` |
| `PublicMobileBottomNav` | `public-mobile-bottom-nav.tsx:10` | sin props | 125 | `public-mobile-bottom-nav.test.tsx` |
| `RadioGroup` | `radio-group.tsx:3` | `children, className?` | 41 | NO EXISTE |
| `RadioGroupItem` | `radio-group.tsx:7` | `value, id, name, checked, onChange, label, className?` | 41 | NO EXISTE |
| `StatusProgress` | `status-progress.tsx:36` | `steps, currentIndex, statusLabel, tone, isTerminalNegative?, className?` | 73 | NO EXISTE |
| `Tabs` | `tabs.tsx:3` | `children, className?` | 56 | NO EXISTE |
| `TabsList` | `tabs.tsx:7` | `children, className?` | 56 | NO EXISTE |
| `TabsTrigger` | `tabs.tsx:15` | `value, activeValue, onClick, children, className?` | 56 | NO EXISTE |
| `TabsContent` | `tabs.tsx:43` | `value, activeValue, children, className?` | 56 | NO EXISTE |
| `WhatsAppInput` | `whatsapp-input.tsx:35` | `value, onChange, id?, name?, label?, helpText?, error?, disabled?, required?, className?, defaultPrefix?` | 152 | `whatsapp-input.test.tsx` |

**NO EXISTE barrel** (`src/shared/ui/index.ts`): todos los imports son por ruta directa.

**NO EXISTE** ningún primitivo de `select` ni de `textarea`.

**Huérfanos (2):** `PublicConfirmationShell` (único archivo entero sin importadores) y `TabsContent`
(nadie lo importa; `orders/page.tsx:25` importa solo `Tabs`, `TabsList`, `TabsTrigger`).

### 2.2 `(admin)/admin/_components/` — 8 componentes + 5 módulos `.ts`

| Componente | Archivo:línea | Líneas | Importadores | Test |
|---|---|---|---|---|
| `AdminShell` (default) | `admin-shell.tsx:23` | 198 | `admin/layout.tsx:4` | NO EXISTE |
| `AdminMobileNav` (default) | `admin-mobile-nav.tsx:57` | 307 | `admin-shell.tsx:18` | NO EXISTE |
| `AdminSessionControls` (default) | `admin-session-controls.tsx:18` | 75 | `admin-shell.tsx:19`, `admin-mobile-nav.tsx:22` | NO EXISTE |
| `AdminStatusDonut` | `admin-status-donut.tsx:26` | 98 | **ninguno (huérfano)** | NO EXISTE |
| `AdminOverviewTrendChart` | `admin-overview-trend-chart.tsx:25` | 210 | `admin-overview-client.tsx:38` | NO EXISTE |
| `AdminOverviewClient` (default) | `admin-overview-client.tsx:156` | 615 | `admin/page.tsx:6` | NO EXISTE |
| `AdminPageHeader` | `admin-operational-ui.tsx:46` | 280 | **11 pantallas** | NO EXISTE |
| `AdminMetricStrip` | `admin-operational-ui.tsx:78` | 280 | **ninguno (huérfano)** | NO EXISTE |
| `AdminCompactToolbar` | `admin-operational-ui.tsx:128` | 280 | `orders/page.tsx`, `menu/products/page.tsx` | NO EXISTE |
| `AdminEmptyState` | `admin-operational-ui.tsx:148` | 280 | **13 lugares** | NO EXISTE |
| `AdminStatusSolid` | `admin-operational-ui.tsx:213` | 280 | `orders/page.tsx`, `orders/[id]/page.tsx` | NO EXISTE |
| `AdminStatusPill` | `admin-operational-ui.tsx:237` | 280 | **ninguno (huérfano)** | NO EXISTE |
| `AdminPickupTimingChip` | `admin-operational-ui.tsx:264` | 280 | `orders/page.tsx`, `orders/[id]/page.tsx` | NO EXISTE |
| `AdminEditSheet` (default) | `admin-edit-sheet.tsx:39` | 194 | 5 pantallas | `admin-edit-sheet.test.tsx` |

`admin-operational-ui.tsx` (280 líneas) concentra **6 componentes + 3 helpers** exportados:
`getAdminOrderSolidStatus:171`, `getAdminReservationSolidStatus:187` (sin uso en producción: solo lo
importa `reservations/reservation-status-ui.test.ts:9`), `formatAdminElapsed:196`.

Módulos `.ts` de la carpeta (5, todos con test propio): `admin-overview-chart.ts` (112),
`admin-overview-formatters.ts` (56), `admin-overview-payload.ts` (143), `admin-overview-request.ts` (63),
`admin-pickup-timing.ts` (123).

### 2.3 `(public)/_components/` y `cart/_components/` — 4 componentes

| Componente | Archivo:línea | Líneas | Importadores | Test |
|---|---|---|---|---|
| `OrderSummaryCard` | `(public)/_components/order-summary-card.tsx:64` | 158 | `checkout/page.tsx:38`, `cart/page.tsx:11` | `order-summary-card.test.ts` |
| `EmptyCartState` | `(public)/_components/empty-cart-state.tsx:8` | 53 | `checkout/page.tsx:37`, `cart/page.tsx:10` | NO EXISTE |
| `OrderTrackingSessionProvider` + `useOrderTrackingSession` | `(public)/_components/order-tracking-session.tsx:13` y `:32` | 38 | `layout.tsx:18` + 3 páginas | NO EXISTE (hay `vi.mock`) |
| `CartLineCard` | `(public)/cart/_components/cart-line-card.tsx:22` | 124 | `cart/page.tsx:12` | NO EXISTE |

En estas dos carpetas **NO EXISTE** ningún `.ts` de helper: todo es `.tsx` o test.

### 2.4 Cambio de convención verificable

- **Los 12 componentes de `_components/` son client** (`"use client"` en línea 1). **NO EXISTE**
  ningún componente server en esas carpetas.
- **Los 13 de `src/shared/ui/` NO son client** (excepto `public-mobile-bottom-nav.tsx:1` y
  `whatsapp-input.tsx:1`). Es decir: 11 primitivos son server-compatibles.
- Convención de export **inconsistente**: los de `admin/_components/` usan `export default`; los de
  `admin-operational-ui.tsx` y `shared/ui/` usan export nombrado; `menu-product-card.tsx` nombrado vs
  `product-dish-card.tsx` default para el mismo rol.
- Componentes locales **no exportados** dentro de páginas: `(public)/page.tsx` define `HeroCta:87`,
  `HeroSlide:126`, `HomeProductCard:172`. En `admin/orders/page.tsx` y `(public)/checkout/page.tsx`
  **NO EXISTE** ninguno fuera del componente de página.

### 2.5 Cobertura de tests de componentes: 4 de 26

Con test propio: `AdminEditSheet`, `OrderSummaryCard`, `BrandMark`, `PublicLocationsList`,
`PublicMobileBottomNav`, `WhatsAppInput` (6 archivos de test).
**Los 6 componentes de `admin-operational-ui.tsx` no tienen ningún test que los monte**; los cubre
solo por texto `admin-ui-contract.test.ts` (561 líneas, que no renderiza).

---

## 3. Cuándo usar qué

> Regla derivada de lo que el código ya hace bien. No es una propuesta nueva.

| Necesidad | Usar | Evidencia de que ya se usa |
|---|---|---|
| Acción con texto | `Button` con la variante correspondiente | 26 pantallas (`button.tsx:8`) |
| Botón de solo ícono | `Button size="icon"` | `button.tsx:8` (size `icon`) |
| Campo de texto con label y error | `Input` | 22 pantallas (`input.tsx:8`) |
| Booleano | `Checkbox` | `settings-client.tsx:23`, `locations/page.tsx:12` |
| Elección exclusiva entre 2–3 opciones visibles | `RadioGroup` + `RadioGroupItem` | `inventory/waste/page.tsx:7` (único uso) |
| Teléfono | `WhatsAppInput` | checkout, orders, track |
| Contenedor con borde y sombra | `Card` + subpartes | `menu-product-card.tsx:11`, `order-summary-card.tsx:10` |
| Etiqueta de estado o categoría | `Badge` (6 variantes) | 10 archivos |
| Estado de un pedido en el panel | `AdminStatusSolid` | `orders/page.tsx:751`, `orders/[id]/page.tsx:365` |
| Cabecera de pantalla del admin | `AdminPageHeader` | 11 pantallas |
| Pantalla vacía (admin) | `AdminEmptyState` | 13 lugares |
| Edición en hoja lateral/inferior | `AdminEditSheet` | 5 pantallas |
| Semáforo de retiro | `AdminPickupTimingChip` | 2 pantallas |
| Marca (logo o iniciales) | `BrandMark` | 4 archivos |
| Lista de sucursales del público | `PublicLocationsList` | 2 archivos |
| Navegación inferior móvil | `PublicMobileBottomNav` | `(public)/layout.tsx:270` |
| Progreso de un pedido en el historial | `StatusProgress` | `order-history-views.tsx:267` |
| Pestañas en el panel | `Tabs` + `TabsList` + `TabsTrigger` (**no** `TabsContent`) | `orders/page.tsx:25` |
| **Elección entre 3+ opciones (desplegable)** | **NO EXISTE componente** | 31 `<select>` crudos en 12 archivos |
| **Texto largo / notas** | **NO EXISTE componente** | 6 `<textarea>` crudos en 5 archivos |
| **Cabecera de pantalla pública** | **NO EXISTE componente** | 6 implementaciones distintas (§4.4) |
| **Estado vacío público** | **NO EXISTE componente** | 6 implementaciones distintas (§4.5) |
| **Barra fija inferior de CTA** | **NO EXISTE componente** | 5 implementaciones (§4.6) |
| **Estado de carga** | **NO EXISTE componente** | 2 literales distintos (§4.5) |
| **Selector de fecha / color** | **NO EXISTE componente** | `pickup-schedule-field.tsx:117` (`type="date"`), `settings-client.tsx:801` (`type="color"`) |

---

## 4. Inconsistencias detectadas

### 4.1 HTML crudo: 111 elementos, y en 22 archivos el componente ya estaba importado

| Raíz | `<button` | `<input` | `<select` | `<textarea` | Total |
|---|---:|---:|---:|---:|---:|
| `src/app/**/*.tsx` | 50 | 14 | 31 | 6 | **101** |
| `src/shared/**/*.tsx` (primitivos: legítimo) | 2 | 5 | 1 | 0 | 8 |
| tests | 1 | 1 | 0 | 0 | 2 |

En **22 archivos** de `src/app` el componente equivalente **ya estaba importado** y se usó igual el
elemento crudo. Los casos más claros:

| Archivo:línea | Crudo | Equivalente que ya existía |
|---|---|---|
| `admin/inventory/{count,items,receive,waste,alerts}/page.tsx:68-124` | `<button className="underline underline-offset-2" onClick={fetch…}>` | `Button` **importado en los 5** |
| `admin/menu/products/[id]/page.tsx:406,434,444` | `<input type="checkbox">` | `Checkbox` existe y no se importa |
| `admin/users/users-client.tsx:404,554` | `<input type="checkbox">` | idem |
| `admin/delivery-zones/[id]/page.tsx:165` | `<input type="checkbox">` | idem |
| `(public)/checkout/page.tsx:842,952` | `<input type="radio">` | `RadioGroupItem` existe; en ese archivo sí se importa `Checkbox` |
| `(public)/menu/[productId]/page.tsx:518` | `<input type="radio"/checkbox>` | `RadioGroupItem` existe |
| `(public)/checkout/pickup-schedule-field.tsx:176` | `<input type="radio">` | idem |
| `admin/orders/page.tsx:1123` | `<button aria-pressed>` (chip de filtro) | `TabsTrigger` **importado en ese archivo** |

Los 5 botones de reintento con `underline` **no tienen `min-h-11`**, que `AGENTS.md` exige para
controles táctiles (evidencia: los literales de la tabla).

`select` (31) y `textarea` (6): en **todos** los casos **NO EXISTE** componente equivalente.

### 4.2 Colores fuera de token

**Hex de UI: 10 apariciones.**
- `#8aa060` ×2 (verde "check" de confirmación): `(public)/success/[orderId]/order-success-view.tsx:194`,
  `(public)/reservations/reservation-success-view.tsx:96`. **No está en `globals.css`**: no sigue la
  apariencia configurada.
- 8 líneas de `(landing)/landing/landing.css:12-16,28,35` con paleta propia del landing
  (`--ember: #ffad3d`, `--cheese: #f9c94d`, `--landing-cream: #fff2d8`, `--landing-black: #030201`,
  `--landing-ink: #1b1007`). **Es otra hoja de estilos**, ajena a los tokens.

**`rgba()`: 35 apariciones**, casi todas sombras `shadow-[…rgba(41,37,36,…)]`. Se repiten 4 tonos base:
`rgba(41,37,36,…)`, `rgba(60,40,20,…)`, `rgba(28,25,23,…)`, `rgba(31,111,69,…)`.
Contradicción concreta: `globals.css:271` ya define `--shadow-card` teñida con el color del negocio y
**`shared/ui/card.tsx:6` no la usa**: escribe `rgba(60,40,20,0.05)` fijo. `shadow-card` sí se usa en
otros 6 lugares.

**Clases de paleta Tailwind cruda: 70 apariciones / 38 clases.** Las que el brief anticipaba
(`bg-gray-*`, `text-slate-900`, `border-zinc-*`) **NO EXISTEN**; las reales son:

| Familia | Apariciones | Token que existía |
|---|---:|---|
| `white`/`black` (`text-white` 15, `bg-white/20` 5, …) | 34 | `--card`, `--brand-foreground` |
| `red-*` (`text-red-700` 6, `text-red-500` 2, `bg-red-600` en `Button danger`) | 16 | `--danger*` |
| `stone-*` (`text-stone-950`, `border-stone-200`, …) | 12 | `--coal`, `--border` |
| `amber-*` (`bg-amber-100 text-amber-700` ×3) | 4 | `--warning*` |
| `emerald-*` (`bg-emerald-100 text-emerald-700` ×2) | 3 | `--success*` |
| `sky-*` (`bg-sky-50`) | 1 | `--accent` |

Caso testigo: `shared/ui/button.tsx:21` → `danger: "bg-red-600 text-white hover:bg-red-700"` mientras
`shared/ui/badge.tsx:16` usa `danger: "border-transparent bg-danger text-danger-foreground"`.

### 4.3 Estilos en línea: 47 `style={{`

- **29 son `fontFamily: "var(--font-heading)"`** en el público, mientras el admin usa la clase
  `font-heading` en 34 lugares. Mismo rol, dos mecanismos. La utilidad existe
  (`globals.css:139`), así que el `style` inline es redundante.
- **12 son configuración del negocio** (preview de settings, color de categoría, tarjeta de menú):
  **legítimos**.
- **7 no son ninguna de las dos** (geometría de gráficos, `aspectRatio`, patrón de fondo del login).

### 4.4 Patrón: cabecera de página — compartida en el admin (11), rehecha 14 veces

`AdminPageHeader` (`admin-operational-ui.tsx:46`) se usa en 11 pantallas. Además hay **14 `<h1>`
a mano** con **3 escalas distintas**: `text-3xl` ×7 (`inventory/*`, `menu/products/[id]`),
`text-2xl` ×5 (`locations/[id]`, `menu/page`, `orders/[id]`, `settings`, `login`), `text-base` ×1
(`orders/page.tsx:785`, que **convive con `AdminPageHeader` en la misma página** en `:982`).

En el público **NO EXISTE componente de cabecera**: `orders/page.tsx:151` y `orders/track/page.tsx:106`
usan `font-heading text-3xl…`; `cart/page.tsx:39` usa `publicCartScaleClasses.heading`; el checkout
usa `publicCheckoutScaleClasses.pageHeading`; `menu/page.tsx:160` otra cosa.

### 4.5 Patrón: estado vacío y estado de carga

- `AdminEmptyState` (`admin-operational-ui.tsx:148`) se usa en **13 lugares** del admin.
- En el público hay **6 implementaciones distintas**: `menu/page.tsx:243` y `:258`
  (`rounded-[28px] border-dashed`), `activity/page.tsx:371` (`rounded-[26px]` con sombra `rgba`),
  `_components/empty-cart-state.tsx:13` (`Card` con `rounded-[28px]`),
  `orders/page.tsx:200` (un `<p>` suelto), `activity/page.tsx:393-397` (variante en línea).
- **Estado de carga con dos literales distintos para lo mismo**: `"flex h-40 items-center
  justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"` (**6**) y
  `"flex h-40 items-center justify-center text-muted-foreground"` (**7**).

### 4.6 Patrón: barra fija inferior de CTA — 5 implementaciones, ninguna compartida

| Archivo:línea | Offset | z-index |
|---|---|---|
| `(public)/checkout/checkout-scale-helpers.ts:15` | `bottom-[calc(5.5rem+env(safe-area-inset-bottom))]` | `z-40` |
| `(public)/menu/[productId]/page.tsx:613` | `bottom-0` | `z-[60]` |
| `admin/menu/modifier-groups/[id]/page.tsx:365` | `bottom-14 md:bottom-0` | `z-40` |
| `admin/orders/[id]/page.tsx:880` | `bottom-14 md:bottom-0` | `z-40` |
| `(public)/layout.tsx:122` (`CartStickyBar`) | `bottom-4` (flotante, solo escritorio) | `z-50` |

Además la condición de "en qué rutas se esconde" está escrita **dos veces y no coincide**:
`public-layout-helpers.ts:22` solo oculta la bottom nav en `/menu/<id>`, mientras
`(public)/layout.tsx:116-117` oculta `CartStickyBar` en `/cart`, `/checkout` y `/menu/<id>`.
Y `design/DESIGN.md:53-55` afirma que la bottom nav desaparece en los tres (ver §5.4).

### 4.7 Patrón: card — 5 implementaciones sin componente común

`menu-product-card.tsx:96` (`Card`, `rounded-[20px]`, `shadow-card`), `(public)/page.tsx:187`
(`<article>`, `rounded-card`, `shadow-card`), `admin/menu/products/product-dish-card.tsx:52`
(`<article>`, `rounded-xl`), `admin/orders/order-comanda-card.tsx:105` (`<article>`, `rounded-panel`),
`cart/_components/cart-line-card.tsx:42` (clases de `cart-scale-helpers.ts:8`). Radios distintos
(`rounded-[20px]`, `rounded-card`, `rounded-xl`, `rounded-panel`) y sombras distintas.

### 4.8 Duplicación literal de `className`

| `className` | Veces | Archivos |
|---|---:|---|
| `overflow-hidden rounded-2xl border border-border bg-card shadow-sm` | 12 | `inventory/*`, `locations/*`, `menu/categories`, `promotions`, `users-client`, … |
| `h-11 w-full rounded-md border border-border bg-card px-3 text-sm … ring-brand` (const `SELECT_CLASS`) | 8 | 8 archivos, cada uno **redefiniendo la constante** |
| `grid gap-1.5 text-sm font-medium text-foreground` (envoltorio de `label`) | 18 | 7 archivos |
| `border-success-strong/30 bg-success text-success-foreground` | 8 | 8 archivos (con `Badge variant="success"` disponible) |
| `border-danger-strong/30 bg-danger text-danger-foreground` | 9 | 9 archivos (idem `danger`) |
| `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 …` (`renderChip`) | 4 | `categories`, `marketing-blocks`, `products`, `promotions` — **misma firma de función** |
| `flex h-40 items-center justify-center …` (carga) | 6 + 7 | §4.5 |
| `font-heading text-3xl font-bold tracking-tight` | 7 | 7 archivos |
| `inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl …` | 2 | `admin-edit-sheet.tsx:175`, `admin-mobile-nav.tsx:220` |
| switch a mano (`h-6 w-11 rounded-full` + `h-5 w-5 … bg-card`) | 2+2 | `modifier-groups/[id]/page.tsx:55`, `product-dish-card.tsx:114` |
| `rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5` (= cuerpo de `AdminPageHeader`) | 4 | 3 pantallas **copian** el contenedor de la cabecera compartida |
| `flex min-h-14 w-full flex-col gap-1 border-t border-border …` | 2 | `locations/[id]/page.tsx:219`, `promotions/page.tsx:373` |
| `inline-flex h-5 min-w-5 … rounded-full px-1 text-[11px] font-bold tabular-nums` | 4 | idem chips |

### 4.9 Sheet de edición: 1 compartido + 2 reimplementaciones

`AdminEditSheet` (194 líneas, focus trap propio `:7-14`, Escape/inert `:79-109`) se usa en 5 pantallas.
Reimplementaciones:
1. `admin-mobile-nav.tsx:26-31` **vuelve a declarar el mismo `SHEET_FOCUSABLE_SELECTOR`** y su propio
   overlay en `:194` (con `z-40` en vez de `z-50`, que es el de `admin-edit-sheet.tsx:149`).
2. `menu/categories/page.tsx:776`: diálogo "mover subcategoría" hecho a mano, **sin focus trap, sin
   Escape y sin `role="dialog"`**.

### 4.10 Detalles menores con evidencia

1. `cart-scale-helpers.ts:16` → `summaryCard: "…"` **no se usa en ningún archivo**.
2. `ring-offset-white` en vez de `ring-offset-background` (que es el token, `input.tsx:27`):
   `inventory/receive/page.tsx:136`, `inventory/waste/page.tsx:142`, `menu/products/[id]/page.tsx:260`.
3. `textarea` con className idéntico en 2 archivos (`receive/page.tsx:162`, `waste/page.tsx:185`).
4. `<h1>` duplicado en la misma página: `orders/page.tsx:785` + `AdminPageHeader` (`:982`).
5. `font-mono` usado 6 veces (`locations/page.tsx:331`, `categories/page.tsx:497`,
   `marketing-blocks/page.tsx:368`, `modifier-groups/[id]/page.tsx:302`, `modifier-groups/page.tsx:118`,
   `promotions/page.tsx:362`) pero **NO EXISTE token `--font-mono`**: `@theme inline` solo define
   `--font-sans` y `--font-heading`.
6. 3 componentes huérfanos: `AdminStatusDonut` (98 líneas), `AdminMetricStrip`, `AdminStatusPill`.
   El primero tiene además un test que **exige que el overview no lo use**
   (`admin-ui-contract.test.ts:182`).
7. `public-confirmation-shell.tsx:55` tiene el texto **`OB` hardcodeado** (iniciales de un negocio
   concreto) en un componente compartido, y `:61` usa `bg-white/95` en vez de `--card`.

---

## 5. Contradicciones con la documentación de diseño existente

Hay 4 documentos de diseño. Ninguno es la fuente de verdad hoy (los 3 primeros están en `.gitignore`):

| Documento | Líneas | Estado |
|---|---:|---|
| `design/DESIGN.md` | 91 | Baseline del público; **`gitignore`** |
| `design/DESIGN_SYSTEM.md` | 16 | Dirección inicial; **`gitignore`** |
| `docs/ui/admin-design-system.md` | 157 | "Ley del admin" en un doc heredado; **`gitignore`** |
| `stitch_full_pwa_builder/.../DESIGN.md` | 211 | Del mock, no del producto; **`gitignore`** |

### 5.1 `design/DESIGN.md:3` apunta a una rama y un commit que NO EXISTEN

`> Línea base resumida del sistema visual público observada en \`origin/staging @ bc98c04\`.`
`git branch -a` devuelve solo `main` / `remotes/origin/main`, y `git log --all -1 bc98c04` →
`fatal: ambiguous argument`. La línea base del documento **no es verificable en este repo**.

### 5.2 `design/DESIGN_SYSTEM.md:7` declara `shadcn/ui`, que NO EXISTE

`package.json:34-41` solo tiene `@prisma/client`, `lucide-react`, `next`, `react`, `react-dom`, `zod`.
**NO EXISTEN** `shadcn`, `@radix-ui/*`, `class-variance-authority`, `clsx` ni `tailwind-merge`. Los
componentes son a mano (`button.tsx:31` compone con template string, no con `cn()`/`cva`).

### 5.3 `design/DESIGN_SYSTEM.md:13` incluye "QR ordering fluido" como parte del producto

`src/modules/table-ordering/README.md:3` dice que está **fuera del MVP** y `:11` pide **no
reactivarlo** sin pedido explícito.

### 5.4 `design/DESIGN.md:53-55` dice que la bottom nav desaparece en `/cart` y `/checkout`: NO es así

`public-layout-helpers.ts:22` → `return !/^\/menu\/[^/]+$/.test(pathname);` y el test lo fija
(`public-layout-helpers.test.ts:32-33`: `/cart` y `/checkout` devuelven `true`). Lo que se esconde en
las tres rutas es `CartStickyBar` (`(public)/layout.tsx:116-117`).

### 5.5 `design/DESIGN.md:65` reporta un hallazgo ya resuelto

Dice que el botón `+` de populares tiene "tactilidad insuficiente"; mide `h-11 w-11` (44 px) en
`(public)/page.tsx:251` y `menu-product-card.tsx:141`, que es el mínimo que exige `AGENTS.md`.

### 5.6 `design/DESIGN.md:21` describe la tipografía como fija, y es configurable

`FONT_CHOICES = ["fraunces", "inter", "jakarta"]` (`business-settings.types.ts:30`) y
`business-settings-style.ts:34-35` la inyecta por request. El default es serif+sans
(`defaults.ts:48-49`), pero el negocio puede poner sans+sans.

### 5.7 `design/DESIGN.md` no menciona los tokens que sí existen

**NO EXISTE** mención a los tokens de estado (`globals.css:56-64`: `--status-*`, `--pickup-*`) ni al
vocabulario de retiro, que están implementados y en uso (`admin-operational-ui.tsx:205-211`, `:251-255`).

### 5.8 Lo que `design/DESIGN.md` sí describe bien

`DESIGN.md:18` (azul de marca como CTA) ↔ `globals.css:12` + `button.tsx:17`; `:19` (superficies
blancas con borde suave) ↔ `globals.css:25,38` + `card.tsx:6`; `:20` (acentos `cream`) ↔
`globals.css:18` + `cart-line-card.tsx:52`; `:50` (navegación inferior persistente) ↔
`public-mobile-bottom-nav.tsx:19`.

---

## 6. Cifras de cierre

| Métrica | Valor |
|---|---|
| Tokens en `:root` | 58 (15 huérfanos, 7 configurables por el negocio) |
| Clases propias (`.brand-*` + ganchos) | 12 (1 huérfana) |
| Bloques `@theme inline` | 2 |
| Pasos tipográficos | 13 (2 sin uso) |
| Componentes | 26 archivos (13 shared/ui, 8 admin, 4 público, 1 cart) |
| Componentes huérfanos | 3 (`AdminStatusDonut`, `AdminMetricStrip`, `AdminStatusPill`) + `PublicConfirmationShell` y `TabsContent` sin importadores |
| Componentes con test propio | 6 de 26 |
| Elementos HTML crudos en pantallas | 111 (101 en `src/app`) |
| Archivos con crudo teniendo el componente importado | 22 |
| Hex de UI fuera de `globals.css` | 10 (2 en `.tsx` + 8 en `landing.css`) |
| `rgba()` fuera de `globals.css` | 35 |
| Clases de paleta Tailwind cruda | 70 apariciones / 38 clases |
| Estilos en línea | 47 (29 `fontFamily` + 12 de negocio + 7 de layout) |
| `className` largos duplicados | 15 patrones (§4.8) |
| Primitivos que faltan | `select`, `textarea`, cabecera pública, estado vacío público, estado de carga, barra fija de CTA, selector de fecha/color |
