# Módulo `inventory` — **fuera del MVP**

Stock, recepciones, conteos, mermas y alertas. El código existe y tiene tests, pero **no se ofrece en
la UI ni en las APIs públicas** (ver `AGENTS.md` → Alcance). No reactivarlo sin pedido explícito.

```
domain/       inventory.types.ts · inventory-errors.ts
ports/        inventory-repository.ts
adapters/     prisma-inventory-repository.ts · in-memory-inventory-repository.ts
features/     create-inventory-item/ · create-inventory-receive/ · create-inventory-count/ ·
              create-inventory-waste/ · list-inventory-items/ · list-inventory-movements/ ·
              list-inventory-alerts/ · shared/inventory-idempotency.ts
```

Reglas a respetar si se retoma:

- Todo movimiento es **idempotente** (`inventory-idempotency.ts`): reintentar la misma operación no
  puede descontar stock dos veces.
- El stock se mueve por **movimientos**, no por un número editable a mano: el total es una consecuencia.
