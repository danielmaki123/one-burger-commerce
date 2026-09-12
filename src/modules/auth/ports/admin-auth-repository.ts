import type {
  AdminSessionRecord,
  AdminUserRecord,
} from "@/modules/auth/domain/admin-auth.types";

export interface AdminAuthRepository {
  findUserByEmail(email: string): Promise<AdminUserRecord | null>;
  findUserById(id: string): Promise<AdminUserRecord | null>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: AdminUserRecord["role"];
  }): Promise<AdminUserRecord>;
  listUsers(): Promise<AdminUserRecord[]>;
  updateUserRole(
    id: string,
    role: AdminUserRecord["role"],
  ): Promise<AdminUserRecord>;
  /**
   * Reescribe el hash de la contraseña. Lo usa el login para actualizar un hash viejo
   * (o más débil) en el momento en que tiene la contraseña en claro: es la única forma
   * de subir el costo sin pedirle a nadie que cambie su contraseña.
   */
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AdminSessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}
