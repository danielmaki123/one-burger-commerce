# Next — Secuencia inmediata

## Ahora

**`SCREEN-POS-QUICK-SALE-001.1 — POS Fase 1 / Venta rápida` CERRADA: la Fase 1 está COMPLETA** (2026-09-26).
La 001 (PR #62, `be4c051`, `build-20260926-170322`) convirtió la Venta rápida en un **workspace
`CATÁLOGO | VENTA`** —ticket anclado al viewport en escritorio, barra + sheet en celular y tablet y opciones
secundarias bajo demanda— y la **001.1** la corrigió contra la **referencia revisada del owner** (hero fuera,
barra operativa de una línea, acciones de caja solo donde bloquean el cobro, `Cobrar pedido del menú` fuera del
POS, catálogo y ticket a alto útil) y le agregó los guardrails de **reuse-first**, **one canonical flow**,
**reuse audit**, **reference fidelity** y **viewport contract**. La spec canónica vive en
[`../design/screens/pos-quick-sale.md`](../design/screens/pos-quick-sale.md); el deploy (`build-20260926-202551`
sobre `3c6951a`), la **QA autenticada de producción a los cuatro viewports** (`1366×768`, `1280×720`,
`768×1024`, `375×812`) y los dos smokes están en [`../CURRENT.md`](../CURRENT.md) §1 y §4. **La Fase 2 NO se
inició.**

**`SCREEN-ORDERS-001 — Órdenes` cerrada y desplegada** (2026-09-26): es la **primera sección rediseñada de
punta a punta** con el proceso completo —discovery, arquitectura/IA, spec de pantalla, prototipo y capturas,
implementación bajo DS v4, QA de navegador a 375/768/1280 y PR con CI verde—. La spec canónica vive en
[`../design/screens/orders.md`](../design/screens/orders.md) (con el prototipo y las capturas al lado) y lo
que quedó documentado —no corregido de paso— está en [`../audit-backlog.md`](../audit-backlog.md) como
`A-60` a `A-66`. El estado del deploy, en [`../CURRENT.md`](../CURRENT.md) §1.

`DS-001 — One Burger Design System v4` **aprobado y desplegado** (baseline del 2026-09-26,
`build-20260926-003808` sobre `4dc2cbb`, con smokes y QA en [`../CURRENT.md`](../CURRENT.md) §1). La ley visual
vive en [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) y el material de Stitch quedó **archivado y
no normativo**. `ARCH-001` ([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)),
`IA-001` (navegación del panel) y la fase de estabilización técnica también están cerradas.

## Después

1. **`SCREEN-001 — /admin Resumen`**: **no iniciado**. El camino es producto + arquitectura + IA + UX →
   mockup canónico → revisión del owner → implementación bajo DS v4 (skill `screen-design`), igual que se
   hizo en Órdenes.
2. **`POS Fase 2 — pedidos existentes / pagos / bancos / USD / factura`**: la define el owner **aparte**. La
   Fase 1 dejó escrito qué **no** se tocó (banco/procesador en `Payment`, corrección USD del cobro de pedidos
   existentes, promo a un pedido ya creado y el rediseño final de «Cobrar pedido», que ahora vive en
   `A-67`: Órdenes localiza el pedido y el POS lo cobra). **No se inicia sola.**
3. **Deuda de Órdenes (`A-60` a `A-67`)**: por riesgo, primero `A-60` (plata y PIN en el detalle para
   `kitchen`) y `A-61` (proyección del endpoint de la bandeja).
4. **Revisión del owner de `ARCH-001`** — las divergencias registradas (Resumen/POS en la navegación, el
   dominio de Caja repartido) siguen siendo decisiones suyas, y `A-66` (el `cashier` en Órdenes) es la
   primera de la lista.

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
