---
# TASK-202 — Design system de One Burger Commerce.
#
# Este archivo es el CATÁLOGO (tokens disponibles, componentes y "cuándo NO usarlos").
# El ADN visual —los 10 patrones que deciden cómo se ve una pantalla— vive en
# `DESIGN_REFERENCES.md` (raíz), que es la fuente de verdad visual y gana si hay conflicto.
#
# `configurable: true` = el valor lo elige el negocio en `/admin/settings` y se inyecta por
# request; NO lo trates como valor fijo. El resto son del sistema.
version: 1
updated: 2026-09-15
source_of_truth: DESIGN_REFERENCES.md
design_dna: DESIGN_REFERENCES.md
tokens_file: src/app/globals.css
inventory: ops/tasks/TASK-201-ui-inventory.md

principles:
  mobile_first: "La UI se verifica a 375 px. Los controles táctiles llevan min-h-11 (44 px)."
  whitelabel: "Nada del negocio hardcodeado: nombre, colores, tipografías, contacto, horarios, precios y propina salen de BusinessSettings."
  tokens_only: "Ningún #hex suelto en el código: solo tokens de globals.css."
  components_first: "Si el componente existe en src/shared/ui/, se usa; no se escribe HTML crudo equivalente."
  dense_operational: "En el panel, la cabecera y los filtros no deben comerse la pantalla: el flujo principal manda."
  no_leaks: "Un componente nuevo en _components/ se registra en este archivo antes de usarlo."
  dark_mode: "Todo componente se ve en light Y dark (DESIGN_REFERENCES.md §3 Patrón 10). El interruptor es class=\"dark\" en <html>."

