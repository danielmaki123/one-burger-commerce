# One Burger — Product & UX Roadmap

Este paquete consolida el nuevo orden de trabajo acordado para One Burger.

## Propósito

Evitar rehacer arquitectura, UX y UI varias veces.

Orden oficial:

1. cerrar A-15 y la fase de estabilización;
2. definir la arquitectura mínima de producto y módulos;
3. definir el Design System v4 como única ley visual;
4. rediseñar e implementar una sección por vez;
5. aplicar arquitectura + information architecture + UX + Design System en una sola pasada por sección.

## Archivos

- [`PRODUCT-UX-ROADMAP.md`](PRODUCT-UX-ROADMAP.md) — roadmap maestro y reglas del proceso.
- [`DECISIONS.md`](DECISIONS.md) — decisiones del owner ya cerradas.
- [`NEXT.md`](NEXT.md) — secuencia operativa inmediata.

## Regla de autoridad

Este paquete es un roadmap de trabajo. No reemplaza todavía a las futuras leyes normativas:

- `ops/product/MODULE_ARCHITECTURE.md`
- `ops/design/DESIGN_SYSTEM.md`

Esos archivos serán creados por las TASKs correspondientes y, una vez aprobados, serán las fuentes normativas del producto y del diseño.

## Vigencia

- El roadmap **no** cambia reglas vigentes por sí solo: cada fase entra en vigor cuando su TASK se mergea y
  ese avance se anota acá.
- **Estado de las fases**: A-15 y la fase de estabilización técnica **cerradas** (2026-09-25) · `ARCH-001`
  **cerrada** el 2026-09-25 ([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)) · `DS-001`
  **aprobada y desplegada** el 2026-09-26 ([`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md)) ·
  `SCREEN-001` **no iniciado**.
- La ley visual vigente es [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md), que declara a Stitch
  **archivado y no normativo** (`D-003` ya aplicada por `DS-001`).
