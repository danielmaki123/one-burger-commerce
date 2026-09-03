import type {
  AdminSessionRecord,
  AdminUserRecord,
} from "@/modules/auth/domain/admin-auth.types";

export interface AdminAuthRepository {
  findUserByEmail(email: string): Promise<AdminUserRecord | null>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: AdminUserRecord["role"];
  }): Promise<AdminUserRecord>;
  listUsers(): Promise<AdminUserRecord[]>;
  createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AdminSessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}