tokens:
  # --- Configurables por el negocio (se inyectan en <html> en cada request) ---
  configurable:
    - { name: "--brand",             default: "#2b6c96", role: "color de marca / CTA primario", source: "business-settings-style.ts:28" }
    - { name: "--accent",            default: "#eaf1f6", role: "tinte claro de apoyo",        source: "business-settings-style.ts:29" }
    - { name: "--background",        default: "#fbf9f5", role: "lienzo",                        source: "business-settings-style.ts:30" }
    - { name: "--foreground",        default: "#23303a", role: "texto principal",              source: "business-settings-style.ts:31" }
    - { name: "--card",              default: "#ffffff", role: "superficie de tarjeta",        source: "business-settings-style.ts:32" }
    - { name: "--font-heading",      default: "fraunces", role: "tipografía de títulos y NÚMEROS grandes", source: "business-settings-style.ts:34" }
    - { name: "--font-body",         default: "inter",    role: "tipografía de texto",        source: "business-settings-style.ts:35" }

  # --- Del sistema (no configurables). El valor de cada uno en modo oscuro está en `.dark`. ---
  surface:
    - { name: "--card-foreground",   value: "var(--foreground)",  role: "texto sobre tarjeta", dark: "#e8ebef" }
    - { name: "--secondary",         value: "#f1ece2",            role: "superficie secundaria", dark: "#1c262e" }
    - { name: "--secondary-foreground", value: "var(--brand-strong)", role: "texto sobre secundaria", dark: "#e8ebef" }
    - { name: "--muted",             value: "#eef0f2",            role: "fondo apagado", dark: "#1c262e" }
    - { name: "--muted-foreground",  value: "#5b6670",            role: "texto secundario (≥4.5:1)", dark: "#8a97a3" }
    - { name: "--border",            value: "#e4e2dc",            role: "borde por defecto", dark: "#263239" }
    - { name: "--input",             value: "var(--border)",      role: "borde de campo", dark: "#263239" }
  brand_derived:
    - { name: "--brand-strong",      value: "color-mix(in srgb, var(--brand) 84%, black)", role: "hover del primario", dark: "#518fba", note: "en dark el valor del ADN (#4a8bb5) daba 4.40:1 sobre --card; se usa el azul más cercano que cumple (4.66:1)" }
    - { name: "--brand-foreground",  value: "#f7fafc",            role: "texto sobre el primario", dark: "#f7fafc", note: "un test de contrato lo compara con BRAND_FOREGROUND_COLOR" }
  accent_limited:
    - { name: "--terracotta",        value: "#b85f3a",  role: "promos / especiales (uso limitado)", dark: "#d07a54" }
    - { name: "--gold",              value: "#c8a96a",  role: "highlight poco frecuente", dark: "#c8a96a" }
    - { name: "--cream",             value: "#f2ece0",  role: "superficie cálida secundaria", dark: "#1c262e" }
    - { name: "--coal",              value: "#16212a",  role: "overlay oscuro / texto más oscuro", dark: "#0b1116" }
    - { name: "--ink-green",         value: "#12351f",  role: "solo el wordmark de marca", dark: "#12351f" }
  semantic:
    # El par que pide el ADN (DESIGN_REFERENCES.md §4): `-soft` es el fondo, `-strong` el texto/dato.
    - { name: "--success-soft",      value: "#e8f3ea", role: "éxito / fondo", dark: "#12351f" }
    - { name: "--success-strong",    value: "#1f5c3f", role: "éxito / texto y dato", dark: "#6fd89c" }
    - { name: "--warning-soft",      value: "#f7ecd6", role: "aviso / fondo", dark: "#2a1f0e" }
    - { name: "--warning-strong",    value: "#7a5518", role: "aviso / texto y dato", dark: "#f0c56a" }
    - { name: "--danger-soft",       value: "#f7e4dc", role: "peligro / fondo", dark: "#2a1612" }
    - { name: "--danger-strong",     value: "#8a3220", role: "peligro / texto y dato", dark: "#f58b7a" }
    - { name: "--info-soft",         value: "#eaf1f6", role: "info neutral / fondo", dark: "#15232e", note: "mismo valor que --accent" }
    - { name: "--info-strong",       value: "#2b6c96", role: "info neutral / texto y dato", dark: "#6fafd5", note: "mismo valor que --brand" }
    # Alias de compatibilidad: los nombres viejos que usa el código actual (~220 clases).
    - { name: "--success",           value: "var(--success-soft)",      role: "alias viejo del fondo de éxito" }
    - { name: "--success-foreground", value: "var(--success-strong)",   role: "alias viejo del texto de éxito" }
    - { name: "--warning",           value: "var(--warning-soft)",      role: "alias viejo del fondo de aviso" }
    - { name: "--warning-foreground", value: "var(--warning-strong)",   role: "alias viejo del texto de aviso" }
    - { name: "--danger",            value: "var(--danger-soft)",       role: "alias viejo del fondo de peligro" }
    - { name: "--danger-foreground", value: "var(--danger-strong)",     role: "alias viejo del texto de peligro" }
  order_status:
    - { name: "--status-nueva",      value: "var(--brand)", role: "pedido nuevo", dark: "#2b6c96" }
    - { name: "--status-preparando", value: "#a36519",      role: "en cocina", dark: "#a36519", note: "bajado del #b5701c del inventario: con texto blanco daba 3.78:1" }
    - { name: "--status-lista",      value: "#1f7a4d",      role: "listo", dark: "#1f7a4d" }
    - { name: "--status-cerrada",    value: "#526069",      role: "cerrado", dark: "#526069" }
    - { name: "--status-alerta",     value: "#b23c2a",      role: "requiere atención", dark: "#b23c2a" }
  pickup_timing:
    - { name: "--pickup-on-time",    value: "#1f7a4d", role: "todavía no es la hora", dark: "#4c9571" }
    - { name: "--pickup-past",       value: "#a36519", role: "pasó la hora, con margen", dark: "#b9792a" }
    - { name: "--pickup-late",       value: "#b23c2a", role: "muy tardado" }
  charts:
    - { name: "--chart-1", value: "var(--brand)",     role: "serie 1" }
    - { name: "--chart-2", value: "var(--terracotta)", role: "serie 2" }
    - { name: "--chart-3", value: "var(--gold)",      role: "serie 3" }
    - { name: "--chart-4", value: "#4f8a68",          role: "serie 4" }
    - { name: "--chart-5", value: "#7f95a3",          role: "serie 5" }

  # NO USAR: existieron y se ELIMINARON en C1-3 (plan2uiux.md) porque ningún archivo los consumía.
  # Ver `ops/tasks/TASK-201-ui-inventory.md` §1.2 y el contrato
  # `src/shared/contracts/dark-mode-contract.test.ts`, que falla si alguno vuelve a declararse
  # sin un consumidor real en el mismo commit.
  removed_dead_tokens_forbidden:
    - --primary
    - --primary-foreground
    - --popover
    - --popover-foreground
    - --accent-foreground
    - --destructive
    - --ink-green-foreground
    - --ring
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
  # Los cinco niveles del ADN (DESIGN_REFERENCES.md §3 Patrón 5). Una pantalla usa estos cinco.
  scale:
    - { utility: "text-display",     size: "3.5rem",    weight: 700, family: "fraunces", use: "HERO: el dato principal de la pantalla" }
    - { utility: "text-kpi",         size: "2rem",      weight: 700, family: "fraunces", use: "KPI: los datos secundarios" }
    - { utility: "text-title",       size: "2rem",      weight: 700, family: "fraunces", use: "alias del KPI (nombre viejo del mock)" }
    - { utility: "text-headline",    size: "1.25rem",   weight: 600, family: "inter",    use: "TÍTULO de sección" }
    - { utility: "text-headline-md", size: "1.25rem",   weight: 600, family: "inter",    use: "subtítulo" }
    - { utility: "text-headline-lg", size: "1.5rem",    weight: 600, family: "inter",    use: "título en escritorio" }
    - { utility: "text-body",        size: "0.875rem",  weight: 400, family: "inter",    use: "BODY: texto normal" }
    - { utility: "text-body-sm",     size: "0.875rem",  weight: 400, family: "inter",    use: "alias del Body" }
    - { utility: "text-title-sm",    size: "1.25rem",   weight: 600, family: "inter",    use: "dato mediano de una fila" }
    - { utility: "text-label",       size: "0.6875rem", weight: 600, family: "inter",    use: "LABEL: uppercase con tracking 0.08em" }
    - { utility: "text-label-sm",    size: "0.6875rem", weight: 600, family: "inter",    use: "label chico" }
    - { utility: "text-label-xs",    size: "0.6875rem", weight: 700, family: "inter",    use: "píldora / overline" }
    - { utility: "text-caption",     size: "0.75rem",   weight: 400, family: "inter",    use: "metadato (único paso fuera del ADN)" }
  unused_forbidden: ["text-display-lg"]
  numbers: "Los números grandes (Hero y KPI) van en Fraunces y con tabular-nums: las cifras no saltan al cambiar."
