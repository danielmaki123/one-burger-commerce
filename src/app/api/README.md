# `src/app/api`

**Capa de composición**: los route handlers validan la entrada con zod, resuelven sesión/permisos,
instancian los adaptadores (Prisma, envío de OTP, etc.) y llaman a un caso de uso del módulo. Acá no
va lógica de negocio: si una regla vive en un route, está en el lugar equivocado.

Los errores de dominio se traducen con `src/shared/lib/http/error-response.ts` (status + body), no con
un `try/catch` distinto por endpoint.

```
/api/menu · /api/locations            catálogo y locales (público, lectura)
/api/orders · /api/orders/[id] · /api/orders/track
/api/orders/[id]/items                agregar ítems a un pedido de mesa (fuera del MVP)
/api/coupons/validate                 estimación del descuento (el servidor decide al crear)
/api/auth/admin/** · /api/customer/auth/** · /api/customer/me
/api/admin/**                         panel: orders, menu, promotions, locations, users,
                                      business-settings, dashboard, overview, activity, reports
/api/health · /api/readiness          liveness y readiness (el contenedor y el CI dependen de esto)
/api/internal/outbox/process          procesa el outbox de notificaciones (protegido)
/api/internal/staging/**              seed/QA de staging: exige APP_ENV=staging y el header
                                      x-staging-seed-token; en producción responden 403
```

Advertencias:

- Siguen existiendo routes de módulos **fuera del MVP** (`admin/inventory/**`, `admin/reservations/**`,
  `admin/tables/**`, `admin/delivery-zones/**`): se conservan, pero **no** se ofrecen en la UI ni se
  agregan nuevos sin pedido explícito (`AGENTS.md` → Prohibiciones).
- `/api/health` es liveness y `/api/readiness` readiness: **no** cambiar su contrato sin revisar el
  Dockerfile, el CI y `ops/production-readiness.md`.
- Ningún route loguea secretos ni el OTP; los códigos de cliente solo se loguean en local (`dev-otp-sender`).
