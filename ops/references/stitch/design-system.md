# ONE BURGER — SISTEMA DE DISEÑO INTEGRAL & TOKENS DE PRODUCCIÓN

> **ARCHIVED / NON-NORMATIVE** — Documento histórico. **No es ley**: la ley visual vigente vive en ops/design/DESIGN_SYSTEM.md (Design System v4, DS-001). Se conserva como evidencia; no es lectura obligatoria, no decide diseños nuevos y su HTML no se copia: se traduce a componentes del repo.
**Archivo maestro de referencia:** `DESIGN_SYSTEM_SPEC.md` / `tokens.json`  
**Versión:** 3.0.0 (Production Core & AI Agent Enforceable Directives)  
**Entornos objetivo:** Pantallas KDS táctiles e industriales (visualización 1.5m–2m), Terminales POS táctiles de alta rotación, Desktop Admin Web de alta densidad.

---

## 1. TOKENS DE COLOR (LIGHT + DARK)

### 1.1 Brand & Identity Tokens
| Token | Valor Hex | Uso Semántico |
|---|---|---|
| `brand-amber` | `#F59E0B` | Color insignia One Burger. Badge del sidebar, acentos gastronómicos, calor de parrilla. |
| `brand-amber-hover` | `#D97706` | Hover en botones ámbar y bordes activos de producción. |
| `brand-amber-light` | `#FEF3C7` | Fondos de advertencia, badges y chips de rol Master. |
| `brand-yellow` | `#EAB308` | Acento secundario (calor de pan brioche, modificadores especiales). |
| `brand-primary` | `#38BDF8` | Sky 400. Acción primaria en Admin/POS, foco en inputs, links activos. |
| `brand-primary-hover` | `#0EA5E9` | Sky 500. Hover primario. |
| `brand-primary-muted` | `rgba(56, 189, 248, 0.12)` | Fondo de chips informativos y estado activo suave. |

### 1.2 Dark Mode Matrix (Estándar KDS & Admin Operativo)
| Categoría de Token | Variable CSS | Valor Hex / RGBA | Propósito & Jerarquía |
|---|---|---|---|
| **Canvas** | `--bg-canvas` | `#000F21` | Base del lienzo oscuro más profundo. |
| **Surface Base** | `--bg-surface` | `#031427` | Fondo principal de pantalla y columnas. |
| **Surface Low** | `--bg-surface-low` | `#0B1C30` | Sidebar, contenedores de agrupación, cabeceras fijas. |
| **Surface Card** | `--bg-surface-card` | `#132438` | Tarjetas de pedidos, productos POS, modales. |
| **Surface Elevated** | `--bg-surface-elevated`| `#1A2D46` | Estados de hover, dropdowns, popovers flotantes. |
| **Surface Input** | `--bg-surface-input` | `#06182B` | Campos de texto, inputs de búsqueda y filtros. |
| **Border Subtle** | `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Divisores de fila, bordes de contenedor estándar. |
| **Border Medium** | `--border-medium` | `rgba(255, 255, 255, 0.14)` | Bordes de tarjeta interactiva, inputs en reposo. |
| **Border Strong** | `--border-strong` | `rgba(255, 255, 255, 0.25)` | Bordes activos y separadores de secciones clave. |
| **Border Focus** | `--border-focus` | `#38BDF8` | Anillo de foco (ring 2px) accesible. |
| **Text Primary** | `--text-primary` | `#F8FAFC` (Slate 50) | Títulos, precios, números de ticket, datos clave. |
| **Text Secondary**| `--text-secondary`| `#94A3B8` (Slate 400) | Subtítulos, labels descriptivos, canales de origen. |
| **Text Muted** | `--text-muted` | `#64748B` (Slate 500) | Breadcrumbs, shortcuts (⌘K), metadatos secundarios. |
| **Text Inverse** | `--text-inverse` | `#000F21` | Texto sobre badges ámbar o verde brillante. |

### 1.3 Light Mode Matrix (Facturación & Terminales Diurnas)
| Categoría de Token | Variable CSS | Valor Hex / RGBA | Propósito & Jerarquía |
|---|---|---|---|
| **Canvas** | `--bg-canvas-light` | `#F8FAFC` (Slate 50) | Fondo general limpio sin blanco clínico puro. |
| **Surface Base** | `--bg-surface-light` | `#FFFFFF` | Tarjetas y contenedores principales con sombra suave. |
| **Surface Low** | `--bg-surface-subtle-light`| `#F1F5F9` (Slate 100)| Sidebar, cabeceras de columnas, cajas secundarias. |
| **Border Default** | `--border-light` | `#E2E8F0` (Slate 200) | Bordes estructurales en light mode. |
| **Border Strong** | `--border-strong-light`| `#CBD5E1` (Slate 300) | Bordes de inputs y separadores marcados. |
| **Text Primary** | `--text-primary-light`| `#0F172A` (Slate 900) | Títulos y cifras principales. |
| **Text Secondary**| `--text-secondary-light`| `#475569` (Slate 600)| Etiquetas y subtítulos. |
| **Text Muted** | `--text-muted-light` | `#94A3B8` (Slate 400) | Shortcuts y datos auxiliares. |