---

# Design system — One Burger Commerce

> **Qué es este archivo.** El **catálogo**: qué tokens existen, qué componentes hay y cuándo NO usar
> cada uno. El **ADN visual** —los 10 patrones que deciden cómo se ve una pantalla— vive en
> [`DESIGN_REFERENCES.md`](DESIGN_REFERENCES.md) y **gana si hay conflicto** con este archivo.
>
> **Jerarquía de fuentes (2026-09-15):** 1) `DESIGN_REFERENCES.md` para el ADN visual · 2)
> `AGENTS.md` para todo lo demás (alcance, arquitectura, TDD, proceso), y sigue mandando sobre los dos
> documentos de diseño cuando el conflicto no es visual · 3) skills de diseño, solo como referencia ·
> 4) el humano, cuando sigue sin estar claro.
>
> **De dónde salen los datos.** Los tokens y los componentes están **medidos** en
> `ops/tasks/TASK-201-ui-inventory.md` (inventario read-only con evidencia `ruta:línea`). Nada de
> acá es inventado: si algo no existe, dice `NO EXISTE`.
>
> **Ubicación.** Este archivo vive en la raíz y **se versiona**, al lado de `AGENTS.md`. No va en
> `docs/`: esa carpeta está entera en `.gitignore` y `AGENTS.md` la declara material heredado de
> otro proyecto.

---

## 0. Los 10 patrones del ADN visual (resumen operativo)

Están completos en `DESIGN_REFERENCES.md` §3. Acá, lo que hay que tener en la cabeza al escribir UI:

