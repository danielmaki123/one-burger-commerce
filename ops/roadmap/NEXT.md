# Next — Secuencia inmediata

## Ahora

`DS-001 — One Burger Design System v4` **aprobado y desplegado** (baseline del 2026-09-26,
`build-20260926-003808` sobre `4dc2cbb`, con smokes y QA en [`../CURRENT.md`](../CURRENT.md) §1). La ley visual
vive en [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) y el material de Stitch quedó **archivado y
no normativo**. `ARCH-001` ([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)) y la
fase de estabilización técnica también están cerradas.

## Después
1. **`SCREEN-001 — /admin Resumen`**: **no iniciado**. El camino es producto + arquitectura + IA + UX →
   mockup canónico → revisión del owner → implementación bajo DS v4 (skill `screen-design`).
2. **Revisión del owner de `ARCH-001`** — las divergencias registradas (Resumen/POS en la navegación, el
   dominio de Caja repartido) siguen siendo decisiones suyas.

## SCREEN-001 no empieza con código

Primero resolver:

- propósito;
- datos actuales;
- jerarquía;
- señales;
- accesos contextuales;
- sucursales dinámicas;
- desktop/mobile;
- elementos a eliminar.

Después implementar una sola vez bajo DS v4.

## Stop conditions

Detenerse si:

- aparece una decisión de producto no definida;
- se requiere mover/reparar datos de producción;
- aparece una operación destructiva;
- una nueva sección/módulo necesita decisión del owner;
- una métrica no puede defenderse con datos reales.
