# Next — Secuencia inmediata

## Ahora

`DS-001 — One Burger Design System v4` **escrita y en revisión del owner** (PR abierto, **sin mergear**): la
ley visual vive en [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) y el material de Stitch quedó
**archivado y no normativo** ([`../references/stitch/`](../references/stitch/README.md)). `ARCH-001` quedó
**cerrada** el 2026-09-25 ([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)), y A-15
con la fase de estabilización técnica también; el estado real está en [`../CURRENT.md`](../CURRENT.md).

## Después
1. **Revisión del owner de `DS-001`** — la ley es el punto de partida: lo que no cierre se corrige en la ley,
   no en una pantalla.
2. **Revisión del owner de `ARCH-001`** — las divergencias registradas (Resumen/POS en la navegación, el
   dominio de Caja repartido) son decisiones suyas.
3. `SCREEN-001 — /admin Resumen`: **no iniciado**. Se diseña con `screen-design` (spec aprobada) y recién
   después se implementa bajo DS v4.

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