| # | Patrón | Regla dura |
|---|---|---|
| 1 | Números protagonistas | Dato principal **56 px Fraunces 700**; secundarios **32 px**. Nada más grande que el hero |
| 2 | Cards con personalidad | **Máximo 2 tipos** de card por pantalla; nunca todas blancas |
| 3 | Íconos con fondo | Todo ícono lleva fondo de color soft, **48×48, radio 12** |
| 4 | Color con significado | `-soft` fondo / `-strong` texto, por estado (success, warning, danger, info) |
| 5 | Jerarquía de 5 niveles | Una pantalla usa **los cinco**: Hero, KPI, Título, Body, Label |
| 6 | Badges de tendencia | Todo dato principal lleva badge de comparación o estado, con ícono si es tendencia |
| 7 | Visualización | Serie → sparkline, proporción → donut, comparación → barras. **Sin datos, estado vacío** |
| 8 | Spacing generoso | **32 px** entre secciones, **24 px** dentro de cards, 12-16 px entre items |
| 9 | Radius consistente | Cards 16-20, íconos 12, badges pill, inputs 12. Nunca un `rounded-[Npx]` |
| 10 | Dark mode siempre | Todo componente se ve en light **y** dark; el interruptor es `class="dark"` en `<html>` |

**La regla de oro:** si dudás entre dos opciones, elegí la que respeta los 10 patrones.

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
7. **Light y dark, siempre.** Todo token tiene valor en los dos modos y todo par texto/fondo cumple
   **4.5:1**; `dark-mode-contract.test.ts` lo mide.

---

## 2. Tokens

Los 7 primeros son **del negocio**: su valor efectivo lo elige el owner en `/admin/settings`. Los
demás son del sistema, y **cada uno tiene su valor en `.dark`** (el frontmatter de este archivo lo
declara). La tabla completa con evidencia está en el frontmatter y en `ops/tasks/TASK-201-ui-inventory.md` §1.

### 2.1 Los 16 tokens muertos: eliminados en C1-3

`--primary`, `--primary-foreground`, `--popover`, `--popover-foreground`, `--accent-foreground`,
`--destructive`, `--ink-green-foreground`, `--ring` y la familia `--sidebar-*` (8) **existían
declarados y nadie los consumía**: sobrante de un scaffold tipo shadcn (el inventario §1.2 tiene la
búsqueda negativa). **C1-3 los borró** de `:root` y de `@theme`.
`src/shared/contracts/dark-mode-contract.test.ts` falla si alguno vuelve sin un consumidor real.

**Ojo con `--ring`**: no era gratis borrarlo. La regla base aplicaba `outline-ring/50`, que Tailwind
compila a un `outline-color: var(--ring)` literal —borrar el token sin tocar esa línea dejaba el
contorno **roto en runtime sin fallar el build**—. Se quitó esa aplicación: los 75 anillos de foco del
producto usan `focus-visible:ring-2 focus-visible:ring-brand`, que es explícito y no depende del token.

### 2.1b El modo oscuro (aprobado el 2026-09-15)

El bloque `.dark` **volvió**, ahora como funcionalidad y no como scaffold: los valores son los de
`DESIGN_REFERENCES.md` §4 y se activa con `class="dark"` en `<html>` (interruptor explícito, sin
detección del sistema). **Una desviación medida**: el `--brand-strong` oscuro del documento
(`#4a8bb5`) daba **4.40:1** sobre `--card`, así que se usa el azul más cercano que cumple,
`#518fba` (**4.66:1**).

Los pares de estado del panel también se corrigieron al activarlo: `--status-preparando` pasó de
`#b5701c` a `#a36519` (con texto blanco daba 3.78:1 y no llegaba a 4.5:1) y los `--pickup-*` oscuros
usan tonos claros porque son **texto sobre tarjeta**. Los 40 pares medidos (20 por modo) están en
verde.

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

> **No todo lo configurable es un token.** El negocio también configura datos que **no** generan
> variables CSS —la moneda (`currencyCode`), su símbolo y el **tipo de cambio del dólar**
> (`usdExchangeRate`, TASK-303a)— y se leen por la API de configuración. No inventes tokens
> `--currency-*` ni `--rate-*`: si algo no cambia un color, una tipografía, un radio o una sombra, no
> va acá.

### 2.4 Espaciado, radios y sombras

- **Espaciado: NO EXISTE escala propia.** Se usa la de Tailwind. No inventar `--spacing-*`.
- Radios: `rounded-card` (tarjetas del público) y `rounded-panel` (paneles). **Prohibido** sumar
  `rounded-[Npx]` arbitrarios: ya hay 37 apariciones con 9 valores distintos.
- Sombras: `shadow-card`. **`shadow-raised` y `shadow-float` existen y NO se usan** (solo en tests):
  no introducirlos.

---

## 3. Catálogo de componentes

