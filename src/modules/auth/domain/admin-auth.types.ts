import type { AdminRole } from "@/modules/auth/domain/admin-role";

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  /**
   * Sucursales asignadas (A). **Vacío significa "ve todas"**: el dueño y el usuario sin asignar
   * no quedan acotados, que es lo que mantiene la operación andando el día del deploy.
   */
  locationIds: string[];
};

export type AdminSessionRecord = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  userId: string;
  user: AdminUserRecord;
};

export type AuthenticatedAdminUser = Pick<
  AdminUserRecord,
  "id" | "name" | "email" | "role" | "locationIds"
>;

