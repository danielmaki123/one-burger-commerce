# DESIGN SYSTEM SPECIFICATION: ONE BURGER (KDS & ADMIN OPERATIVO)
**Version:** 2.0.0 (Production Core & AI Agent Enforceable Directives)  
**Target Environments:** Touch POS Terminals, Kitchen Display Monitors (1.5m–2m viewing distance), High-Density Web Admin  
**Design Engine:** Tailwind CSS / CSS Variables / Semantic Theming Tokens  

---

## 1. CRITICAL RULES FOR AI AGENTS & CODING ENGINES (NON-NEGOTIABLE)

When generating screens, components, or frontend code for One Burger, the agent **MUST STRICTLY OBEY** these inviolable directives:

1. **PROHIBITED: Generic Templates & Plain White Containers:**  
   - NEVER use raw white backgrounds (`#ffffff`, `bg-white`) for base canvases, main app frames, or entire content columns.  
   - Base canvas MUST be dark `#000f21` / `#031427` (or warm layered slate `#f8fafc` in light mode). Containers must use layered surfaces with subtle alpha borders (`border-white/10` or `border-slate-200/80`).
2. **PROHIBITED: Inventing Features or Alphanumeric Hallucinations:**  
   - Currency is STRICTLY Nicaraguan Córdobas (`C$` / `NIO`). Phone codes use `+505`.  
   - Specific local branch names are: `Camino de Oriente`, `Carretera Masaya`, and `Casa Antigua`. Do not invent fictional locations.
3. **MANDATORY: Tabular & Monospace Numbers:**  
   - All financial amounts (`C$ 305.00`), timers (`22:45 min`), order tickets (`#1038`), PIN numbers (`PIN: 849`), and counts MUST use `font-mono` and `tabular-nums`.
4. **MANDATORY: Minimum Touch Target Ergonometry:**  
   - Kitchen and POS buttons MUST have a minimum click/tap target of **44px** (`h-11`, `py-2.5 px-4`). Touch targets smaller than 40px are strictly rejected for operational actions.
5. **MANDATORY: 15–20% Vertical Header Budget:**  
   - Filters, command bars, and navigation headers MUST NOT exceed 20% of the viewport height. 80%+ of the vertical canvas is reserved for operational cards, kanban columns, or data lists.
6. **MANDATORY: Animated & Pulsing SLA Urgency:**  
   - Delayed orders exceeding target SLA (e.g. >15 min) MUST render with high-visibility urgency styling: badge in `#ef4444` / `#b91c1c`, pulsating ring (`animate-pulse`), and unmistakable contrast.

---

## 2. SEMANTIC DESIGN TOKENS (CSS & TAILWIND COMPATIBLE)

```css
:root {
  /* --- Brand & Signature Colors --- */
  --brand-primary: #38bdf8;         /* Sky 400 - Main active accent */
  --brand-primary-hover: #0ea5e9;   /* Sky 500 */
  --brand-amber: #f59e0b;           /* Amber 500 - Food warmth, burger badge, kitchen production */
  --brand-amber-hover: #d97706;     /* Amber 600 */
  --brand-yellow: #eab308;          /* Yellow 500 - Bun warmth */

  /* --- Dark Mode Palette (KDS & Admin Standard) --- */
  --bg-canvas: #000f21;             /* Surface container lowest */
  --bg-surface: #031427;            /* Base dark backdrop */
  --bg-surface-low: #0b1c30;        /* Sidebar, secondary container */
  --bg-surface-card: #132438;       /* Interactive tickets, card surfaces */
  --bg-surface-elevated: #1a2d46;   /* Hover states, dropdowns, modal cards */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);
  --border-focus: #38bdf8;

  /* --- Text & Contrast Hierarchy (Dark Mode) --- */
  --text-primary: #f8fafc;          /* High contrast headlines, ticket IDs (Slate 50) */
  --text-secondary: #94a3b8;        /* Subtitles, labels, helpers (Slate 400) */
  --text-muted: #64748b;            /* Minor tags, shortcuts, breadcrumbs (Slate 500) */
  --text-inverse: #031427;          /* Text on bright badges */

  /* --- Light Mode Palette (Optional Fallback / Invoicing) --- */
  --bg-canvas-light: #f8fafc;
  --bg-surface-light: #ffffff;
  --bg-surface-subtle-light: #f1f5f9;
  --border-light: #e2e8f0;
  --text-primary-light: #0f172a;
  --text-secondary-light: #475569;

  /* --- Operational Semantic Lifecycle Tokens --- */
  /* Stage 1: Reception / Por aceptar */
  --status-pending-bg: rgba(56, 189, 248, 0.12);
  --status-pending-border: rgba(56, 189, 248, 0.35);
  --status-pending-text: #38bdf8;
  --status-pending-dot: #0284c7;

  /* Stage 2: Production / En preparación (Kitchen, Grill) */
  --status-prep-bg: rgba(245, 158, 11, 0.12);
  --status-prep-border: rgba(245, 158, 11, 0.4);
  --status-prep-text: #f59e0b;
  --status-prep-dot: #d97706;

  /* Stage 3: Ready / Listas para entrega (Dispatch, Counter) */
  --status-ready-bg: rgba(16, 185, 129, 0.12);
  --status-ready-border: rgba(16, 185, 129, 0.4);
  --status-ready-text: #34d399;
  --status-ready-dot: #10b981;

  /* Critical: SLA Delay / Atrasado */
  --status-sla-bg: rgba(239, 68, 68, 0.2);
  --status-sla-border: #ef4444;
  --status-sla-text: #f87171;
  --status-sla-pulse: #dc2626;

  /* --- Typography Scale & Weights --- */
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Roboto Mono', monospace;

  /* --- Elevation & Radii --- */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
}
```