Este catálogo es **la fuente humana** y `src/shared/ui/registry.json` es su **espejo declarado** (C0-3
de `plan2uiux.md`): el mismo inventario con la metadata en JSON, para que una herramienta o un agente
lo lean sin parsear markdown. `src/shared/contracts/registry-contract.test.ts` exige que los dos
tengan los mismos componentes y que cada fila tenga su "cuándo SÍ" y su "cuándo NO"; ningún archivo
nuevo de UI queda sin fila.

### 3.1 `src/shared/ui/` — usar siempre que exista

| Componente | Cuándo usarlo | Cuándo **no** |
|---|---|---|
| `Button` (`button.tsx:8`) | Toda acción con texto o ícono. Variantes: `primary`, `secondary`, `outline`, `ghost`, `danger`; tamaños `sm`, `md`, `lg`, `icon` y **`pill`** (chip de filtro: pastilla + mínimo táctil; el radio va en el tamaño porque `rounded-full` por `className` pierde la cascada contra `rounded-md`) | Nunca escribir `<button>` a mano. **Excepciones legítimas**: un overlay de cierre o un `role="switch"`, que no son botones de acción, y una **fila de lista multilínea** (ancho completo, contenido apilado y alineado a la izquierda), que no tiene primitivo todavía |
| `Input` (`input.tsx:8`) | Campo de texto con `label` y `error` | No sirve para `type="color"` ni `type="date"`: **NO EXISTE** primitivo para esos |
| `Select` (`select.tsx:28`) | Elección entre 4+ opciones, con `label`, `error` y `options` (o `children`); `placeholder` para el caso opcional. Lo usa `/admin/locations` para los interruptores del local (acepta pedidos, **punto de venta** desde TASK-308, estado) | No para 2–3 opciones visibles (eso es `RadioGroup`) ni para elegir fecha o color, que no tienen primitivo |
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
| `Modal` (`modal.tsx:30`) **C1-1** | Diálogo y confirmaciones: `<dialog>` nativo con el foco atrapado, `Escape` y `::backdrop` del navegador. Título obligatorio (nombra al diálogo). | No para editar un formulario largo (para eso está `AdminEditSheet`) ni para avisos que no piden decisión (para eso, `Toast`) |
| `Toggle` (`toggle.tsx:28`) **C1-1** | Interruptor de encendido/apagado sobre un dato que se guarda al tocarlo (`role="switch"`, `aria-checked`, 44 px y `saving`) | No para elegir entre dos opciones de un formulario (eso es `RadioGroup`) ni para un booleano que se guarda al enviar (eso es `Checkbox`) |
| `Textarea` (`textarea.tsx:23`) **C1-1** | Texto de varias líneas, con `label`, `error` y `description` | No para una línea: eso es `Input` |
| `Skeleton` (`skeleton.tsx:26`) + `SkeletonAnnouncement` (`skeleton.tsx:42`) **C1-1** | Estado de carga de una pantalla con datos: huesos + el anuncio en una sola línea | No para «no hay datos» (eso es `AdminEmptyState`) ni para esperas de una acción (eso es el `saving` del botón) |
| `Toast` (`toast.tsx:31`) **C1-1** | Resultado de una acción que acaba de hacer el usuario, con su tono (`success`/`error`/`warning`/`info`) | No para errores de validación de un campo (van en el `error` del control) ni para información permanente en pantalla |
| `HelpText` (`help-text.tsx:22`) **C1-1** | Aclaración bajo un campo, referenciada por el `id` del control (`aria-describedby`) | No para mensajes de error (para eso, el `error` del control) ni para copy decorativo |
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
| `Select` | **EXISTE desde TASK-206** (`select.tsx`): etiqueta asociada, error con `aria-describedby` y mínimo táctil de 44 px en el primitivo. Quedan **25 `<select>` crudos en `src/app`** y **6 archivos** con su propia copia literal de `SELECT_CLASS` (`locations/[id]`, `menu/categories`, `menu/marketing-blocks`, `menu/modifier-groups/[id]`, `menu/products`, `users-client`); TASK-308 migró los dos de `locations` y bajó su techo de 4 a 2 controles crudos | Usar `Select`; migrar los crudos cuando se toque cada pantalla |
| `Textarea` | **NO EXISTE**: 6 crudos | Ídem, sin inventar variantes |
| Cabecera pública | **NO EXISTE**: 6 implementaciones | Usar `font-heading` + la escala, no `style` inline |
| Estado vacío público | **NO EXISTE** | Reusar el patrón de `AdminEmptyState` |
| Estado de carga | **NO EXISTE**: 2 literales distintos | Usar el literal de `rounded-2xl` con borde |
| Barra fija de CTA | **NO EXISTE**: 5 implementaciones con offsets y `z-index` distintos | Reusar `publicCheckoutScaleClasses` |
| Selector de fecha / color | **NO EXISTE** | `<input type="date">` / `type="color"` crudo |
| Grilla de conteo de billetes | **NO EXISTE** (TASK-305): el arqueo se cuenta por denominación y moneda | Una fila por billete con `Input` numérico y una etiqueta con el valor (`10 × C$100`), agrupada por moneda; el total lo calcula el dominio (`cashCountsTotal`), no la pantalla |

