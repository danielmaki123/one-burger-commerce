---

> **ARCHIVED / NON-NORMATIVE** — Documento histórico. **No es ley**: la ley visual vigente vive en ops/design/DESIGN_SYSTEM.md (Design System v4, DS-001). Se conserva como evidencia; no es lectura obligatoria, no decide diseños nuevos y su HTML no se copia: se traduce a componentes del repo.
name: Kitchen Dispatch & Operational Hub
colors:
  surface: '#031427'
  surface-dim: '#031427'
  surface-bright: '#2a3a4f'
  surface-container-lowest: '#000f21'
  surface-container-low: '#0b1c30'
  surface-container: '#102034'
  surface-container-high: '#1b2b3f'
  surface-container-highest: '#26364a'
  on-surface: '#d3e4fe'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#d3e4fe'
  inverse-on-surface: '#213145'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#ffbcbf'
  on-tertiary: '#67001b'
  tertiary-container: '#ff929a'
  on-tertiary-container: '#8c0028'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#031427'
  on-background: '#d3e4fe'
  surface-variant: '#26364a'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  counter-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 1.75rem
    letterSpacing: -0.02em
  counter-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: 1.25rem
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-md: 1rem
  margin: 1rem
  margin-lg: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets high-pressure culinary and logistics operators: kitchen expeditors, station cooks, dispatch coordinators, and delivery aggregators. The interface operates in ambient heat, varying lighting, and rapid decision-making environments where split-second recognition prevents delayed orders and SLA breaches.

The visual direction rejects sterile flat white sheets in favor of **High-Density Tactile Utility**. Drawing from modern industrial consoles and aviation dispatch software, the system relies on deeply layered neutral slate and zinc surfaces, subtle borders, and razor-sharp typographic hierarchy. Primary interactions convey precision, steadiness, and zero friction.

Key design attributes:
- **Calm Authority:** Balanced low-strain neutral tones prevent eye fatigue during 12-hour shifts under commercial kitchen fluorescent or LED fixtures.
- **Glanceable Hierarchy:** Immediate visual routing via muted surface steps, high-contrast critical tokens, and dedicated SLA accent callouts.
- **Physical Resilience:** Every actionable surface accommodates both touch display taps (greased fingers, kitchen gloves) and rapid desktop keyboard navigation.

## Colors

The palette operates in a default deep-neutral dark mode constructed with slate and zinc foundation tones to eliminate glare, reduce power consumption on wall-mounted touch displays, and create rich contrast against bright order status tokens.

### Surface Tiers
- **Base Canvas (`#090D16`):** The structural viewport foundation behind columns and global framing.
- **Surface Level 1 (`#0F172A`):** Enterprise rail sidebar, compact command bar, and structural kanban columns.
- **Surface Level 2 (`#1E293B`):** Active order cards, interactive table rows, and modular command popovers.
- **Surface Level 3 (`#334155`):** Sub-cards, modifier groups, nested ticket items, and hover fills.
- **Border Subtle (`#1E293B`):** Primary boundary separating columns and panels.
- **Border Defined (`#334155`):** Structural card outlines and input bounds.

### Functional Status System
Semantic colors are strictly reserved for operational state signaling; they are never used decoratively:
- **Received / Queued:** Ice Blue tint (`#38BDF8`) on deep slate badge container (`#0C4A6E` at 30% opacity).
- **In Kitchen / Cooking:** Neutral Slate (`#94A3B8`) on subtle surface tint, indicating active production without emergency.
- **Ready for Dispatch:** Emerald Mint (`#10B981`) on forest shade container (`#064E3B` at 35% opacity), directing immediate runner action.
- **Urgent SLA Warning:** Amber Flame (`#F59E0B`) for tickets within 3 minutes of SLA breach.
- **SLA Breached / Alert:** Vivid Rose (`#F43F5E`) with pulsating indicator ring for delayed or flagged tickets.

## Typography

The type system blends structural geometric clarity with ultra-legible utilitarian body text. **Plus Jakarta Sans** provides sturdy, friendly yet authoritative section framing, while **Inter** delivers crisp legibility for multi-line order tickets, item descriptions, and modification notes.