### 1.4 Lifecycle & Operational Semantic Tokens
| Estado Operativo | Background Token | Border Token | Text Token | Indicador / Dot |
|---|---|---|---|---|
| **Recepción (Por aceptar)** | `rgba(56, 189, 248, 0.12)` | `rgba(56, 189, 248, 0.35)` | `#38BDF8` | `#0284C7` (Sky 600) |
| **Producción (En preparación)**| `rgba(245, 158, 11, 0.12)`| `rgba(245, 158, 11, 0.40)`| `#F59E0B` | `#D97706` (Amber 600) |
| **Despacho (Listas para entrega)**| `rgba(16, 185, 129, 0.12)`| `rgba(16, 185, 129, 0.40)`| `#34D399` | `#10B981` (Emerald 500) |
| **Alerta SLA (Atrasado > 15m)**| `rgba(239, 68, 68, 0.20)` | `#EF4444` | `#F87171` | `#DC2626` + `animate-pulse` |
| **Inactivo / Cancelado** | `rgba(100, 116, 139, 0.12)`| `rgba(100, 116, 139, 0.30)`| `#94A3B8` | `#64748B` (Slate 500) |

---

## 2. TIPOGRAFÍA COMPLETA

### 2.1 Familias Tipográficas
* **UI Sans-Serif:** `'Plus Jakarta Sans'`, system-ui, -apple-system, BlinkMacSystemFont, sans-serif.  
  *Uso:* Interfaces de navegación, etiquetas, botones, modales y títulos.
* **Monospace & Tabular:** `'JetBrains Mono'`, `'Roboto Mono'`, monospace; con propiedad CSS `font-variant-numeric: tabular-nums`.  
  *Uso Mandatorio:* Todos los precios (`C$ 305.00`), cronómetros (`22:45 min`), IDs de ticket (`#1038`), PIN de cliente (`PIN: 849`) y contadores de stock/arqueo.

### 2.2 Escala Tipográfica (Type Scale)
| Nivel | Size (px / rem) | Line-Height | Tracking | Weight | Uso Principal |
|---|---|---|---|---|---|
| **Display / Hero** | `32px` / `2.0rem` | `1.15` (`36px`) | `-0.03em` | ExtraBold (800) | Totales principales de caja / Arqueo masivo. |
| **Heading 1 (H1)** | `24px` / `1.5rem` | `1.2` (`28px`) | `-0.025em`| ExtraBold (800) | Títulos de módulo (`Comandas`, `Punto de venta`). |
| **Heading 2 (H2)** | `20px` / `1.25rem` | `1.25` (`24px`) | `-0.02em` | Bold (700) | Títulos de sección, ID de ticket en tarjeta (`#1038`). |
| **Heading 3 (H3)** | `16px` / `1.0rem` | `1.3` (`20px`) | `-0.015em`| SemiBold (600) | Nombres de producto en tarjeta, cabecera de modales. |
| **Body Large** | `15px` / `0.9375rem`| `1.4` (`21px`) | `0` | Medium (500) | Modificadores de cocina, ítems desglosados de pedido. |
| **Body Standard** | `14px` / `0.875rem` | `1.4` (`20px`) | `0` | Regular (400) / Med (500)| Textos de navegación del sidebar, datos de formulario. |
| **Caption / Meta** | `12px` / `0.75rem` | `1.3` (`16px`) | `+0.01em` | Medium (500) / Semi (600)| Timers relativos (`Hace 2m`), direcciones de local. |
| **Overline / Micro** | `10px` / `0.625rem`| `1.2` (`12px`) | `+0.08em` | Bold (700) UPPERCASE | Grupos de sidebar (`OPERACIÓN`), tags de estación. |

---

## 3. ESPACIADO (ESCALA ESTRICTA DE 4PX)

