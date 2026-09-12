# Módulo `auth`

Sesión y permisos del **panel**: login, logout, cookie de sesión, roles y usuarios del admin.

```
domain/       admin-role.ts · admin-permissions.ts (qué puede hacer cada rol) · session-cookie.ts
              admin-auth.types.ts · auth-errors.ts
ports/        admin-auth-repository.ts
adapters/     prisma-admin-auth-repository.ts · in-memory-admin-auth-repository.ts
features/     login-admin/ · logout-admin/ · get-admin-session/ · require-admin-session/
              create-admin-user/ · list-admin-users/ · update-admin-user-role/ · delete-admin-user/
```

Reglas:

- **El rol se resuelve en el servidor** con `admin-permissions`, y la autorización se aplica en las
  páginas y en las API del admin (`require-admin-session`), no con un `if` suelto en el cliente.
- El primer admin se crea en el **arranque del contenedor** con `BOOTSTRAP_ADMIN_*` (variables
  temporales: se borran después de usarlas; el CI prueba ese bootstrap).
- La contraseña se guarda hasheada; la sesión es una cookie **opaca** (`ob_admin_session`, 7 días,
  `session-cookie.ts`) que se valida contra la base: no hay JWT ni datos del usuario en el cliente.
- Hay **rate limit** en el login (`ADMIN_LOGIN_RATE_LIMIT`); no bajarlo en producción para probar.

Ver `AGENTS.md` (roles y prohibiciones) y `ops/production-readiness.md` (primer arranque).