> Registrar en esta tabla lo que falta es parte de la tarea: si un agente necesita un primitivo y no
> está, se documenta acá en vez de crear el 6.º `className` distinto.

---

## 4. Ejemplos reales de composición

Cinco casos tomados del código que ya está en producción, con su `ruta:línea` para que se puedan
leer tal como están en el repo. Son la referencia de composición: copy y estructura salen de acá.

**1. Cabecera de pantalla del panel** (`AdminPageHeader`, usado en 11 pantallas) —
`src/app/(admin)/admin/promotions/page.tsx:252`:

```tsx
<AdminPageHeader
  label="Operación"
  title="Promociones"
  description="Los códigos que el cliente puede aplicar en el checkout."
  actions={<Button onClick={openSheet}>Nueva promo</Button>}
/>
```

**2. Píldora de estado de un pedido** (clases fuera; el estado lo resuelve el dominio) —
`src/app/(admin)/admin/orders/page.tsx:751`:

```tsx
<AdminStatusSolid status={getAdminOrderSolidStatus(order.status)}>
  {order.status}
</AdminStatusSolid>
```

**3. Estado vacío del panel con su CTA** (`AdminEmptyState`) —
`src/app/(admin)/admin/promotions/page.tsx:313`:

```tsx
<AdminEmptyState
  title="Todavía no hay promos"
  description="Cuando crees la primera, el cliente la puede aplicar en el checkout."
  action={<Button onClick={openSheet}>Nueva promo</Button>}
/>
```

**4. Formulario dentro de la hoja de edición** (label + control) —
`src/app/(admin)/admin/users/users-client.tsx:490`:

```tsx
<label className="grid gap-1.5 text-sm font-medium text-foreground">
  <span>Nombre</span>
  <Input value={name} onChange={…} error={errors.name} />
</label>
```

**5. Bloque de cobro del POS con los chips de medio de pago** — `/admin/pos`
(`pos-client.tsx:746`): dos opciones visibles con `Button size="pill"` y `aria-pressed`, el total en
`aria-live` para que el lector de pantalla anuncie el número que se cobra (`pos-client.tsx:696`):