---

## 3. LAYOUT & ARCHITECTURE PATTERNS

### 3.1 Persistent Master Sidebar (`w-64` / 256px)
* **Header:**
  * One Burger Badge: Round container (`w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20`).
  * Brand Typography: `One Burger` (Bold, 15px) + `ADMIN OPERATIVO` (`text-[10px] font-bold text-amber-500 tracking-wider uppercase`).
* **Navigation Sections:**
  * Group Labels: `OPERACIÓN` and `CONFIGURACIÓN` in `text-[10px] font-bold uppercase tracking-widest text-slate-400/80 px-4 py-2 mt-4`.
  * Nav Items: `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors`.
  * Active Item: `bg-slate-800/70 border border-white/10 text-white font-semibold shadow-inner`.
  * Badge Counters: Numeric badge in active routes (e.g. `Órdenes: 12`) in rounded pill `bg-amber-500 text-slate-950 font-bold text-xs px-2 py-0.5`.
* **Footer (Operator Card):**
  * Current Operator: User initial avatar (`D`), Full Name (`Daniel`), Role Badge (`Master` in gold pill), and Session status dot (`● Turno activo` in green).
  * Fast Logout / Shift change button with simple outline.

### 3.2 Command Header & Utility Bar (Height ≤ 68px)
* **Breadcrumb & Branch Switcher:** Current store dropdown (`One Burger / Sucursal Central`) + Synchronized indicator (`● Sincronizado` with soft green glow).
* **Live Operational Badges (Single-line metrics):**
  * Pills with micro-dots: `● Nuevas: 3`, `● En preparación: 4`, `● Listas: 2`, `● Atrasadas: 1`.
  * Average Prep Time: `Prep. promedio: 14m 20s` (tabular-nums font-mono).
* **Utility Actions:**
  * Toggle `Aviso sonoro` (Speaker icon with active highlight).
  * `Pantalla completa` (Fullscreen button for touchscreen kitchen mounts).
  * Quick refresh (`12s` countdown or manual refresh button).
* **Global Search & Filter Bar:**
  * Universal input (`max-w-md`) with keyboard shortcut indicator (`/` or `⌘K`) and helper placeholder: `"Número, nombre, WhatsApp o PIN (ej: #1042 o 849)..."`.
  * Payment method filter (`PAGO: Todas / Efectivo / Tarjeta`).
  * Alert Button `Atrasados [N]` in bold red if count > 0.

---

## 4. COMPONENT MATRIX & SPECIFICATIONS

### 4.1 KDS Operational Ticket Card
Every ticket must convey instant operational status at a 2-meter glance:
1. **Ticket Header:**
   * Order ID: `text-2xl font-black font-mono tracking-tight` (e.g., `#1038`).
   * Origin Badge: Channel tag (`Mostrador`, `Takeout / Web`, `Mesa 4 / Salón`).
   * Dynamic Timer Pill:
     * Normal: `bg-slate-800 text-slate-300 font-mono text-sm px-2.5 py-1 rounded-lg`.
     * Delayed (>SLA): `bg-rose-950/80 border border-rose-500 text-rose-300 font-bold animate-pulse flex items-center gap-1.5`.
