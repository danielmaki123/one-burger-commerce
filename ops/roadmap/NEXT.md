# Next — Secuencia inmediata

## Ahora

`ARCH-001 — Product & Module Architecture` (en curso). A-15 y la fase de estabilización técnica quedaron
**cerradas** el 2026-09-25: el estado real está en [`../CURRENT.md`](../CURRENT.md).

## Después
1. `ARCH-001 — Product & Module Architecture`
2. Revisión del owner
3. `DS-001 — One Burger Design System v4`
4. Revisión del owner
5. `SCREEN-001 — /admin Resumen`

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
