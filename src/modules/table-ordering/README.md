# `table-ordering` (carpeta reservada, sin código)

Pedido por QR desde la mesa. Está **fuera del MVP** y esta carpeta está vacía a propósito.

Lo que existe de mesas vive en otros lados:

- `src/modules/tables/lib/casa-antigua-table-bootstrap.ts` — alta inicial de mesas (demo/local).
- `src/modules/orders/features/add-table-order-items/` — agregar ítems a un pedido de mesa.
- `src/app/api/admin/tables/**` y `src/modules/orders/domain/order-workflows.ts` (flujo por tipo `table`).

**No reactivar** el pedido por QR en la navegación ni en las APIs públicas sin pedido explícito del
owner (ver `AGENTS.md` → Prohibiciones). Si se retoma, el módulo se crea completo (domain/ports/
adapters/features + tests) y se documenta acá; no dejar estructura vacía antes de eso.
