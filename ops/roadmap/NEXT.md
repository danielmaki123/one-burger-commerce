# Next — Secuencia inmediata

## Ahora

`ARCH-001 — Product & Module Architecture` **cerrada** (2026-09-25): la constitución de producto vive en
[`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md). A-15 y la fase de estabilización
técnica quedaron cerradas el 2026-09-25; el estado real está en [`../CURRENT.md`](../CURRENT.md).

## Después
1. **Revisión del owner de `ARCH-001`** — la constitución es el punto de partida, no un techo: las
   divergencias registradas (Resumen/POS en la navegación, el dominio de Caja repartido) son decisiones suyas.
2. `DS-001 — One Burger Design System v4` (brief separado del owner; **no iniciada**)
3. Revisión del owner
4. `SCREEN-001 — /admin Resumen`

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
