# One Burger — Decisions Register

Decisiones **ya tomadas** por el owner, como registro, para no reabrirlas sin evidencia nueva. **No son
leyes**: las leyes del repo se enuncian una sola vez en [`../../AGENTS.md`](../../AGENTS.md) § *Leyes del
repo*, y donde una decisión de acá coincide con una ley, **manda la ley** (acá queda el registro de cuándo y
por qué se decidió).

## D-001 — No migración masiva de UI
Las pantallas se revisan una por una.

## D-002 — Arquitectura antes que Design System aplicado
Primero `ARCH-001`; después `DS-001`. Ninguna rediseña pantallas.

## D-003 — Stitch no es normativo
Puede conservarse como historia, no como autoridad.

## D-004 — Resumen es transversal
`/admin` muestra señales; no absorbe dominios.

## D-005 — Sidebar no es sitemap
No toda ruta o feature obtiene entrada en navegación.

## D-006 — Datos configurables son dinámicos
Sucursales, productos, categorías y similares no se hardcodean como listas cerradas.

## D-007 — Theming semántico
Brand configurable; estructura controlada/derivada; estados semánticos protegidos.

## D-008 — Sin colores raw en componentes nuevos
Los componentes consumen tokens de intención.

## D-009 — Premium significa menos ruido
Jerarquía, densidad deliberada, alineación, motion funcional y feedback consistente.

## D-010 — Content Design
No explicar con párrafos una interacción normal que puede entenderse por label, estado y comportamiento.

## D-011 — Métricas defendibles
No mostrar KPI o proyecciones sin fórmula y datos reales defendibles.

## D-012 — Arquitectura de dinero A-15
No borrar historia financiera. Refund y Void/Reversal son explícitos y auditables.

## D-013 — Nueva deuda visual prohibida
Legacy puede permanecer temporalmente; pantalla nueva o rediseñada debe cumplir DS v4.

## D-014 — Capacidades nominales del pedido y el `cashier` en Pedidos
El pedido deja de depender de una sola puerta gruesa. Se separan cinco capacidades nominales: **ver/localizar
pedidos** · **operar Cocina** · **ver los datos financieros del pedido** · **cobrar** · **administrar/anular
operaciones**. Reparto decidido por el owner (2026-09-27): `owner` todo; `manager` Pedidos + Cocina según su
alcance; `kitchen` **sólo Cocina, sin dinero ni documentos financieros**; `cashier` **puede localizar el pedido
que necesita cobrar** desde el flujo canónico (queda resuelta la contradicción `A-66`), pero **no** opera Cocina
ni administra Pedidos. El contrato vive en
[`../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md`](../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md) y **lo
implementa cada TASK de su superficie** (Cocina → `canOperateKitchen` + el recorte financiero del servidor;
Pedidos → `canViewOrders` + `canViewOrderFinancials`).

## D-015 — `Order.source`: el canal de origen se escribe, no se adivina
El canal (menú público / POS) es una **propiedad de `orders`** que se escribe **al crear** el pedido. Prohibido
inferirlo desde `Payment`, el nombre «Mostrador», el turno, el medio de pago o cualquier heurística. La
migración es **aditiva y nullable**: `null` = «no declarado» en los pedidos anteriores a la columna y **no se
reconstruye** el pasado (ley 7). Aprobada por el owner el 2026-09-27 en
[`../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md`](../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md).
