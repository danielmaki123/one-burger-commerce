# Módulo `customers`

Identidad del cliente: sesión por **OTP de WhatsApp** (código de un solo uso), sesión guardada en
cookie, y el alta/búsqueda del cliente por número.

```
domain/       customer-auth.types.ts · customer-auth-policy.ts (vigencia, intentos, reenvíos)
              customer-auth-errors.ts · mask-whatsapp.ts (nunca se muestra el número entero)
ports/        customer-auth-repository.ts · otp-sender.ts
adapters/     prisma-customer-auth-repository.ts · customer-session-cookie.ts
              dev-otp-sender.ts (solo local/demo: escribe el código en el log) — el de producción
              se inyecta desde la capa de composición
features/     request-otp/ · verify-otp/ · find-or-create-customer/ · get-customer-session/ ·
              logout-customer/
```

Reglas:

- La **política** (cuánto dura el código, cuántos intentos, cada cuánto se puede reenviar) está en
  `customer-auth-policy.ts`, no repartida en los casos de uso.
- El OTP y la sesión se guardan **hasheados**; el número se muestra enmascarado (`mask-whatsapp`).
- `dev-otp-sender` **solo** vale para local/demo; en producción el envío real se arma en la composición.
  Nunca loguear códigos en producción.

Ver `src/modules/orders/README.md` (historial y seguimiento del cliente) y `AGENTS.md`.