| Token Tailwind | Dimensión (px) | Propósito Ergonómico |
|---|---|---|
| `space-1` (`p-1`, `gap-1`) | `4px` | Separación entre iconos y micro-textos, dots de estado. |
| `space-1.5` | `6px` | Padding interno de pills y tags muy compactos. |
| `space-2` (`p-2`, `gap-2`) | `8px` | Gap estándar entre items de listas compactas, padding de botones micro. |
| `space-2.5` | `10px` | Padding horizontal en badges y chips de estación. |
| `space-3` (`p-3`, `gap-3`) | `12px` | Gap de formularios en paneles laterales, padding interno de inputs. |
| `space-4` (`p-4`, `gap-4`) | `16px` | Espacio entre tarjetas, padding estándar de tarjetas medianas. |
| `space-5` (`p-5`, `gap-5`) | `20px` | Padding interior de tarjetas de ticket KDS y productos POS. |
| `space-6` (`p-6`, `gap-6`) | `24px` | Padding general de módulos, modales y cabeceras operativas. |
| `space-8` (`p-8`, `gap-8`) | `32px` | Padding exterior de canvas y separación entre bloques mayores. |
| `space-12` (`p-12`) | `48px` | Padding vertical en estados vacíos (Empty States con alma). |

---

## 4. RADIUS (SISTEMA DE BORDES REDONDEADOS)

| Token | Dimensión (px) | Aplicación en Interfaz |
|---|---|---|
| `radius-xs` | `4px` | Checkboxes, barras de progreso internas y tags microscópicos. |
| `radius-sm` | `8px` | Badges de cantidad (`2x`), selector de cantidad y micro-botones. |
| `radius-md` | `12px` | Inputs de formulario, botones secundarios, dropdown items. |
| `radius-lg` | `16px` | Botones de acción táctil principales (`h-11`), cards de tickets KDS, cards de producto POS. |
| `radius-xl` | `20px` | Contenedores de columnas Kanban, drawers laterales (`Venta en curso`), modales. |
| `radius-2xl`| `24px` | Grandes contenedores de canvas, tarjetas modales de arqueo de caja. |
| `radius-full`| `9999px` | Avatares circulares, pills de status (`● En preparación: 4`), toggle switches. |

---

## 5. SOMBRAS POR ELEVACIÓN (ELEVATION MATRIX)

Diseñado para mantener nitidez en pantallas de alto brillo sin generar bordes nebulosos sucios.

| Nivel de Elevación | Regla CSS / Tailwind | Aplicación |
|---|---|---|
| **Elevation 0 (Flat)** | `none` | Canvas base, columnas integradas al lienzo. |
| **Elevation 1 (Subtle)** | `box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.06);` | Tarjetas de ticket en reposo, inputs inactivos. |
| **Elevation 2 (Medium)** | `box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(255, 255, 255, 0.08);` | Tarjetas al hacer hover, barra de navegación superior sticky. |
| **Elevation 3 (High)** | `box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.12);` | Dropdowns desplegados, cajón lateral de venta en curso. |
| **Elevation 4 (Modal)** | `box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.16);` | Modal de edición de horarios, arqueo de apertura/cierre. |
| **Glow Amber** | `box-shadow: 0 0 20px -2px rgba(245, 158, 11, 0.35);` | Botones principales de acción KDS (`✓ Marcar listo`). |
| **Glow Critical (SLA)** | `box-shadow: 0 0 20px 2px rgba(239, 68, 68, 0.45);` | Tarjeta o badge pulsante de orden demorada (>15m). |

---

## 6. CATÁLOGO DE COMPONENTES CON VARIANTES

### 6.1 Touch Action Button (Ergonómico, mínimo 44px)
* **Propósito:** Ejecución táctil instantánea por cocineros o cajeros.
* **Variantes:**
  * `Primary Sky`: `bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold h-11 px-5 rounded-xl`.
  * `Action Amber`: `bg-amber-500 hover:bg-amber-600 text-slate-950 font-black h-12 px-5 rounded-xl shadow-lg shadow-amber-500/20`.
  * `Action Emerald`: `bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-11 px-5 rounded-xl`.
  * `Secondary Ghost/Outline`: `bg-transparent hover:bg-white/5 border border-white/15 text-slate-300 h-11 px-4 rounded-xl`.
  * `Destructive Outline`: `bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 h-11 px-4 rounded-xl`.

### 6.2 KDS Operational Ticket Card
* **Estructura Estándar:**
  1. Header: Número `#1038` (20px font-mono) + Canal badge (`Takeout`, `Mostrador`, `Mesa 4`) + Cronómetro (`22:45 min`).
  2. Cliente: Nombre, teléfono enmascarado (`+505 8821-4432`) y PIN visible (`PIN: 849`).
  3. Lista de Ítems: Badge `2x` en ámbar translúcido, nombre del plato, sub-balas de modificadores (`• Sin cebolla`) y nota del chef.
  4. Tracker de Cocina: Barra de avance (`Plancha: Listo → Armado: En proceso → Empaque: Pendiente`).
  5. Footer de Acción: Botón ancho `h-11` (`✓ Marcar listo` o `✓ Aceptar orden`).

