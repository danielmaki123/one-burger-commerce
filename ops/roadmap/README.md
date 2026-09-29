# One Burger — roadmap de producto y UX (índice)

**Este paquete tiene un solo roadmap**: [`PRODUCT-UX-ROADMAP.md`](PRODUCT-UX-ROADMAP.md), el **roadmap maestro
de producto y UX** —con el orden autoritativo de 16 pasos, las leyes que aplica y el Design Freeze—.

- [`PRODUCT-UX-ROADMAP.md`](PRODUCT-UX-ROADMAP.md) — **el roadmap maestro** y las reglas del proceso.
- [`NEXT.md`](NEXT.md) — la secuencia inmediata (`ACTIVE` / `NEXT` / `LATER`), corta a propósito.
- [`EXECUTION-MAP.md`](EXECUTION-MAP.md) — **qué falta de verdad en cada orden 5b→16**: estado real auditado,
  dependencias, `REUSE` obligatorio, `MOVE`/`CONSOLIDATE`, `NEW` real, deuda asignada, fuera de alcance y gate
  de cierre. **No es un segundo roadmap**: no decide orden.
- [`DECISIONS.md`](DECISIONS.md) — las decisiones **ya cerradas** del owner, como registro; no son leyes.

## Reglas de autoridad

- Las **leyes del repo** (Reuse First, Reuse Audit, One Canonical Flow, Single Owner, Reference Fidelity,
  Viewport Contract, la del **dueño único de la configuración con snapshot** y Design Freeze) se enuncian
  **una sola vez** en [`../../AGENTS.md`](../../AGENTS.md) § *Leyes del repo*. Acá no se repiten.
- La **arquitectura de producto y de módulos** —hoy y objetivo— vive en
  [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md); **qué posee cada módulo**, en
  [`../product/MODULE-OWNERSHIP.md`](../product/MODULE-OWNERSHIP.md), y **qué reutiliza cada capacidad y quién
  es su dueño hoy**, en [`../product/CAPABILITY-REUSE-MAP.md`](../product/CAPABILITY-REUSE-MAP.md).
- La **ley visual** vive en [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md).
- El **programa de remediación técnica** (hallazgos `A-*`) vive en
  [`../tasks/AUDIT-REMEDIATION-ROADMAP.md`](../tasks/AUDIT-REMEDIATION-ROADMAP.md): es el **qué** técnico, no
  el orden de producto.
- **No se mantiene un segundo roadmap.** Si algo no está en el orden de §2 del roadmap maestro, no está
  planificado. Las fases históricas (`ROADMAP-001`, las fases `ARCH-001`/`DS-001`/`IA-001`) quedaron cerradas
  y su estado está en [`../CURRENT.md`](../CURRENT.md).

**Estado de las fases**: `A-15` y la estabilización técnica **cerradas** · `ARCH-001` **cerrada**
([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)) · `DS-001` **aprobada y desplegada**
([`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md)) · `IA-001` **cerrada y desplegada** ·
`SCREEN-ORDERS-001` y `SCREEN-POS-QUICK-SALE-001.2` **cerradas y desplegadas** · `TASK-GOV-001` **cerrada** ·
`TASK-ORDERS-KITCHEN-FOUNDATIONS-001` **cerrada** · **`Cocina runtime` (3b), `Money` y `Payments` (4 y 5, con
su cierre de aceptación) CERRADAS Y DESPLEGADAS** · lo que sigue es **`Pedidos runtime`** (orden **5b**):
`/admin/orders` denso y paginado, y el detalle con su historia y su estado de cobro.
