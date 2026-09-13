import type {
  AdminUserRecord,
  AuthenticatedAdminUser,
} from "@/modules/auth/domain/admin-auth.types";

/**
 * La vista pública de un usuario del admin: lo que sale por la API y lo que viaja en la sesión.
 *
 * Es un `pick` explícito y no un spread a propósito: el `passwordHash` nunca puede salir por
 * accidente porque alguien agregue un campo al registro. Vivía copiado en cuatro casos de uso
 * (login, alta, listado y cambio de rol) y se desincronizaba cada vez que el registro crecía.
 */
export function toAuthenticatedAdminUser(user: AdminUserRecord): AuthenticatedAdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locationIds: user.locationIds,
  };
}