### 6.3 POS Product Grid Card
* **Variante con Selección en Carta (Burgers):** Imagen gastronómica apetitosa + Tag de categoría + Nombre + Precio en `font-mono text-lg font-black` + Botón selector táctil `+`.
* **Variante de Agregado Directo (Bebidas / Sides):** Card compacta con icono/foto + Título + Volumen/Descripción + Botón ancho `+ Agregar`.

### 6.4 Order Drawer (Panel Lateral de Venta en Curso)
* **Variante Vacía (Empty):** Ilustración vectorial de comanda/bolsa + Mensaje amigable *"Agregá productos del catálogo para armar la venta"* + Indicador de estado sincronizado.
* **Variante Activa:** Lista itemizada con stepper `[-] [1] [+]`, desglose financiero (`Subtotal`, `Descuento`, `Total a cobrar` en `text-3xl font-black font-mono text-sky-400`), selector segmentado `[ Efectivo ] [ Tarjeta ]` y campo de cálculo de cambio instantáneo (`CAMBIO: C$ 0.00`).

### 6.5 Operational Command Header
* **Componentes integrados:**
  * Selector de sucursal (`Camino de Oriente`, `Carretera Masaya`, `Casa Antigua`).
  * Indicador de sync en vivo (`● Sincronizado` con pulso esmeralda).
  * Live SLA Badges: Píldoras compactas (`● Nuevas: 3`, `● En preparación: 4`, `● Listas: 2`, `● Atrasadas: 1`).
  * Preparación promedio: `14m 20s` (`tabular-nums font-mono`).
  * Controles de terminal: Botón de alerta sonora con toggle, pantalla completa y sync manual.

---

## 7. ESTADOS POR COMPONENTE (STATE MATRIX)

Para cada componente del sistema se definen obligatoriamente sus estados de interacción:

| Componente | Default (Reposo) | Hover | Active / Pressed | Disabled | Focus-Visible | Error / SLA Alert |
|---|---|---|---|---|---|---|
| **Botón Primario** | `bg-sky-400 text-slate-950` | `bg-sky-300 transform scale-[1.01]` | `bg-sky-500 scale-[0.99]` | `opacity-40 cursor-not-allowed` | `ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950` | N/A |
| **Ticket KDS** | `bg-surface-card border-white/10` | `border-white/20 bg-surface-elevated` | `border-amber-400` | N/A | N/A | `border-rose-500 bg-rose-950/40 animate-pulse` |
| **Input / Search** | `bg-[#06182B] border-white/10 text-white` | `border-white/20` | `border-sky-400` | `bg-slate-900/50 text-slate-600` | `border-sky-400 ring-2 ring-sky-400/20` | `border-rose-500 ring-2 ring-rose-500/20` |
| **Nav Sidebar Item**| `text-slate-400 hover:text-white` | `bg-white/5 text-slate-200` | `bg-slate-800/80 border border-white/10 text-white font-bold` | `opacity-30` | `ring-1 ring-white/20` | N/A |
| **Empty State** | `bg-slate-900/30 border-dashed border-white/10` | N/A | N/A | N/A | N/A | N/A |

---

## 8. REGLAS DE USO VINCULANTES (CUÁNDO USAR CADA ELEMENTO)

1. **Cuándo usar Monospace (`font-mono`) vs Sans-Serif (`font-sans`):**
   * *Regla:* Si el valor cambia dinámicamente o representa una cifra financiera, timer o ID, es **mandatorio `font-mono`**. Si es un nombre, título o texto explicativo, usa `font-sans`.
   * *Justificación:* Evita que la interfaz "tiemble" o salte visualmente al actualizarse cronómetros y totales.

2. **Cuándo usar Ámbar (`#F59E0B`) vs Azul Cielo (`#38BDF8`):**
   * *Ámbar:* Reservado para la identidad One Burger (badge principal), etapa de cocina/preparación caliente y llamada de acción principal de comanda lista.
   * *Azul Cielo:* Usado para acciones técnicas de administración, navegación primaria, botones de confirmación POS y links del sistema.

3. **Cuándo aplicar `animate-pulse`:**
   * Únicamente en tickets que hayan excedido el SLA objetivo (>15 minutos en preparación) o cuando haya una pérdida temporal de sincronización. **Prohibido** usar animaciones continuas en tickets normales para no fatigar la vista del personal.

4. **Regla del 20% de presupuesto vertical:**
   * La cabecera, filtros y utilidades nunca deben superar el 20% del alto del monitor. El 80%+ de la superficie táctil pertenece a las tarjetas de pedidos o al catálogo de venta.

5. **Antialucinación de datos territoriales:**
   * La moneda es siempre Córdobas (`C$` / `NIO`), el código de país es `+505` y las sucursales oficiales son estrictamente: `Camino de Oriente`, `Carretera Masaya` y `Casa Antigua`.