2. **Customer & Delivery Info:**
   * Name, masked phone (`+505 8821-4432`), and PIN badge (`PIN: 849` in amber tag for fast pickup verification).
3. **Itemized Order List:**
   * Quantity Badge: `2x` / `3x` in high-contrast square badge (`bg-amber-500/20 text-amber-300 font-black text-sm px-2 py-1 rounded-md`).
   * Item Title: `font-bold text-slate-100 text-base`.
   * Kitchen Modifiers (Crucial): Sub-bullet notes in amber/yellow (`• Sin cebolla`, `• Extra queso cheddar`, `• Término 3/4`).
   * Special Chef Notes: Callout box in italics with quotes (`"Bien cocidas las carnes, papas bien doradas"`).
4. **Station Progress Tracker:**
   * Stepper bar: `Plancha: Listo → Armado: En proceso → Empaque: Pendiente`.
5. **Action Buttons (Minimum 44px height):**
   * Primary Action: Full-width button with icon (`✓ Marcar listo para entrega` in solid Amber/Emerald, or `✓ Aceptar orden` in Sky-blue).
   * Secondary Action: Ghost/danger outline (`Rechazar`).

### 4.2 POS Sales Counter & Fast Catalog
1. **Collapsible Cash Register (Arqueo / Caja):**
   * Denomination Inputs: Structured grid for Nicaraguan Córdobas (`NIO 1000`, `500`, `200`, `100`, `50`, `20`, `10`, `5`, `1`).
   * Live sum total in `font-mono text-xl text-amber-400 font-black`.
2. **Tactile Product Grid:**
   * 3-column / 4-column cards with appetizing photography, category pill, high-contrast price tag (`C$ 305.00`), and quick `+` touch trigger.
3. **Order Drawer (Venta en curso):**
   * Pinned right-side panel (`w-80` to `w-96`).
   * Empty state with custom vector cart icon and friendly prompt.
   * Totalizer with calculation breakdown (Subtotal, Descuentos, Total a cobrar in large font `text-3xl font-black font-mono text-sky-400`).
   * Payment toggle switch: `[ Efectivo ]` | `[ Tarjeta ]` with cash calculation field and instant change calculation (`CAMBIO / VUELTO: C$ 0.00`).

### 4.3 Standard Empty States (Never Plain Empty Boxes)
* **Rule:** An empty state must never be a blank dashed box.
* **Composition:**
  1. Centered layout with generous vertical padding (`py-12`).
  2. Muted circular icon container (`w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center`).
  3. Bold status heading in gastronomic tone (*"Parrilla despejada"*, *"Sin comandas entrantes"*, *"Mostrador limpio"*).
  4. Helper text explaining what triggers incoming data.
  5. Live indicator pill at the bottom (`● Esperando solicitudes`, `● Sincronizado`).

---

## 5. DESIGN SYSTEM INSTRUCTIONS FOR CODING AGENTS (PROMPT RULES)

When instructing an LLM or code generator, provide the following prompt block:

```markdown
You are generating production-ready HTML/Tailwind code for the "One Burger" Operations suite.
You MUST adhere to the following strict guidelines:
- Theme: Dark operational palette (background: #000f21, cards: #132438, borders: rgba(255,255,255,0.08), accents: #38bdf8 and #f59e0b).
- Font: Use Plus Jakarta Sans or Inter for interface, JetBrains Mono or tabular-nums for all prices (C$), IDs (#), timers, and PINs.
- Sidebar: Keep persistent left 256px sidebar with One Burger logo (amber badge), operator Daniel (Master), and active section highlight.
- Header: High-density operational bar with store selector, live sync dot, sound toggle, fullscreen button, and search input.
- Touch Targets: Buttons must be at least h-11 (44px) with clear tactile states.
- Data Integrity: Do not hallucinate dummy US names or generic cities. Use Nicaraguan currency (C$ NIO) and real store locations (Camino de Oriente, Carretera Masaya, Casa Antigua).
- SLA Alerts: Delayed tickets must feature animated pulse and rose border styling.
```