```tsx
<Button size="pill" aria-pressed={method === "cash"} variant={method === "cash" ? "primary" : "secondary"}>Efectivo</Button>
<Input label="Con cuánto paga" type="number" error={fieldErrors.amount} />
<dl><dt>Total</dt><dd aria-live="polite">{formatCurrency(totals.total, currency)}</dd></dl>
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
| **NO** volver a declarar los 16 tokens muertos | §2.1: se eliminaron en C1-3 y el contrato los rechaza |
| **NO** usar `text-display-lg`, `text-headline-lg`, `text-body`, `shadow-raised`, `shadow-float`, `rounded-4xl` | Declarados y sin uso: suman superficie sin sumar sistema |
| **NO** `font-mono` | **NO EXISTE** el token; usar `tabular-nums` |
| **NO** hardcodear datos del negocio (nombre, iniciales, colores, contacto, precios) | `anti-hardcode-contract.test.ts`; el caso vivo es el `OB` de `public-confirmation-shell.tsx:55` |
| **NO** clases sueltas para estados de pedido o de retiro | Usar `AdminStatusSolid` / `AdminPickupTimingChip` |
| **NO** crear un componente nuevo sin registrarlo acá | §3 es el catálogo; un componente sin fila es una fuga |
| **NO** duplicar la hoja de edición | `AdminEditSheet` existe; hoy hay 2 reimplementaciones, una sin focus trap ni Escape |
| **NO** dos `<h1>` en la misma página | `admin/orders/page.tsx:785` convive con `AdminPageHeader` (`:982`) |
| **NO** olvidar el modo oscuro | Patrón 10: si un componente nuevo no se ve bien con `class="dark"`, no está terminado |
| **NO** declarar un token sin valor en `.dark` | Un token que solo vive en el modo claro rompe el oscuro; `dark-mode-contract.test.ts` lo mide |
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
| HTML crudo, `#hex`, registro de componentes en `DESIGN_SYSTEM.md` | `src/shared/contracts/ui-contract.test.ts` (techos por archivo que solo bajan) |
| El registro JSON y el catálogo dicen lo mismo | `src/shared/contracts/registry-contract.test.ts` (forma, exports reales y todo archivo de UI registrado) |
| Paleta cruda, `fontFamily` inline, radios/tamaños/sombras arbitrarios, `window.confirm`, `role="dialog"`/`role="switch"` a mano y HTML crudo | `src/shared/contracts/design-guardrails-contract.test.ts` sobre los **techos por archivo** de `src/shared/config/design-tokens.allow.json` (C1-2): un techo nunca sube, si baja se baja en el mismo commit y al terminar la Capa 1.9 todas las tablas quedan vacías |
| Los 16 tokens muertos no vuelven, y el modo oscuro es real y legible | `src/shared/contracts/dark-mode-contract.test.ts` (ex C1-3: tokens en los dos modos, contraste ≥4.5:1 y `color-scheme`) |
| Route handlers: 50 líneas y sin Prisma | `src/shared/contracts/route-contract.test.ts` |
| Módulos: capas con archivos y dirección de las dependencias | `src/shared/contracts/module-contract.test.ts` |
| Documentos sincronizados (`AGENTS.md` sin rutas rotas y frescura contra `schema.prisma`/`src/shared/ui/`) | `src/shared/contracts/docs-sync-contract.test.ts` |
| La suma del total vive en un solo lugar | `src/shared/lib/order-totals-contract.test.ts` |
| Los contratos corren como check propio, con historia completa, y bloquean `publish` | job `contracts` de `.github/workflows/publish-ghcr.yml` |

**Los números medidos el 2026-09-15 (C1-2, primer congelamiento)**, para saber cuánto falta: **36**
apariciones de paleta cruda en **12 archivos**, **29** `fontFamily` inline en **15**, **36** radios
arbitrarios en **17**, **97** tamaños de texto arbitrarios en **33**, **26** sombras arbitrarias en **16**,
**4** `window.confirm`, **8** `role` a mano en **7** y **97** controles HTML crudos en **34**. La meta de
la Capa 1.9 es que todas esas tablas queden vacías.

**Todavía sin guardrail automático:** nada de la lista de §5, que es lo que C1-2 cierra. Dos excepciones
de color necesitan **aprobación del owner** porque cambian el tono visible: `Button.danger`
(`red-600`/`red-700`) y el error de `Input` (`text-red-500`), que deberían salir de los tokens
`--danger-*` (hoy están congelados como techo, no se pueden sumar usos nuevos).

---

## 7. Documentos obsoletos: eliminados (C0-5)

Tres documentos describían el sistema visual **antes** de este archivo y afirmaban cosas que el
código ya no cumple: `design/DESIGN.md` (su línea base apuntaba a `origin/staging @ bc98c04`, una rama
y un commit que no existen en este repo), `design/DESIGN_SYSTEM.md` (declaraba `shadcn/ui` en el stack
—no está instalado— e incluía "QR ordering", fuera del MVP) y `docs/ui/admin-design-system.md` (se
autodeclaraba "ley del admin" desde una carpeta no versionada).

Los tres vivían en `design/` y `docs/`, carpetas **enteras en `.gitignore`**: no están en el repo ni
en un clon, así que C0-5 los borró del disco y **no** deja un commit que los elimine (no había nada
versionado que borrar). Este documento toma su rol desde TASK-202. El cuarto
(`stitch_full_pwa_builder/.../DESIGN.md`) es del **mock**, no del producto: no se toca.