### Tabular Numerals & Monospace Alignment
All counters, countdown timers, order reference codes, and timestamps must render with fixed-width tabular figures (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" on, "zero" on`). This prevents visual jumping or layout shift during rapid 1-second interval renders across multiple dispatch lanes.

### Scale Rules
- **Order Numbers (`headline-md` / `counter-lg`):** Bold, high contrast, scannable from a 6-foot kitchen distance.
- **Item Modifications (`label-md` / `body-sm`):** Placed with distinct weight differences (Semi-Bold for exclusions/allergies, Regular for standard additions) to prevent prep errors.
- **Metadata and Timestamps (`label-sm`):** High uppercase definition with expanded letter-spacing (+0.04em) for immediate parsing.

## Layout & Spacing

The layout is built upon an aggressive vertical conservation principle: **the top command bar must not exceed 48px to 56px in total height**, ensuring 85% or more of the vertical display is reserved for active kanban columns and dispatch tracks.

### Grid & Lane Structure
- **Kanban Columns:** Fluid horizontal distribution with strict minimum lane widths (320px minimum on desktop; horizontal swipe snapping on tablet screens).
- **Column Header & Flow:** 40px rigid lane header anchoring ticket counts and aggregated preparation times, followed by a continuous scrollable ticket lane with `space-sm` gaps between tickets.
- **Command Rail (Sidebar):** 56px collapsed width displaying primary station navigation icons, expandable to 240px drawer overlay when accessing full dispatch settings and shift handoff tools.

### Breakpoints & Adaptive Reflow
- **Kitchen Display Tablet (768px – 1024px):** Single-station mode or split dual-column view. Action buttons expand to full card width. Sidebar automatically collapses into an auto-hiding edge-docked strip.
- **Expedite Console (1024px – 1440px):** 3 to 4 lane layout covering full pipeline (Received, Kitchen, Staged, Dispatched).
- **Overhead Wall Display (1440px+):** 5 to 6 dense lanes with maximum visible ticket cards per lane; scrollbars remain hidden with visual bottom fade indications.

## Elevation & Depth

To avoid visual murkiness in low-contrast ambient environments, depth is communicated through **tonal surface stacking paired with sharp micro-borders (1px)** rather than blurry or expansive drop shadows.

- **Level 0 (Backdrop Canvas):** `#090D16` solid.
- **Level 1 (Column Containers & Rail):** `#0F172A` with a 1px border of `#1E293B`.
- **Level 2 (Active Order Cards):** `#1E293B` resting on Level 1. Borders use `#334155`. Cards carry a subtle directional ambient rim: `0 1px 2px 0 rgba(0, 0, 0, 0.45)`.
- **Level 3 (Focused / Dragged / Selected State):** `#253349` with border token shifted to primary accent `#38BDF8` (or semantic state tone). Shadow expands to `0 8px 16px -4px rgba(0, 0, 0, 0.6)`.
- **SLA Breach Warning Elevation:** Ambient glow using tint-focused box shadow: `0 0 0 1px #F43F5E, 0 4px 12px rgba(244, 63, 94, 0.25)`.

## Shapes

The design language uses the **Soft (1)** roundedness tier. In a dense operational workstation, excessive curvature wastes screen canvas and softens the industrial, no-nonsense utility required by line cooks and dispatch managers.

- **Primary Cards & Columns:** 0.25rem (`4px`) or 0.375rem (`6px`) maximum corner radii to keep edge lines crisp and card grids compact.
- **Interactive Badges & Chips:** 0.25rem (`4px`) outer radius; pills are strictly avoided except for live dot pulses and active notification pips.
- **Touch Targets:** Interior buttons inside cards use 0.25rem radius to cleanly align with card borders and internal gutters.

## Components

### 1. Order Tickets (Kanban Cards)
- **Minimum Interactive Dimension:** Card action triggers (e.g., "Bump Ticket", "Recall", "Print") must satisfy a minimum tap footprint of 44px x 44px.
- **Structure:**
  - *Header Strip:* Order ID (`#E2E8F0`, semi-bold), channel icon (UberEats, DoorDash, POS, Direct Web), and live tabular SLA countdown timer.
  - *Body List:* Item quantities in solid high-contrast chips (`#334155`), item names (`#F8FAFC`), and indented allergen/modifier tags colored in distinct warning amber or high-contrast silver.
  - *Footer Action Zone:* Large primary bump target spanning the bottom edge with tactile hit-state visual feedback (instant surface flash to `#38BDF8`).

### 2. Status Badges & SLA Counters
- Constructed with a 1px inner border and a 12% opacity tinted background matching the status color.
- Always accompanied by an icon or tabular numeral; color is never the sole vehicle of status information.
- SLA timers transition dynamically:
  - `> 10 min remaining`: Neutral Slate badge.
  - `< 5 min remaining`: Warning Amber badge with steady icon.
  - `Overdue`: Rose badge with 1-second CSS border pulse.

### 3. Compact Command Header
- Height pinned at 48px.
- Houses station selector dropdown, global search with hotkey cue (`/`), bulk-bump control, aggregate kitchen speed indicator, and emergency pause/throttle switch.
- Retains 85%+ vertical screen clearance for operations.

### 4. Collapsible Enterprise Sidebar
- Collapsed width: 56px. Displays icon stack (Active Dispatch, Station Routing, Menu Throttling, Historical Analytics).
- Footer features a micro-profile card: avatar initials, station name ("Station 02 - Saute"), and quick connection status dot (green for synced online, amber for offline queue).
- Expands on hover or toggle to reveal shift metrics, expediter name, and kitchen handoff controls.

### 5. Inputs & Form Controls
- Compact 36px inputs on desktop; 44px touch targets on tablet viewports.
- Dark fill (`#090D16`), subtle slate border (`#334155`), and active focus ring in ice blue (`#38BDF8`).
- Checkboxes and radio targets feature rigid 4px radii with a 2px visual gap between indicator and label.

### 6. Empty States
- Subdued, non-distracting slate line illustrations with precise micro-copy ("All orders cleared for Station 02. Stand by for inbound drops.").
- Accompanied by a quick-test "Simulate Test Ticket" action for pre-shift prep verification.
