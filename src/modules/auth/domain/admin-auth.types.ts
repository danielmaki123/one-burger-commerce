import type { AdminRole } from "@/modules/auth/domain/admin-role";

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
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
  "id" | "name" | "email" | "role"
>;

