# Módulo `reservations` — **fuera del MVP**

Reservas de mesa: alta, disponibilidad por horario, seguimiento y estados. El código existe y tiene
tests, pero **no se ofrece en la UI ni en las APIs públicas** (ver `AGENTS.md` → Alcance).

```
domain/       reservation.types.ts · reservation-workflows.ts (transiciones) · reservation-overlap.ts
              reservation-business-hours.ts · reservation-tracking.ts · reservation-errors.ts
ports/        reservation-repository.ts
adapters/     prisma-reservation-repository.ts · in-memory-reservation-repository.ts
features/     create-reservation/ · check-availability/ · track-reservation/
              list-admin-reservations/ · get-admin-reservation/ · update-reservation-status/
```

Reglas a respetar si se retoma:

- **No se pueden superponer** dos reservas en la misma mesa y horario (`reservation-overlap.ts`).
- El horario se valida con `reservation-business-hours.ts`, que hoy tiene su propia lógica y por eso
  quedó **excluido** del contrato anti-hardcode de timezone (junto con `tables`, `table-ordering` e
  `inventory`). Si las reservas vuelven al MVP, ese horario debe pasar a la configuración editable del
  negocio y el módulo debe entrar en el contrato.
- El seguimiento usa token, igual que los pedidos (`reservation-tracking.ts`).
